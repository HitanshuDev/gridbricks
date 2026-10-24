from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "WindScope API"


class MetadataResponse(BaseModel):
    product: str
    target_period: dict[str, str]
    default_cutoff_time: str
    timezone: str
    sources: list[str]
    provenance: str
    source_label: str


class AnalysisResponse(BaseModel):
    provenance: str
    source_label: str
    period: dict[str, str]
    cutoff_time: str
    data_refreshed_at: Optional[str]
    latest_forecast_publish_time: Optional[str]
    average_forecast_mw: Optional[float]
    average_actual_mw: Optional[float]
    metrics: dict[str, Any]
    quality: dict[str, Any]
    intervals: list[dict[str, Any]]
    daily: list[dict[str, Any]]
    forecast_average_mw: Optional[float]


class AccuracyResponse(BaseModel):
    provenance: str
    source_label: str
    period: dict[str, str]
    cutoff_time: str
    metrics: dict[str, Any]
    daily_breakdown: list[dict[str, Any]]
    hourly_breakdown: list[dict[str, Any]]
    error_histogram: list[dict[str, Any]]
    scatter: list[dict[str, Any]]
    intervals: list[dict[str, Any]]


class ForecastResponse(BaseModel):
    provenance: str
    source_label: str
    delivery_date: str
    decision_cutoff: str
    intervals: list[dict[str, Any]]
    daily: Optional[dict[str, Any]]
    note: str


class QualityResponse(BaseModel):
    provenance: str
    source_label: str
    raw_records: int
    normalized_records: int
    duplicate_records_removed: int
    null_generation_records: int
    invalid_records: int
    expected_intervals: int
    actual_intervals: int
    forecast_intervals: int
    missing_actual_intervals: int
    missing_forecast_intervals: int
    valid_aligned_pairs: int
    actual_coverage_percent: float
    forecast_coverage_percent: float
    aligned_coverage_percent: float
