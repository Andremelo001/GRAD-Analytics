"""Casamento curso do INEP -> unidade da UFC (lista de cursos do SIGAA).

O INEP só diz o município do curso; a unidade (centro, faculdade, instituto
ou campus do interior) vem de ``unidades_ufc.json``, a lista de cursos do SIGAA.
Como o SIGAA não tem o código e-MEC, o casamento é pelo nome do curso
normalizado, na mesma sede e modalidade, com o grau de desempate. Para
agrupar basta a unidade: dois cursos do SIGAA com o mesmo nome na mesma
unidade (turnos, "DIREITO (DIURNO)" / "(NOTURNO)") não são ambiguidade.
``unidades_ufc_ajustes.json`` resolve o que o nome não resolve.
"""

import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field

_TURNO_OU_GRAU = re.compile(
    r"\((?:DIURNO|NOTURNO|VESPERTINO-NOTURNO|LICENCIATURA|BACHARELADO)\)"
)
_GRAU_SUFIXO = re.compile(r"\s*-\s*(?:BACHARELADO|LICENCIATURA)\b")
_PREFIXO = re.compile(
    r"^(?:(?:LICENCIATURA|BACHARELADO|TECNOLOGIA) EM |COMUNICACAO SOCIAL - )"
)


@dataclass(frozen=True, slots=True)
class CursoSigaa:
    nome: str
    sede: str
    modalidade: str | None


@dataclass(frozen=True, slots=True)
class UnidadeSigaa:
    """Uma unidade de ``unidades_ufc.json``: ``rotulo`` é o texto do SIGAA."""

    sigla: str
    rotulo: str
    cursos: tuple[CursoSigaa, ...]


@dataclass(frozen=True, slots=True)
class CursoInep:
    """O que o INEP diz de um curso da IES, para casar com o SIGAA.

    ``ead``: ``None`` quando a modalidade não é conhecida (não filtra).
    """

    codigo_curso: int
    nome: str
    municipio: str | None
    ead: bool | None
    grau: str | None


@dataclass(frozen=True, slots=True)
class AjustesUnidades:
    """``unidades_ufc_ajustes.json``: curso -> sigla fixada e unidades ignoradas."""

    cursos: Mapping[int, str] = field(default_factory=dict)
    unidades_ignoradas: frozenset[str] = frozenset()


def parse_unidades(raw: Mapping[str, object]) -> list[UnidadeSigaa]:
    """``unidades_ufc.json`` (já lido) -> unidades. Arquivo vazio -> lista vazia."""
    unidades = raw.get("unidades")
    if not isinstance(unidades, list):
        return []
    out = []
    for unidade in unidades:
        if not isinstance(unidade, dict) or not unidade.get("sigla"):
            continue
        cursos = tuple(
            CursoSigaa(
                nome=str(c.get("nome") or ""),
                sede=str(c.get("sede") or ""),
                modalidade=c.get("modalidade"),
            )
            for c in unidade.get("cursos") or []
            if isinstance(c, dict)
        )
        out.append(
            UnidadeSigaa(
                sigla=str(unidade["sigla"]),
                rotulo=str(unidade.get("rotulo") or unidade["sigla"]),
                cursos=cursos,
            )
        )
    return out


def parse_ajustes(raw: Mapping[str, object]) -> AjustesUnidades:
    """``unidades_ufc_ajustes.json`` (já lido) -> ajustes. Chaves ``_*`` são notas."""
    cursos_raw = raw.get("cursos")
    cursos: dict[int, str] = {}
    if isinstance(cursos_raw, dict):
        for codigo, ajuste in cursos_raw.items():
            sigla = ajuste.get("unidade") if isinstance(ajuste, dict) else ajuste
            if str(codigo).isdigit() and isinstance(sigla, str) and sigla:
                cursos[int(codigo)] = sigla
    ignorados = raw.get("unidades_ignoradas")
    return AjustesUnidades(
        cursos=cursos,
        unidades_ignoradas=(
            frozenset(str(s) for s in ignorados)
            if isinstance(ignorados, dict | list)
            else frozenset()
        ),
    )


