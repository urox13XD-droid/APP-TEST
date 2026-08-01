import cv2
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _encode_png(image_bgr) -> bytes:
    ok, buf = cv2.imencode(".png", image_bgr)
    assert ok
    return buf.tobytes()


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_full_upload_process_export_flow(two_shapes_image):
    png_bytes = _encode_png(two_shapes_image)
    r = client.post("/api/upload", files={"file": ("test.png", png_bytes, "image/png")})
    assert r.status_code == 200
    session_id = r.json()["session_id"]

    r = client.post(f"/api/process/{session_id}", json={"mode": "artistic", "thickness_mm": 4.0})
    assert r.status_code == 200
    graph = r.json()["graph"]
    assert graph["stats"]["is_fully_connected"] is True
    assert len(graph["nodes"]) > 0
    assert len(graph["edges"]) > 0

    r = client.get(f"/api/session/{session_id}/export/svg")
    assert r.status_code == 200
    assert "svg" in r.headers["content-type"]

    r = client.get(f"/api/session/{session_id}/export/stl")
    assert r.status_code == 200

    edge_id = graph["edges"][0]["id"]
    r = client.post(f"/api/session/{session_id}/edit", json={"type": "delete_edge", "edge_id": edge_id})
    assert r.status_code == 200
    assert r.json()["graph"]["stats"]["is_fully_connected"] is True


def test_process_unknown_session_404():
    r = client.post("/api/process/does-not-exist", json={})
    assert r.status_code == 404


def test_upload_rejects_bad_file():
    r = client.post("/api/upload", files={"file": ("bad.png", b"not an image", "image/png")})
    assert r.status_code == 400
