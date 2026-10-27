import time
from typing import Any, Dict, List, Optional
from app.db.neo4j import execute_cypher


class DetectionService:
    """
    Core graph pattern detection service.
    Implements P1 (shared devices), P2 (circular flows), P3 (mule structures),
    and Shortest Paths.
    Returns both detection records and the exact parameterized Cypher query
    so students can inspect and explain the algorithms during their viva.
    """

    @staticmethod
    def detect_shared_devices(min_accounts: int = 4) -> Dict[str, Any]:
        """
        Pattern P1: Shared-device rings.
        Finds hardware devices shared across multiple distinct accounts (syndicates).
        """
        cypher = """
        MATCH (a:Account)-[ud:USED_DEVICE]->(d:Device)
        WITH d, collect(DISTINCT a) AS accounts, count(DISTINCT a) AS account_count
        WHERE account_count >= $min_accounts
        UNWIND accounts AS acc
        OPTIONAL MATCH (acc)-[lf:LOGGED_FROM]->(ip:IP)
        WITH d, accounts, account_count, collect(DISTINCT ip.id) AS shared_ips
        RETURN
            d.id AS device_id,
            d.fingerprint_hash AS fingerprint_hash,
            d.os AS os,
            account_count AS size,
            [acc IN accounts | acc.id] AS member_account_ids,
            shared_ips,
            round(reduce(tot = 0.0, acc IN accounts | tot + coalesce(acc.risk_score, 0.0)) / account_count, 1) AS avg_risk_score
        ORDER BY account_count DESC, d.id ASC
        """
        params = {"min_accounts": min_accounts}
        t0 = time.perf_counter()
        records = execute_cypher(cypher, params)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        # Format ring results
        results = []
        for idx, r in enumerate(records):
            ring_id = f"ring_sd_det_{idx+1:02d}"
            results.append({
                "ring_id": ring_id,
                "type": "shared_device",
                "pattern": "P1",
                "device_id": r["device_id"],
                "fingerprint_hash": r["fingerprint_hash"],
                "os": r["os"],
                "size": r["size"],
                "member_account_ids": r["member_account_ids"],
                "shared_ips": [ip for ip in r["shared_ips"] if ip],
                "avg_risk_score": r["avg_risk_score"],
                "description": f"Syndicate device {r['device_id']} ({r['os']}) shared across {r['size']} distinct accounts",
            })

        return {
            "pattern": "P1",
            "name": "Shared Device Rings",
            "count": len(results),
            "execution_time_ms": round(elapsed_ms, 2),
            "cypher_query": cypher.strip(),
            "parameters": params,
            "results": results,
        }

    @staticmethod
    def detect_cycles(
        min_len: int = 3,
        max_len: int = 6,
        window_hours: float = 72.0,
        min_volume: float = 1000.0,
    ) -> Dict[str, Any]:
        """
        Pattern P2: Circular money flow.
        Finds directed closed loops (A -> B -> C -> ... -> A) within window_hours.
        Enforces chronological transfer ordering (r[i].ts <= r[i+1].ts) and caps
        traversal depth to max_len to prevent combinatorial path explosion.
        """
        # Dynamic relationship length string formatted safely from validated integers
        min_hops = max(3, min(int(min_len), 6))
        max_hops = max(min_hops, min(int(max_len), 6))

        cypher = f"""
        MATCH path = (start:Account)-[r:SENT*{min_hops}..{max_hops}]->(start)
        WHERE ALL(i IN range(0, size(nodes(path))-2) WHERE ALL(j IN range(i+1, size(nodes(path))-2) WHERE nodes(path)[i] <> nodes(path)[j]))
          AND ALL(n IN nodes(path)[1..-1] WHERE n.id > start.id)
        WITH path, relationships(path) AS txns, nodes(path) AS members
        WHERE ALL(i IN range(0, size(txns)-2) WHERE datetime(txns[i].ts) <= datetime(txns[i+1].ts))
        WITH path, txns, members,
             duration.between(datetime(head(txns).ts), datetime(last(txns).ts)).seconds AS dur_sec,
             reduce(tot = 0.0, rel IN txns | tot + rel.amount) AS vol
        WHERE dur_sec >= 0 AND dur_sec <= $window_seconds AND vol >= $min_volume
        RETURN
            [m IN members[0..-1] | m.id] AS member_account_ids,
            [t IN txns | t.txn_id] AS txn_ids,
            size(txns) AS hop_count,
            round(vol, 2) AS total_volume,
            round(dur_sec / 3600.0, 1) AS duration_hours
        ORDER BY vol DESC, hop_count ASC
        LIMIT 50
        """
        params = {
            "window_seconds": int(window_hours * 3600),
            "min_volume": float(min_volume),
        }

        t0 = time.perf_counter()
        records = execute_cypher(cypher, params)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        results = []
        for idx, r in enumerate(records):
            ring_id = f"ring_cf_det_{idx+1:02d}"
            results.append({
                "ring_id": ring_id,
                "type": "cycle",
                "pattern": "P2",
                "size": r["hop_count"],
                "hop_count": r["hop_count"],
                "total_volume": r["total_volume"],
                "duration_hours": r["duration_hours"],
                "member_account_ids": r["member_account_ids"],
                "txn_ids": r["txn_ids"],
                "description": f"Circular loop of {r['hop_count']} hops totaling ${r['total_volume']:,.2f} within {r['duration_hours']}h",
            })

        return {
            "pattern": "P2",
            "name": "Circular Money Flows",
            "count": len(results),
            "execution_time_ms": round(elapsed_ms, 2),
            "cypher_query": cypher.strip(),
            "parameters": {
                "min_hops": min_hops,
                "max_hops": max_hops,
                "window_hours": window_hours,
                "min_volume": min_volume,
            },
            "results": results,
        }

    @staticmethod
    def detect_mules(
        min_fan_in: int = 4,
        max_dwell_hours: float = 24.0,
        min_inflow: float = 2000.0,
        min_outflow_ratio: float = 0.70,
    ) -> Dict[str, Any]:
        """
        Pattern P3: Mule account structures.
        Finds intermediary accounts receiving deposits from multiple feeder accounts (high fan-in)
        and rapidly fanning out the capital to sink accounts with short dwell time.
        """
        cypher = """
        MATCH (in_acc:Account)-[in_r:SENT]->(mule:Account)
        WITH mule,
             collect(DISTINCT in_acc.id) AS feeders,
             collect(in_r) AS in_txns,
             reduce(s = 0.0, r IN collect(in_r) | s + r.amount) AS total_inflow,
             max(in_r.ts) AS last_in
        WHERE size(feeders) >= $min_fan_in AND total_inflow >= $min_inflow
        MATCH (mule)-[out_r:SENT]->(out_acc:Account)
        WHERE out_acc.id <> mule.id AND NOT out_acc.id IN feeders AND out_r.ts >= last_in
        WITH mule, feeders, in_txns, total_inflow, last_in,
             collect(DISTINCT out_acc.id) AS sinks,
             collect(out_r) AS out_txns,
             reduce(s = 0.0, r IN collect(out_r) | s + r.amount) AS total_outflow,
             min(out_r.ts) AS first_out
        WHERE size(sinks) >= 1
          AND (total_outflow / total_inflow) >= $min_outflow_ratio
          AND duration.between(datetime(last_in), datetime(first_out)).seconds <= $max_dwell_seconds
        RETURN
            mule.id AS mule_account_id,
            size(feeders) AS fan_in_count,
            size(sinks) AS fan_out_count,
            feeders,
            sinks,
            round(total_inflow, 2) AS total_inflow,
            round(total_outflow, 2) AS total_outflow,
            round(duration.between(datetime(last_in), datetime(first_out)).seconds / 3600.0, 1) AS dwell_hours
        ORDER BY fan_in_count DESC, total_inflow DESC
        """
        params = {
            "min_fan_in": int(min_fan_in),
            "min_inflow": float(min_inflow),
            "min_outflow_ratio": float(min_outflow_ratio),
            "max_dwell_seconds": int(max_dwell_hours * 3600),
        }

        t0 = time.perf_counter()
        records = execute_cypher(cypher, params)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        results = []
        for idx, r in enumerate(records):
            ring_id = f"ring_mule_det_{idx+1:02d}"
            all_members = [r["mule_account_id"]] + r["feeders"] + r["sinks"]
            results.append({
                "ring_id": ring_id,
                "type": "mule",
                "pattern": "P3",
                "mule_account_id": r["mule_account_id"],
                "size": len(all_members),
                "fan_in_count": r["fan_in_count"],
                "fan_out_count": r["fan_out_count"],
                "total_inflow": r["total_inflow"],
                "total_outflow": r["total_outflow"],
                "dwell_hours": r["dwell_hours"],
                "feeder_account_ids": r["feeders"],
                "sink_account_ids": r["sinks"],
                "member_account_ids": all_members,
                "description": f"Mule {r['mule_account_id']}: {r['fan_in_count']} feeder inflows (${r['total_inflow']:,.2f}) fanned out to {r['fan_out_count']} sinks in {r['dwell_hours']}h",
            })

        return {
            "pattern": "P3",
            "name": "Mule Accounts",
            "count": len(results),
            "execution_time_ms": round(elapsed_ms, 2),
            "cypher_query": cypher.strip(),
            "parameters": {
                "min_fan_in": min_fan_in,
                "max_dwell_hours": max_dwell_hours,
                "min_inflow": min_inflow,
                "min_outflow_ratio": min_outflow_ratio,
            },
            "results": results,
        }

    @staticmethod
    def find_shortest_path(from_id: str, to_id: str) -> Dict[str, Any]:
        """
        Finds the shortest relational path between two entities up to 6 hops.
        Reveals non-obvious multi-step connections between suspects.
        """
        cypher = """
        MATCH (src {id: $from_id}), (dst {id: $to_id})
        MATCH p = shortestPath((src)-[*..6]-(dst))
        RETURN
            [n IN nodes(p) | {id: n.id, label: labels(n)[0], properties: properties(n)}] AS nodes,
            [r IN relationships(p) | {
                type: type(r),
                properties: properties(r),
                start_node: startNode(r).id,
                end_node: endNode(r).id
            }] AS relationships,
            length(p) AS hop_length
        """
        params = {"from_id": from_id, "to_id": to_id}
        t0 = time.perf_counter()
        records = execute_cypher(cypher, params)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        if not records:
            return {
                "found": False,
                "message": f"No path found between '{from_id}' and '{to_id}' within 6 hops.",
                "cypher_query": cypher.strip(),
                "parameters": params,
                "execution_time_ms": round(elapsed_ms, 2),
                "path": None,
            }

        rec = records[0]
        return {
            "found": True,
            "hop_length": rec["hop_length"],
            "nodes": rec["nodes"],
            "relationships": rec["relationships"],
            "cypher_query": cypher.strip(),
            "parameters": params,
            "execution_time_ms": round(elapsed_ms, 2),
        }
