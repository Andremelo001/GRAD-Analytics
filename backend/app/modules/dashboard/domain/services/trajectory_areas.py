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
)


def areas_dos_campi(campi: list[ScopedData]) -> list[str]:
    """Áreas CINE (o curso em si) dos cursos dos campi com trajetória."""
    areas: set[str] = set()
    for data in campi:
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
        int(codigo): quality_areas.texto_mais_comum(grupo, "sigla_ies")
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
    """A turma madura de cada curso do Brasil numa área CINE.

    A mais recente que já foi acompanhada até dois anos depois do prazo
    (``course_profile.turma_madura``), com ingressantes e a curva ano a ano:
    o front compara um curso da UFC com qualquer curso da mesma área
    ("Entre cursos da mesma área", na Trajetória). A sigla da IES e o nome do
    município vêm de ``nomes_da_qualidade``. ``None`` se nenhum curso da área
    tem turma madura.
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
    turmas = _turmas_maduras(area_df)
    cursos: list[list[object]] = []
    for (codigo, ano), grupo in turmas.groupby(["codigo_curso", "ano_ingresso"]):
        turma = grupo.sort_values("ano_referencia")
        primeira = turma.iloc[0]
        ingressantes = primeira.get("qt_ingressante")
        modalidade = str(primeira.get("tp_modalidade_ensino_desc") or "")
        grau = primeira.get("tp_grau_academico_desc")
        anos = (turma["ano_referencia"] - turma["ano_ingresso"]).astype(int)
        cursos.append(
            [
                _codigo(codigo),
                int(primeira["codigo_ies"]),
                _codigo(primeira["codigo_municipio"]),
                None if pd.isna(grau) else str(grau),
                "dist" in modalidade.lower(),
                int(primeira["prazo_integralizacao"]),
                _codigo(ano),
                None if pd.isna(ingressantes) else int(ingressantes),
                [
                    [
                        int(a),
                        round(float(tp), 1),
                        round(float(tc), 1),
                        round(float(td), 1),
                    ]
                    for a, tp, tc, td in zip(
                        anos,
                        turma["taxa_permanencia"],
                        turma["taxa_conclusao_acumulada"],
                        turma["taxa_desistencia_acumulada"],
                        strict=True,
                    )
                ],
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


def _codigo(value: object) -> int | None:
    """Código numérico (município de curso EaD pode vir vazio)."""
    return None if pd.isna(value) else int(str(value).split(".")[0])


def _turmas_maduras(area_df: pd.DataFrame) -> pd.DataFrame:
    """As linhas da turma madura mais recente de cada curso.

    A mesma regra de ``course_profile.turma_madura``, de uma vez pra área.
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
    maduras = por_turma[
        por_turma["anos"] >= por_turma["prazo"] + course_profile.ANOS_ALEM_DO_PRAZO - 1
    ]
    ultimas = maduras.loc[
        maduras.groupby("codigo_curso")["ano_ingresso"].idxmax(), chave
    ]
    return frame.merge(ultimas, on=chave)
