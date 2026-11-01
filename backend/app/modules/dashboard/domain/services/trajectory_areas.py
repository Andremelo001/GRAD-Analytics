from typing import Any

import pandas as pd

from app.modules.dashboard.domain.services import course_profile, quality_areas
from app.modules.dashboard.domain.services.national_benchmarks import UF_SIGLAS
from app.modules.dashboard.domain.shared import ScopedData, slugify

# Colunas de cada linha de ``cursos`` no JSON de uma área CINE (formato
# colunar, como o das áreas de avaliação da Qualidade).
COLUNAS: tuple[str, ...] = (
    "codigo_curso",
    "codigo_ies",
    "codigo_municipio",
    "grau_academico",
    "ead",
    "prazo_integralizacao",
    "ano_ingresso",
    "ingressantes",
    # ``[anos desde o ingresso, % cursando, % concluiu, % desistiu]`` por ano
    "curva",
    # as outras turmas maduras do curso, da mais antiga à mais recente, cada
    # uma ``[ano_ingresso, prazo, ingressantes, curva]`` (o seletor de turma
    # das Comparações da Trajetória); a mais recente é a das colunas acima
    "turmas_anteriores",
    # as turmas ainda não maduras (em andamento), no mesmo formato
    "turmas_em_andamento",
)


def areas_das_unidades(unidades: list[ScopedData]) -> list[str]:
    """Áreas CINE (o curso em si) dos cursos das unidades com trajetória."""
    areas: set[str] = set()
    for data in unidades:
        if data.trajetoria.empty:
            continue
        areas.update(data.trajetoria["nome_cine_area_geral"].dropna().astype(str))
    return sorted(areas)


def area_slug(area: str) -> str:
    return slugify(area)


def nomes_da_qualidade(
    qualidade_nacional: pd.DataFrame,
) -> tuple[dict[int, str | None], dict[int, str | None]]:
    """Sigla de cada IES e nome de cada município, da Qualidade.

    A trajetória só traz os códigos; calculados uma vez pra todas as áreas.
    """
    if qualidade_nacional.empty:
        return {}, {}
    siglas = {
        int(codigo): quality_areas.sigla_ies(grupo)
        for codigo, grupo in qualidade_nacional.groupby("codigo_ies")
    }
    municipios = {
        int(codigo): quality_areas.texto_mais_comum(grupo, "municipio_curso")
        for codigo, grupo in qualidade_nacional.groupby("codigo_municipio")
    }
    return siglas, municipios


def build_area(
    trajetoria_nacional: pd.DataFrame,
    nomes: tuple[dict[int, str | None], dict[int, str | None]],
    area: str,
    codigo_ies_destaque: int,
) -> dict[str, object] | None:
    """As turmas maduras de cada curso do Brasil numa área CINE.

    Uma linha por curso, com a turma madura mais recente — a que já foi
    acompanhada até dois anos depois do prazo (``course_profile.turma_madura``)
    —, ingressantes e a curva ano a ano; em ``turmas_anteriores``, as outras
    turmas maduras, no mesmo formato. O front compara um curso da UFC com
    qualquer curso da mesma área ("Entre cursos da mesma área", na Trajetória,
    com o seletor de turma). A sigla da IES e o nome do município vêm de
    ``nomes_da_qualidade``. ``None`` se nenhum curso da área tem turma madura.
    """
    area_df = trajetoria_nacional[trajetoria_nacional["nome_cine_area_geral"] == area]
    if area_df.empty:
        return None
    area_df = area_df.dropna(
        subset=[
            "taxa_permanencia",
            "taxa_conclusao_acumulada",
            "taxa_desistencia_acumulada",
        ]
    )
    # as linhas de cada turma, agrupadas por curso numa passada só (agrupar e
    # ordenar com o pandas turma a turma levava minutos nas áreas grandes)
    linhas_maduras = _turmas_maduras(area_df)
    maduras = _por_curso_e_turma(linhas_maduras)
    andamento = _por_curso_e_turma(_turmas_em_andamento(area_df, linhas_maduras))
    cursos: list[list[object]] = []
    for codigo in sorted(maduras):
        # cada turma madura do curso, da mais antiga à mais recente
        por_ano = [maduras[codigo][ano] for ano in sorted(maduras[codigo])]
        em_andamento = [
            andamento[codigo][ano] for ano in sorted(andamento.get(codigo, {}))
        ]
        recente = por_ano[-1]
        primeira = recente[0]
        modalidade = str(getattr(primeira, "tp_modalidade_ensino_desc", "") or "")
        grau = getattr(primeira, "tp_grau_academico_desc", None)
        ano, prazo, ingressantes, curva = _turma(recente)
        cursos.append(
            [
                _codigo(codigo),
                int(primeira.codigo_ies),
                _codigo(primeira.codigo_municipio),
                None if pd.isna(grau) else str(grau),
                "dist" in modalidade.lower(),
                prazo,
                ano,
                ingressantes,
                curva,
                [_turma(t) for t in por_ano[:-1]],
                [_turma(t) for t in em_andamento],
            ]
        )
    if not cursos:
        return None

    codigos_ies = {linha[1] for linha in cursos}
    codigos_mun = {linha[2] for linha in cursos if linha[2] is not None}
    siglas, nomes_municipios = nomes
    ies: dict[str, list[object]] = {}
    for codigo, grupo in area_df[area_df["codigo_ies"].isin(codigos_ies)].groupby(
        "codigo_ies"
    ):
        ies[str(_codigo(codigo))] = [
            quality_areas.texto_mais_comum(grupo, "nome_ies"),
            siglas.get(int(str(codigo).split(".")[0])),
            quality_areas.rede_publica(
                quality_areas.texto_mais_comum(
                    grupo, "tp_categoria_administrativa_desc"
                )
            ),
        ]
    municipios: dict[str, list[object]] = {}
    for codigo, grupo in area_df[area_df["codigo_municipio"].isin(codigos_mun)].groupby(
        "codigo_municipio"
    ):
        uf = grupo["codigo_uf"].dropna()
        municipios[str(_codigo(codigo))] = [
            nomes_municipios.get(int(str(codigo).split(".")[0])),
            UF_SIGLAS.get(int(uf.iloc[0])) if not uf.empty else None,
        ]

    return {
        "area": area,
        "codigo_ies_destaque": codigo_ies_destaque,
        "colunas": list(COLUNAS),
        "cursos": cursos,
        "ies": ies,
        "municipios": municipios,
    }


