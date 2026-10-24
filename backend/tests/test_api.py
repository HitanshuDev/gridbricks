from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_dashboard_returns_demo_data_and_metrics() -> None:
    response = client.get("/api/dashboard?source=demo&start_date=2026-01-01&end_date=2026-01-02")
    assert response.status_code == 200
    body = response.json()
    assert body["provenance"] == "synthetic"
    assert body["metrics"]["valid_pairs"] == 96
    assert len(body["intervals"]) == 96


def test_accuracy_exposes_daily_and_hourly_breakdowns() -> None:
    response = client.get("/api/accuracy?source=demo&start_date=2026-01-01&end_date=2026-01-01")
    assert response.status_code == 200
    body = response.json()
    assert len(body["daily_breakdown"]) == 1
    assert len(body["hourly_breakdown"]) > 0


def test_forecast_endpoint_returns_clear_cutoff_and_caveat() -> None:
    response = client.get("/api/forecasts?source=demo&delivery_date=2026-01-15&cutoff_time=11:00")
    assert response.status_code == 200
    body = response.json()
    assert body["decision_cutoff"] == "2026-01-14T11:00:00Z"
    assert "cannot be calculated" in body["note"]
    assert all(row["forecast_publish_time"] <= body["decision_cutoff"] for row in body["intervals"])


def test_export_csv_contains_missing_values_without_zero_imputation() -> None:
    response = client.get("/api/export.csv?source=unavailable&start_date=2026-01-01&end_date=2026-01-01")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "delivery_time" in response.text
    assert "forecast_mw" in response.text


def test_date_range_validation_is_explicit() -> None:
    response = client.get("/api/dashboard?source=demo&start_date=2026-01-10&end_date=2026-01-02")
    assert response.status_code == 422


def test_dates_outside_january_are_rejected() -> None:
    response = client.get("/api/dashboard?source=demo&start_date=2025-12-31&end_date=2026-01-02")
    assert response.status_code == 422
