from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.core.security import require_analyst, UserAuth
from app.services.detection import DetectionService

router = APIRouter(prefix="", tags=["Detection Algorithms"])


@router.get("/detect/shared-devices")
async def detect_shared_devices(
    min_accounts: int = Query(default=4, ge=2, description="Minimum number of accounts sharing a device"),
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Pattern P1: Shared-device / shared-IP rings.
    Detects hardware devices accessed by many distinct accounts.
    Returns detected rings, member accounts, shared IPs, and the exact parameterized Cypher query for the viva.
    """
    return DetectionService.detect_shared_devices(min_accounts=min_accounts)


@router.get("/detect/cycles")
async def detect_cycles(
    min_len: int = Query(default=3, ge=3, le=6, description="Minimum cycle path length (hops)"),
    max_len: int = Query(default=6, ge=3, le=6, description="Maximum cycle path length (capped at 6)"),
    window_hours: float = Query(default=72.0, ge=1.0, description="Maximum time window in hours for cycle to close"),
    min_volume: float = Query(default=1000.0, ge=0.0, description="Minimum total cycle volume in currency units"),
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Pattern P2: Circular money flows (A -> B -> C -> A).
    Detects closed transfer loops within a time window.
    Caps variable-length paths to avoid combinatorial explosion.
    Returns detected cycles and the exact parameterized Cypher query for the viva.
    """
    return DetectionService.detect_cycles(
        min_len=min_len,
        max_len=max_len,
        window_hours=window_hours,
        min_volume=min_volume,
    )


@router.get("/detect/mules")
async def detect_mules(
    min_fan_in: int = Query(default=4, ge=2, description="Minimum number of distinct feeder accounts"),
    max_dwell_hours: float = Query(default=24.0, ge=0.5, description="Maximum dwell time between deposits and fan-out"),
    min_inflow: float = Query(default=2000.0, ge=0.0, description="Minimum accumulated inflow volume"),
    min_outflow_ratio: float = Query(default=0.70, ge=0.1, le=1.0, description="Minimum outflow-to-inflow percentage"),
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Pattern P3: Mule account structures.
    Detects high fan-in followed by rapid fan-out with short dwell time.
    Returns detected mule structures and the exact parameterized Cypher query for the viva.
    """
    return DetectionService.detect_mules(
        min_fan_in=min_fan_in,
        max_dwell_hours=max_dwell_hours,
        min_inflow=min_inflow,
        min_outflow_ratio=min_outflow_ratio,
    )


@router.get("/paths/shortest")
async def get_shortest_path(
    from_id: str = Query(..., alias="from", description="Source node ID (e.g., acc_00001)"),
    to_id: str = Query(..., alias="to", description="Target node ID (e.g., acc_00005)"),
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Shortest relational path query between two entities up to 6 hops.
    Reveals hidden multi-step connections between suspects.
    Returns path nodes, relationships, and the exact parameterized Cypher query for the viva.
    """
    return DetectionService.find_shortest_path(from_id=from_id, to_id=to_id)