def problemas_ajustes(
    unidades: Sequence[UnidadeSigaa], ajustes: AjustesUnidades
) -> list[str]:
    """Siglas dos ajustes que não existem em ``unidades_ufc.json`` (erro de edição)."""
    siglas = {c.sigla for c in unidades}
    problemas = [
        f"curso {codigo} -> unidade {sigla!r} inexistente"
        for codigo, sigla in sorted(ajustes.cursos.items())
        if sigla not in siglas
    ]
    problemas += [
        f"unidade ignorada {sigla!r} inexistente"
        for sigla in sorted(ajustes.unidades_ignoradas - siglas)
    ]
    return problemas


def match_unidade(
    curso: CursoInep, unidades: Sequence[UnidadeSigaa], ajustes: AjustesUnidades
) -> str | None:
    """Sigla da unidade do curso, ou ``None`` se não houver uma unidade só.

    Ordem: ajuste manual; nome igual (normalizado) na mesma sede e
    modalidade; nome do SIGAA que começa com o do INEP ("LICENCIATURA
    INTERCULTURAL INDÍGENA" -> "... KUABA"). Se sobrar mais de uma unidade, o
    grau escrito no nome do SIGAA desempata.
    """
    siglas_validas = {c.sigla for c in unidades}
    fixado = ajustes.cursos.get(curso.codigo_curso)
    if fixado in siglas_validas:
        return fixado

    sede = _ascii_upper(curso.municipio) if curso.municipio else None
    pool = [
        (unidade.sigla, sigaa)
        for unidade in unidades
        if unidade.sigla not in ajustes.unidades_ignoradas
        for sigaa in unidade.cursos
        if (sede is None or _ascii_upper(sigaa.sede) == sede)
        and (curso.ead is None or is_ead(sigaa.modalidade) == curso.ead)
    ]
    chave = chave_nome(curso.nome)
    chaves = [
        (sigla, sigaa, chave_nome(sigaa.nome, sigaa.sede)) for sigla, sigaa in pool
    ]
    candidatos = [(s, c) for s, c, k in chaves if k == chave] or [
        (s, c) for s, c, k in chaves if k.startswith(chave + " ")
    ]
    siglas = {s for s, _ in candidatos}
    if len(siglas) > 1 and curso.grau:
        mesmo_grau = {s for s, c in candidatos if _grau(c.nome) == curso.grau}
        siglas = mesmo_grau or siglas
    return next(iter(siglas)) if len(siglas) == 1 else None


def chave_nome(nome: str, sede: str | None = None) -> str:
    """Nome de curso -> chave de comparação, sem turno, grau nem pontuação.

    "EDUCAÇÃO FÍSICA - BACHARELADO (DIURNO)" -> "EDUCACAO FISICA";
    "MEDICINA - SOBRAL" (sede SOBRAL) -> "MEDICINA";
    "PSICOLOGIA/CCGPSIC - SOBRAL" -> "PSICOLOGIA";
    "TECNOLOGIA EM GESTÃO DA QUALIDADE" -> "GESTAO DA QUALIDADE";
    "LETRAS - LÍNGUA PORTUGUESA" -> "LETRAS PORTUGUES".
    """
    texto = _ascii_upper(nome).split("/")[0]
    texto = _TURNO_OU_GRAU.sub(" ", texto)
    texto = _GRAU_SUFIXO.sub(" ", texto)
    texto = " ".join(texto.split())
    if sede:
        texto = re.sub(rf"\s-\s{re.escape(_ascii_upper(sede))}$", "", texto)
    texto = _PREFIXO.sub("", texto)
    texto = re.sub(r"\bLINGUA PORTUGUESA\b", "PORTUGUES", texto)
    return " ".join(re.sub(r"[^A-Z]+", " ", texto).split())


def _grau(nome: str) -> str | None:
    texto = _ascii_upper(nome)
    if "BACHARELADO" in texto:
        return "Bacharelado"
    if "LICENCIATURA" in texto:
        return "Licenciatura"
    return None


def is_ead(modalidade: str | None) -> bool:
    """EaD: "A Distância" (SIGAA), "Curso a distância"/"Educação a Distância"."""
    return modalidade is not None and "DISTANCIA" in _ascii_upper(modalidade)


def _ascii_upper(texto: str) -> str:
    sem_acento = (
        unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode("ascii")
    )
    return " ".join(sem_acento.upper().split())
