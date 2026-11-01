import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from bs4.element import Tag

from app.modules.unidades.domain.schema import (
    CursoSigaa,
    PaginaCursosSigaa,
    UnidadeSigaa,
)

_ID_RE = re.compile(r"[?&]id=(\d+)")


class SigaaLayoutError(ValueError):
    """A página do SIGAA não tem mais a tabela de cursos no formato esperado."""


def parse_lista_cursos(html: str, base_url: str) -> PaginaCursosSigaa:
    """Estrutura a página "Consulta de Cursos" do SIGAA.

    A tabela ``listagem`` alterna uma linha de título (``td.subFormulario``:
    a unidade) com as linhas dos cursos dela. As colunas são lidas pelo
    cabeçalho, não pela posição: o SIGAA só mostra Modalidade/Coordenador em
    alguns níveis.
    """
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table", class_="listagem")
    if not isinstance(table, Tag) or not isinstance(table.tbody, Tag):
        msg = "tabela 'listagem' não encontrada na página de cursos do SIGAA"
        raise SigaaLayoutError(msg)

    colunas = [_text(th) for th in table.select("thead th")]
    indice = {nome.lower(): i for i, nome in enumerate(colunas) if nome}
    if "nome" not in indice or "sede" not in indice:
        msg = f"cabeçalho inesperado na tabela de cursos do SIGAA: {colunas}"
        raise SigaaLayoutError(msg)

    unidades: list[UnidadeSigaa] = []
    rotulo: str | None = None
    cursos: list[CursoSigaa] = []
    for tr in table.tbody.find_all("tr", recursive=False):
        titulo = tr.find("td", class_="subFormulario")
        if isinstance(titulo, Tag):
            if rotulo is not None:
                unidades.append(_unidade(rotulo, cursos))
            rotulo, cursos = _text(titulo), []
            continue
        tds = tr.find_all("td", recursive=False)
        if len(tds) < len(indice) or rotulo is None:
            continue
        cursos.append(_curso(tds, indice, base_url))
    if rotulo is not None:
        unidades.append(_unidade(rotulo, cursos))

    return PaginaCursosSigaa(
        titulo=_titulo(soup),
        descricao=[
            _text(p)
            for p in soup.select("div.descricaoOperacao p")
            if isinstance(p, Tag) and _text(p)
        ],
        nivel=_nivel(soup),
        modalidades_filtro=_modalidades(soup),
        colunas=[c for c in colunas if c],
        unidades=unidades,
    )


def _curso(tds: list[Tag], indice: dict[str, int], base_url: str) -> CursoSigaa:
    def coluna(nome: str) -> str | None:
        i = indice.get(nome)
        valor = _text(tds[i]) if i is not None and i < len(tds) else ""
        return valor or None

    link = next(
        (
            a
            for td in tds
            for a in td.find_all("a", href=True)
            if isinstance(a, Tag) and "portal.jsf" in str(a.get("href"))
        ),
        None,
    )
    href = str(link.get("href")) if link is not None else None
    match = _ID_RE.search(href) if href else None
    return CursoSigaa(
        nome=coluna("nome") or "",
        sede=coluna("sede") or "",
        modalidade=coluna("modalidade"),
        coordenador=coluna("coordenador"),
        id_sigaa=int(match.group(1)) if match else None,
        url_portal=urljoin(base_url, href) if href else None,
    )


def _unidade(rotulo: str, cursos: list[CursoSigaa]) -> UnidadeSigaa:
    """Rótulo -> sigla + nome: "PRG - PRÓ - REITORIA..." -> "PRG" e o resto."""
    sigla, _, nome = rotulo.partition(" - ")
    sedes = list(dict.fromkeys(c.sede for c in cursos if c.sede))
    return UnidadeSigaa(
        rotulo=rotulo,
        sigla=sigla.strip(),
        nome=nome.strip() or rotulo,
        sedes=sedes,
        total_cursos=len(cursos),
        cursos=cursos,
    )


def _titulo(soup: BeautifulSoup) -> str | None:
    h2 = soup.find("h2", class_="title")
    return _text(h2) if isinstance(h2, Tag) else None


def _nivel(soup: BeautifulSoup) -> str | None:
    campo = soup.find("input", attrs={"name": "nivel"})
    valor = campo.get("value") if isinstance(campo, Tag) else None
    return valor.strip() if isinstance(valor, str) and valor.strip() else None


def _modalidades(soup: BeautifulSoup) -> list[str]:
    """Opções do filtro "Modalidade de Ensino" (sem o "-- SELECIONE --")."""
    opcoes: list[str] = []
    for select in soup.select("table.formulario select"):
        for option in select.find_all("option"):
            if not isinstance(option, Tag) or option.get("value") in (None, "0"):
                continue
            opcoes.append(_text(option))
    return opcoes


def _text(tag: Tag) -> str:
    return " ".join(tag.get_text(" ").split())
