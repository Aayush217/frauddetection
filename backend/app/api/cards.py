import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import require_analyst, require_admin, UserAuth
from app.db.neo4j import execute_cypher
from app.models.card import CardCreate, CardLink, CardRead, CardUpdate
from app.models.common import DeleteResponse, PaginatedResponse

router = APIRouter(prefix="/cards", tags=["Cards"])


@router.get("", response_model=PaginatedResponse[CardRead])
async def list_cards(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    issuer: Optional[str] = Query(default=None),
    last4: Optional[str] = Query(default=None),
    current_user: UserAuth = Depends(require_analyst),
):
    """List payment cards with pagination, issuer, and last4 filters."""
    skip = (page - 1) * page_size
    where_clauses = []
    params = {"skip": skip, "limit": page_size}

    if issuer:
        where_clauses.append("toLower(c.issuer) = toLower($issuer)")
        params["issuer"] = issuer
    if last4:
        where_clauses.append("c.last4 = $last4")
        params["last4"] = last4

    where_stmt = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    count_query = f"MATCH (c:Card) {where_stmt} RETURN count(c) AS total"
    count_res = execute_cypher(count_query, params)
    total = count_res[0]["total"] if count_res else 0

    data_query = f"""
    MATCH (c:Card)
    {where_stmt}
    RETURN
        c.id AS id,
        c.last4 AS last4,
        coalesce(c.issuer, 'Unknown') AS issuer,
        COUNT {{ (:Account)-[:PAID_WITH]->(c) }} AS account_count
    ORDER BY account_count DESC, c.id ASC
    SKIP $skip
    LIMIT $limit
    """
    records = execute_cypher(data_query, params)

    items = [
        CardRead(
            id=r["id"],
            last4=r["last4"],
            issuer=r["issuer"],
            account_count=r["account_count"],
        )
        for r in records
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse[CardRead](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{card_id}")
async def get_card_detail(
    card_id: str,
    current_user: UserAuth = Depends(require_analyst),
):
    """Get card detail and inspect accounts sharing this payment instrument."""
    query = """
    MATCH (c:Card {id: $card_id})
    OPTIONAL MATCH (a:Account)-[:PAID_WITH]->(c)
    OPTIONAL MATCH (u:User)-[:OWNS]->(a)
    RETURN
        c.id AS id,
        c.last4 AS last4,
        c.issuer AS issuer,
        collect(DISTINCT {
            account_id: a.id,
            status: a.status,
            risk_score: a.risk_score,
            user_name: u.name
        }) AS accounts
    """
    records = execute_cypher(query, {"card_id": card_id})
    if not records or not records[0].get("id"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card with ID '{card_id}' not found",
        )

    rec = records[0]
    accounts = [acc for acc in rec.get("accounts", []) if acc.get("account_id")]

    return {
        "id": rec["id"],
        "last4": rec["last4"],
        "issuer": rec["issuer"],
        "account_count": len(accounts),
        "accounts": accounts,
    }


@router.post("", response_model=CardRead, status_code=status.HTTP_201_CREATED)
async def create_card(
    data: CardCreate,
    current_user: UserAuth = Depends(require_analyst),
):
    """Create a new payment card node."""
    card_id = data.id or f"crd_{uuid.uuid4().hex[:8]}"

    query = """
    CREATE (c:Card {
        id: $id,
        last4: $last4,
        issuer: $issuer
    })
    RETURN c.id AS id, c.last4 AS last4, c.issuer AS issuer
    """
    records = execute_cypher(query, {
        "id": card_id,
        "last4": data.last4,
        "issuer": data.issuer,
    })
    r = records[0]

    return CardRead(
        id=r["id"],
        last4=r["last4"],
        issuer=r["issuer"],
        account_count=0,
    )


@router.post("/link")
async def link_account_card(
    data: CardLink,
    current_user: UserAuth = Depends(require_analyst),
):
    """Link an Account to a Card via (:Account)-[:PAID_WITH]->(:Card)."""
    query = """
    MATCH (a:Account {id: $account_id})
    MATCH (c:Card {id: $card_id})
    MERGE (a)-[:PAID_WITH]->(c)
    RETURN a.id AS account_id, c.id AS card_id
    """
    records = execute_cypher(query, {
        "account_id": data.account_id,
        "card_id": data.card_id,
    })
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account or Card ID not found",
        )

    return {"message": "Account linked to Card successfully", "link": records[0]}


@router.patch("/{card_id}")
async def update_card(
    card_id: str,
    data: CardUpdate,
    current_user: UserAuth = Depends(require_analyst),
):
    """Update Card issuer."""
    if not data.issuer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No issuer specified")

    query = """
    MATCH (c:Card {id: $id})
    SET c.issuer = $issuer
    RETURN c.id AS id, c.last4 AS last4, c.issuer AS issuer
    """
    records = execute_cypher(query, {"id": card_id, "issuer": data.issuer})
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Card '{card_id}' not found")
    return records[0]


@router.delete("/{card_id}", response_model=DeleteResponse)
async def delete_card(
    card_id: str,
    confirm: bool = Query(default=False, description="Explicit confirmation flag required for permanent deletion"),
    current_user: UserAuth = Depends(require_admin),
):
    """Admin-only DETACH DELETE for Card nodes."""
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deletion of graph nodes requires explicit confirmation flag (?confirm=true)",
        )

    check = execute_cypher("MATCH (c:Card {id: $id}) RETURN c.id AS id", {"id": card_id})
    if not check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Card '{card_id}' not found")

    execute_cypher("MATCH (c:Card {id: $id}) DETACH DELETE c", {"id": card_id}, fetch_records=False)

    return DeleteResponse(
        success=True,
        deleted_id=card_id,
        message=f"Card '{card_id}' detached and deleted.",
    )
