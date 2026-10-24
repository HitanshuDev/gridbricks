from app.services import elexon


def test_client_uses_documented_dataset_stream_path(monkeypatch) -> None:
    captured = {}

    class Response:
        status_code = 200
        headers = {}

        def raise_for_status(self):
            return None

        def json(self):
            return [{"startTime": "2026-01-01T00:00:00Z"}]

    class Client:
        def __init__(self, timeout):
            captured["timeout"] = timeout

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def get(self, url, params):
            captured["url"] = url
            captured["params"] = params
            return Response()

    monkeypatch.setattr(elexon.httpx, "Client", Client)
    result = elexon._get_json("FUELHH", {"fuelType": ["WIND"]})

    assert result[0]["startTime"] == "2026-01-01T00:00:00Z"
    assert captured["url"].endswith("/datasets/FUELHH/stream")
    assert captured["params"] == {"fuelType": ["WIND"]}
    assert captured["timeout"] == elexon.settings.api_timeout_seconds
