import { AlertCircle, ArrowDownToLine, LoaderCircle, Wind } from "lucide-react";
import type { ReactNode } from "react";
import type { Provenance } from "../types";

export function ProvenanceBadge({ provenance, label }: { provenance: Provenance; label: string }) {
  const style = {
    official: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    synthetic: "bg-amber-50 text-amber-900 ring-amber-200",
    csv: "bg-blue-50 text-blue-800 ring-blue-200",
    unavailable: "bg-slate-100 text-slate-600 ring-slate-200",
  }[provenance];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function Panel({ title, subtitle, action, children, className = "" }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title = "No observations available", message }: { title?: string; message: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-white p-3 text-slate-400 shadow-sm"><Wind size={20} /></div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-5 text-muted">{message}</p>
    </div>
  );
}

export function RequestState({ loading, error, retry, children }: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-5" aria-label="Loading analysis">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/60" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/60" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 text-red-700" size={19} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">Unable to load this analysis</p>
            <p className="mt-1 text-sm text-red-800">{error}</p>
            <button className="mt-4 rounded-lg bg-red-800 px-3 py-2 text-xs font-semibold text-white hover:bg-red-900" onClick={retry}>Retry</button>
          </div>
        </div>
      </div>
    );
  }
  return children;
}

export function MetricCard({ label, value, unit, detail, accent = false }: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="panel relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1 ${accent ? "bg-amber-400" : "bg-emerald-600"}`} />
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted">{detail}</p>
    </div>
  );
}

export function ExportButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="inline-flex self-start items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50" onClick={onClick} disabled={disabled}>
      <ArrowDownToLine size={15} /> Export CSV
    </button>
  );
}

export function InlineLoading() {
  return <span className="inline-flex items-center gap-2 text-xs text-muted"><LoaderCircle size={14} className="animate-spin" /> Loading</span>;
}
