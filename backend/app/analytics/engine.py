from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

LONDON = ZoneInfo("Europe/London")
UTC = ZoneInfo("UTC")
JANUARY_START = pd.Timestamp("2026-01-01T00:00:00Z")
FEBRUARY_START = pd.Timestamp("2026-02-01T00:00:00Z")
EXPECTED_INTERVALS = 31 * 48


def _utc(value: Any) -> pd.Timestamp | pd.NaT:
    if value is None or pd.isna(value):
        return pd.NaT
    try:
        parsed = pd.Timestamp(value)
        if parsed.tzinfo is None:
            return parsed.tz_localize("UTC")
        return parsed.tz_convert("UTC")
    except (TypeError, ValueError, OverflowError):
        return pd.NaT


def _generation(value: Any) -> float:
    if value is None or pd.isna(value):
        return np.nan
    try:
        parsed = float(value)
        return parsed if np.isfinite(parsed) else np.nan
    except (TypeError, ValueError):
        return np.nan


def normalize_records(
    records: list[dict[str, Any]], *, kind: str
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Map Elexon rows into a stable schema, retaining null measurements."""
    if kind not in {"actual", "forecast"}:
        raise ValueError("kind must be 'actual' or 'forecast'")
    raw_count = len(records)
    normalized: list[dict[str, Any]] = []
    invalid = 0
    missing = 0
    for row in records:
        if kind == "actual" and row.get("fuelType") != "WIND":
            continue
        delivery = _utc(row.get("startTime"))
        publication = _utc(row.get("publishTime")) if kind == "forecast" else pd.NaT
        generation = _generation(row.get("generation"))
        if pd.isna(delivery) or (kind == "forecast" and pd.isna(publication)):
            invalid += 1
            continue
        if pd.isna(generation):
            missing += 1
        normalized.append(
            {
                "delivery_time": delivery,
                "publish_time": publication,
                "generation_mw": generation,
                "source": row.get("source", "Elexon"),
                "fuel_type": row.get("fuelType") if kind == "actual" else None,
                "record_type": kind,
            }
        )
    columns = [
        "delivery_time",
        "publish_time",
        "generation_mw",
        "source",
        "fuel_type",
        "record_type",
    ]
    frame = pd.DataFrame(normalized, columns=columns)
    if not frame.empty:
        frame = frame.sort_values(
            ["delivery_time", "publish_time", "generation_mw"],
            na_position="first",
            kind="mergesort",
        ).reset_index(drop=True)
    return frame, {
        "raw_records": raw_count,
        "normalized_records": len(frame),
        "invalid_records": invalid,
        "null_generation_records": missing,
    }


def deduplicate(frame: pd.DataFrame, *, kind: str) -> tuple[pd.DataFrame, int]:
    if frame.empty:
        return frame.copy(), 0
    keys = ["delivery_time"]
    if kind == "forecast":
        keys.append("publish_time")
    ordered = frame.sort_values(
        keys + ["generation_mw"], na_position="first", kind="mergesort"
    )
    unique = ordered.drop_duplicates(keys, keep="last").reset_index(drop=True)
    return unique, len(frame) - len(unique)


def cutoff_for_delivery(delivery_time: pd.Timestamp, cutoff_time: str) -> pd.Timestamp:
    hour, minute = (int(part) for part in cutoff_time.split(":"))
    delivery_local = delivery_time.tz_convert(LONDON)
    previous_day = delivery_local.date() - timedelta(days=1)
    local_cutoff = datetime.combine(previous_day, time(hour, minute), tzinfo=LONDON)
    return pd.Timestamp(local_cutoff).tz_convert("UTC")


def select_latest_forecasts(
    forecasts: pd.DataFrame, cutoff_time: str = "11:00"
) -> pd.DataFrame:
    """Select per delivery interval the latest publication not after its cutoff."""
    if forecasts.empty:
        empty = forecasts.copy()
        empty["forecast_age_hours"] = pd.Series(dtype=float)
        return empty
    ordered = forecasts.copy()
    ordered["decision_cutoff"] = ordered["delivery_time"].map(
        lambda delivery: cutoff_for_delivery(delivery, cutoff_time)
    )
    eligible = ordered.loc[ordered["publish_time"] <= ordered["decision_cutoff"]]
    if eligible.empty:
        empty = eligible.drop(columns=["decision_cutoff"]).copy()
        empty["forecast_age_hours"] = pd.Series(dtype=float)
        return empty
    selected = eligible.sort_values(
        ["delivery_time", "publish_time"], kind="mergesort"
    ).drop_duplicates("delivery_time", keep="last")
    selected["forecast_age_hours"] = (
        selected["decision_cutoff"] - selected["publish_time"]
    ).dt.total_seconds() / 3600
    return selected.drop(columns=["decision_cutoff"]).reset_index(drop=True)


def align_data(
    actuals: pd.DataFrame, forecasts: pd.DataFrame, cutoff_time: str = "11:00"
) -> pd.DataFrame:
    selected = select_latest_forecasts(forecasts, cutoff_time)
    actual = actuals[["delivery_time", "generation_mw"]].rename(
        columns={"generation_mw": "actual_mw"}
    )
    forecast_columns = [
        "delivery_time",
        "publish_time",
        "generation_mw",
        "forecast_age_hours",
    ]
    forecast = selected[forecast_columns].rename(
        columns={
            "publish_time": "forecast_publish_time",
            "generation_mw": "forecast_mw",
        }
    )
    aligned = actual.merge(forecast, on="delivery_time", how="outer")
    aligned["error_mw"] = aligned["forecast_mw"] - aligned["actual_mw"]
    aligned["absolute_error_mw"] = aligned["error_mw"].abs()
    aligned["shortfall_mw"] = aligned["actual_mw"] - aligned["forecast_mw"]
    return aligned.sort_values("delivery_time").reset_index(drop=True)


def calculate_metrics(aligned: pd.DataFrame) -> dict[str, Any]:
    valid = aligned.dropna(subset=["actual_mw", "forecast_mw"])
    if valid.empty:
        return {
            "valid_pairs": 0,
            "mae_mw": None,
            "rmse_mw": None,
            "wape_percent": None,
            "mean_bias_error_mw": None,
            "absolute_error_p50_mw": None,
            "absolute_error_p90_mw": None,
            "absolute_error_p95_mw": None,
        }
    errors = valid["error_mw"].astype(float)
    absolute = errors.abs()
    actual_sum = valid["actual_mw"].sum()
    return {
        "valid_pairs": int(len(valid)),
        "mae_mw": float(absolute.mean()),
        "rmse_mw": float(np.sqrt(np.square(errors).mean())),
        "wape_percent": (
            float(absolute.sum() / actual_sum * 100) if actual_sum > 0 else None
        ),
        "mean_bias_error_mw": float(errors.mean()),
        "absolute_error_p50_mw": float(absolute.quantile(0.50)),
        "absolute_error_p90_mw": float(absolute.quantile(0.90)),
        "absolute_error_p95_mw": float(absolute.quantile(0.95)),
    }


def records_for_json(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if frame.empty:
        return []
    clean = frame.astype(object).where(pd.notna(frame), None)
    result = clean.to_dict(orient="records")
    for row in result:
        for key, value in row.items():
            if isinstance(value, pd.Timestamp):
                row[key] = value.isoformat().replace("+00:00", "Z")
            elif isinstance(value, np.generic):
                row[key] = value.item()
    return result


def daily_aggregates(aligned: pd.DataFrame) -> list[dict[str, Any]]:
    if aligned.empty:
        return []
    work = aligned.copy()
    work["delivery_date"] = work["delivery_time"].dt.strftime("%Y-%m-%d")
    rows = []
    for day, group in work.groupby("delivery_date", sort=True):
        forecast = group["forecast_mw"].dropna()
        valid = group.dropna(subset=["actual_mw", "forecast_mw"])
        rows.append(
            {
                "delivery_date": day,
                "forecast_average_mw": float(forecast.mean()) if len(forecast) else None,
                "forecast_minimum_mw": float(forecast.min()) if len(forecast) else None,
                "forecast_maximum_mw": float(forecast.max()) if len(forecast) else None,
                "forecast_stddev_mw": float(forecast.std(ddof=0)) if len(forecast) else None,
                "actual_average_mw": (
                    float(group["actual_mw"].mean())
                    if group["actual_mw"].notna().any()
                    else None
                ),
                "valid_pairs": int(len(valid)),
                "mae_mw": (
                    float(valid["error_mw"].abs().mean()) if len(valid) else None
                ),
            }
        )
    return rows


def data_quality(
    actuals: pd.DataFrame,
    forecasts: pd.DataFrame,
    aligned: pd.DataFrame,
    diagnostics: dict[str, int],
    cutoff_time: str = "11:00",
) -> dict[str, Any]:
    actual_available = (
        actuals.loc[actuals["generation_mw"].notna()]
        if not actuals.empty
        else actuals
    )
    actual_intervals = (
        int(actual_available["delivery_time"].nunique()) if not actual_available.empty else 0
    )
    selected_forecasts = select_latest_forecasts(forecasts, cutoff_time)
    forecast_available = (
        selected_forecasts.loc[selected_forecasts["generation_mw"].notna()]
        if not selected_forecasts.empty
        else selected_forecasts
    )
    forecast_intervals = (
        int(forecast_available["delivery_time"].nunique())
        if not forecast_available.empty
        else 0
    )
    valid_pairs = int(aligned.dropna(subset=["actual_mw", "forecast_mw"]).shape[0])
    return {
        **diagnostics,
        "expected_intervals": EXPECTED_INTERVALS,
        "actual_intervals": actual_intervals,
        "forecast_intervals": forecast_intervals,
        "missing_actual_intervals": max(EXPECTED_INTERVALS - actual_intervals, 0),
        "missing_forecast_intervals": max(EXPECTED_INTERVALS - forecast_intervals, 0),
        "valid_aligned_pairs": valid_pairs,
        "actual_coverage_percent": actual_intervals / EXPECTED_INTERVALS * 100,
        "forecast_coverage_percent": forecast_intervals / EXPECTED_INTERVALS * 100,
        "aligned_coverage_percent": valid_pairs / EXPECTED_INTERVALS * 100,
    }
