import os
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
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
