import {
  Activity,
  BarChart3,
  ChevronDown,
  CircleHelp,
  Database,
  Menu,
  Wind,
} from "lucide-react";
import { createContext, useContext, useMemo, useState } from "react";
import { NavLink, Outlet, Route, Routes, useOutletContext } from "react-router-dom";
import type { ReactNode } from "react";
import { api } from "./api/client";
import { AccuracyCharts, ErrorChart, ForecastActualChart, HourlyAccuracyChart } from "./components/charts";
import { IntervalTable } from "./components/interval-table";
import { EmptyState, ExportButton, MetricCard, Panel, ProvenanceBadge, RequestState } from "./components/shared";
import { useApi } from "./hooks/useApi";
import type { Accuracy, Analysis, DayForecast, Filters, QualityResponse, SourceMode } from "./types";

interface Shared {
  filters: Filters;
  setFilters: (next: Filters) => void;
}
const Context = createContext<Shared | null>(null);
const useShared = () => {
  const value = useContext(Context);
  if (!value) throw new Error("App layout context is missing.");
  return value;
};

function displayDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const nav = [
  { to: "/", label: "Overview", icon: Activity, end: true },
  { to: "/accuracy", label: "Accuracy analysis", icon: BarChart3 },
  { to: "/decision", label: "Decision explorer", icon: Wind },
  { to: "/quality", label: "Data & methodology", icon: Database },
];

