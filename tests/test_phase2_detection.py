import pytest
from httpx import AsyncClient

from scripts.evaluate_accuracy import run_evaluation


@pytest.mark.anyio
async def test_detection_accuracy_report():
    """
    Asserts precision and recall per pattern against ground_truth.json.
    Ensures mathematical and algorithmic correctness for student viva.
    """
    metrics = run_evaluation()

    # Pattern P1: Shared-device rings
    assert metrics["p1"]["recall"] >= 0.90, f"P1 Recall too low: {metrics['p1']['recall']}"
    assert metrics["p1"]["precision"] >= 0.90, f"P1 Precision too low: {metrics['p1']['precision']}"
    assert metrics["p1"]["tp"] == 15

    # Pattern P2: Circular money flows
    assert metrics["p2"]["recall"] >= 0.90, f"P2 Recall too low: {metrics['p2']['recall']}"
    assert metrics["p2"]["precision"] >= 0.90, f"P2 Precision too low: {metrics['p2']['precision']}"
    assert metrics["p2"]["tp"] == 10

    # Pattern P3: Mule account structures
    assert metrics["p3"]["recall"] >= 0.90, f"P3 Recall too low: {metrics['p3']['recall']}"
    assert metrics["p3"]["precision"] >= 0.80, f"P3 Precision too low: {metrics['p3']['precision']}"
    assert metrics["p3"]["tp"] == 8


@pytest.mark.anyio
async def test_detection_endpoints(async_client: AsyncClient, analyst_headers: dict):
    """
    Tests detection API endpoints:
    - GET /api/detect/shared-devices
    - GET /api/detect/cycles
    - GET /api/detect/mules
    - Verifies Cypher query text is returned for student viva explanation.
    """
    # 1. Shared Devices
    sd_resp = await async_client.get("/api/detect/shared-devices?min_accounts=4", headers=analyst_headers)
    assert sd_resp.status_code == 200
    sd_data = sd_resp.json()
    assert sd_data["pattern"] == "P1"
    assert "cypher_query" in sd_data
    assert len(sd_data["results"]) == 15

    # 2. Cycles
    cyc_resp = await async_client.get("/api/detect/cycles?min_len=3&max_len=6&window_hours=72&min_volume=1000", headers=analyst_headers)
    assert cyc_resp.status_code == 200
    cyc_data = cyc_resp.json()
    assert cyc_data["pattern"] == "P2"
    assert "cypher_query" in cyc_data
    assert len(cyc_data["results"]) == 10

    # 3. Mules
    mule_resp = await async_client.get("/api/detect/mules?min_fan_in=5&min_inflow=10000", headers=analyst_headers)
    assert mule_resp.status_code == 200
    mule_data = mule_resp.json()
    assert mule_data["pattern"] == "P3"
    assert "cypher_query" in mule_data
    assert len(mule_data["results"]) == 8


@pytest.mark.anyio
async def test_shortest_path_endpoint(async_client: AsyncClient, analyst_headers: dict):
    """Test shortest path discovery between suspect accounts."""
    resp = await async_client.get("/api/paths/shortest?from=acc_00001&to=acc_00002", headers=analyst_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is True
    assert "nodes" in data
    assert "relationships" in data
    assert "cypher_query" in data


@pytest.mark.anyio
async def test_gds_analysis_and_risk_scoring(async_client: AsyncClient, analyst_headers: dict):
    """
    Test POST /api/analysis/run:
    Executes Louvain, PageRank, Betweenness, and computes explainable risk scores.
    """
    resp = await async_client.post("/api/analysis/run", headers=analyst_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert "metrics" in data
    assert data["metrics"]["total_accounts_scored"] == 5000
    assert data["metrics"]["louvain_communities"] > 0
    assert data["metrics"]["rings_detected"]["total_rings"] >= 33


@pytest.mark.anyio
async def test_rings_and_analyst_review_workflow(async_client: AsyncClient, analyst_headers: dict):
    """
    Test GET /api/rings and PATCH /api/rings/{id}/review:
    - Lists detected rings
    - Analyst marks ring as 'confirmed'
    - Verifies review state propagates to member accounts
    """
    # List rings
    rings_resp = await async_client.get("/api/rings", headers=analyst_headers)
    assert rings_resp.status_code == 200
    rings = rings_resp.json()
    assert len(rings) >= 33

    target_ring = rings[0]
    ring_id = target_ring["id"]

    # Review action: mark as confirmed
    review_payload = {
        "status": "confirmed",
        "notes": "Verified fraudulent circular flow by senior analyst",
    }
    patch_resp = await async_client.patch(f"/api/rings/{ring_id}/review", json=review_payload, headers=analyst_headers)
    assert patch_resp.status_code == 200
    patch_data = patch_resp.json()
    assert patch_data["status"] == "confirmed"
    assert patch_data["member_accounts_updated"] > 0

    # Verify ring detail reflects confirmed status
    detail_resp = await async_client.get(f"/api/rings/{ring_id}", headers=analyst_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["status"] == "confirmed"
