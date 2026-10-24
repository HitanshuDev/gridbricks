from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from math import sin
from threading import RLock
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd

from app.analytics.engine import (
    FEBRUARY_START,
    JANUARY_START,
    align_data,
    calculate_metrics,
    daily_aggregates,
    data_quality,
    deduplicate,
    normalize_records,
    records_for_json,
)
from app.core.config import settings
from app.services.elexon import fetch_january_2026, load_csv_dataset


def _synthetic_dataset() -> dict[str, Any]:
    actuals: list[dict[str, Any]] = []
    forecasts: list[dict[str, Any]] = []
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for index in range(31 * 48):
        delivery = start + timedelta(minutes=index * 30)
        baseline = 7800 + 2600 * sin(index * 2 * 3.14159 / 460)
        actual = round(baseline + 700 * sin(index * 2 * 3.14159 / 83), 2)
        actuals.append(
            {
                "startTime": delivery.isoformat().replace("+00:00", "Z"),
                "generation": actual,
                "fuelType": "WIND",
                "source": "Synthetic demo",
            }
        )
        forecast = round(actual + 520 * sin(index * 2 * 3.14159 / 37), 2)
        forecasts.append(
            {
                "startTime": delivery.isoformat().replace("+00:00", "Z"),
                "publishTime": (delivery - timedelta(days=1, hours=13)).isoformat().replace(
                    "+00:00", "Z"
                ),
                "generation": forecast,
                "source": "Synthetic demo",
            }
        )
    return {"actuals": actuals, "forecasts": forecasts}


def _load_raw(mode: str) -> tuple[dict[str, Any], str]:
    if mode == "demo":
        return _synthetic_dataset(), "synthetic"
    if mode == "elexon":
        try:
            return fetch_january_2026(), "official"
        except (OSError, RuntimeError) as exc:
            import logging

            logging.getLogger(__name__).warning("Elexon history unavailable: %s", exc)
            return {"actuals": [], "forecasts": []}, "unavailable"
    if mode == "csv":
        try:
            return load_csv_dataset(settings.csv_dir), "csv"
        except (OSError, ValueError) as exc:
            import logging

            logging.getLogger(__name__).warning("CSV dataset unavailable: %s", exc)
            return {"actuals": [], "forecasts": []}, "unavailable"
    if mode == "unavailable":
        return {"actuals": [], "forecasts": []}, "unavailable"
    raise ValueError("source must be one of: elexon, demo, csv, unavailable")


_PREPARED: dict[str, dict[str, Any]] = {}
_PREPARE_LOCK = RLock()


def _prepare(mode: str) -> dict[str, Any]:
    with _PREPARE_LOCK:
        if mode in _PREPARED:
            return _PREPARED[mode]
        raw, provenance = _load_raw(mode)
        actuals, actual_diagnostics = normalize_records(raw["actuals"], kind="actual")
        forecasts, forecast_diagnostics = normalize_records(raw["forecasts"], kind="forecast")
        actuals = actuals.loc[
            (actuals["delivery_time"] >= JANUARY_START)
            & (actuals["delivery_time"] < FEBRUARY_START)
        ].reset_index(drop=True)
        forecasts = forecasts.loc[
            (forecasts["delivery_time"] >= JANUARY_START)
            & (forecasts["delivery_time"] < FEBRUARY_START)
        ].reset_index(drop=True)
        normalized_count = len(actuals) + len(forecasts)
        null_count = int(actuals["generation_mw"].isna().sum()) + int(
            forecasts["generation_mw"].isna().sum()
        )
        actuals, duplicate_actuals = deduplicate(actuals, kind="actual")
        forecasts, duplicate_forecasts = deduplicate(forecasts, kind="forecast")
        prepared = {
            "actuals": actuals,
            "forecasts": forecasts,
            "provenance": provenance,
            "data_refreshed_at": (
                _refresh_time(mode) if provenance in {"official", "csv"} else None
            ),
            "diagnostics": {
                "raw_records": actual_diagnostics["raw_records"]
                + forecast_diagnostics["raw_records"],
                "normalized_records": normalized_count,
                "duplicate_records_removed": duplicate_actuals + duplicate_forecasts,
                "null_generation_records": null_count,
                "invalid_records": actual_diagnostics["invalid_records"]
                + forecast_diagnostics["invalid_records"],
            },
        }
        if provenance != "unavailable":
            _PREPARED[mode] = prepared
        return prepared


