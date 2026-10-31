from dataclasses import replace
from pathlib import Path

from app.core.domain.pipelines.report import FileReport, ModuleReport
from app.core.domain.value_objects.raw_file import RawFile

_RAW = RawFile(module="m", year_label="2026", source_url="u", path=Path("x.xlsx"))


def test_needs_review_only_when_file_changed_and_has_gap():
    changed_with_gap = FileReport(
        raw_file=_RAW, columns_missing_from_file=["nome_curso"]
    )
    assert changed_with_gap.needs_review() is True

    unchanged_with_gap = FileReport(
        raw_file=replace(_RAW, changed=False),
        columns_missing_from_file=["nome_curso"],
    )
    assert unchanged_with_gap.needs_review() is False

    changed_no_gap = FileReport(raw_file=_RAW)
    assert changed_no_gap.needs_review() is False


def test_unmatched_column_also_counts_as_a_gap():
    report = FileReport(raw_file=_RAW, columns_unmatched_in_file=["coluna_nova"])
    assert report.needs_review() is True


def test_module_report_collects_only_files_needing_review():
    ok_file = FileReport(raw_file=replace(_RAW, year_label="2024", changed=False))
    bad_file = FileReport(
        raw_file=replace(_RAW, year_label="2026"),
        columns_missing_from_file=["nome_curso"],
        columns_unmatched_in_file=["nome_do_curso"],
    )
    module_report = ModuleReport(module="m", file_reports=[ok_file, bad_file])

    items = module_report.review_items()

    assert len(items) == 1
    assert items[0].year_label == "2026"
    assert items[0].columns_missing_from_file == ["nome_curso"]
    assert items[0].columns_unmatched_in_file == ["nome_do_curso"]


def test_config_change_rechecks_unchanged_files():
    # depois de editar colunas_inep.json, quem editou precisa ver se a
    # correção resolveu — então arquivos em cache também são reavaliados.
    unchanged_with_gap = FileReport(
        raw_file=replace(_RAW, changed=False),
        columns_unmatched_in_file=["Nome Novo da Coluna"],
    )
    assert unchanged_with_gap.needs_review() is False
    assert unchanged_with_gap.needs_review(config_changed=True) is True

    fixed = FileReport(raw_file=replace(_RAW, changed=False))
    assert fixed.needs_review(config_changed=True) is False

    module_report = ModuleReport(
        module="m", file_reports=[unchanged_with_gap, fixed], config_changed=True
    )
    assert len(module_report.review_items()) == 1


def test_unmapped_category_code_needs_review():
    report = FileReport(raw_file=_RAW, categories_unmapped={"tp_categoria": [8]})
    assert report.needs_review() is True


def test_many_dropped_rows_need_review_but_a_footer_does_not():
    footer = FileReport(
        raw_file=_RAW, rows_dropped_bad_type=3, rows_dropped_missing_key=1
    )
    assert footer.needs_review() is False
    many = FileReport(raw_file=_RAW, rows_dropped_bad_type=179)
    assert many.needs_review() is True
