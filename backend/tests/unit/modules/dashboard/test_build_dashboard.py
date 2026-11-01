import json
from pathlib import Path

import pandas as pd
import pytest

from app.core.config.settings import settings
from app.modules.dashboard.application.use_cases.build_dashboard import build_dashboard


class _FakeSource:
    def __init__(
        self,
        qualidade: pd.DataFrame,
        trajetoria: pd.DataFrame,
        unidades: dict[str, object] | None = None,
    ) -> None:
        self._qualidade = qualidade
        self._trajetoria = trajetoria
        self._unidades = unidades or {}

    def read_qualidade(self) -> pd.DataFrame:
        return self._qualidade

    def read_trajetoria(self) -> pd.DataFrame:
        return self._trajetoria

    def read_meta(self) -> dict[str, object]:
        return {"qualidade": {"generated_at": "2026-01-01T00:00:00", "rows": 4}}

    def read_unidades(self) -> dict[str, object]:
        return self._unidades

    def read_unidades_ajustes(self) -> dict[str, object]:
        return {}


@pytest.fixture
def source(qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame) -> _FakeSource:
    # mesma IES (1) em um segundo município (200), com nome pra virar slug
    segundo = trajetoria_raw[trajetoria_raw["codigo_curso"] == 30].assign(
        codigo_municipio=200, codigo_curso=31
    )
    qualidade = qualidade_raw.assign(municipio_curso="Cidade Um")
    return _FakeSource(qualidade, pd.concat([trajetoria_raw, segundo]))


@pytest.fixture(autouse=True)
def _ies(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dashboard_codigo_ies", 1)


def test_writes_one_json_per_unidade_plus_index(
    source: _FakeSource, tmp_path: Path
) -> None:
    out = build_dashboard(source=source, out_dir=tmp_path)

    assert out == tmp_path
    assert sorted(p.name for p in tmp_path.glob("*.json")) == [
        "200.json",
        "cidade-um.json",
        "index.json",
        "resumo_unidades.json",
    ]
    index = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert [c["slug"] for c in index["unidades"]] == ["cidade-um", "200"]
    assert index["unidades"][0]["nome"] == "UFT em Cidade Um"
    assert index["unidades"][0]["total_cursos"] == 3


def test_each_unidade_json_keeps_the_same_structure(
    source: _FakeSource, tmp_path: Path
) -> None:
    build_dashboard(source=source, out_dir=tmp_path)

    um = json.loads((tmp_path / "cidade-um.json").read_text(encoding="utf-8"))
    dois = json.loads((tmp_path / "200.json").read_text(encoding="utf-8"))
    assert list(um) == list(dois)
    assert um["escopo"]["codigo_municipio"] == 100
    assert dois["escopo"]["codigo_municipio"] == 200
    assert [c["codigo_curso"] for c in dois["cursos"]] == [31]
    assert um["fontes"]["qualidade"]["linhas"] == 4


def test_removes_json_of_unidade_no_longer_present(
    source: _FakeSource, tmp_path: Path
) -> None:
    (tmp_path / "unidade-extinta.json").write_text("{}", encoding="utf-8")
    build_dashboard(source=source, out_dir=tmp_path)
    assert not (tmp_path / "unidade-extinta.json").exists()


def test_writes_one_json_per_quality_area_plus_index(
    source: _FakeSource, tmp_path: Path
) -> None:
    areas_dir = tmp_path / "areas_qualidade"
    areas_dir.mkdir()
    (areas_dir / "area-extinta.json").write_text("{}", encoding="utf-8")
    build_dashboard(source=source, out_dir=tmp_path)

    # áreas da avaliação mais recente dos cursos da unidade (a outra IES fica de fora)
    assert sorted(p.name for p in areas_dir.glob("*.json")) == [
        "ciencia-da-computacao.json",
        "curso-so-qualidade.json",
        "index.json",
    ]
    index = json.loads((areas_dir / "index.json").read_text(encoding="utf-8"))
    cc = next(a for a in index["areas"] if a["slug"] == "ciencia-da-computacao")
    assert cc == {
        "slug": "ciencia-da-computacao",
        "area_avaliacao": "Ciência da Computação",
        "ano": 2019,
        "total_cursos": 1,
        "arquivo": "ciencia-da-computacao.json",
    }


def test_writes_summary_of_every_unidade(source: _FakeSource, tmp_path: Path) -> None:
    build_dashboard(source=source, out_dir=tmp_path)
    resumo = json.loads((tmp_path / "resumo_unidades.json").read_text(encoding="utf-8"))
    assert [c["slug"] for c in resumo["unidades"]] == ["cidade-um", "200"]
    cursos = {c["codigo_curso"]: c for c in resumo["unidades"][0]["cursos"]}
    assert cursos[10]["area_avaliacao"] == "Ciência da Computação"
    assert cursos[10]["ano"] == 2019
    assert cursos[10]["cpc_faixa"] == "4"
    assert cursos[10]["idd"] == 4.0
    assert cursos[10]["taxa_desistencia_acumulada"] == 0.0
    assert cursos[30]["cpc_continuo"] is None  # só trajetória
    assert cursos[10]["notas"]["formacao_geral"] == 4.0  # avaliação de 2019
    assert [h["ano"] for h in cursos[10]["historico"]] == [2017, 2019]
    assert cursos[10]["historico"][0]["cpc_continuo"] == 3.1
    assert cursos[30]["notas"] is None
    assert cursos[30]["historico"] == []


def test_splits_by_sigaa_unidade_when_unidades_file_present(
    source: _FakeSource, tmp_path: Path
) -> None:
    # curso 10 (Ciência da Computação) casa com o "CC"; 20 e 30 não estão no
    # SIGAA e ficam no recorte da cidade
    unidades = {
        "unidades": [
            {
                "sigla": "CC",
                "rotulo": "CC - CENTRO DE CIÊNCIAS",
                "cursos": [
                    {
                        "nome": "CIÊNCIA DA COMPUTAÇÃO",
                        "sede": "CIDADE UM",
                        "modalidade": "Presencial",
                    }
                ],
            }
        ]
    }
    com_sigaa = _FakeSource(source._qualidade, source._trajetoria, unidades)
    build_dashboard(source=com_sigaa, out_dir=tmp_path)

    index = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert [(c["slug"], c["sigla"]) for c in index["unidades"]] == [
        ("cc", "CC"),
        ("cidade-um", None),
        ("200", None),
    ]
    assert index["unidades"][0]["nome"] == "CC - CENTRO DE CIÊNCIAS"
    assert index["unidades"][0]["localidade"] == "Cidade Um"
    cc = json.loads((tmp_path / "cc.json").read_text(encoding="utf-8"))
    assert [c["codigo_curso"] for c in cc["cursos"]] == [10]
    assert cc["escopo"]["unidade"] == "CC - CENTRO DE CIÊNCIAS"
    assert cc["escopo"]["municipio"] == "UFT em Cidade Um"
    cidade = json.loads((tmp_path / "cidade-um.json").read_text(encoding="utf-8"))
    assert [c["codigo_curso"] for c in cidade["cursos"]] == [20, 30]
