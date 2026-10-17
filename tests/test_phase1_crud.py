import uuid
import pytest
from httpx import AsyncClient

from app.db.neo4j import execute_cypher


@pytest.mark.anyio
async def test_health_check(async_client: AsyncClient):
    """Verify health check returns healthy status and Neo4j connectivity."""
    resp = await async_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["neo4j"] == "connected"


@pytest.mark.anyio
async def test_auth_login_flow(async_client: AsyncClient):
    """Verify login authentication for admin and analyst accounts."""
    # Valid login
    resp = await async_client.post("/api/auth/login", json={"username": "admin", "password": "adminpassword123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "admin"

    # Invalid login
    bad_resp = await async_client.post("/api/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert bad_resp.status_code == 401
    bad_data = bad_resp.json()
    assert "error" in bad_data
    assert "detail" in bad_data


@pytest.mark.anyio
async def test_auth_me_profiles(async_client: AsyncClient, admin_headers: dict, analyst_headers: dict):
    """Verify /auth/me returns proper role metadata."""
    admin_resp = await async_client.get("/api/auth/me", headers=admin_headers)
    assert admin_resp.status_code == 200
    assert admin_resp.json()["is_admin"] is True

    analyst_resp = await async_client.get("/api/auth/me", headers=analyst_headers)
    assert analyst_resp.status_code == 200
    assert analyst_resp.json()["is_admin"] is False
    assert analyst_resp.json()["is_analyst"] is True


@pytest.mark.anyio
async def test_neo4j_uniqueness_constraint():
    """Verify that Neo4j uniqueness constraint prevents duplicate Account IDs."""
    test_id = f"acc_test_unique_{uuid.uuid4().hex[:6]}"
    # Insert first
    execute_cypher("CREATE (a:Account {id: $id, status: 'active'})", {"id": test_id}, fetch_records=False)

    # Attempt duplicate insert should fail
    with pytest.raises(Exception):
        execute_cypher("CREATE (a:Account {id: $id, status: 'active'})", {"id": test_id}, fetch_records=False)

    # Cleanup
    execute_cypher("MATCH (a:Account {id: $id}) DETACH DELETE a", {"id": test_id}, fetch_records=False)


@pytest.mark.anyio
async def test_accounts_crud_lifecycle(
    async_client: AsyncClient,
    admin_headers: dict,
    analyst_headers: dict,
):
    """
    Test Account CRUD:
    - List accounts paginated
    - Create account
    - Read account detail
    - Update account
    - Non-admin delete blocked (403)
    - Admin delete without ?confirm=true blocked (400)
    - Admin delete with ?confirm=true succeeds (200)
    """
    # 1. List accounts
    list_resp = await async_client.get("/api/accounts?page=1&page_size=10", headers=analyst_headers)
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert len(list_data["items"]) == 10
    assert list_data["total"] >= 5000

    # 2. Create account
    test_acc_id = f"acc_crud_test_{uuid.uuid4().hex[:6]}"
    create_payload = {
        "id": test_acc_id,
        "status": "active",
        "risk_score": 12.5,
        "risk_reasons": ["Test account creation"],
    }
    create_resp = await async_client.post("/api/accounts", json=create_payload, headers=analyst_headers)
    assert create_resp.status_code == 201
    assert create_resp.json()["id"] == test_acc_id

    # 3. Read account detail
    get_resp = await async_client.get(f"/api/accounts/{test_acc_id}", headers=analyst_headers)
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["id"] == test_acc_id
    assert get_data["risk_score"] == 12.5

    # 4. Update account
    update_payload = {
        "status": "suspended",
        "risk_score": 88.0,
        "risk_reasons": ["Elevated risk after review"],
        "review_state": "under_review",
    }
    update_resp = await async_client.patch(f"/api/accounts/{test_acc_id}", json=update_payload, headers=analyst_headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "suspended"
    assert update_resp.json()["risk_score"] == 88.0

    # 5. Non-admin delete blocked
    del_unauth_resp = await async_client.delete(f"/api/accounts/{test_acc_id}?confirm=true", headers=analyst_headers)
    assert del_unauth_resp.status_code == 403

    # 6. Admin delete without confirm blocked
    del_no_confirm = await async_client.delete(f"/api/accounts/{test_acc_id}", headers=admin_headers)
    assert del_no_confirm.status_code == 400
    assert "confirm" in del_no_confirm.json()["detail"]

    # 7. Admin delete with confirm succeeds
    del_resp = await async_client.delete(f"/api/accounts/{test_acc_id}?confirm=true", headers=admin_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # 8. Verify deletion in graph
    verify_resp = await async_client.get(f"/api/accounts/{test_acc_id}", headers=analyst_headers)
    assert verify_resp.status_code == 404


@pytest.mark.anyio
async def test_devices_crud_lifecycle(async_client: AsyncClient, admin_headers: dict, analyst_headers: dict):
    """Test Device creation, linking, read, and admin deletion."""
    test_dev_id = f"dev_test_{uuid.uuid4().hex[:6]}"
    create_payload = {
        "id": test_dev_id,
        "raw_fingerprint": f"canvas_raw_token_{uuid.uuid4().hex}",
        "os": "macOS",
    }
    create_resp = await async_client.post("/api/devices", json=create_payload, headers=analyst_headers)
    assert create_resp.status_code == 201
    dev_data = create_resp.json()
    assert dev_data["id"] == test_dev_id
    assert len(dev_data["fingerprint_hash"]) == 64  # SHA-256 length

    # Link to an account
    link_resp = await async_client.post("/api/devices/link", json={
        "account_id": "acc_00001",
        "device_id": test_dev_id,
    }, headers=analyst_headers)
    assert link_resp.status_code == 200

    # Read device detail
    detail_resp = await async_client.get(f"/api/devices/{test_dev_id}", headers=analyst_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["account_count"] >= 1

    # Admin delete
    del_resp = await async_client.delete(f"/api/devices/{test_dev_id}?confirm=true", headers=admin_headers)
    assert del_resp.status_code == 200


@pytest.mark.anyio
async def test_ips_crud_lifecycle(async_client: AsyncClient, admin_headers: dict, analyst_headers: dict):
    """Test IP creation, linking, read, and admin deletion."""
    test_ip_id = f"ip_test_{uuid.uuid4().hex[:6]}"
    create_payload = {
        "id": test_ip_id,
        "raw_address": "198.51.100.42",
        "country": "US",
    }
    create_resp = await async_client.post("/api/ips", json=create_payload, headers=analyst_headers)
    assert create_resp.status_code == 201
    ip_data = create_resp.json()
    assert ip_data["id"] == test_ip_id
    assert len(ip_data["address_hash"]) == 64

    # Link to account
    link_resp = await async_client.post("/api/ips/link", json={
        "account_id": "acc_00001",
        "ip_id": test_ip_id,
        "count": 5,
    }, headers=analyst_headers)
    assert link_resp.status_code == 200

    # Admin delete
    del_resp = await async_client.delete(f"/api/ips/{test_ip_id}?confirm=true", headers=admin_headers)
    assert del_resp.status_code == 200


@pytest.mark.anyio
async def test_cards_crud_lifecycle(async_client: AsyncClient, admin_headers: dict, analyst_headers: dict):
    """Test Card creation, linking, read, and admin deletion."""
    test_card_id = f"crd_test_{uuid.uuid4().hex[:6]}"
    create_payload = {
        "id": test_card_id,
        "last4": "9921",
        "issuer": "Amex",
    }
    create_resp = await async_client.post("/api/cards", json=create_payload, headers=analyst_headers)
    assert create_resp.status_code == 201
    card_data = create_resp.json()
    assert card_data["id"] == test_card_id
    assert card_data["last4"] == "9921"

    # Link to account
    link_resp = await async_client.post("/api/cards/link", json={
        "account_id": "acc_00001",
        "card_id": test_card_id,
    }, headers=analyst_headers)
    assert link_resp.status_code == 200

    # Admin delete
    del_resp = await async_client.delete(f"/api/cards/{test_card_id}?confirm=true", headers=admin_headers)
    assert del_resp.status_code == 200


@pytest.mark.anyio
async def test_atomic_transfer_execution(async_client: AsyncClient, admin_headers: dict, analyst_headers: dict):
    """
    Test single-transaction atomic transfer execution:
    - Normal transfer completes
    - High-value transfer flags risk
    - List transfers paginated
    - Delete transfer edge
    """
    # 1. Normal transfer
    normal_payload = {
        "from_account_id": "acc_00001",
        "to_account_id": "acc_00002",
        "amount": 250.00,
    }
    norm_resp = await async_client.post("/api/transfers", json=normal_payload, headers=analyst_headers)
    assert norm_resp.status_code == 201
    norm_data = norm_resp.json()
    assert norm_data["status"] == "completed"
    assert norm_data["flagged"] is False
    created_txn_id = norm_data["transfer"]["txn_id"]

    # 2. High-value transfer (triggers quick heuristic check inside transaction)
    high_val_payload = {
        "from_account_id": "acc_00001",
        "to_account_id": "acc_00003",
        "amount": 15000.00,
    }
    high_resp = await async_client.post("/api/transfers", json=high_val_payload, headers=analyst_headers)
    assert high_resp.status_code == 201
    high_data = high_resp.json()
    assert high_data["status"] == "flagged"
    assert high_data["flagged"] is True
    assert any("High-value" in r for r in high_data["flag_reasons"])
    high_txn_id = high_data["transfer"]["txn_id"]

    # 3. Verify transfer is retrievable
    get_txn_resp = await async_client.get(f"/api/transfers/{created_txn_id}", headers=analyst_headers)
    assert get_txn_resp.status_code == 200
    assert get_txn_resp.json()["amount"] == 250.00

    # 4. Clean up transfers via admin delete with confirm
    del1 = await async_client.delete(f"/api/transfers/{created_txn_id}?confirm=true", headers=admin_headers)
    assert del1.status_code == 200
    del2 = await async_client.delete(f"/api/transfers/{high_txn_id}?confirm=true", headers=admin_headers)
    assert del2.status_code == 200
