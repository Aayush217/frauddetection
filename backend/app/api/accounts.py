import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import require_analyst, require_admin, UserAuth
from app.db.neo4j import execute_cypher
from app.models.account import (
    AccountCreate,
    AccountRead,
    AccountUpdate,
    AccountReviewUpdate,
)
from app.models.common import DeleteResponse, PaginatedResponse

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.get("", response_model=PaginatedResponse[AccountRead])
async def list_accounts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    status: Optional[str] = Query(default=None),
    review_state: Optional[str] = Query(default=None),
    min_risk: Optional[float] = Query(default=None, ge=0.0, le=100.0),
    max_risk: Optional[float] = Query(default=None, ge=0.0, le=100.0),
    search: Optional[str] = Query(default=None),
    current_user: UserAuth = Depends(require_analyst),
):
    """
    List accounts with pagination and filters.
    Cypher queries are fully parameterized for injection safety.
    """
    skip = (page - 1) * page_size

    # Construct parameterized WHERE conditions
    where_clauses = []
    params = {"skip": skip, "limit": page_size}

    if status:
        where_clauses.append("a.status = $status")
        params["status"] = status
    if review_state:
        where_clauses.append("a.review_state = $review_state")
        params["review_state"] = review_state
    if min_risk is not None:
        where_clauses.append("a.risk_score >= $min_risk")
        params["min_risk"] = min_risk
    if max_risk is not None:
        where_clauses.append("a.risk_score <= $max_risk")
        params["max_risk"] = max_risk
    if search:
        where_clauses.append("(toLower(a.id) CONTAINS toLower($search) OR (EXISTS { MATCH (u:User)-[:OWNS]->(a) WHERE toLower(u.name) CONTAINS toLower($search) }))")
        params["search"] = search.strip()

    where_stmt = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Count total matching
    count_query = f"""
    MATCH (a:Account)
    {where_stmt}
    RETURN count(a) AS total
    """
    count_res = execute_cypher(count_query, params)
    total = count_res[0]["total"] if count_res else 0

    # Fetch paginated items with aggregations
    data_query = f"""
    MATCH (a:Account)
    {where_stmt}
    OPTIONAL MATCH (u:User)-[:OWNS]->(a)
    RETURN
        a.id AS id,
        a.status AS status,
        a.opened_at AS opened_at,
        coalesce(a.risk_score, 0.0) AS risk_score,
        coalesce(a.risk_reasons, []) AS risk_reasons,
        coalesce(a.review_state, 'unreviewed') AS review_state,
        u.id AS user_id,
        u.name AS user_name,
        COUNT {{ (a)-[:USED_DEVICE]->(:Device) }} AS device_count,
        COUNT {{ (a)-[:LOGGED_FROM]->(:IP) }} AS ip_count,
        COUNT {{ (a)-[:PAID_WITH]->(:Card) }} AS card_count,
        COUNT {{ (a)-[:SENT]->(:Account) }} AS sent_count,
        COUNT {{ (:Account)-[:SENT]->(a) }} AS received_count
    ORDER BY a.risk_score DESC, a.id ASC
    SKIP $skip
    LIMIT $limit
    """
    records = execute_cypher(data_query, params)

    items = [
        AccountRead(
            id=r["id"],
            status=r["status"] or "active",
            opened_at=r["opened_at"] or "",
            risk_score=float(r["risk_score"]),
            risk_reasons=r["risk_reasons"] or [],
            review_state=r["review_state"] or "unreviewed",
            user_id=r["user_id"],
            user_name=r["user_name"],
            device_count=r["device_count"],
            ip_count=r["ip_count"],
            card_count=r["card_count"],
            sent_count=r["sent_count"],
            received_count=r["received_count"],
        )
        for r in records
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse[AccountRead](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{account_id}")
async def get_account_detail(
    account_id: str,
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Get full investigation profile for a specific account:
    Includes user, connected devices, IPs, cards, and recent transfers.
    """
    query = """
    MATCH (a:Account {id: $account_id})
    OPTIONAL MATCH (u:User)-[:OWNS]->(a)
    OPTIONAL MATCH (a)-[ud:USED_DEVICE]->(d:Device)
    OPTIONAL MATCH (a)-[lf:LOGGED_FROM]->(i:IP)
    OPTIONAL MATCH (a)-[:PAID_WITH]->(c:Card)
    RETURN
        a.id AS id,
        a.status AS status,
        a.opened_at AS opened_at,
        coalesce(a.risk_score, 0.0) AS risk_score,
        coalesce(a.risk_reasons, []) AS risk_reasons,
        coalesce(a.review_state, 'unreviewed') AS review_state,
        u.id AS user_id,
        u.name AS user_name,
        collect(DISTINCT {
            id: d.id,
            os: d.os,
            fingerprint_hash: d.fingerprint_hash,
            first_seen: ud.first_seen,
            last_seen: ud.last_seen
        }) AS devices,
        collect(DISTINCT {
            id: i.id,
            country: i.country,
            address_hash: i.address_hash,
            count: lf.count,
            last_seen: lf.last_seen
        }) AS ips,
        collect(DISTINCT {
            id: c.id,
            last4: c.last4,
            issuer: c.issuer
        }) AS cards
    """
    records = execute_cypher(query, {"account_id": account_id})
    if not records or not records[0].get("id"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID '{account_id}' not found",
        )

    acc = records[0]

    # Fetch recent sent transfers (limit 15)
    sent_query = """
    MATCH (a:Account {id: $account_id})-[r:SENT]->(dst:Account)
    RETURN r.txn_id AS txn_id, dst.id AS to_account, r.amount AS amount, r.ts AS ts
    ORDER BY r.ts DESC
    LIMIT 15
    """
    sent_txns = execute_cypher(sent_query, {"account_id": account_id})

    # Fetch recent received transfers (limit 15)
    recv_query = """
    MATCH (src:Account)-[r:SENT]->(a:Account {id: $account_id})
    RETURN r.txn_id AS txn_id, src.id AS from_account, r.amount AS amount, r.ts AS ts
    ORDER BY r.ts DESC
    LIMIT 15
    """
    recv_txns = execute_cypher(recv_query, {"account_id": account_id})

    # Clean null collections resulting from OPTIONAL MATCH
    devices = [d for d in acc.get("devices", []) if d.get("id")]
    ips = [i for i in acc.get("ips", []) if i.get("id")]
    cards = [c for c in acc.get("cards", []) if c.get("id")]

    return {
        "id": acc["id"],
        "status": acc["status"],
        "opened_at": acc["opened_at"],
        "risk_score": float(acc["risk_score"]),
        "risk_reasons": acc["risk_reasons"] or [],
        "review_state": acc["review_state"],
        "owner": {"id": acc["user_id"], "name": acc["user_name"]} if acc.get("user_id") else None,
        "devices": devices,
        "ips": ips,
        "cards": cards,
        "recent_sent_transfers": sent_txns,
        "recent_received_transfers": recv_txns,
    }


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Create a new account node. Optionally attaches to an existing User.
    """
    account_id = data.id or f"acc_{uuid.uuid4().hex[:8]}"

    # Check for existing account
    existing = execute_cypher("MATCH (a:Account {id: $id}) RETURN a.id", {"id": account_id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Account with ID '{account_id}' already exists",
        )

    # Check user existence if user_id supplied
    if data.user_id:
        user_check = execute_cypher("MATCH (u:User {id: $id}) RETURN u.id", {"id": data.user_id})
        if not user_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID '{data.user_id}' does not exist",
            )

    create_query = """
    CREATE (a:Account {
        id: $id,
        status: $status,
        opened_at: $opened_at,
        risk_score: $risk_score,
        risk_reasons: $risk_reasons,
        review_state: $review_state
    })
    WITH a
    CALL {
        WITH a
        WITH a WHERE $user_id IS NOT NULL
        MATCH (u:User {id: $user_id})
        MERGE (u)-[:OWNS]->(a)
        RETURN count(u) AS dummy
    }
    RETURN a.id AS id, a.status AS status, a.opened_at AS opened_at,
           a.risk_score AS risk_score, a.risk_reasons AS risk_reasons,
           a.review_state AS review_state
    """
    params = {
        "id": account_id,
        "status": data.status.value,
        "opened_at": data.opened_at,
        "risk_score": data.risk_score,
        "risk_reasons": data.risk_reasons,
        "review_state": data.review_state.value,
        "user_id": data.user_id,
    }
    records = execute_cypher(create_query, params)
    r = records[0]

    return AccountRead(
        id=r["id"],
        status=r["status"],
        opened_at=r["opened_at"],
        risk_score=float(r["risk_score"]),
        risk_reasons=r["risk_reasons"] or [],
        review_state=r["review_state"],
        user_id=data.user_id,
    )


@router.patch("/{account_id}")
async def update_account(
    account_id: str,
    data: AccountUpdate,
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Update account status, risk score, risk reasons, or review state.
    """
    set_clauses = []
    params = {"id": account_id}

    if data.status is not None:
        set_clauses.append("a.status = $status")
        params["status"] = data.status.value
    if data.risk_score is not None:
        set_clauses.append("a.risk_score = $risk_score")
        params["risk_score"] = data.risk_score
    if data.risk_reasons is not None:
        set_clauses.append("a.risk_reasons = $risk_reasons")
        params["risk_reasons"] = data.risk_reasons
    if data.review_state is not None:
        set_clauses.append("a.review_state = $review_state")
        params["review_state"] = data.review_state.value

    if not set_clauses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    query = f"""
    MATCH (a:Account {{id: $id}})
    SET {', '.join(set_clauses)}
    RETURN a.id AS id, a.status AS status, a.risk_score AS risk_score,
           a.risk_reasons AS risk_reasons, a.review_state AS review_state
    """
    records = execute_cypher(query, params)
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID '{account_id}' not found",
        )

    return records[0]


@router.delete("/{account_id}", response_model=DeleteResponse)
async def delete_account(
    account_id: str,
    confirm: bool = Query(default=False, description="Explicit confirmation flag required for permanent deletion"),
    current_user: UserAuth = Depends(require_admin),
):
    """
    Delete an account using DETACH DELETE.
    Enforces admin role and mandatory confirmation flag per project specification.
    """
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deletion of graph nodes requires explicit confirmation flag (?confirm=true)",
        )

    # Check existence
    check = execute_cypher("MATCH (a:Account {id: $id}) RETURN a.id AS id", {"id": account_id})
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID '{account_id}' not found",
        )

    delete_query = """
    MATCH (a:Account {id: $id})
    DETACH DELETE a
    """
    execute_cypher(delete_query, {"id": account_id}, fetch_records=False)

    return DeleteResponse(
        success=True,
        deleted_id=account_id,
        message=f"Account '{account_id}' and all incident edges successfully detached and deleted by admin.",
    )
