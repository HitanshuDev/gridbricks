export type SourceMode = "elexon" | "demo" | "csv" | "unavailable";
export type Provenance = "official" | "synthetic" | "csv" | "unavailable";

export interface Metrics {
  valid_pairs: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  wape_percent: number | null;
  mean_bias_error_mw: number | null;
  absolute_error_p50_mw: number | null;
  absolute_error_p90_mw: number | null;
  absolute_error_p95_mw: number | null;
}

export interface Interval {
  delivery_time: string;
  actual_mw: number | null;
  forecast_mw: number | null;
  forecast_publish_time: string | null;
  forecast_age_hours: number | null;
  error_mw: number | null;
  absolute_error_mw: number | null;
  shortfall_mw: number | null;
}

export interface DailyAggregate {
  delivery_date: string;
  forecast_average_mw: number | null;
  forecast_minimum_mw: number | null;
  forecast_maximum_mw: number | null;
  forecast_stddev_mw: number | null;
  actual_average_mw: number | null;
  valid_pairs: number;
  mae_mw: number | null;
}

export interface DataQuality {
  raw_records: number;
  normalized_records: number;
  duplicate_records_removed: number;
  null_generation_records: number;
  invalid_records: number;
  expected_intervals: number;
  actual_intervals: number;
  forecast_intervals: number;
  missing_actual_intervals: number;
  missing_forecast_intervals: number;
  valid_aligned_pairs: number;
  actual_coverage_percent: number;
  forecast_coverage_percent: number;
  aligned_coverage_percent: number;
}

export interface Analysis {
  provenance: Provenance;
  source_label: string;
  period: { start_date: string; end_date: string };
  cutoff_time: string;
  data_refreshed_at: string | null;
  latest_forecast_publish_time: string | null;
  average_forecast_mw: number | null;
  average_actual_mw: number | null;
  forecast_average_mw: number | null;
  metrics: Metrics;
  quality: DataQuality;
  intervals: Interval[];
  daily: DailyAggregate[];
}

export interface Accuracy extends Pick<Analysis, "provenance" | "source_label" | "period" | "cutoff_time" | "metrics" | "intervals"> {
  daily_breakdown: DailyAggregate[];
  hourly_breakdown: { hour: number; mean_absolute_error_mw: number; mean_bias_error_mw: number; valid_pairs: number }[];
  error_histogram: { range: string; midpoint_mw: number; count: number }[];
  scatter: { forecast_mw: number; actual_mw: number }[];
}

export interface DayForecast {
  provenance: Provenance;
  source_label: string;
  delivery_date: string;
  decision_cutoff: string;
  intervals: Interval[];
  daily: DailyAggregate | null;
  note: string;
}

export interface QualityResponse extends DataQuality {
  provenance: Provenance;
  source_label: string;
}

export interface Filters {
  startDate: string;
  endDate: string;
  cutoffTime: string;
  source: SourceMode;
}
