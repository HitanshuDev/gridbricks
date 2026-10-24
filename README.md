# WindScope | Day-Ahead Analytics

WindScope is a historical decision-support MVP for examining national UK wind generation forecasts and actuals during January 2026. It reconstructs which Elexon forecast was available at a configurable day-ahead decision cutoff, aligns the selected forecasts to actual delivery intervals, and reports accuracy and data coverage.

> **Scope boundary:** this application analyzes wind generation only. It cannot calculate an electricity utility's total procurement requirement without consumer demand and other relevant supply information.

## Screenshots

Screenshots will be added after a reviewed deployment. No screenshots in this repository represent live observations.

## What is included

- Responsive React, TypeScript, Tailwind dashboard with overview, accuracy, decision explorer, and data-quality pages.
- FastAPI API and independently tested pandas/NumPy analytics.
- Elexon BMRS FUELHH and WINDFOR historical data clients, CSV imports, explicit synthetic demo mode, and a truthful unavailable state.
- Cutoff-aware forecast selection, actual alignment, coverage reporting, CSV export, local historical cache, retries, and bounded API requests.
- Docker Compose setup, production frontend build, Render/Vercel deployment configuration, OpenAPI at `/docs`.

## Architecture

```text
Browser (React/Vite) ── /api proxy ── FastAPI
       │                                 ├── Elexon FUELHH / WINDFOR client
       ├── Recharts                       ├── CSV import or synthetic demo provider
       └── CSV download                   ├── UTC normalization + analytics
                                          └── persistent JSON cache
```

The backend owns provider selection, normalization, cutoff filtering, interval alignment, and metrics. The frontend only presents typed API results and never invents observations.

## Technology

- React 18, TypeScript, Vite, Tailwind CSS, React Router, Recharts, Lucide
- Python 3.12, FastAPI, Pydantic, pandas, NumPy, HTTPX, pytest
- Docker and Docker Compose

## Quick start with Docker

