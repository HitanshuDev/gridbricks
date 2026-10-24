from datetime import date

import pandas as pd
import pytest

from app.analytics.engine import (
    align_data,
    calculate_metrics,
    data_quality,
    deduplicate,
    normalize_records,
    select_latest_forecasts,
)
from app.services.dataset import build_analysis


def frame(records: list[dict], kind: str) -> pd.DataFrame:
    normalized, _ = normalize_records(records, kind=kind)
    return normalized


def test_latest_forecast_selection_includes_exact_cutoff_and_excludes_later() -> None:
    forecasts = frame(
        [
            {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T10:59:00Z", "generation": 100},
            {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T11:00:00Z", "generation": 110},
            {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T11:01:00Z", "generation": 120},
        ],
        "forecast",
    )
    selected = select_latest_forecasts(forecasts, "11:00")
    assert len(selected) == 1
    assert selected.iloc[0]["generation_mw"] == 110
    assert selected.iloc[0]["publish_time"] == pd.Timestamp("2026-01-01T11:00:00Z")


def test_forecasts_for_separate_delivery_dates_use_separate_cutoffs() -> None:
    forecasts = frame(
        [
            {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T11:00:00Z", "generation": 1},
            {"startTime": "2026-01-03T00:00:00Z", "publishTime": "2026-01-02T11:00:00Z", "generation": 2},
        ],
        "forecast",
    )
    selected = select_latest_forecasts(forecasts, "11:00")
    assert selected["generation_mw"].tolist() == [1, 2]


def test_duplicate_forecast_records_are_removed_deterministically() -> None:
    forecasts = frame(
        [
            {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T09:00:00Z", "generation": 10},
            {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T09:00:00Z", "generation": 12},
        ],
        "forecast",
    )
    unique, removed = deduplicate(forecasts, kind="forecast")
    assert removed == 1
    assert unique.iloc[0]["generation_mw"] == 12


def test_actual_filter_and_null_and_zero_generation_values_are_distinct() -> None:
    records = [
        {"startTime": "2026-01-01T00:00:00Z", "generation": None, "fuelType": "WIND"},
        {"startTime": "2026-01-01T00:30:00Z", "generation": 0, "fuelType": "WIND"},
        {"startTime": "2026-01-01T01:00:00Z", "generation": 50, "fuelType": "SOLAR"},
    ]
    actuals, diagnostics = normalize_records(records, kind="actual")
    assert len(actuals) == 2
    assert pd.isna(actuals.iloc[0]["generation_mw"])
    assert actuals.iloc[1]["generation_mw"] == 0
    assert diagnostics["null_generation_records"] == 1


def test_missing_actual_or_forecast_remains_unpaired() -> None:
    actuals = frame(
        [{"startTime": "2026-01-02T00:00:00Z", "generation": 5, "fuelType": "WIND"}],
        "actual",
    )
    forecasts = frame(
        [{"startTime": "2026-01-02T00:30:00Z", "publishTime": "2026-01-01T09:00:00Z", "generation": 8}],
        "forecast",
    )
    aligned = align_data(actuals, forecasts)
    assert len(aligned) == 2
    assert aligned["error_mw"].isna().all()


def test_metrics_match_hand_calculated_sample() -> None:
    actuals = frame(
        [
            {"startTime": "2026-01-02T00:00:00Z", "generation": 10, "fuelType": "WIND"},
            {"startTime": "2026-01-02T00:30:00Z", "generation": 20, "fuelType": "WIND"},
        ],
        "actual",
    )
    forecasts = frame(
        [
            {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T10:00:00Z", "generation": 13},
            {"startTime": "2026-01-02T00:30:00Z", "publishTime": "2026-01-01T10:00:00Z", "generation": 15},
        ],
        "forecast",
    )
    metrics = calculate_metrics(align_data(actuals, forecasts))
    assert metrics["valid_pairs"] == 2
    assert metrics["mae_mw"] == 4
    assert metrics["rmse_mw"] == pytest.approx(17**0.5)
    assert metrics["wape_percent"] == pytest.approx(8 / 30 * 100)
    assert metrics["mean_bias_error_mw"] == -1
    assert metrics["absolute_error_p50_mw"] == 4


def test_wape_is_unavailable_when_total_actual_is_zero() -> None:
    actuals = frame(
        [{"startTime": "2026-01-02T00:00:00Z", "generation": 0, "fuelType": "WIND"}],
        "actual",
    )
    forecasts = frame(
        [{"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T10:00:00Z", "generation": 2}],
        "forecast",
    )
    assert calculate_metrics(align_data(actuals, forecasts))["wape_percent"] is None


def test_empty_metrics_are_not_reported_as_zero() -> None:
    empty = pd.DataFrame(columns=["actual_mw", "forecast_mw", "error_mw"])
    metrics = calculate_metrics(empty)
    assert metrics["valid_pairs"] == 0
    assert metrics["mae_mw"] is None
    assert metrics["wape_percent"] is None


def test_timezone_naive_values_are_normalized_as_utc() -> None:
    actuals = frame(
        [{"startTime": "2026-01-02T00:00:00", "generation": 5, "fuelType": "WIND"}],
        "actual",
    )
    assert str(actuals.iloc[0]["delivery_time"].tz) == "UTC"


def test_coverage_does_not_count_null_measurements_as_observed() -> None:
    actuals = frame(
        [
            {"startTime": "2026-01-01T00:00:00Z", "generation": None, "fuelType": "WIND"},
            {"startTime": "2026-01-01T00:30:00Z", "generation": 0, "fuelType": "WIND"},
        ],
        "actual",
    )
    forecasts = frame(
        [
            {"startTime": "2026-01-01T00:00:00Z", "publishTime": "2025-12-31T10:00:00Z", "generation": None},
            {"startTime": "2026-01-01T00:30:00Z", "publishTime": "2025-12-31T10:00:00Z", "generation": 0},
        ],
        "forecast",
    )
    aligned = align_data(actuals, forecasts)
    quality = data_quality(actuals, forecasts, aligned, {})
    assert quality["actual_intervals"] == 1
    assert quality["forecast_intervals"] == 1
    assert quality["valid_aligned_pairs"] == 1


def test_synthetic_data_is_explicitly_labeled_and_january_bounded() -> None:
    result = build_analysis(source="demo")
    assert result["provenance"] == "synthetic"
    assert result["source_label"] == "SYNTHETIC DEMO DATA"
    assert result["quality"]["expected_intervals"] == 1488
    assert len(result["intervals"]) == 1488
    assert result["period"] == {"start_date": "2026-01-01", "end_date": "2026-01-31"}
    assert result["intervals"][0]["delivery_time"].startswith("2026-01-01T")
    assert result["intervals"][-1]["delivery_time"].startswith("2026-01-31T")


def test_custom_date_filter_returns_only_selected_january_days() -> None:
    result = build_analysis(source="demo", start_date=date(2026, 1, 5), end_date=date(2026, 1, 6))
    assert len(result["intervals"]) == 96
    assert result["period"] == {"start_date": "2026-01-05", "end_date": "2026-01-06"}
