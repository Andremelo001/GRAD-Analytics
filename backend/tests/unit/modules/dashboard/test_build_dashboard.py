import json
from pathlib import Path

import pandas as pd
import pytest

from app.core.config.settings import settings
from app.modules.dashboard.application.use_cases.build_dashboard import build_dashboard


class _FakeSource:
    def __init__(self, qualidade: pd.DataFrame, trajetoria: pd.DataFrame) -> None:
        self._qualidade = qualidade
        self._trajetoria = trajetoria

    def read_qualidade(self) -> pd.DataFrame:
        return self._qualidade

    def read_trajetoria(self) -> pd.DataFrame:
        return self._trajetoria

    def read_meta(self) -> dict[str, object]:
        return {"qualidade": {"generated_at": "2026-01-01T00:00:00", "rows": 4}}


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


def test_writes_one_json_per_campus_plus_index(
    source: _FakeSource, tmp_path: Path
) -> None:
    out = build_dashboard(source=source, out_dir=tmp_path)

    assert out == tmp_path
    assert sorted(p.name for p in tmp_path.glob("*.json")) == [
        "200.json",
        "cidade-um.json",
        "index.json",
        "resumo_campi.json",
    ]
    index = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert [c["slug"] for c in index["campi"]] == ["cidade-um", "200"]
    assert index["campi"][0]["nome"] == "UFT em Cidade Um"
    assert index["campi"][0]["total_cursos"] == 3


def test_each_campus_json_keeps_the_same_structure(
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


def test_removes_json_of_campus_no_longer_present(
    source: _FakeSource, tmp_path: Path
) -> None:
    (tmp_path / "campus-extinto.json").write_text("{}", encoding="utf-8")
    build_dashboard(source=source, out_dir=tmp_path)
    assert not (tmp_path / "campus-extinto.json").exists()


def test_writes_one_json_per_quality_area_plus_index(
    source: _FakeSource, tmp_path: Path
) -> None:
    areas_dir = tmp_path / "areas_qualidade"
    areas_dir.mkdir()
    (areas_dir / "area-extinta.json").write_text("{}", encoding="utf-8")
    build_dashboard(source=source, out_dir=tmp_path)

    # áreas da avaliação mais recente dos cursos do campus (a da outra IES fica de fora)
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


def test_writes_summary_of_every_campus(source: _FakeSource, tmp_path: Path) -> None:
    build_dashboard(source=source, out_dir=tmp_path)
    resumo = json.loads((tmp_path / "resumo_campi.json").read_text(encoding="utf-8"))
    assert [c["slug"] for c in resumo["campi"]] == ["cidade-um", "200"]
    cursos = {c["codigo_curso"]: c for c in resumo["campi"][0]["cursos"]}
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