1. Copy `.env.example` to `.env` and adjust settings if needed.
2. Run `docker compose up --build`.
3. Open [http://localhost:8080](http://localhost:8080); the API docs are at [http://localhost:8080/docs](http://localhost:8080/docs) and the health route is [http://localhost:8080/api/health](http://localhost:8080/api/health).

The Compose frontend proxies `/api` to the backend container. Set the source selector to **Synthetic demo data** to explore an explicitly synthetic, deterministic dataset without waiting for Elexon. The default source is official Elexon; the first request downloads January actuals and the required publication history, then stores a persistent cache in the `windscope-data` volume. The stream endpoints are not paginated; forecast history is fetched in daily publication-time windows, with a bounded worker count, timeouts, retry/backoff, and HTTP error handling.

To keep the initial page quick or work offline, set `DATA_MODE=unavailable` in `.env`; no measurements will be generated. Compose passes `DATA_MODE` through as the frontend's initial source selection. The UI source selector can switch among Elexon, demo, CSV, and unavailable modes for the current session. For standalone frontend builds, set `VITE_DEFAULT_SOURCE` to the same provider mode.

## Local development without Docker

### Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DATA_MODE=demo uvicorn app.main:app --reload --port 8000
```

API docs: [http://localhost:8000/docs](http://localhost:8000/docs). For official data, use `DATA_MODE=elexon`. For an offline empty state, use `DATA_MODE=unavailable`.

### Frontend

```bash
cd frontend
npm install
VITE_DEFAULT_SOURCE=demo npm run dev
```

Vite proxies `/api` to `http://localhost:8000` by default. Override this with `VITE_DEV_API_PROXY` if the backend runs elsewhere. Set `VITE_DEFAULT_SOURCE=elexon`, `csv`, or `unavailable` to start with another source selection.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATA_MODE` | `elexon` | Initial provider: `elexon`, `demo`, `csv`, or `unavailable` |
| `DATA_DIR` | `backend/data` | Persistent location for the Elexon JSON cache |
| `CSV_DIR` | `backend/data/imports` | Directory containing `actuals.csv` and `forecasts.csv` |
| `ELEXON_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1` | Elexon API root |
| `API_TIMEOUT_SECONDS` | `30` | Per-request HTTP timeout |
| `API_MAX_RETRIES` | `4` | Retries for network failures, 429, and server errors |
| `CORS_ORIGINS` | Local Vite and Docker origins | Comma-separated allowed backend origins |
| `VITE_API_BASE_URL` | `/api` in Docker; same-origin path otherwise | Frontend API origin; for Vercel set to the deployed backend origin, without `/api` |
| `VITE_DEFAULT_SOURCE` | `elexon` | Initial frontend provider selection; Compose maps `DATA_MODE` to this build argument |
| `FRONTEND_PORT` | `8080` | Local Docker frontend port |

Do not put API credentials or secrets in the frontend environment. The current documented Elexon read endpoints do not require a secret.

## Data sources and contract

- [Elexon BMRS API documentation](https://bmrs.elexon.co.uk/api-documentation)
- [FUELHH stream documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
- [WINDFOR stream documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)
- [Elexon OpenAPI specification](https://data.elexon.co.uk/swagger/v1/swagger.json)

The OpenAPI contract confirms:

- FUELHH accepts `settlementDateFrom`, `settlementDateTo`, and `fuelType`; the app requests only January 2026 and WIND.
- WINDFOR accepts `publishDateTimeFrom` and `publishDateTimeTo`, but no delivery-time filter or pagination parameters. The app downloads publication history from December 31, 2025 through January 30, 2026 in bounded daily windows, then filters to January delivery intervals.
- Both response schemas contain `startTime`, `publishTime`, and nullable integer `generation`; FUELHH also has `fuelType`, `settlementDate`, and `settlementPeriod`. These are parsed from the actual documented response shape, not guessed API properties.
- January 2026 FUELHH observations and WINDFOR publication history were reachable when the API contract was checked. Continued historical availability depends on Elexon's service and retention policies; if retrieval fails, WindScope reports unavailable rather than presenting synthetic observations as official.

The canonical schema is `delivery_time`, `publish_time` (null for actuals), `generation_mw`, `source`, `fuel_type`, and `record_type`. Timestamps are normalized to UTC; decision cutoffs are interpreted in Europe/London. Elexon's generation values are displayed as MW (average power over a delivery interval), not MWh. If interval energy is ever derived, a half-hour interval is `MW × 0.5 h`.

### CSV import

Place two UTF-8 files in `CSV_DIR`:

- `actuals.csv`: official FUELHH export columns, including `startTime`, `generation`, and `fuelType` (only WIND rows are retained).
- `forecasts.csv`: official WINDFOR export columns, including `startTime`, `publishTime`, and `generation`.

Date strings must be ISO-8601. Null `generation` values remain missing. Imported rows receive a clear **Imported Elexon CSV** provenance label; use only official exports if presenting them as official data. CSV import does not combine records with the network provider.

With Docker Compose, place the files in `backend/data/imports/`; this host directory is mounted read-only into the backend container.

## Cutoff, selection, and analytics

The default is 11:00 Europe/London on the calendar day before each delivery date. This is a configurable scenario cutoff, **not a claim that 11:00 is the official gate-closure time for a specific customer or market product**; confirm the customer's operational deadline before relying on this setting. The January dates are GMT, but zone-aware conversion is implemented.

For each delivery interval, WindScope:

1. Normalizes publication and delivery timestamps to UTC.
2. Computes the delivery date's prior-day London cutoff and converts it to UTC.
3. Discards forecast publications after that cutoff.
4. Selects the latest eligible publication for that delivery interval.
5. Aligns selected forecast and actual values using exact `startTime` equality; it does not interpolate coarser forecast intervals.

Error = forecast − actual. Forecast shortfall relative to actual = actual − forecast. MAE, RMSE, mean bias, absolute-error percentiles, and WAPE use only non-null aligned pairs. WAPE is N/A when total actual generation is not positive. No MAPE is used. Missing/null values are not filled with zero. January coverage is measured against 1,488 expected half-hour intervals; forecast/actual availability and valid aligned sample count are reported separately.

## Run checks

```bash
cd backend && python -m pytest
cd frontend && npm test
cd frontend && npm run build
```

For Python 3.12 environments, the pinned requirements are recommended. API tests use FastAPI TestClient and deterministic demo fixtures; they do not depend on a live Elexon call.

## Deployment

No public deployment has been performed by this implementation. No deployment URL is claimed.

### Backend on Render

1. Push this directory to a GitHub repository.
2. Create a Render Blueprint from `render.yaml`, or create a Python web service with root directory `backend`, build command `pip install -r requirements.txt`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers`, and health path `/api/health`.
3. Set `CORS_ORIGINS` to the exact Vercel app origin (comma-separated, no wildcard). Set `DATA_MODE=elexon`.
4. For durable caching/imports, attach a persistent disk at `/var/data`; set `DATA_DIR=/var/data` and `CSV_DIR=/var/data/imports`. Without a persistent disk, local cache files may be lost on restart.
5. Verify `https://<your-render-service>/api/health` and `/docs`.

### Frontend on Vercel

1. Import the repository and set project root to `frontend`.
2. Set `VITE_API_BASE_URL` to the backend origin (for example, `https://your-service.onrender.com`, not a made-up or localhost URL).
3. Deploy and verify the app plus an API-backed page; add the exact Vercel origin to backend `CORS_ORIGINS`.

The Docker Compose deployment uses Nginx to proxy `/api` internally. Vercel uses the configured backend API origin instead. Keep those topologies distinct.

## Limitations and next steps

- The evaluation is restricted to national wind actuals and forecasts; it is not a complete balancing or procurement model.
- Forecast delivery cadence can differ from FUELHH's half-hourly cadence. Only exact delivery timestamp matches are paired.
- A historical backtest depends on availability of the Elexon publication history. It is not a live January 2026 feed.
- Validate the customer's operational cutoff, reporting timezone preferences, and data retention before operational use.
- Synthetic values exist only for UI/testing and are visibly labeled; they are never combined with Elexon data.
- The MVP has no user authentication, trading functionality, prices, demand, or non-wind generation.

## AI-use disclosure

GitHub Copilot (Copilot SDK in VS Code) was used to assist with implementation and documentation. ChatGPT was not used as a separate implementation tool for this workspace. All data contract, code, and test claims should be independently reviewed before production use.
