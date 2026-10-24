import os
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Settings:
    data_mode: str = os.getenv("DATA_MODE", "elexon").lower()
    data_dir: Path = Path(os.getenv("DATA_DIR", str(ROOT / "data")))
    csv_dir: Path = Path(os.getenv("CSV_DIR", str(ROOT / "data" / "imports")))
    elexon_base_url: str = os.getenv(
        "ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1"
    ).rstrip("/")
    api_timeout_seconds: float = float(os.getenv("API_TIMEOUT_SECONDS", "30"))
    api_max_retries: int = int(os.getenv("API_MAX_RETRIES", "4"))
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    )


settings = Settings()


def prepare_storage() -> None:
    """Create configured storage, falling back visibly when a host path is not writable."""
    try:
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        settings.csv_dir.mkdir(parents=True, exist_ok=True)
        return
    except OSError as exc:
        fallback = ROOT / "data" / "runtime"
        fallback_imports = fallback / "imports"
        fallback.mkdir(parents=True, exist_ok=True)
        fallback_imports.mkdir(parents=True, exist_ok=True)
        previous_data_dir = settings.data_dir
        previous_csv_dir = settings.csv_dir
        settings.data_dir = fallback
        settings.csv_dir = fallback_imports
        import logging

        logging.getLogger(__name__).warning(
            "Configured storage is unavailable (%s; data=%s, imports=%s). "
            "Using ephemeral application storage at %s; cache and imports may not "
            "survive a restart. Attach a persistent disk to retain data.",
            exc,
            previous_data_dir,
            previous_csv_dir,
            fallback,
        )
