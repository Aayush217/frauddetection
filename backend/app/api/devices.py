import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import hash_pii, require_analyst, require_admin, UserAuth
from app.db.neo4j import execute_cypher
from app.models.common import DeleteResponse, PaginatedResponse
from app.models.device import DeviceCreate, DeviceLink, DeviceRead, DeviceUpdate

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("", response_model=PaginatedResponse[DeviceRead])
async def list_devices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    os: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: UserAuth = Depends(require_analyst),
):
    """
    List devices with pagination, OS filter, and search.
    """
    skip = (page - 1) * page_size
    where_clauses = []
    params = {"skip": skip, "limit": page_size}

    if os:
        where_clauses.append("d.os = $os")
        params["os"] = os
    if search:
        where_clauses.append("(toLower(d.id) CONTAINS toLower($search) OR d.fingerprint_hash CONTAINS $search)")
        params["search"] = search.strip()

    where_stmt = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    count_query = f"MATCH (d:Device) {where_stmt} RETURN count(d) AS total"
    count_res = execute_cypher(count_query, params)
    total = count_res[0]["total"] if count_res else 0

    data_query = f"""
    MATCH (d:Device)
    {where_stmt}
    RETURN
        d.id AS id,
        d.fingerprint_hash AS fingerprint_hash,
        coalesce(d.os, 'Unknown') AS os,
        coalesce(d.first_seen, '') AS first_seen,
        COUNT {{ (:Account)-[:USED_DEVICE]->(d) }} AS account_count
    ORDER BY account_count DESC, d.id ASC
    SKIP $skip
    LIMIT $limit
    """
    records = execute_cypher(data_query, params)

    items = [
        DeviceRead(
            id=r["id"],
            fingerprint_hash=r["fingerprint_hash"],
            os=r["os"],
            first_seen=r["first_seen"],
            account_count=r["account_count"],
        )
        for r in records
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse[DeviceRead](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{device_id}")
async def get_device_detail(
    device_id: str,
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Get device detail and inspect all accounts that have accessed it.
    Critical for investigating P1 shared-device rings.
    """
    query = """
    MATCH (d:Device {id: $device_id})
    OPTIONAL MATCH (a:Account)-[ud:USED_DEVICE]->(d)
    OPTIONAL MATCH (u:User)-[:OWNS]->(a)
    RETURN
        d.id AS id,
        d.fingerprint_hash AS fingerprint_hash,
        d.os AS os,
        d.first_seen AS first_seen,
        collect(DISTINCT {
            account_id: a.id,
            status: a.status,
            risk_score: a.risk_score,
            user_name: u.name,
            first_seen: ud.first_seen,
            last_seen: ud.last_seen
        }) AS accounts
    """
    records = execute_cypher(query, {"device_id": device_id})
    if not records or not records[0].get("id"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID '{device_id}' not found",
        )

    rec = records[0]
    accounts = [acc for acc in rec.get("accounts", []) if acc.get("account_id")]

    return {
        "id": rec["id"],
        "fingerprint_hash": rec["fingerprint_hash"],
        "os": rec["os"],
        "first_seen": rec["first_seen"],
        "account_count": len(accounts),
        "accounts": accounts,
    }


@router.post("", response_model=DeviceRead, status_code=status.HTTP_201_CREATED)
async def create_device(
    data: DeviceCreate,
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Create a new Device node. Fingerprint is hashed immediately to enforce zero raw PII.
    """
    dev_id = data.id or f"dev_{uuid.uuid4().hex[:8]}"

    fp_hash = data.fingerprint_hash
    if not fp_hash:
        raw = data.raw_fingerprint or f"fp_synthetic_{dev_id}"
        fp_hash = hash_pii(raw)

    query = """
    CREATE (d:Device {
        id: $id,
        fingerprint_hash: $fingerprint_hash,
        os: $os,
        first_seen: $first_seen
    })
    RETURN d.id AS id, d.fingerprint_hash AS fingerprint_hash, d.os AS os, d.first_seen AS first_seen
    """
    params = {
        "id": dev_id,
        "fingerprint_hash": fp_hash,
        "os": data.os,
        "first_seen": data.first_seen,
    }
    records = execute_cypher(query, params)
    r = records[0]

    return DeviceRead(
        id=r["id"],
        fingerprint_hash=r["fingerprint_hash"],
        os=r["os"],
        first_seen=r["first_seen"],
        account_count=0,
    )


@router.post("/link")
async def link_account_device(
    data: DeviceLink,
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Links an Account to a Device via (:Account)-[:USED_DEVICE]->(:Device).
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    first_seen = data.first_seen or now_iso
    last_seen = data.last_seen or now_iso

    query = """
    MATCH (a:Account {id: $account_id})
    MATCH (d:Device {id: $device_id})
    MERGE (a)-[r:USED_DEVICE]->(d)
    ON CREATE SET r.first_seen = $first_seen, r.last_seen = $last_seen
    ON MATCH SET r.last_seen = $last_seen
    RETURN a.id AS account_id, d.id AS device_id, r.first_seen AS first_seen, r.last_seen AS last_seen
    """
    records = execute_cypher(query, {
        "account_id": data.account_id,
        "device_id": data.device_id,
        "first_seen": first_seen,
        "last_seen": last_seen,
    })
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account or Device ID not found",
        )

    return {"message": "Account linked to device successfully", "link": records[0]}


@router.patch("/{device_id}")
async def update_device(
    device_id: str,
    data: DeviceUpdate,
    current_user: UserAuth = Depends(require_analyst),
):
    """Update device properties."""
    if not data.os:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update fields specified")

    query = """
    MATCH (d:Device {id: $id})
    SET d.os = $os
    RETURN d.id AS id, d.fingerprint_hash AS fingerprint_hash, d.os AS os, d.first_seen AS first_seen
    """
    records = execute_cypher(query, {"id": device_id, "os": data.os})
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")
    return records[0]


@router.delete("/{device_id}", response_model=DeleteResponse)
async def delete_device(
    device_id: str,
    confirm: bool = Query(default=False, description="Explicit confirmation flag required for permanent deletion"),
    current_user: UserAuth = Depends(require_admin),
):
    """
    Admin-only DETACH DELETE for Device nodes.
    """
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deletion of graph nodes requires explicit confirmation flag (?confirm=true)",
        )

    check = execute_cypher("MATCH (d:Device {id: $id}) RETURN d.id AS id", {"id": device_id})
    if not check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")

    execute_cypher("MATCH (d:Device {id: $id}) DETACH DELETE d", {"id": device_id}, fetch_records=False)

    return DeleteResponse(
        success=True,
        deleted_id=device_id,
        message=f"Device '{device_id}' detached and deleted.",
    )