function Layout() {
  const { filters, setFilters } = useShared();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-white lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center gap-3 border-b border-line px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white"><Wind size={19} /></div>
          <div><p className="text-[15px] font-bold tracking-tight text-ink">WindScope</p><p className="text-[10px] font-medium text-muted">DAY-AHEAD ANALYTICS</p></div>
        </div>
        <div className="px-4 pt-7">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Workspace</p>
          <nav className="space-y-1" aria-label="Main navigation">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-ink"}`}>
                <Icon size={17} strokeWidth={1.8} />{label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-line p-5">
          <div className="rounded-xl bg-[#f7faf8] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink"><CircleHelp size={15} className="text-emerald-700" />Decision support only</div>
            <p className="mt-2 text-[11px] leading-4 text-muted">Wind forecast is not a measure of total procurement need.</p>
          </div>
          <p className="mt-4 text-[10px] text-slate-400">JAN 2026 · HISTORICAL BACKTEST</p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7 xl:px-9">
            <div className="flex items-center gap-3">
              <button className="rounded-md p-2 text-muted hover:bg-slate-100 lg:hidden" aria-label="Toggle navigation" onClick={() => setMobileOpen((open) => !open)}><Menu size={19} /></button>
              <div className="hidden text-xs text-muted sm:block">Analysis period <span className="ml-1 font-semibold text-ink">{displayDate(filters.startDate)}–{displayDate(filters.endDate)}, 2026</span></div>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                {filters.source === "elexon" ? "Elexon BMRS" : filters.source === "demo" ? "Synthetic demo" : filters.source === "csv" ? "CSV import" : "No data"}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="start-date">Start delivery date</label>
              <input id="start-date" className="filter-input w-[132px]" aria-label="Start delivery date" type="date" min="2026-01-01" max="2026-01-31" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} />
              <span className="text-[10px] text-slate-400">to</span>
              <label className="sr-only" htmlFor="end-date">End delivery date</label>
              <input id="end-date" className="filter-input w-[132px]" aria-label="End delivery date" type="date" min="2026-01-01" max="2026-01-31" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} />
              <label className="sr-only" htmlFor="source-select">Data source</label>
              <div className="relative">
                <select id="source-select" className="filter-input min-w-[180px] appearance-none pr-8" value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value as SourceMode })}>
                  <option value="elexon">Official Elexon data</option>
                  <option value="demo">Synthetic demo data</option>
                  <option value="csv">Imported CSV</option>
                  <option value="unavailable">Data unavailable</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-muted" size={13} />
              </div>
              <label className="sr-only" htmlFor="cutoff-time">Decision cutoff time</label>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5">
                <span className="hidden text-[10px] text-muted sm:inline">Cutoff</span>
                <input id="cutoff-time" aria-label="Decision cutoff time" className="w-[78px] py-2 text-xs font-semibold text-ink outline-none" type="time" value={filters.cutoffTime} onChange={(event) => setFilters({ ...filters, cutoffTime: event.target.value })} />
              </div>
            </div>
          </div>
          {mobileOpen && (
            <nav className="space-y-1 border-t border-line px-4 py-3 lg:hidden" aria-label="Mobile navigation">
              {nav.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? "bg-emerald-50 text-emerald-800" : "text-muted"}`}><Icon size={16} />{label}</NavLink>)}
            </nav>
          )}
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 xl:px-9">
          <Routes>
            <Route element={<Outlet context={{ filters, setFilters } satisfies Shared} />}>
              <Route index element={<OverviewPage />} />
              <Route path="accuracy" element={<AccuracyPage />} />
              <Route path="decision" element={<DecisionPage />} />
              <Route path="quality" element={<QualityPage />} />
            </Route>
          </Routes>
          <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-line py-5 text-[10px] text-muted sm:flex-row">
            <span>WindScope · National wind generation analysis · January 2026</span>
            <span>Generation shown as average power in MW, not interval energy in MWh.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function useFilters() {
  return useOutletContext<Shared>().filters;
}

function useAnalysis(filters: Filters) {
  const load = (signal: AbortSignal) => api.dashboard(filters, signal);
  return useApi<Analysis>(load, [filters.startDate, filters.endDate, filters.cutoffTime, filters.source]);
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">{eyebrow}</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted">{description}</p></div>
      {action}
    </div>
  );
}

function SourceWarning({ data }: { data: Pick<Analysis, "provenance" | "source_label"> }) {
  if (data.provenance !== "synthetic") return null;
  return <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950"><span className="mt-0.5 font-bold">DEMO</span><p><strong>SYNTHETIC DEMO DATA</strong> is for interface testing only and is not an Elexon observation or evidence of January 2026 forecast performance.</p></div>;
}

function OverviewPage() {
  const filters = useFilters();
  const state = useAnalysis(filters);
  const { data } = state;
  const download = () => void api.exportCsv(filters).catch((error: unknown) => window.alert(error instanceof Error ? error.message : "CSV export failed."));
  return (
    <RequestState {...state}>
      {data && <>
        <PageHeading eyebrow="Executive overview" title="Wind forecast performance" description="A historical view of January 2026 national wind forecasts, evaluated against Elexon actual generation." action={<ExportButton onClick={download} />} />
        <SourceWarning data={data} />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <ProvenanceBadge provenance={data.provenance} label={data.source_label} />
          <p className="text-xs text-muted">{data.quality.actual_coverage_percent.toFixed(1)}% actual coverage <span className="mx-1.5 text-slate-300">·</span>{data.quality.missing_actual_intervals.toLocaleString()} missing actual intervals <span className="mx-1.5 text-slate-300">·</span>Cutoff: previous day {data.cutoff_time} London{data.data_refreshed_at && <> <span className="mx-1.5 text-slate-300">·</span>Refreshed {new Date(data.data_refreshed_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</>}</p>
        </div>
        {data.provenance === "unavailable" && <div className="mb-5"><EmptyState title="Historical dataset unavailable" message="Elexon records could not be loaded for this request. Check the backend connection, or choose Synthetic demo data to explore the interface. No measurements are fabricated." /></div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Latest selected publication" value={data.latest_forecast_publish_time ? new Date(data.latest_forecast_publish_time).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "N/A"} detail={data.latest_forecast_publish_time ? `${new Date(data.latest_forecast_publish_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC · selected at cutoff` : "No forecast selected"} />
          <MetricCard label="Forecast average" value={data.average_forecast_mw == null ? "N/A" : Math.round(data.average_forecast_mw).toLocaleString()} unit="MW" detail="Average forecast power in selected date range" />
          <MetricCard label="Actual average" value={data.average_actual_mw == null ? "N/A" : Math.round(data.average_actual_mw).toLocaleString()} unit="MW" detail="Average actual power in selected date range" />
          <MetricCard label="Mean absolute error" value={data.metrics.mae_mw == null ? "N/A" : Math.round(data.metrics.mae_mw).toLocaleString()} unit="MW" detail={`${data.metrics.valid_pairs.toLocaleString()} valid aligned pairs`} accent />
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
          <Panel title="Forecast vs actual" subtitle="Exact UTC delivery timestamps · lines connect observed values across source cadences">{data.intervals.some((row) => row.forecast_mw != null || row.actual_mw != null) ? <ForecastActualChart rows={data.intervals} /> : <EmptyState message="No forecast or actual observations are available in this date range." />}</Panel>
          <Panel title="Forecast error over time" subtitle="Error = forecast − actual · valid paired points connected across source cadences">{data.intervals.some((row) => row.error_mw != null) ? <ErrorChart rows={data.intervals} /> : <EmptyState message="Error is unavailable until forecasts and actuals can be aligned." />}</Panel>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <MetricCard label="RMSE" value={data.metrics.rmse_mw == null ? "N/A" : Math.round(data.metrics.rmse_mw).toLocaleString()} unit="MW" detail="Root mean squared error; larger errors weigh more." />
          <MetricCard label="WAPE" value={data.metrics.wape_percent == null ? "N/A" : `${data.metrics.wape_percent.toFixed(1)}%`} detail="Absolute error divided by total actual generation." accent />
          <MetricCard label="Mean bias error" value={data.metrics.mean_bias_error_mw == null ? "N/A" : Math.round(data.metrics.mean_bias_error_mw).toLocaleString()} unit="MW" detail="Average signed error; positive means over-forecast." />
        </div>
        <Panel className="mt-5 !p-0" title="Aligned interval detail" subtitle="A missing value is shown as a dash and excluded from paired error metrics." action={<span className="mr-5 text-[10px] text-muted">Export follows selected source and filters</span>}>
          <IntervalTable rows={data.intervals} />
        </Panel>
      </>}
    </RequestState>
  );
}

function AccuracyPage() {
  const filters = useFilters();
  const state = useApi<Accuracy>((signal) => api.accuracy(filters, signal), [filters.startDate, filters.endDate, filters.cutoffTime, filters.source]);
  const { data } = state;
  const download = () => void api.exportCsv(filters).catch((error: unknown) => window.alert(error instanceof Error ? error.message : "CSV export failed."));
  return (
    <RequestState {...state}>
      {data && <>
        <PageHeading eyebrow="Forecast verification" title="Accuracy analysis" description="Understand error magnitude, bias, distribution, and how forecast accuracy varies by time of day." action={<ExportButton onClick={download} />} />
        <SourceWarning data={data} />
        <div className="mb-5"><ProvenanceBadge provenance={data.provenance} label={data.source_label} /></div>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="MAE" value={data.metrics.mae_mw == null ? "N/A" : Math.round(data.metrics.mae_mw).toLocaleString()} unit="MW" detail="Mean absolute forecast error" />
          <MetricCard label="RMSE" value={data.metrics.rmse_mw == null ? "N/A" : Math.round(data.metrics.rmse_mw).toLocaleString()} unit="MW" detail="Root mean squared error" />
          <MetricCard label="WAPE" value={data.metrics.wape_percent == null ? "N/A" : `${data.metrics.wape_percent.toFixed(1)}%`} detail="Undefined when total actual ≤ 0" accent />
          <MetricCard label="Mean bias" value={data.metrics.mean_bias_error_mw == null ? "N/A" : Math.round(data.metrics.mean_bias_error_mw).toLocaleString()} unit="MW" detail="Positive = over-forecast" />
          <MetricCard label="P90 absolute error" value={data.metrics.absolute_error_p90_mw == null ? "N/A" : Math.round(data.metrics.absolute_error_p90_mw).toLocaleString()} unit="MW" detail={`P50 ${data.metrics.absolute_error_p50_mw == null ? "N/A" : Math.round(data.metrics.absolute_error_p50_mw).toLocaleString()} · ${data.metrics.valid_pairs} pairs`} />
        </div>
        <Panel title="Forecast fit and error distribution" subtitle="Each point is one valid aligned interval. The diagonal represents a perfect forecast."><AccuracyCharts data={data} /></Panel>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.35fr]">
          <Panel title="Error by time of day" subtitle="Mean absolute error by delivery hour (UTC)"><HourlyAccuracyChart data={data.hourly_breakdown} /></Panel>
          <Panel title="Metric definitions" subtitle="All metrics use valid aligned pairs only.">
            <div className="space-y-3 text-xs leading-5 text-slate-600">
              <p><strong className="text-ink">Error</strong> = forecast − actual; <strong className="text-ink">shortfall</strong> = actual − forecast.</p>
              <p><strong className="text-ink">MAE</strong> = mean absolute error. <strong className="text-ink">RMSE</strong> = square root of mean squared error.</p>
              <p><strong className="text-ink">WAPE</strong> = sum of absolute error ÷ sum of actual generation × 100; shown as N/A when the denominator is not positive.</p>
              <p><strong className="text-ink">P50 / P90 / P95</strong> are quantiles of absolute error. MAPE is intentionally not used because actual wind can be zero or near zero.</p>
            </div>
          </Panel>
        </div>
        <Panel className="mt-5" title="Delivery-day breakdown" subtitle="Daily aggregates show forecast levels, paired accuracy, and the valid sample count.">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead className="border-y border-line bg-slate-50/80 text-[10px] uppercase tracking-wider text-muted"><tr>
                <th className="px-3 py-3 font-semibold">Delivery date</th><th className="px-3 py-3 text-right font-semibold">Forecast avg MW</th><th className="px-3 py-3 text-right font-semibold">Actual avg MW</th><th className="px-3 py-3 text-right font-semibold">Daily MAE MW</th><th className="px-3 py-3 text-right font-semibold">Valid pairs</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{data.daily_breakdown.map((day) => <tr key={day.delivery_date}>
                <td className="px-3 py-2.5 font-medium text-ink">{day.delivery_date}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{day.forecast_average_mw == null ? "—" : Math.round(day.forecast_average_mw).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{day.actual_average_mw == null ? "—" : Math.round(day.actual_average_mw).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{day.mae_mw == null ? "—" : Math.round(day.mae_mw).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{day.valid_pairs}</td>
              </tr>)}</tbody>
            </table>
            {!data.daily_breakdown.length && <p className="py-8 text-center text-xs text-muted">No daily observations are available for this selection.</p>}
          </div>
        </Panel>
        <Panel className="mt-5 !p-0" title="Interval-level evaluation" subtitle={`${data.metrics.valid_pairs.toLocaleString()} valid aligned intervals in the selected sample`}><IntervalTable rows={data.intervals} /></Panel>
      </>}
    </RequestState>
  );
}

function DecisionPage() {
  const filters = useFilters();
  const { setFilters } = useShared();
  const [deliveryDate, setDeliveryDate] = useState("2026-01-15");
  const [postDelivery, setPostDelivery] = useState(false);
  const state = useApi<DayForecast>((signal) => api.forecasts(deliveryDate, filters, signal), [deliveryDate, filters.cutoffTime, filters.source]);
  const { data } = state;
  return (
    <RequestState {...state}>
      {data && <>
        <PageHeading eyebrow="Historical decision simulation" title="Day-ahead explorer" description="Reconstruct which forecast publication would have been available before a selected delivery day." />
        <SourceWarning data={data} />
        <Panel title="Decision parameters" subtitle="The decision cutoff is interpreted in Europe/London on the calendar day before delivery.">
          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-1.5 text-xs font-medium text-ink">Delivery date
              <input className="filter-input" type="date" min="2026-01-01" max="2026-01-31" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-ink">Decision cutoff · London
              <input className="filter-input" type="time" value={filters.cutoffTime} onChange={(event) => setFilters({ ...filters, cutoffTime: event.target.value })} />
            </label>
            <ProvenanceBadge provenance={data.provenance} label={data.source_label} />
          </div>
        </Panel>
        <div className="my-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950"><strong>Wind generation forecast only.</strong> Total electricity procurement requirements cannot be calculated without electricity demand and other relevant supply information.</div>
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Panel title="Delivery-day forecast profile" subtitle={`January ${deliveryDate.slice(-2)}, 2026 · forecast selected at or before the previous-day ${filters.cutoffTime} London cutoff`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${postDelivery ? "bg-blue-50 text-blue-800" : "bg-emerald-50 text-emerald-800"}`}>{postDelivery ? "POST-DELIVERY EVALUATION" : "PRE-DELIVERY DECISION"}</span>
              <button className="text-[11px] font-semibold text-emerald-800 underline underline-offset-2" onClick={() => setPostDelivery((value) => !value)}>{postDelivery ? "Hide actual outcomes" : "Show post-delivery actuals"}</button>
            </div>
            {data.intervals.some((row) => row.forecast_mw != null) ? <ForecastActualChart rows={postDelivery ? data.intervals : data.intervals.map((row) => ({ ...row, actual_mw: null }))} /> : <EmptyState message="No forecast publications were available at or before this decision cutoff." />}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted">
              <span>Selected forecast publication: <strong className="text-ink">{data.intervals.find((row) => row.forecast_publish_time)?.forecast_publish_time ? new Date(data.intervals.find((row) => row.forecast_publish_time)!.forecast_publish_time!).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : "N/A"}</strong></span>
              <span>Forecast age at cutoff: <strong className="text-ink">{data.intervals.find((row) => row.forecast_age_hours != null)?.forecast_age_hours?.toFixed(1) ?? "N/A"} hours</strong></span>
            </div>
            {postDelivery && <p className="mt-2 text-[10px] text-muted">Actual generation and forecast error are retrospective only; neither is used in the pre-delivery selection.</p>}
          </Panel>
          <Panel title="Delivery-day summary" subtitle="Computed from selected available forecast records">
            {data.daily ? <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Average" value={data.daily.forecast_average_mw} />
              <MiniStat label="Maximum" value={data.daily.forecast_maximum_mw} />
              <MiniStat label="Minimum" value={data.daily.forecast_minimum_mw} />
              <MiniStat label="Intra-day σ" value={data.daily.forecast_stddev_mw} />
              <div className="col-span-2 border-t border-line pt-3 text-xs text-muted">{postDelivery ? `${data.daily.valid_pairs} valid pairs for post-delivery evaluation.` : "Actuals and forecast errors are withheld in the pre-delivery decision view."} Pre-delivery selection uses forecast publications only.</div>
            </div> : <EmptyState message="No selected forecast values are available for this delivery day." />}
          </Panel>
        </div>
        <Panel className="mt-5 !p-0" title="Forecast publications and outcomes" subtitle={postDelivery ? "Actuals and errors are post-delivery outcomes and were not used in forecast selection." : "Pre-delivery view shows only information available at the decision cutoff."}><IntervalTable rows={postDelivery ? data.intervals : data.intervals.map((row) => ({ ...row, actual_mw: null, error_mw: null, absolute_error_mw: null }))} /></Panel>
      </>}
    </RequestState>
  );
}

