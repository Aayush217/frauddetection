from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.security import require_analyst, UserAuth
from app.db.neo4j import execute_cypher

router = APIRouter(prefix="/rings", tags=["Fraud Rings"])


class RingReviewUpdate(BaseModel):
    status: str = Field(..., description="confirmed | false_positive | under_review")
    notes: Optional[str] = Field(default=None, description="Analyst investigation notes")


class RingRead(BaseModel):
    id: str
    type: str
    pattern: str
    size: int
    score: float
    status: str
    description: str
    total_volume: float
    detected_at: Optional[str] = None
    member_account_ids: List[str] = Field(default_factory=list)


@router.get("", response_model=List[RingRead])
async def list_rings(
    type: Optional[str] = Query(default=None, description="Filter by ring type (shared_device, cycle, mule)"),
    status: Optional[str] = Query(default=None, description="Filter by status (unreviewed, confirmed, false_positive, under_review)"),
    min_score: Optional[float] = Query(default=None, ge=0.0, le=100.0),
    current_user: UserAuth = Depends(require_analyst),
):
    """
    List all detected fraud rings with type, size, risk score, and analyst review status.
    """
    where_clauses = []
    params = {}

    if type:
        where_clauses.append("r.type = $type")
        params["type"] = type
    if status:
        where_clauses.append("r.status = $status")
        params["status"] = status
    if min_score is not None:
        where_clauses.append("r.score >= $min_score")
        params["min_score"] = min_score

    where_stmt = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    query = f"""
    MATCH (r:Ring)
    {where_stmt}
    OPTIONAL MATCH (r)-[:HAS_MEMBER]->(a:Account)
    RETURN
        r.id AS id,
        r.type AS type,
        coalesce(r.pattern, 'P1') AS pattern,
        r.size AS size,
        r.score AS score,
        r.status AS status,
        r.description AS description,
        coalesce(r.total_volume, 0.0) AS total_volume,
        r.detected_at AS detected_at,
        collect(DISTINCT a.id) AS member_account_ids
    ORDER BY r.score DESC, r.size DESC
    """
    records = execute_cypher(query, params)

    return [
        RingRead(
            id=rec["id"],
            type=rec["type"],
            pattern=rec["pattern"],
            size=rec["size"],
            score=float(rec["score"]),
            status=rec["status"],
            description=rec["description"] or "",
            total_volume=float(rec["total_volume"]),
            detected_at=rec["detected_at"],
            member_account_ids=[m for m in rec["member_account_ids"] if m],
        )
        for rec in records
    ]


@router.get("/{ring_id}", response_model=RingRead)
async def get_ring_detail(
    ring_id: str,
    current_user: UserAuth = Depends(require_analyst),
):
    """Get single ring detail with its member accounts."""
    query = """
    MATCH (r:Ring {id: $ring_id})
    OPTIONAL MATCH (r)-[:HAS_MEMBER]->(a:Account)
    RETURN
        r.id AS id,
        r.type AS type,
        coalesce(r.pattern, 'P1') AS pattern,
        r.size AS size,
        r.score AS score,
        r.status AS status,
        r.description AS description,
        coalesce(r.total_volume, 0.0) AS total_volume,
        r.detected_at AS detected_at,
        collect(DISTINCT a.id) AS member_account_ids
    """
    records = execute_cypher(query, {"ring_id": ring_id})
    if not records or not records[0].get("id"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ring '{ring_id}' not found",
        )

    rec = records[0]
    return RingRead(
        id=rec["id"],
        type=rec["type"],
        pattern=rec["pattern"],
        size=rec["size"],
        score=float(rec["score"]),
        status=rec["status"],
        description=rec["description"] or "",
        total_volume=float(rec["total_volume"]),
        detected_at=rec["detected_at"],
        member_account_ids=[m for m in rec["member_account_ids"] if m],
    )


@router.patch("/{ring_id}/review")
async def review_ring(
    ring_id: str,
    data: RingReviewUpdate,
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Analyst review action on a detected fraud ring:
    Sets status to 'confirmed', 'false_positive', or 'under_review'.
    Propagates review state to member accounts.
    """
    valid_states = ["confirmed", "false_positive", "under_review", "unreviewed"]
    if data.status not in valid_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status must be one of {valid_states}",
        )

    # Update Ring status and propagate to member accounts
    update_query = """
    MATCH (r:Ring {id: $ring_id})
    SET r.status = $status,
        r.review_notes = $notes,
        r.reviewed_by = $username
    WITH r
    OPTIONAL MATCH (r)-[:HAS_MEMBER]->(a:Account)
    SET a.review_state = $status
    RETURN r.id AS id, r.status AS status, r.type AS type, r.size AS size,
           collect(DISTINCT a.id) AS updated_accounts
    """
    params = {
        "ring_id": ring_id,
        "status": data.status,
        "notes": data.notes,
        "username": current_user.username,
    }
    records = execute_cypher(update_query, params)
    if not records or not records[0].get("id"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ring '{ring_id}' not found",
        )

    rec = records[0]
    return {
        "ring_id": rec["id"],
        "status": rec["status"],
        "reviewed_by": current_user.username,
        "member_accounts_updated": len(rec["updated_accounts"]),
        "message": f"Ring '{ring_id}' marked as '{data.status}' by analyst {current_user.username}.",
    }
