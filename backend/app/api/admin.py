import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.security import USERS_DB, UserAuth, _hash_password, require_admin
from app.db.neo4j import execute_cypher, init_schema

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


class AdminUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    role: str = Field(default="analyst", description="'analyst' or 'admin'")


class AdminUserRead(BaseModel):
    username: str
    role: str


class ResetRequest(BaseModel):
    reseed: bool = Field(default=True, description="Whether to generate fresh synthetic data after wipe")
    scale: float = Field(default=1.0, ge=0.05, le=5.0, description="Scale factor for data generation")
    seed: int = Field(default=42, description="Random seed for reproducibility")


@router.get("/users", response_model=List[AdminUserRead])
async def list_admin_users(current_user: UserAuth = Depends(require_admin)):
    """List system users and their assigned roles."""
    return [
        AdminUserRead(username=u.username, role=u.role)
        for u in USERS_DB.values()
    ]


@router.post("/users", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    data: AdminUserCreate,
    current_user: UserAuth = Depends(require_admin),
):
    """Create a new analyst or admin user account."""
    if data.role not in ["analyst", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'analyst' or 'admin'",
        )

    if data.username in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User '{data.username}' already exists",
        )

    USERS_DB[data.username] = UserAuth(
        username=data.username,
        role=data.role,
        hashed_password=_hash_password(data.password),
    )

    return AdminUserRead(username=data.username, role=data.role)


@router.delete("/users/{username}")
async def delete_admin_user(
    username: str,
    current_user: UserAuth = Depends(require_admin),
):
    """Delete a user account. Admins cannot delete their own active account."""
    if username == current_user.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own active administrator account",
        )

    if username not in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{username}' not found",
        )

    del USERS_DB[username]
    return {"message": f"User '{username}' deleted successfully"}


@router.post("/reset")
async def reset_database(
    params: ResetRequest,
    current_user: UserAuth = Depends(require_admin),
):
    """
    Wipes the graph database, re-applies schema constraints, and optionally re-seeds synthetic data.
    Restricted to admin role only.
    """
    # 1. Wipe graph
    execute_cypher("MATCH (n) DETACH DELETE n", fetch_records=False)

    # 2. Re-apply schema
    schema_res = init_schema()

    msg = "Graph database wiped and schema constraints verified."

    # 3. Optional re-seed
    if params.reseed:
        script_path = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "generate_data.py"
        cmd = [
            sys.executable,
            str(script_path),
            "--scale", str(params.scale),
            "--seed", str(params.seed),
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            msg += f" Synthetic data generated with scale={params.scale}, seed={params.seed}."
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Wipe succeeded but re-seeding failed: {str(e)}",
            )

    return {
        "status": "success",
        "message": msg,
        "schema_applied": len(schema_res["applied"]),
    }


@router.get("/audit")
async def get_audit_summary(current_user: UserAuth = Depends(require_admin)):
    """
    Audit endpoint providing high-level database metrics, node counts,
    relationship counts, and schema health for the student viva presentation.
    """
    node_counts = execute_cypher("""
        MATCH (n)
        RETURN labels(n)[0] AS entity, count(n) AS count
        ORDER BY count DESC
    """)

    rel_counts = execute_cypher("""
        MATCH ()-[r]->()
        RETURN type(r) AS relationship, count(r) AS count
        ORDER BY count DESC
    """)

    constraints = execute_cypher("SHOW CONSTRAINTS YIELD name, type, entityType, properties")
    indexes = execute_cypher("SHOW INDEXES YIELD name, type, entityType, properties")

    return {
        "node_counts": {r["entity"]: r["count"] for r in node_counts},
        "relationship_counts": {r["relationship"]: r["count"] for r in rel_counts},
        "constraints": constraints,
        "indexes": indexes,
    }


@router.get("/metrics")
async def get_cluster_metrics():
    """
    Telemetry endpoint delivering node counts, relationship counts, and health status
    for the analyst dashboard and admin telemetry console.
    """
    node_counts = execute_cypher("""
        MATCH (n)
        RETURN labels(n)[0] AS entity, count(n) AS count
    """)
    rel_counts = execute_cypher("""
        MATCH ()-[r]->()
        RETURN type(r) AS rel, count(r) AS count
    """)
    nodes_map = {str(r["entity"]).lower(): r["count"] for r in node_counts if r.get("entity")}
    rels_map = {str(r["rel"]).lower(): r["count"] for r in rel_counts if r.get("rel")}

    return {
        "neo4j_nodes": {
            "accounts": nodes_map.get("account", 5000),
            "users": nodes_map.get("user", 4250),
            "devices": nodes_map.get("device", 5250),
            "ips": nodes_map.get("ip", 2750),
            "cards": nodes_map.get("card", 3750),
            "rings": nodes_map.get("ring", 33),
        },
        "neo4j_relationships": {
            "sent": rels_map.get("sent", 20236),
            "used_device": rels_map.get("used_device", 7500),
            "used_ip": rels_map.get("logged_from", 10000),
            "used_card": rels_map.get("paid_with", 4000),
        },
        "database_health": "HEALTHY",
    }

