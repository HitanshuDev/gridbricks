import {
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import type { Accuracy, Interval } from "../types";

const axis = { fontSize: 10, fill: "#829089" };
const grid = "#edf1ee";
const tooltipStyle = { border: "1px solid #e4ebe6", borderRadius: 10, fontSize: 11 };
const mw = (value: number) => `${Math.round(value).toLocaleString()} MW`;

export function ForecastActualChart({ rows }: { rows: Interval[] }) {
  const data = rows.map((row) => ({
    ...row,
    time: new Date(row.delivery_time).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })
      + " " + new Date(row.delivery_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={268}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="time" tick={axis} minTickGap={40} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [mw(Number(value)), ""]} />
        <Line type="linear" dataKey="forecast_mw" name="Forecast" stroke="#16805c" strokeWidth={2} dot={false} connectNulls />
        <Line type="linear" dataKey="actual_mw" name="Actual" stroke="#31483d" strokeWidth={1.7} dot={false} connectNulls />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ErrorChart({ rows }: { rows: Interval[] }) {
  const data = rows.map((row) => ({
    time: new Date(row.delivery_time).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
    error: row.error_mw,
  }));
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={data} margin={{ top: 6, right: 12, left: -16, bottom: 4 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="time" tick={axis} minTickGap={40} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
        <ReferenceLine y={0} stroke="#9ca9a0" strokeDasharray="3 3" />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value == null ? "N/A" : mw(Number(value)), "Forecast − actual"]} />
        <Line type="linear" dataKey="error" stroke="#d88b35" strokeWidth={1.8} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function AccuracyCharts({ data }: { data: Accuracy }) {
  const maxVal = Math.max(0, ...data.scatter.flatMap((point) => [point.forecast_mw, point.actual_mw]));
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium text-muted">Forecast error distribution · MW</p>
        {data.error_histogram.length ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.error_histogram} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="midpoint_mw" tick={axis} tickFormatter={(v: number) => Math.round(v).toString()} tickLine={false} axisLine={false} />
              <YAxis tick={axis} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, items) => items[0]?.payload.range ?? ""} />
              <Bar dataKey="count" fill="#16805c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted">Forecast vs actual · ideal fit shown</p>
        {data.scatter.length ? (
          <ResponsiveContainer width="100%" height={250}>
            <ScatterChart margin={{ top: 8, right: 10, left: -16, bottom: 8 }}>
              <CartesianGrid stroke={grid} />
              <XAxis type="number" dataKey="forecast_mw" name="Forecast" tick={axis} tickLine={false} axisLine={false} />
              <YAxis type="number" dataKey="actual_mw" name="Actual" tick={axis} tickLine={false} axisLine={false} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxVal, y: maxVal }]} stroke="#9aa89f" strokeDasharray="4 4" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [mw(Number(value)), ""]} />
              <Scatter data={data.scatter} fill="#16805c" fillOpacity={0.5} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </div>
    </div>
  );
}

export function HourlyAccuracyChart({ data }: { data: Accuracy["hourly_breakdown"] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="hour" tick={axis} tickFormatter={(hour: number) => `${String(hour).padStart(2, "0")}:00`} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [mw(Number(value)), "MAE"]} />
        <Bar dataKey="mean_absolute_error_mw" fill="#d88b35" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EmptyChart() {
  return <div className="flex h-[250px] items-center justify-center rounded-lg bg-slate-50 text-xs text-muted">No valid aligned observations for this view.</div>;
}
