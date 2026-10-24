# WindScope demo script (maximum 10 minutes)

## Part 1 — Customer presentation (target 4:30, maximum 5:00)

### 0:00–0:40 · Set the context

“Day-ahead procurement teams must act before delivery, while wind output is weather-dependent. WindScope makes the wind forecast available at a stated decision cutoff visible and compares it with the later Elexon actual. This is a focused pilot view of national wind only, not a complete procurement calculator.”

### 0:40–1:30 · Dashboard overview

Open the overview page. Point out the January 2026 historical period, the provenance badge, actual/forecast coverage and missing intervals. Select **Synthetic demo data** only if official data are still loading or unavailable; point out the persistent synthetic banner and say clearly that its values are for UI demonstration only.

Explain latest selected publication, forecast average, actual average, MAE/RMSE/WAPE, and valid pair count. If official data are visible, state their displayed provenance; avoid describing the synthetic values as observations.

### 1:30–2:30 · Forecast and accuracy

Show the forecast-vs-actual line chart and error-over-time chart. Explain signed error as forecast minus actual and show how the zero line distinguishes over- from under-forecast. Open **Accuracy analysis** and point out the scatter's ideal diagonal, error distribution, time-of-day breakdown, and the sample count.

### 2:30–3:30 · Reconstruct a decision

Open **Day-ahead explorer**, select a January delivery date and a decision cutoff. Explain that the cutoff applies on the previous day in London time and that a forecast published after the cutoff is excluded. Start in **Pre-delivery decision** view; then reveal post-delivery actuals to illustrate hindsight evaluation without contaminating the simulated choice.

### 3:30–4:30 · Value and boundary

Open the interval table or export CSV. Close with the value: an auditable view of forecast vintage, forecast uncertainty and historical error supports a better-informed wind assessment. Read the caution: “Wind generation forecast only. Total electricity procurement requirements cannot be calculated without electricity demand and other relevant supply information.”

## Part 2 — Technical lead review (target 4:30, maximum 5:00)

### 0:00–0:45 · Architecture

Show the repository tree and architecture document. Explain React/TypeScript visualizations, the typed FastAPI boundary, pandas analytics, and Elexon/CSV/synthetic/unavailable providers.

### 0:45–1:40 · Data contract and normalization

Open `backend/app/services/elexon.py` and point to the documented FUELHH settlement-date/fuel-type query and WINDFOR publication-time windows. Show the canonical fields and UTC normalization in `backend/app/analytics/engine.py`. Explain that WINDFOR has publication-time filters but no documented delivery-time filter or pagination, so the client uses bounded daily windows and persistent local caching.

### 1:40–2:30 · No look-ahead selection

Walk through `cutoff_for_delivery` and `select_latest_forecasts`. Demonstrate the comparison `publish_time <= cutoff`, the prior-day London interpretation, and exact `delivery_time` alignment. Mention that a coarser forecast interval is not interpolated.

### 2:30–3:20 · Metrics and tests

Show the metric implementation, missing-value handling, and WAPE denominator guard. Run `cd backend && python -m pytest` and `cd frontend && npm test && npm run build`. Point to the tests covering equality/after-cutoff, duplicates, nulls, zero values, empty data, timezone and API validation.

### 3:20–4:30 · Operations, failures and deployment

Show `docker-compose.yml`, the backend health check, retry/timeout configuration, and the `/api/health` endpoint. Explain official data failure leads to unavailable, not synthetic fallback. Show `.env.example`, Render configuration and the Vercel API-base environment variable. Explain that public deployment and video publishing require the owner's repository/hosting/video accounts and have not been claimed as completed.

## Recording checklist

- [ ] Publish the intended public repository; remove local imports or private data first.
- [ ] Run tests and production build; show the actual result.
- [ ] Verify the backend health URL and OpenAPI page from a logged-out/incognito browser.
- [ ] Verify the deployed frontend, API CORS and source/provenance behavior in incognito.
- [ ] If no public app is available, record the working local Docker/demo workflow and state that no deployment URL exists.
- [ ] Keep the combined recording at or under 10 minutes (Part 1 ≤5, Part 2 ≤5).
- [ ] Do not describe synthetic demo values as Elexon records.
- [ ] Upload as an unlisted YouTube video only after reviewing the recording; share the URL yourself.
- [ ] Do not include secrets, credentials, private CSV data, or browser account details.
