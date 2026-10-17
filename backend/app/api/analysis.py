from fastapi import APIRouter, Depends
from app.core.security import require_analyst, UserAuth
from app.services.gds_service import GDSService

router = APIRouter(prefix="/analysis", tags=["GDS Analytics"])


@router.post("/run")
async def run_gds_analysis(current_user: UserAuth = Depends(require_analyst)):
    """
    Runs full Graph Data Science (GDS) analysis pipeline:
    - Louvain Community Detection
    - PageRank Centrality
    - Betweenness Centrality
    - P1, P2, P3 pattern detectors
    - Multi-factor Explainable Risk Scoring Engine
    - Updates Account.risk_score and Account.risk_reasons across all accounts
    """
    return GDSService.run_full_analysis()
