import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { Interval } from "../types";

const format = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : Math.round(value).toLocaleString("en-GB");
const dateTime = (value: string | null, timeZone: string) =>
  value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone }) : "—";

export function IntervalTable({ rows }: { rows: Interval[] }) {
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = useMemo(() => rows.slice(page * pageSize, (page + 1) * pageSize), [rows, page]);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-[1000px] w-full text-left text-xs">
          <thead className="border-y border-line bg-slate-50/80 text-[10px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-3 font-semibold">Delivery · London</th>
              <th className="px-3 py-3 font-semibold">Published · UTC</th>
              <th className="px-3 py-3 text-right font-semibold">Age at cutoff h</th>
              <th className="px-3 py-3 text-right font-semibold">Forecast MW</th>
              <th className="px-3 py-3 text-right font-semibold">Actual MW</th>
              <th className="px-3 py-3 text-right font-semibold">Error MW</th>
              <th className="px-3 py-3 text-right font-semibold">Absolute MW</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => (
              <tr key={row.delivery_time} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-3 py-3 font-medium text-ink">{dateTime(row.delivery_time, "Europe/London")}</td>
                <td className="whitespace-nowrap px-3 py-3 text-muted">{dateTime(row.forecast_publish_time, "UTC")}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.forecast_age_hours == null ? "—" : row.forecast_age_hours.toFixed(1)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{format(row.forecast_mw)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{format(row.actual_mw)}</td>
                <td className={`px-3 py-3 text-right tabular-nums ${row.error_mw == null ? "text-muted" : row.error_mw > 0 ? "text-amber-700" : "text-emerald-800"}`}>{format(row.error_mw)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{format(row.absolute_error_mw)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td className="px-3 py-8 text-center text-muted" colSpan={7}>No intervals in the selected period.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 pt-3 text-xs text-muted">
        <span>{rows.length.toLocaleString()} intervals · values shown in MW</span>
        <div className="flex items-center gap-2">
          <button aria-label="Previous table page" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><ChevronLeft size={16} /></button>
          <span>{page + 1} / {pageCount}</span>
          <button aria-label="Next table page" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}><ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}
