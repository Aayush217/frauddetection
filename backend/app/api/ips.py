import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import hash_pii, require_analyst, require_admin, UserAuth
from app.db.neo4j import execute_cypher
from app.models.common import DeleteResponse, PaginatedResponse
from app.models.ip import IPCreate, IPLink, IPRead, IPUpdate

router = APIRouter(prefix="/ips", tags=["IPs"])


@router.get("", response_model=PaginatedResponse[IPRead])
async def list_ips(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    country: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: UserAuth = Depends(require_analyst),
):
    """List IP addresses with pagination, country filtering, and search."""
    skip = (page - 1) * page_size
    where_clauses = []
    params = {"skip": skip, "limit": page_size}

    if country:
        where_clauses.append("i.country = $country")
        params["country"] = country.upper()
    if search:
        where_clauses.append("(toLower(i.id) CONTAINS toLower($search) OR i.address_hash CONTAINS $search)")
        params["search"] = search.strip()

    where_stmt = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    count_query = f"MATCH (i:IP) {where_stmt} RETURN count(i) AS total"
    count_res = execute_cypher(count_query, params)
    total = count_res[0]["total"] if count_res else 0

    data_query = f"""
    MATCH (i:IP)
    {where_stmt}
    RETURN
        i.id AS id,
        i.address_hash AS address_hash,
        coalesce(i.country, 'XX') AS country,
        COUNT {{ (:Account)-[:LOGGED_FROM]->(i) }} AS account_count
    ORDER BY account_count DESC, i.id ASC
    SKIP $skip
    LIMIT $limit
    """
    records = execute_cypher(data_query, params)

    items = [
        IPRead(
            id=r["id"],
            address_hash=r["address_hash"],
            country=r["country"],
            account_count=r["account_count"],
        )
        for r in records
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse[IPRead](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{ip_id}")
async def get_ip_detail(
    ip_id: str,
    current_user: UserAuth = Depends(require_analyst),
):
    """Get IP detail and inspect connected accounts."""
    query = """
    MATCH (i:IP {id: $ip_id})
    OPTIONAL MATCH (a:Account)-[lf:LOGGED_FROM]->(i)
    OPTIONAL MATCH (u:User)-[:OWNS]->(a)
    RETURN
        i.id AS id,
        i.address_hash AS address_hash,
        i.country AS country,
        collect(DISTINCT {
            account_id: a.id,
            status: a.status,
            risk_score: a.risk_score,
            user_name: u.name,
            count: lf.count,
            last_seen: lf.last_seen
        }) AS accounts
    """
    records = execute_cypher(query, {"ip_id": ip_id})
    if not records or not records[0].get("id"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IP with ID '{ip_id}' not found",
        )

    rec = records[0]
    accounts = [acc for acc in rec.get("accounts", []) if acc.get("account_id")]

    return {
        "id": rec["id"],
        "address_hash": rec["address_hash"],
        "country": rec["country"],
        "account_count": len(accounts),
        "accounts": accounts,
    }


@router.post("", response_model=IPRead, status_code=status.HTTP_201_CREATED)
async def create_ip(
    data: IPCreate,
    current_user: UserAuth = Depends(require_analyst),
):
    """Create a new IP node. Cryptographically hashes IP address to prevent PII exposure."""
    ip_id = data.id or f"ip_{uuid.uuid4().hex[:8]}"

    addr_hash = data.address_hash
    if not addr_hash:
        raw = data.raw_address or f"192.168.{uuid.uuid4().int % 255}.{uuid.uuid4().int % 255}"
        addr_hash = hash_pii(raw)

    query = """
    CREATE (i:IP {
        id: $id,
        address_hash: $address_hash,
        country: $country
    })
    RETURN i.id AS id, i.address_hash AS address_hash, i.country AS country
    """
    records = execute_cypher(query, {
        "id": ip_id,
        "address_hash": addr_hash,
        "country": data.country.upper(),
    })
    r = records[0]

    return IPRead(
        id=r["id"],
        address_hash=r["address_hash"],
        country=r["country"],
        account_count=0,
    )


@router.post("/link")
async def link_account_ip(
    data: IPLink,
    current_user: UserAuth = Depends(require_analyst),
):
    """Link an Account to an IP via (:Account)-[:LOGGED_FROM]->(:IP)."""
    last_seen = data.last_seen or datetime.now(timezone.utc).isoformat()

    query = """
    MATCH (a:Account {id: $account_id})
    MATCH (i:IP {id: $ip_id})
    MERGE (a)-[r:LOGGED_FROM]->(i)
    ON CREATE SET r.count = $count, r.last_seen = $last_seen
    ON MATCH SET r.count = r.count + $count, r.last_seen = $last_seen
    RETURN a.id AS account_id, i.id AS ip_id, r.count AS count, r.last_seen AS last_seen
    """
    records = execute_cypher(query, {
        "account_id": data.account_id,
        "ip_id": data.ip_id,
        "count": data.count,
        "last_seen": last_seen,
    })
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account or IP ID not found",
        )

    return {"message": "Account linked to IP successfully", "link": records[0]}


@router.patch("/{ip_id}")
async def update_ip(
    ip_id: str,
    data: IPUpdate,
    current_user: UserAuth = Depends(require_analyst),
):
    """Update IP country."""
    if not data.country:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No country specified")

    query = """
    MATCH (i:IP {id: $id})
    SET i.country = $country
    RETURN i.id AS id, i.address_hash AS address_hash, i.country AS country
    """
    records = execute_cypher(query, {"id": ip_id, "country": data.country.upper()})
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"IP '{ip_id}' not found")
    return records[0]


@router.delete("/{ip_id}", response_model=DeleteResponse)
async def delete_ip(
    ip_id: str,
    confirm: bool = Query(default=False, description="Explicit confirmation flag required for permanent deletion"),
    current_user: UserAuth = Depends(require_admin),
):
    """Admin-only DETACH DELETE for IP nodes."""
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deletion of graph nodes requires explicit confirmation flag (?confirm=true)",
        )

    check = execute_cypher("MATCH (i:IP {id: $id}) RETURN i.id AS id", {"id": ip_id})
    if not check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"IP '{ip_id}' not found")

    execute_cypher("MATCH (i:IP {id: $id}) DETACH DELETE i", {"id": ip_id}, fetch_records=False)

    return DeleteResponse(
        success=True,
        deleted_id=ip_id,
        message=f"IP '{ip_id}' detached and deleted.",
    )