function MiniStat({ label, value }: { label: string; value: number | null }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-medium text-muted">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-ink">{value == null ? "N/A" : `${Math.round(value).toLocaleString()} MW`}</p></div>;
}

function QualityPage() {
  const filters = useFilters();
  const state = useApi<QualityResponse>((signal) => api.quality(filters, signal), [filters.source, filters.cutoffTime]);
  const { data } = state;
  return (
    <RequestState {...state}>
      {data && <>
        <PageHeading eyebrow="Trust & transparency" title="Data quality & methodology" description="Inspect data provenance, interval coverage, cleaning counts, source conventions, and the limits of this analysis." />
        <SourceWarning data={data} />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><ProvenanceBadge provenance={data.provenance} label={data.source_label} /><span className="text-xs text-muted">January 2026 · 1,488 expected half-hour intervals</span></div>
        <SourceWarning data={data} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Raw records fetched" value={data.raw_records.toLocaleString()} detail="Combined FUELHH and WINDFOR rows" />
          <MetricCard label="Normalized records" value={data.normalized_records.toLocaleString()} detail="January delivery intervals only" />
          <MetricCard label="Duplicate rows removed" value={data.duplicate_records_removed.toLocaleString()} detail="Deterministic latest-publication policy" accent />
          <MetricCard label="Valid aligned pairs" value={data.valid_aligned_pairs.toLocaleString()} detail="Both forecast and actual are present" />
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Panel title="Interval coverage" subtitle="Coverage uses 1,488 expected half-hour delivery periods for January 2026.">
            <Coverage label="Actual observations" value={data.actual_coverage_percent} count={data.actual_intervals} total={data.expected_intervals} />
            <Coverage label="Forecast observations selected" value={data.forecast_coverage_percent} count={data.forecast_intervals} total={data.expected_intervals} />
            <Coverage label="Valid aligned evaluation pairs" value={data.aligned_coverage_percent} count={data.valid_aligned_pairs} total={data.expected_intervals} />
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
              <p className="text-muted">Null generations <strong className="ml-1 text-ink">{data.null_generation_records}</strong></p>
              <p className="text-muted">Invalid timestamps <strong className="ml-1 text-ink">{data.invalid_records}</strong></p>
              <p className="text-muted">Missing actual intervals <strong className="ml-1 text-ink">{data.missing_actual_intervals}</strong></p>
              <p className="text-muted">Missing forecast intervals <strong className="ml-1 text-ink">{data.missing_forecast_intervals}</strong></p>
            </div>
          </Panel>
          <Panel title="Source & conventions" subtitle="Verified endpoints and canonical processing">
            <div className="space-y-4 text-xs leading-5 text-slate-600">
              <p><strong className="text-ink">Actuals:</strong> <a className="text-emerald-800 underline" href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">Elexon FUELHH stream</a>, filtered to fuelType WIND using settlementDateFrom/To.</p>
              <p><strong className="text-ink">Forecasts:</strong> <a className="text-emerald-800 underline" href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">Elexon WINDFOR stream</a>, downloaded in publication-time windows because the endpoint has no delivery-time query parameter.</p>
              <p>Delivery <code>startTime</code> and forecast <code>publishTime</code> are normalized and compared in UTC. Dates shown to decision-makers use Europe/London (January is GMT).</p>
              <p>Generation is shown as average power in MW. Half-hour interval energy, if required, is MW × 0.5 hours; this dashboard does not relabel MW as MWh.</p>
              <p>When duplicate forecast delivery/publication pairs exist, a deterministic stable ordering chooses one record. Null values remain missing; they are never converted to zero.</p>
              <p>Default cutoff is 11:00 Europe/London on the preceding calendar day. Only forecasts published at or before that per-delivery-date cutoff can be selected.</p>
            </div>
          </Panel>
        </div>
        <Panel className="mt-5" title="Methodology & limitations">
          <ul className="list-disc space-y-2 pl-5 text-xs leading-5 text-slate-600">
            <li>Error = forecast − actual; MAE, RMSE, bias, WAPE, and absolute-error percentiles use valid aligned pairs only.</li>
            <li>Coverage is reported separately from accuracy. Missing/mismatched 30-minute actual and forecast intervals are not interpolated or silently imputed.</li>
            <li>The forecast feed may use a coarser delivery resolution than FUELHH actuals; this implementation aligns exact timestamps only.</li>
            <li>Forecast shortfall relative to actual wind is not the utility’s procurement requirement. Demand and other sources are outside scope.</li>
            <li>For Elexon history, records are persisted locally after retrieval. The API does not provide pagination for these stream routes; history is requested in bounded daily windows with retry/backoff.</li>
          </ul>
        </Panel>
      </>}
    </RequestState>
  );
}

function Coverage({ label, value, count, total }: { label: string; value: number; count: number; total: number }) {
  return <div className="mb-4">
    <div className="mb-2 flex justify-between gap-3 text-xs"><span className="font-medium text-ink">{label}</span><span className="tabular-nums text-muted">{value.toFixed(1)}% · {count.toLocaleString()} / {total.toLocaleString()}</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
  </div>;
}

export default function App() {
  const configuredSource = import.meta.env.VITE_DEFAULT_SOURCE;
  const defaultSource: SourceMode =
    configuredSource === "demo" ||
    configuredSource === "csv" ||
    configuredSource === "unavailable" ||
    configuredSource === "elexon"
      ? configuredSource
      : "elexon";
  const [filters, setFilters] = useState<Filters>({
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    cutoffTime: "11:00",
    source: defaultSource,
  });
  const context = useMemo(() => ({ filters, setFilters }), [filters]);
  return <Context.Provider value={context}><Layout /></Context.Provider>;
}
