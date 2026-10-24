# WindScope architecture

## Components and responsibilities

```text
React SPA / Vite / Tailwind
  ├─ React Router page views: overview, accuracy, decision, data quality
  ├─ typed API client, query state, cancellation and retry
  └─ Recharts visualizations and CSV download
             │ /api
FastAPI application
  ├─ routes.py: HTTP parameters, validation, response models
  ├─ services/elexon.py: HTTP access, retries, daily forecast windows, cache, CSV
  ├─ services/dataset.py: provider selection, normalization, source provenance
  └─ analytics/engine.py: deterministic cleaning, cutoff selection, alignment, metrics
             │
       Elexon BMRS API or local CSV / synthetic test provider
```

## Request and data flow

1. A page reads the shared date range, cutoff time, and explicit source mode.
2. The frontend sends a cancellable typed request to FastAPI. The Vite proxy or Docker Nginx forwards `/api`; a Vercel build uses `VITE_API_BASE_URL`.
3. The backend loads provider data. Elexon history is requested only when the local persistent cache is absent or unreadable. Actuals are bounded by settlement date and WIND. Forecasts are retrieved in publication-date windows covering the first delivery day's decision cutoff through the last delivery day's prior-day cutoff.
4. Response records are validated and mapped to the canonical internal schema. Null generation is retained; malformed timestamps are counted and dropped.
5. Duplicate actual delivery timestamps resolve to the latest publication; duplicate forecast delivery/publication pairs are ordered deterministically. Data are then restricted to January 2026.
6. Each forecast delivery interval receives a prior-day London cutoff. Eligible forecasts are selected before actuals are joined. Alignment is exact timestamp equality.
7. The API returns provenance, metrics, aligned rows, coverage, and aggregates. The UI never creates observational values.

## API boundaries

- `GET /api/health`: liveness check.
- `GET /api/metadata`: product, period, timezone, default cutoff and source configuration.
- `GET /api/dashboard`: filtered aligned interval series, summary metrics, daily aggregates and coverage.
- `GET /api/accuracy`: metrics, error histogram, forecast/actual scatter and hourly breakdown.
- `GET /api/forecasts`: delivery-day cutoff simulation and post-delivery outcomes.
- `GET /api/data-quality`: raw/normalized/duplicate/null counts and coverage diagnostics.
- `GET /api/export.csv`: filtered aligned dataset, with missing values left blank.

The OpenAPI schema is available at `/docs` and `/openapi.json`. CORS is configured through `CORS_ORIGINS`. Business calculations are in the analytics/service modules rather than route handlers.

## Key decisions and trade-offs

- **Historical, not live:** January 2026 is treated as a historical period. No live/current data are passed off as January.
- **Publication filter first:** selecting by `publishTime` before joining actuals prevents look-ahead leakage. The publication exactly at the cutoff is eligible; a later one is not.
- **Exact timestamp alignment:** forecasts and actuals can have different temporal resolutions. No interpolation or implicit aggregation is introduced.
- **JSON file cache:** a single idempotent historical cache avoids a database for a fixed-month MVP. It is stored on a named Compose volume; production deployments should attach a persistent disk.
- **Daily bounded pulls:** the documented WINDFOR stream accepts publication time but no delivery-time bound or pagination. The client requests daily windows with a maximum of two concurrent calls; this trades first-load latency for historical completeness and controlled request size.
- **No automatic synthetic fallback:** the user must select demo data or configure it. Network failures produce an unavailable state; synthetic and official records are never mixed.
- **Configurable 11:00 cutoff:** this is a clearly labeled default analysis scenario, not an asserted official gate closure; customer operations must confirm it.

## Failure handling

- Elexon calls have configurable timeouts and retry/backoff for transient network errors, 429 responses and server errors. HTTP failures are logged and become a truthful unavailable data state.
- A validated persistent cache is reused. Writes are atomic (temporary file followed by rename).
- Invalid response shapes fail explicitly; malformed rows are counted, and null generations are preserved.
- API date/cutoff validation returns 422. CSV mode requires both expected files and logs missing/invalid import conditions.
- Frontend requests are abortable on navigation/filter changes. HTTP/network errors render a retry state; empty successful responses render unavailable/empty UI instead.
- Production CORS must be set to the exact frontend origin.

## Testing strategy

- Unit tests verify cutoff boundaries, latest eligible forecast selection, timestamp normalization, duplicate policy, null/zero semantics, exact alignment, known metric values, zero-denominator WAPE, empty data, and January bounds.
- FastAPI TestClient tests verify health, response shapes, validation, cutoff simulation and CSV response behavior using deterministic synthetic data.
- Vitest and React Testing Library verify provenance, empty and unavailable metric components.
- Frontend type-check and Vite production build validate the shipped bundle.
- Live Elexon availability is checked separately; deterministic tests do not depend on network access.

## Deployment topology

- Docker Compose runs FastAPI and Nginx-served Vite production output. Nginx proxies `/api` to the backend service over the private Compose network.
- Vercel serves the static frontend; `VITE_API_BASE_URL` points to the separate backend's origin. The backend `CORS_ORIGINS` must include the deployed Vercel origin.
- `render.yaml` prepares a native Render Python service. Attach a persistent disk to retain cache/import files across restarts.
- No deployment URL or successful public deployment is claimed by this repository.
