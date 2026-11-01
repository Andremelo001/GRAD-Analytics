import json
from pathlib import Path

import pytest

from app.modules.unidades.application.use_cases.build_unidades import (
    UnidadesVaziasError,
    build_unidades,
)
from app.modules.unidades.domain.schema import PaginaCursosSigaa
from app.modules.unidades.infrastructure.sources.sigaa_parser import (
    SigaaLayoutError,
    parse_lista_cursos,
)

_BASE = "https://si3.ufc.br/sigaa/public/curso/lista.jsf?nivel=G&aba=p-ensino"

# recorte da página real: título, descrição, filtro de modalidade, a tabela
# com duas unidades (uma com coordenador vazio) e entidades HTML nos nomes
_HTML = """
<h2 class="title">Consulta de Cursos -
GRADUA&#199;&#195;O</h2>
<div class="descricaoOperacao">
  <p>Atrav&#233;s desta p&#225;gina voc&#234; pode consultar os cursos.</p>
  <p>Utilize o formul&#225;rio abaixo.</p>
</div>
<form>
  <input type="hidden" name="nivel" value="G" />
  <table class="formulario"><tr><td>
    <select name="x">
      <option value="0" selected="selected">-- SELECIONE UMA MODALIDADE --</option>
      <option value="2">A Dist&acirc;ncia</option>
      <option value="1">Presencial</option>
    </select>
  </td></tr></table>
</form>
<table class="listagem">
  <thead><tr>
    <th>Nome</th><th>Sede</th><th>Modalidade</th><th>Coordenador</th><th></th>
  </tr></thead>
  <tbody>
    <tr><td colspan="5" class="subFormulario">
      PRG - PR&#211; - REITORIA DE GRADUA&#199;&#195;O
    </td></tr>
    <tr class="linhaPar">
      <td>CI&#202;NCIAS HUMANAS </td><td> FORTALEZA </td>
      <td>Presencial</td><td></td>
      <td><a href="portal.jsf?id=657482&lc=pt_BR"><img /></a></td>
    </tr>
    <tr><td colspan="5" class="subFormulario">
      CCA - CENTRO DE CI&#202;NCIAS AGR&#193;RIAS
    </td></tr>
    <tr class="linhaPar">
      <td>AGRONOMIA</td><td>FORTALEZA</td><td>Presencial</td><td>FULANO DE TAL</td>
      <td><a href="portal.jsf?id=10&lc=pt_BR"><img /></a></td>
    </tr>
    <tr class="linhaImpar">
      <td>ZOOTECNIA</td><td>FORTALEZA</td><td>Presencial</td><td>BELTRANO</td>
      <td><a href="portal.jsf?id=11&lc=pt_BR"><img /></a></td>
    </tr>
  </tbody>
</table>
"""


def test_parse_lista_cursos_keeps_every_field_of_the_page() -> None:
    pagina = parse_lista_cursos(_HTML, _BASE)

    assert pagina.titulo == "Consulta de Cursos - GRADUAÇÃO"
    assert pagina.descricao[0].startswith("Através desta página")
    assert pagina.nivel == "G"
    assert pagina.modalidades_filtro == ["A Distância", "Presencial"]
    assert pagina.colunas == ["Nome", "Sede", "Modalidade", "Coordenador"]
    assert [c.rotulo for c in pagina.unidades] == [
        "PRG - PRÓ - REITORIA DE GRADUAÇÃO",
        "CCA - CENTRO DE CIÊNCIAS AGRÁRIAS",
    ]
    prg, cca = pagina.unidades
    assert (prg.sigla, prg.nome) == ("PRG", "PRÓ - REITORIA DE GRADUAÇÃO")
    assert cca.sedes == ["FORTALEZA"]
    assert cca.total_cursos == 2
    assert pagina.total_cursos == 3
    curso = prg.cursos[0]
    assert curso.nome == "CIÊNCIAS HUMANAS"
    assert curso.sede == "FORTALEZA"
    assert curso.modalidade == "Presencial"
    assert curso.coordenador is None
    assert curso.id_sigaa == 657482
    assert curso.url_portal == (
        "https://si3.ufc.br/sigaa/public/curso/portal.jsf?id=657482&lc=pt_BR"
    )


def test_parse_lista_cursos_without_table_raises() -> None:
    with pytest.raises(SigaaLayoutError):
        parse_lista_cursos("<html><body>manutenção</body></html>", _BASE)


class _FakeSource:
    url = _BASE

    def __init__(self, html: str) -> None:
        self._html = html

    def collect(self) -> PaginaCursosSigaa:
        return parse_lista_cursos(self._html, self.url)


def test_build_unidades_writes_the_whole_page(tmp_path: Path) -> None:
    out = build_unidades(source=_FakeSource(_HTML), out_file=tmp_path / "unidades.json")

    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["fonte"] == _BASE
    assert data["total_unidades"] == 2
    assert data["total_cursos"] == 3
    assert data["titulo"] == "Consulta de Cursos - GRADUAÇÃO"
    assert data["unidades"][1]["cursos"][0]["coordenador"] == "FULANO DE TAL"


def test_build_unidades_keeps_previous_file_when_page_is_empty(tmp_path: Path) -> None:
    vazia = '<table class="listagem"><thead><tr><th>Nome</th><th>Sede</th></tr>'
    vazia += "</thead><tbody></tbody></table>"
    out_file = tmp_path / "unidades.json"
    out_file.write_text('{"anterior": true}', encoding="utf-8")

    with pytest.raises(UnidadesVaziasError):
        build_unidades(source=_FakeSource(vazia), out_file=out_file)
    assert json.loads(out_file.read_text(encoding="utf-8")) == {"anterior": True}
