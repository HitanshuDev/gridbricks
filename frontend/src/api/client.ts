import type { Accuracy, Analysis, DayForecast, Filters, QualityResponse } from "../types";

const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE = (configuredBase || "").replace(/\/api\/?$/, "").replace(/\/$/, "");

function query(filters: Filters) {
  return new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    cutoff_time: filters.cutoffTime,
    source: filters.source,
  });
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Could not reach WindScope. Check the API connection and try again.");
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // Keep the HTTP status message if the response body is not JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export const api = {
  dashboard(filters: Filters, signal?: AbortSignal) {
    return request<Analysis>(`/dashboard?${query(filters)}`, signal);
  },
  accuracy(filters: Filters, signal?: AbortSignal) {
    return request<Accuracy>(`/accuracy?${query(filters)}`, signal);
  },
  forecasts(date: string, filters: Filters, signal?: AbortSignal) {
    const params = new URLSearchParams({
      delivery_date: date,
      cutoff_time: filters.cutoffTime,
      source: filters.source,
    });
    return request<DayForecast>(`/forecasts?${params}`, signal);
  },
  quality(filters: Filters, signal?: AbortSignal) {
    return request<QualityResponse>(
      `/data-quality?${new URLSearchParams({
        source: filters.source,
        cutoff_time: filters.cutoffTime,
      })}`,
      signal,
    );
  },
  async exportCsv(filters: Filters) {
    const response = await fetch(`${API_BASE}/api/export.csv?${query(filters)}`);
    if (!response.ok) throw new Error(`CSV export failed (${response.status}).`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wind-scope-january-2026.csv";
    link.click();
    URL.revokeObjectURL(url);
  },
};
