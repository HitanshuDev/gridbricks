from __future__ import annotations

import json
import logging
import random
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time as clock_time, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
import pandas as pd

from app.core.config import settings

logger = logging.getLogger(__name__)


class ElexonError(RuntimeError):
    pass


def _get_json(dataset: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    url = f"{settings.elexon_base_url}/datasets/{dataset}/stream"
    retries = settings.api_max_retries
    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=settings.api_timeout_seconds) as client:
                response = client.get(url, params=params)
            if response.status_code == 429 or response.status_code >= 500:
                if attempt < retries:
                    retry_after = response.headers.get("Retry-After")
                    delay = (
                        min(float(retry_after), 30)
                        if retry_after and retry_after.isdigit()
                        else min(2**attempt + random.random(), 30)
                    )
                    time.sleep(delay)
                    continue
            response.raise_for_status()
            try:
                payload = response.json()
            except ValueError as exc:
                raise ElexonError("Elexon returned invalid JSON.") from exc
            if isinstance(payload, dict) and isinstance(payload.get("data"), list):
                payload = payload["data"]
            if not isinstance(payload, list) or not all(
                isinstance(item, dict) for item in payload
            ):
                raise ElexonError("Elexon returned an unexpected response shape.")
            return payload
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            if attempt >= retries:
                raise ElexonError("Elexon request failed after retries.") from exc
            time.sleep(min(2**attempt + random.random(), 30))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429 or exc.response.status_code >= 500:
                if attempt < retries:
                    time.sleep(min(2**attempt + random.random(), 30))
                    continue
            raise ElexonError(
                f"Elexon request failed with HTTP {exc.response.status_code}."
            ) from exc
    raise ElexonError("Elexon request failed after retries.")


def _fetch_publication_day(day: date) -> list[dict[str, Any]]:
    start = datetime.combine(day, clock_time.min, tzinfo=timezone.utc)
    end = datetime.combine(day, clock_time.max.replace(microsecond=0), tzinfo=timezone.utc)
    return _get_json(
        "WINDFOR",
        {
            "publishDateTimeFrom": start.isoformat().replace("+00:00", "Z"),
            "publishDateTimeTo": end.isoformat().replace("+00:00", "Z"),
        }
    )


def fetch_january_2026() -> dict[str, Any]:
    cache_path = settings.data_dir / "cache" / "elexon-january-2026.json"
    if cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text())
            if isinstance(cached, dict) and "actuals" in cached and "forecasts" in cached:
                return cached
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Ignoring unreadable Elexon cache: %s", exc)

    actuals = _get_json(
        "FUELHH",
        {
            "settlementDateFrom": "2026-01-01",
            "settlementDateTo": "2026-01-31",
            "fuelType": ["WIND"],
        }
    )
    publication_days = [
        date(2025, 12, 31) + timedelta(days=offset) for offset in range(31)
    ]
    with ThreadPoolExecutor(max_workers=2) as pool:
        forecast_batches = list(pool.map(_fetch_publication_day, publication_days))
    forecasts = [row for batch in forecast_batches for row in batch]

    dataset = {"actuals": actuals, "forecasts": forecasts}
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = cache_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(dataset, separators=(",", ":")))
    temporary.replace(cache_path)
    logger.info(
        "Cached Elexon January dataset: %d actual and %d forecast records",
        len(actuals),
        len(forecasts),
    )
    return dataset


def load_csv_dataset(directory: Path) -> dict[str, Any]:
    actual_path = directory / "actuals.csv"
    forecast_path = directory / "forecasts.csv"
    if not actual_path.is_file() or not forecast_path.is_file():
        raise FileNotFoundError(
            f"CSV mode requires {actual_path.name} and {forecast_path.name} in {directory}."
        )
    actuals = pd.read_csv(actual_path).to_dict(orient="records")
    forecasts = pd.read_csv(forecast_path).to_dict(orient="records")
    return {"actuals": actuals, "forecasts": forecasts}