def _por_curso_e_turma(frame: pd.DataFrame) -> dict[Any, dict[Any, list[Any]]]:
    """As linhas de cada turma, agrupadas por curso e ano de ingresso.

    Uma ordenação e uma passada só pelas linhas (em ordem de ano de
    referência dentro de cada turma), em vez de agrupar e ordenar com o pandas
    turma a turma.
    """
    if frame.empty:
        return {}
    ordenado = frame.sort_values(
        ["codigo_curso", "ano_ingresso", "ano_referencia"], kind="stable"
    )
    grupos: dict[Any, dict[Any, list[Any]]] = {}
    for linha in ordenado.itertuples(index=False):
        grupos.setdefault(linha.codigo_curso, {}).setdefault(
            linha.ano_ingresso, []
        ).append(linha)
    return grupos


def _turma(linhas: list[Any]) -> list[object]:
    """Uma turma: ``[ano_ingresso, prazo, ingressantes, curva]``.

    As linhas vêm em ordem de ano; a curva é ``[anos, % cursando, % concluiu,
    % desistiu]`` por ano acompanhado.
    """
    primeira = linhas[0]
    ingressantes: Any = getattr(primeira, "qt_ingressante", None)
    return [
        _codigo(primeira.ano_ingresso),
        int(primeira.prazo_integralizacao),
        None if ingressantes is None or pd.isna(ingressantes) else int(ingressantes),
        [
            [
                int(linha.ano_referencia - linha.ano_ingresso),
                round(float(linha.taxa_permanencia), 1),
                round(float(linha.taxa_conclusao_acumulada), 1),
                round(float(linha.taxa_desistencia_acumulada), 1),
            ]
            for linha in linhas
        ],
    ]


def _turmas_em_andamento(area_df: pd.DataFrame, maduras: pd.DataFrame) -> pd.DataFrame:
    """As linhas das turmas ainda não maduras dos cursos que têm turma madura.

    Curso sem turma madura nenhuma (novo) fica de fora do arquivo da área.
    """
    if maduras.empty or "prazo_integralizacao" not in area_df.columns:
        return area_df.iloc[0:0]
    frame = area_df.dropna(subset=["prazo_integralizacao"])
    frame = frame[frame["codigo_curso"].isin(maduras["codigo_curso"].unique())]
    chave = ["codigo_curso", "ano_ingresso"]
    ja = maduras[chave].drop_duplicates().assign(_madura=True)
    marcado = frame.merge(ja, on=chave, how="left")
    return marcado[marcado["_madura"].isna()].drop(columns="_madura")


def _codigo(value: object) -> int | None:
    """Código numérico (município de curso EaD pode vir vazio)."""
    return None if pd.isna(value) else int(str(value).split(".")[0])


def _turmas_maduras(area_df: pd.DataFrame) -> pd.DataFrame:
    """As linhas de todas as turmas maduras de cada curso.

    A mesma regra de ``course_profile.turmas_maduras``, de uma vez pra área.
    """
    if "prazo_integralizacao" not in area_df.columns:
        return area_df.iloc[0:0]
    frame = area_df.dropna(subset=["prazo_integralizacao"])
    if frame.empty:
        return frame
    chave = ["codigo_curso", "ano_ingresso"]
    por_turma = (
        frame.assign(anos=frame["ano_referencia"] - frame["ano_ingresso"])
        .groupby(chave, as_index=False)
        .agg(anos=("anos", "max"), prazo=("prazo_integralizacao", "first"))
    )
    maduras = por_turma.loc[
        por_turma["anos"] >= por_turma["prazo"] + course_profile.ANOS_ALEM_DO_PRAZO - 1,
        chave,
    ]
    return frame.merge(maduras, on=chave)
