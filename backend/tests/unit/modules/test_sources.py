import zipfile
from pathlib import Path

from app.modules.qualidade.infrastructure.sources.inep_qualidade_source import (
    InepQualidadeSource,
)
from app.modules.trajetoria.infrastructure.sources.inep_trajetoria_source import (
    _extract_xlsx,
    _pick_zip,
    _slug,
    _start_year,
)


def test_trajetoria_label_helpers():
    assert _slug(" 2012 - 2021 ") == "2012-2021"
    assert _start_year("2012-2021") == 2012
    assert _start_year("Sobre") is None


def test_pick_zip_prefers_zip_extension():
    links = ["https://x/a/doc.pdf", "https://x/a/dados_2023.zip", "https://x/a/b.xlsx"]
    assert _pick_zip(links) == "https://x/a/dados_2023.zip"
    assert _pick_zip(["https://x/a/b.xlsx"]) is None


def test_pick_cpc_selects_cpc_and_prefers_xlsx():
    links = [
        "https://x/2023/conceito_enade_2023.xlsx",
        "https://x/2023/IDD_2023.xlsx",
        "https://x/2023/IGC_2023.xlsx",
        "https://x/2016/Resultado_CPC_2016_portal.xls",
        "https://x/2023/CPC_2023.xlsx",
    ]
    assert InepQualidadeSource._pick_cpc(links) == "https://x/2023/CPC_2023.xlsx"
    only_xls = [
        "https://x/2016/Resultado_CPC_2016_portal.xls",
        "https://x/2016/idd.xls",
    ]
    assert InepQualidadeSource._pick_cpc(only_xls) == only_xls[0]
    assert InepQualidadeSource._pick_cpc(["https://x/2025/conceito_enade.xlsx"]) is None


def test_extract_xlsx_picks_expected_member(trajetoria_xlsx: Path, tmp_path: Path):
    zip_path = tmp_path / "pacote.zip"
    with zipfile.ZipFile(zip_path, "w") as archive:
        archive.write(
            trajetoria_xlsx, "indicadores_trajetoria_educacao_superior_2019_2024.xlsx"
        )
        archive.writestr("Dicionário.docx", b"x")
        archive.writestr("md5.txt", b"x")

    out = _extract_xlsx(zip_path, tmp_path / "extract", force=True)
    assert out is not None
    assert out.name == "indicadores_trajetoria_educacao_superior_2019_2024.xlsx"
    assert out.exists()

    empty = tmp_path / "vazio.zip"
    with zipfile.ZipFile(empty, "w") as archive:
        archive.writestr("leia-me.txt", b"x")
    assert _extract_xlsx(empty, tmp_path / "e2", force=True) is None


def test_qualidade_scope_without_max_year_accepts_future_editions():
    source = InepQualidadeSource(client=object(), min_year=2015)  # type: ignore[arg-type]
    source._max_year = None  # sem limite, independente do .env de quem roda
    assert source._in_scope(2031, None) is True
    assert source._in_scope(2014, None) is False
    limited = InepQualidadeSource(client=object(), min_year=2015, max_year=2023)  # type: ignore[arg-type]
    assert limited._in_scope(2024, None) is False