def _refresh_time(mode: str) -> str | None:
    if mode == "elexon":
        paths = [settings.data_dir / "cache" / "elexon-january-2026.json"]
    elif mode == "csv":
        paths = [settings.csv_dir / "actuals.csv", settings.csv_dir / "forecasts.csv"]
    else:
        return None
    present = [path.stat().st_mtime for path in paths if path.is_file()]
    if not present:
        return None
    return (
        datetime.fromtimestamp(max(present), tz=timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _filtered(aligned: pd.DataFrame, start_date: date, end_date: date) -> pd.DataFrame:
    start = pd.Timestamp(datetime.combine(start_date, datetime.min.time()), tz="UTC")
    end = pd.Timestamp(datetime.combine(end_date + timedelta(days=1), datetime.min.time()), tz="UTC")
    return aligned.loc[
        (aligned["delivery_time"] >= start) & (aligned["delivery_time"] < end)
    ].reset_index(drop=True)


def build_analysis(
    *,
    source: str | None = None,
    start_date: date = date(2026, 1, 1),
    end_date: date = date(2026, 1, 31),
    cutoff_time: str = "11:00",
) -> dict[str, Any]:
    mode = source or settings.data_mode
    dataset = _prepare(mode)
    aligned = align_data(dataset["actuals"], dataset["forecasts"], cutoff_time)
    filtered = _filtered(aligned, start_date, end_date)
    metrics = calculate_metrics(filtered)
    quality = data_quality(
        dataset["actuals"],
        dataset["forecasts"],
        aligned,
        dataset["diagnostics"],
        cutoff_time,
    )
    actual_values = filtered["actual_mw"].dropna()
    forecast_values = filtered["forecast_mw"].dropna()
    selected_forecasts = filtered["forecast_publish_time"].dropna()
    valid_forecast_pubs = pd.to_datetime(selected_forecasts, utc=True)
    latest_forecast = (
        valid_forecast_pubs.max().isoformat().replace("+00:00", "Z")
        if not valid_forecast_pubs.empty
        else None
    )
    return {
        "provenance": dataset["provenance"],
        "source_label": {
            "official": "Official Elexon Data",
            "synthetic": "SYNTHETIC DEMO DATA",
            "csv": "Imported Elexon CSV",
            "unavailable": "Data Unavailable",
        }[dataset["provenance"]],
        "period": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "cutoff_time": cutoff_time,
        "data_refreshed_at": dataset["data_refreshed_at"],
        "latest_forecast_publish_time": latest_forecast,
        "average_forecast_mw": (
            float(forecast_values.mean()) if not forecast_values.empty else None
        ),
        "average_actual_mw": float(actual_values.mean()) if not actual_values.empty else None,
        "metrics": metrics,
        "quality": quality,
        "intervals": records_for_json(filtered),
        "daily": daily_aggregates(filtered),
        "forecast_average_mw": (
            float(forecast_values.mean()) if not forecast_values.empty else None
        ),
    }


def build_quality(source: str | None = None, cutoff_time: str = "11:00") -> dict[str, Any]:
    analysis = build_analysis(source=source, cutoff_time=cutoff_time)
    return {
        "provenance": analysis["provenance"],
        "source_label": analysis["source_label"],
        **analysis["quality"],
    }


def build_forecasts(
    delivery_date: date, cutoff_time: str, source: str | None = None
) -> dict[str, Any]:
    analysis = build_analysis(
        source=source,
        start_date=delivery_date,
        end_date=delivery_date,
        cutoff_time=cutoff_time,
    )
    intervals = analysis["intervals"]
    cutoff = datetime.combine(
        delivery_date - timedelta(days=1),
        datetime.strptime(cutoff_time, "%H:%M").time(),
        tzinfo=ZoneInfo("Europe/London"),
    ).astimezone(timezone.utc)
    return {
        "provenance": analysis["provenance"],
        "source_label": analysis["source_label"],
        "delivery_date": delivery_date.isoformat(),
        "decision_cutoff": cutoff.isoformat().replace("+00:00", "Z"),
        "intervals": intervals,
        "daily": analysis["daily"][0] if analysis["daily"] else None,
        "note": (
            "Wind generation forecast only. Total electricity procurement requirements "
            "cannot be calculated without electricity demand and other relevant supply information."
        ),
    }
