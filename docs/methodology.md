# WindScope data and evaluation methodology

## Source and canonical schema

Official sources:

- [FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
- [WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)
- [Elexon OpenAPI JSON](https://data.elexon.co.uk/swagger/v1/swagger.json)

FUELHH is requested for settlement dates January 1–31, 2026 and `fuelType=WIND`. WINDFOR history is requested using `publishDateTimeFrom` and `publishDateTimeTo` windows from December 31, 2025 through January 30, 2026; the forecast endpoint does not expose a delivery-time query parameter or pagination in its documented stream operation. After retrieval, both datasets are restricted to delivery timestamps in `[2026-01-01T00:00:00Z, 2026-02-01T00:00:00Z)`.

The response contract includes `startTime`, `publishTime`, nullable integer `generation`; FUELHH also carries `fuelType`. It is normalized to:

| Canonical field | Meaning |
| --- | --- |
| `delivery_time` | `startTime`, timezone-aware UTC |
| `publish_time` | Forecast `publishTime`; null for actual observations |
| `generation_mw` | Generation power value; null remains null |
| `source` | Elexon, CSV import, or synthetic provenance |
| `fuel_type` | FUELHH fuel type, WIND for retained actuals |
| `record_type` | `actual` or `forecast` |

The generation values are represented and displayed in MW (power). A MW observation for a half-hour settlement period is not an MWh quantity. Interval energy could be derived as `generation_mw × 0.5 hours`, but this product does not derive it.

## Cutoff convention

The default evaluation scenario uses 11:00 Europe/London on the calendar day before delivery. This is configurable by `cutoff_time`. It is a declared analysis scenario, not confirmation of any specific market gate closure or customer procurement decision deadline. Validate the applicable process before operational use.

The target delivery time is interpreted in Europe/London to identify the preceding calendar day; the cutoff is then converted to UTC. January 2026 uses GMT (UTC+0), but the implementation uses the IANA timezone rather than a hard-coded offset.

## Forecast selection

For every target delivery interval `d`:

1. Compute `cutoff(d) = prior London calendar date at configured cutoff_time`, converted to UTC.
2. Keep records for `d` where `publish_time <= cutoff(d)`.
3. Select the row with the maximum eligible `publish_time`.
4. If there is no eligible publication, leave the selected forecast missing.

Publication time is never substituted with delivery time. A later forecast cannot leak into the simulated decision. A publication exactly at the cutoff is allowed. The selected row's forecast age is `(cutoff - publish_time)` in hours.

## Duplicates and missing records

- Actuals are unique by delivery timestamp; when repeated, a deterministic sort by delivery, publication and generation retains the last (latest publication, with stable generation ordering for ties).
- Forecasts are unique by delivery and publication timestamp; deterministic generation ordering resolves duplicate keys.
- Invalid timestamps are counted and discarded. Null generation remains missing. Zero is a valid observed generation and is not treated as missing.
- Selected forecasts and actuals are joined on exact UTC delivery timestamp. No interpolation, carry-forward, aggregation, or zero fill occurs.
- Unmatched/missing records remain visible in the interval table and do not contribute to paired error metrics.

## Metrics

For valid intervals with both a selected forecast and actual:

- `error = forecast − actual`
- `absolute error = abs(forecast − actual)`
- `forecast shortfall relative to actual = actual − forecast`
- `MAE = mean(abs(error))`
- `RMSE = sqrt(mean(error²))`
- `mean bias error = mean(error)`
- `WAPE = sum(abs(error)) / sum(actual) × 100`, only when `sum(actual) > 0`
- P50, P90 and P95 are quantiles of absolute error.

The sample count is disclosed. When it is zero, metrics are `N/A`/null, not zero. MAPE is not a primary metric because actual wind may be zero or close to zero.

## Coverage

January 2026 has 31 calendar days and 1,488 expected half-hour intervals. Actual and selected forecast coverage are separately calculated as unique interval counts divided by 1,488. Valid aligned pair count and coverage are reported separately. Since WINDFOR can be coarser than FUELHH, exact timestamp alignment may yield lower paired coverage; this is disclosed, not filled.

## Procurement interpretation and limitations

An actual-minus-forecast wind shortfall quantifies wind forecast deviation only. It is not total load shortfall or a procurement instruction. Demand, other generation, interconnectors, storage, portfolio positions, prices, constraints, balancing actions, and commercial rules are out of scope. Do not use these outputs as a complete procurement decision without those inputs, operational policy and human review.

Historical publication coverage and API retention are external dependencies. A retrieval failure must remain visibly unavailable. Synthetic demo observations are deterministic for UI/testing and are labeled as synthetic; they must never be cited as official forecast performance.
