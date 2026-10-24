from __future__ import annotations

from datetime import date, time
from enum import Enum
from io import StringIO
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.analytics.engine import calculate_metrics
from app.core.config import settings
from app.schemas import (
    AccuracyResponse,
    AnalysisResponse,
    ForecastResponse,
    HealthResponse,
    MetadataResponse,
    QualityResponse,
)
from app.services.dataset import build_analysis, build_forecasts, build_quality

router = APIRouter(prefix="/api")
START = date(2026, 1, 1)
END = date(2026, 1, 31)


class Source(str, Enum):
    elexon = "elexon"
    demo = "demo"
    csv = "csv"
    unavailable = "unavailable"


def _validate_dates(start_date: date, end_date: date) -> None:
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date.")
    if start_date < START or end_date > END:
        raise HTTPException(
            status_code=422, detail="Dates must be within January 1–31, 2026."
        )


def _cutoff(value: str) -> str:
    try:
        time.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="cutoff_time must use HH:MM format.") from exc
    if len(value) != 5:
        raise HTTPException(status_code=422, detail="cutoff_time must use HH:MM format.")
    return value


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@router.get("/metadata", response_model=MetadataResponse)
def metadata() -> MetadataResponse:
    source = settings.data_mode
    return MetadataResponse(
        product="WindScope | Day-Ahead Analytics",
        target_period={"start_date": START.isoformat(), "end_date": END.isoformat()},
        default_cutoff_time="11:00",
        timezone="Europe/London (stored as UTC)",
        sources=["elexon", "demo", "csv", "unavailable"],
        provenance=source,
        source_label={
            "elexon": "Official Elexon Data",
            "demo": "SYNTHETIC DEMO DATA",
            "csv": "Imported Elexon CSV",
        }.get(source, "Data Unavailable"),
    )


def _analysis_params(
    start_date: date, end_date: date, cutoff_time: str, source: Source | None
) -> dict:
    _validate_dates(start_date, end_date)
    return {
        "start_date": start_date,
        "end_date": end_date,
        "cutoff_time": _cutoff(cutoff_time),
        "source": source.value if source else None,
    }


@router.get("/dashboard", response_model=AnalysisResponse)
def dashboard(
    start_date: date = START,
    end_date: date = END,
    cutoff_time: str = "11:00",
    source: Optional[Source] = None,
) -> dict:
    return build_analysis(**_analysis_params(start_date, end_date, cutoff_time, source))


@router.get("/accuracy", response_model=AccuracyResponse)
def accuracy(
    start_date: date = START,
    end_date: date = END,
    cutoff_time: str = "11:00",
    source: Optional[Source] = None,
) -> dict:
    result = build_analysis(**_analysis_params(start_date, end_date, cutoff_time, source))
    intervals = pd.DataFrame(
        result["intervals"],
        columns=[
            "delivery_time",
            "actual_mw",
            "forecast_mw",
            "forecast_publish_time",
            "forecast_age_hours",
            "error_mw",
            "absolute_error_mw",
            "shortfall_mw",
        ],
    )
    valid = intervals.dropna(subset=["actual_mw", "forecast_mw"])
    if valid.empty:
        hourly: list[dict] = []
        histogram: list[dict] = []
        scatter: list[dict] = []
    else:
        valid["delivery_time"] = pd.to_datetime(valid["delivery_time"], utc=True)
        valid["hour"] = valid["delivery_time"].dt.hour
        valid["error_mw"] = valid["forecast_mw"] - valid["actual_mw"]
        hourly = [
            {
                "hour": int(hour),
                "mean_absolute_error_mw": float(group["error_mw"].abs().mean()),
                "mean_bias_error_mw": float(group["error_mw"].mean()),
                "valid_pairs": int(len(group)),
            }
            for hour, group in valid.groupby("hour", sort=True)
        ]
        max_abs = float(valid["error_mw"].abs().max())
        bins = min(20, max(1, int(len(valid) ** 0.5)))
        edges = pd.interval_range(
            start=-max_abs - 1e-9, end=max_abs + 1e-9, periods=bins, closed="left"
        )
        counts = pd.cut(valid["error_mw"], bins=edges).value_counts(sort=False)
        histogram = [
            {
                "range": f"{interval.left:.0f} to {interval.right:.0f}",
                "midpoint_mw": float((interval.left + interval.right) / 2),
                "count": int(count),
            }
            for interval, count in counts.items()
        ]
        scatter = [
            {"forecast_mw": float(row.forecast_mw), "actual_mw": float(row.actual_mw)}
            for row in valid.itertuples()
        ]
    return {
        "provenance": result["provenance"],
        "source_label": result["source_label"],
        "period": result["period"],
        "cutoff_time": result["cutoff_time"],
        "metrics": result["metrics"],
        "daily_breakdown": result["daily"],
        "hourly_breakdown": hourly,
        "error_histogram": histogram,
        "scatter": scatter,
        "intervals": result["intervals"],
    }


@router.get("/forecasts", response_model=ForecastResponse)
def forecasts(
    delivery_date: date,
    cutoff_time: str = "11:00",
    source: Optional[Source] = None,
) -> dict:
    if delivery_date < START or delivery_date > END:
        raise HTTPException(status_code=422, detail="delivery_date must be in January 2026.")
    return build_forecasts(delivery_date, _cutoff(cutoff_time), source.value if source else None)


@router.get("/data-quality", response_model=QualityResponse)
def quality(source: Optional[Source] = None, cutoff_time: str = "11:00") -> dict:
    return build_quality(source.value if source else None, _cutoff(cutoff_time))


@router.get("/export.csv")
def export_csv(
    start_date: date = START,
    end_date: date = END,
    cutoff_time: str = "11:00",
    source: Optional[Source] = None,
) -> StreamingResponse:
    result = build_analysis(**_analysis_params(start_date, end_date, cutoff_time, source))
    frame = pd.DataFrame(
        result["intervals"],
        columns=[
            "delivery_time",
            "actual_mw",
            "forecast_mw",
            "forecast_publish_time",
            "forecast_age_hours",
            "error_mw",
            "absolute_error_mw",
            "shortfall_mw",
        ],
    )
    content = StringIO()
    frame.to_csv(content, index=False)
    content.seek(0)
    return StreamingResponse(
        iter([content.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="wind-scope-january-2026.csv"'
        },
    )
