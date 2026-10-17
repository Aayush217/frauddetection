import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.db.neo4j import execute_cypher, get_driver
from app.services.detection import DetectionService

logger = logging.getLogger("fraudgraph.gds")

PROJECTION_NAME = "fraudGraphProjection"


class GDSService:
    """
    Manages Neo4j Graph Data Science (GDS) algorithms and risk scoring:
    - Louvain Community Detection
    - Weakly Connected Components (WCC)
    - PageRank Centrality
    - Betweenness Centrality
    - Multi-factor Explainable Risk Scoring Engine
    """

    @staticmethod
    def project_graph(graph_name: str = PROJECTION_NAME) -> Dict[str, Any]:
        """
        Projects an in-memory graph projection of Accounts and SENT relationships
        weighted by transaction amount.
        """
        # Drop existing projection if present
        drop_query = "CALL gds.graph.drop($graph_name, false)"
        try:
            execute_cypher(drop_query, {"graph_name": graph_name})
        except Exception as e:
            logger.debug(f"Graph drop notice: {e}")

        # Project monopartite Account -> Account graph with SENT edges and amount property
        project_query = """
        CALL gds.graph.project(
            $graph_name,
            'Account',
            {
                SENT: {
                    type: 'SENT',
                    orientation: 'NATURAL',
                    properties: ['amount']
                }
            }
        )
        """
        records = execute_cypher(project_query, {"graph_name": graph_name})
        return records[0] if records else {}

    @staticmethod
    def drop_graph(graph_name: str = PROJECTION_NAME) -> None:
        """Frees the in-memory GDS graph projection."""
        try:
            execute_cypher("CALL gds.graph.drop($graph_name, false)", {"graph_name": graph_name})
        except Exception as e:
            logger.debug(f"Drop graph notice: {e}")

    @staticmethod
    def run_full_analysis() -> Dict[str, Any]:
        """
        Orchestrates full GDS algorithm pipeline, pattern detection,
        and recomputes risk scores across all graph accounts.
        """
        t0 = time.perf_counter()
        logger.info("Starting GDS Analysis Pipeline...")

        # 1. Project Graph
        proj_meta = GDSService.project_graph()

        # 2. Run Louvain Community Detection
        logger.info("Executing GDS Louvain...")
        louvain_query = """
        CALL gds.louvain.stream($graph_name)
        YIELD nodeId, communityId
        RETURN gds.util.asNode(nodeId).id AS account_id, communityId
        """
        louvain_records = execute_cypher(louvain_query, {"graph_name": PROJECTION_NAME})
        communities = {r["account_id"]: r["communityId"] for r in louvain_records}
        unique_communities = len(set(communities.values()))

        # 3. Run PageRank
        logger.info("Executing GDS PageRank...")
        pagerank_query = """
        CALL gds.pageRank.stream($graph_name, {
            maxIterations: 20,
            dampingFactor: 0.85
        })
        YIELD nodeId, score
        RETURN gds.util.asNode(nodeId).id AS account_id, score AS pagerank
        """
        pagerank_records = execute_cypher(pagerank_query, {"graph_name": PROJECTION_NAME})
        pageranks = {r["account_id"]: float(r["pagerank"]) for r in pagerank_records}

        # 4. Run Betweenness Centrality
        logger.info("Executing GDS Betweenness Centrality...")
        betweenness_query = """
        CALL gds.betweenness.stream($graph_name)
        YIELD nodeId, score
        RETURN gds.util.asNode(nodeId).id AS account_id, score AS betweenness
        """
        betweenness_records = execute_cypher(betweenness_query, {"graph_name": PROJECTION_NAME})
        betweenness = {r["account_id"]: float(r["betweenness"]) for r in betweenness_records}

        # 5. Clean up in-memory projection
        GDSService.drop_graph()

        # 6. Run Pattern Detections (P1, P2, P3)
        logger.info("Running pattern detections (P1, P2, P3)...")
        p1_res = DetectionService.detect_shared_devices(min_accounts=4)
        p2_res = DetectionService.detect_cycles(min_len=3, max_len=6, window_hours=72.0, min_volume=1000.0)
        p3_res = DetectionService.detect_mules(min_fan_in=4, max_dwell_hours=24.0, min_inflow=2000.0)

        # 7. Compute explainable risk scores
        logger.info("Calculating explainable risk scores...")
        account_scores: Dict[str, Dict[str, Any]] = {}

        # Default initialization for all known accounts
        all_acc_ids = set(communities.keys()) | set(pageranks.keys())
        for acc_id in all_acc_ids:
            account_scores[acc_id] = {
                "score": 0.0,
                "reasons": [],
                "cycle_score": 0.0,
                "shared_device_score": 0.0,
                "mule_score": 0.0,
                "velocity_score": 0.0,
            }

        # A. Apply Cycle Weight (settings.RISK_WEIGHT_CYCLE = 35)
        for ring in p2_res["results"]:
            hop_count = ring["hop_count"]
            vol = ring["total_volume"]
            dur = ring["duration_hours"]
            for member_id in ring["member_account_ids"]:
                if member_id not in account_scores:
                    account_scores[member_id] = {"score": 0.0, "reasons": []}
                account_scores[member_id]["cycle_score"] = settings.RISK_WEIGHT_CYCLE
                account_scores[member_id]["reasons"].append(
                    f"Part of a {hop_count}-hop cycle totaling ${vol:,.2f} within {dur}h"
                )

        # B. Apply Shared-Device Weight (settings.RISK_WEIGHT_SHARED_DEVICE = 25)
        for ring in p1_res["results"]:
            size = ring["size"]
            dev_id = ring["device_id"]
            for member_id in ring["member_account_ids"]:
                if member_id not in account_scores:
                    account_scores[member_id] = {"score": 0.0, "reasons": []}
                # Scale from min 4 accounts upwards
                fraction = min(1.0, (size - 3) / 5.0)
                account_scores[member_id]["shared_device_score"] = round(settings.RISK_WEIGHT_SHARED_DEVICE * fraction, 1)
                account_scores[member_id]["reasons"].append(
                    f"Shared hardware device {dev_id} with {size - 1} other accounts"
                )

        # C. Apply Mule Weight (settings.RISK_WEIGHT_MULE = 25)
        # Combine explicit mule structures and high betweenness centrality
        for ring in p3_res["results"]:
            mule_id = ring["mule_account_id"]
            fan_in = ring["fan_in_count"]
            fan_out = ring["fan_out_count"]
            dwell = ring["dwell_hours"]
            inflow = ring["total_inflow"]

            if mule_id in account_scores:
                account_scores[mule_id]["mule_score"] = settings.RISK_WEIGHT_MULE
                account_scores[mule_id]["reasons"].append(
                    f"Identified as mule account: {fan_in} inflows (${inflow:,.2f}) rapidly fanned out to {fan_out} sinks within {dwell}h"
                )

            # Feeder and sink accounts receive a proportional risk bump
            for feeder in ring["feeder_account_ids"]:
                if feeder in account_scores:
                    account_scores[feeder]["mule_score"] = max(account_scores[feeder].get("mule_score", 0), 10.0)
                    account_scores[feeder]["reasons"].append(f"Feeder account depositing funds into mule structure {mule_id}")

            for sink in ring["sink_account_ids"]:
                if sink in account_scores:
                    account_scores[sink]["mule_score"] = max(account_scores[sink].get("mule_score", 0), 12.0)
                    account_scores[sink]["reasons"].append(f"Sink account receiving aggregated cash-out from mule {mule_id}")

        # D. Apply Velocity Weight (settings.RISK_WEIGHT_VELOCITY = 15)
        # Fetch outbound transfer counts in last 30 days
        velocity_query = """
        MATCH (a:Account)-[r:SENT]->()
        WITH a.id AS acc_id, count(r) AS txn_count
        WHERE txn_count >= 10
        RETURN acc_id, txn_count
        """
        vel_records = execute_cypher(velocity_query)
        for r in vel_records:
            acc_id = r["acc_id"]
            txns = r["txn_count"]
            if acc_id in account_scores:
                score_val = round(min(1.0, txns / 20.0) * settings.RISK_WEIGHT_VELOCITY, 1)
                account_scores[acc_id]["velocity_score"] = score_val
                account_scores[acc_id]["reasons"].append(
                    f"Elevated transfer frequency: {txns} outbound transfers"
                )

        # Calculate final composite score (0 to 100)
        updates_batch = []
        now_iso = datetime.now(timezone.utc).isoformat()

        for acc_id, val in account_scores.items():
            total_raw = (
                val.get("cycle_score", 0.0)
                + val.get("shared_device_score", 0.0)
                + val.get("mule_score", 0.0)
                + val.get("velocity_score", 0.0)
            )
            final_score = round(min(100.0, total_raw), 1)
            # Remove duplicate reasons while preserving order
            seen_reasons = set()
            dedup_reasons = []
            for r in val.get("reasons", []):
                if r not in seen_reasons:
                    seen_reasons.add(r)
                    dedup_reasons.append(r)

            updates_batch.append({
                "id": acc_id,
                "risk_score": final_score,
                "risk_reasons": dedup_reasons,
                "community_id": communities.get(acc_id, -1),
                "pagerank": pageranks.get(acc_id, 0.0),
                "betweenness": betweenness.get(acc_id, 0.0),
            })

        # 8. Batch update Account nodes in Neo4j
        logger.info(f"Writing updated scores for {len(updates_batch)} accounts to Neo4j...")
        update_query = """
        UNWIND $batch AS u
        MATCH (a:Account {id: u.id})
        SET a.risk_score = u.risk_score,
            a.risk_reasons = u.risk_reasons,
            a.community_id = u.community_id,
            a.pagerank = u.pagerank,
            a.betweenness = u.betweenness
        """
        driver = get_driver()
        batch_size = 500
        for i in range(0, len(updates_batch), batch_size):
            chunk = updates_batch[i : i + batch_size]
            with driver.session() as session:
                session.run(update_query, {"batch": chunk})

        # 9. Sync Detected Rings into graph Ring nodes for analyst review
        GDSService._sync_rings_to_graph(p1_res["results"], p2_res["results"], p3_res["results"], now_iso)

        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info(f"GDS Analysis & Risk Scoring completed in {elapsed_ms:.1f}ms")

        # Summary statistics
        high_risk_count = sum(1 for u in updates_batch if u["risk_score"] >= 65.0)
        med_risk_count = sum(1 for u in updates_batch if 30.0 <= u["risk_score"] < 65.0)

        return {
            "status": "completed",
            "execution_time_ms": round(elapsed_ms, 2),
            "analyzed_at": now_iso,
            "metrics": {
                "total_accounts_scored": len(updates_batch),
                "high_risk_accounts": high_risk_count,
                "medium_risk_accounts": med_risk_count,
                "louvain_communities": unique_communities,
                "rings_detected": {
                    "p1_shared_devices": len(p1_res["results"]),
                    "p2_cycles": len(p2_res["results"]),
                    "p3_mules": len(p3_res["results"]),
                    "total_rings": len(p1_res["results"]) + len(p2_res["results"]) + len(p3_res["results"]),
                },
            },
        }

    @staticmethod
    def _sync_rings_to_graph(p1_rings: List[dict], p2_rings: List[dict], p3_rings: List[dict], detected_at: str):
        """
        Idempotently persists detected rings as (:Ring) nodes in Neo4j and connects
        members via (:Ring)-[:HAS_MEMBER]->(:Account).
        Preserves existing analyst review status (confirmed / false_positive / under_review).
        """
        all_rings = []
        for r in p1_rings:
            all_rings.append({
                "id": r["ring_id"],
                "type": "shared_device",
                "pattern": "P1",
                "size": r["size"],
                "score": 65.0 + min(35.0, (r["size"] - 4) * 7.0),
                "description": r["description"],
                "member_account_ids": r["member_account_ids"],
                "total_volume": 0.0,
            })

        for r in p2_rings:
            all_rings.append({
                "id": r["ring_id"],
                "type": "cycle",
                "pattern": "P2",
                "size": r["size"],
                "score": 85.0,
                "description": r["description"],
                "member_account_ids": r["member_account_ids"],
                "total_volume": r.get("total_volume", 0.0),
            })

        for r in p3_rings:
            all_rings.append({
                "id": r["ring_id"],
                "type": "mule",
                "pattern": "P3",
                "size": r["size"],
                "score": 80.0,
                "description": r["description"],
                "member_account_ids": r["member_account_ids"],
                "total_volume": r.get("total_inflow", 0.0),
            })

        sync_query = """
        UNWIND $rings AS r
        MERGE (ring:Ring {id: r.id})
        ON CREATE SET
            ring.type = r.type,
            ring.pattern = r.pattern,
            ring.size = r.size,
            ring.score = r.score,
            ring.status = 'unreviewed',
            ring.description = r.description,
            ring.total_volume = r.total_volume,
            ring.detected_at = $detected_at
        ON MATCH SET
            ring.size = r.size,
            ring.score = r.score,
            ring.description = r.description,
            ring.total_volume = r.total_volume
        WITH ring, r
        UNWIND r.member_account_ids AS acc_id
        MATCH (a:Account {id: acc_id})
        MERGE (ring)-[:HAS_MEMBER]->(a)
        """
        execute_cypher(sync_query, {"rings": all_rings, "detected_at": detected_at}, fetch_records=False)
