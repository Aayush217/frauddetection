import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import require_analyst, require_admin, UserAuth
from app.db.neo4j import execute_cypher, get_driver
from app.models.common import DeleteResponse, PaginatedResponse
from app.models.transaction import TransferCreate, TransferRead, TransferResult

router = APIRouter(prefix="/transfers", tags=["Transfers"])


def _atomic_transfer_work(tx, data: TransferCreate, txn_id: str, ts_iso: str) -> dict:
    """
    Transaction work unit executed inside ONE Neo4j ManagedTransaction.
    Demonstrates atomicity:
    1. Validates source and destination accounts exist and are not frozen.
    2. Runs quick heuristic checks (high value, velocity, ping-pong reciprocation).
    3. Creates the [:SENT] edge.
    4. Updates risk markers on sender if suspicious.
    If any check fails or exception is raised, Neo4j rolls back the entire transaction.
    """
    # 1. Verify source and destination accounts
    check_query = """
    MATCH (src:Account {id: $src_id})
    MATCH (dst:Account {id: $dst_id})
    RETURN src.status AS src_status, dst.status AS dst_status
    """
    res = tx.run(check_query, {"src_id": data.from_account_id, "dst_id": data.to_account_id}).data()
    if not res:
        raise ValueError("Source or destination account does not exist.")

    src_status = res[0]["src_status"]
    dst_status = res[0]["dst_status"]

    if src_status in ["frozen", "closed"]:
        raise ValueError(f"Source account {data.from_account_id} is {src_status}; transfers disabled.")
    if dst_status == "closed":
        raise ValueError(f"Destination account {data.to_account_id} is closed; transfer rejected.")

    # 2. Quick heuristics: check transfer velocity in last 1 hour
    one_hour_ago = (datetime.fromisoformat(ts_iso.replace("Z", "+00:00")) - timedelta(hours=1)).isoformat()
    velocity_query = """
    MATCH (src:Account {id: $src_id})-[r:SENT]->()
    WHERE r.ts >= $one_hour_ago
    RETURN count(r) AS recent_velocity
    """
    vel_res = tx.run(velocity_query, {"src_id": data.from_account_id, "one_hour_ago": one_hour_ago}).data()
    recent_velocity = vel_res[0]["recent_velocity"] if vel_res else 0

    # Quick heuristics: check reciprocation within 24 hours (immediate bounce-back)
    one_day_ago = (datetime.fromisoformat(ts_iso.replace("Z", "+00:00")) - timedelta(days=1)).isoformat()
    recip_query = """
    MATCH (dst:Account {id: $dst_id})-[r:SENT]->(src:Account {id: $src_id})
    WHERE r.ts >= $one_day_ago
    RETURN count(r) AS reciprocated
    """
    recip_res = tx.run(recip_query, {
        "src_id": data.from_account_id,
        "dst_id": data.to_account_id,
        "one_day_ago": one_day_ago,
    }).data()
    reciprocated = recip_res[0]["reciprocated"] if recip_res else 0

    # Evaluate risk flags
    flagged = False
    flag_reasons = []

    if data.amount >= 10000.0:
        flagged = True
        flag_reasons.append(f"High-value transfer alert (${data.amount:,.2f} exceeds $10k threshold)")

    if recent_velocity >= 4:
        flagged = True
        flag_reasons.append(f"High velocity outflow: {recent_velocity} transfers sent in the last hour")

    if reciprocated > 0:
        flagged = True
        flag_reasons.append(f"Rapid reciprocation: recipient returned funds to sender within 24h")

    # 3. Create the SENT edge
    create_edge_query = """
    MATCH (src:Account {id: $src_id})
    MATCH (dst:Account {id: $dst_id})
    CREATE (src)-[r:SENT {
        txn_id: $txn_id,
        amount: $amount,
        ts: $ts
    }]->(dst)
    RETURN r.txn_id AS txn_id, src.id AS from_account_id, dst.id AS to_account_id,
           r.amount AS amount, r.ts AS ts
    """
    edge_res = tx.run(create_edge_query, {
        "src_id": data.from_account_id,
        "dst_id": data.to_account_id,
        "txn_id": txn_id,
        "amount": data.amount,
        "ts": ts_iso,
    }).data()
    created_edge = edge_res[0]

    # 4. If flagged, update risk markers atomically
    if flagged:
        update_risk_query = """
        MATCH (src:Account {id: $src_id})
        SET src.risk_score = CASE WHEN coalesce(src.risk_score, 0) + 15 > 100 THEN 100 ELSE coalesce(src.risk_score, 0) + 15 END,
            src.risk_reasons = [x IN coalesce(src.risk_reasons, []) WHERE NOT x IN $new_reasons] + $new_reasons
        """
        tx.run(update_risk_query, {"src_id": data.from_account_id, "new_reasons": flag_reasons})

    return {
        "transfer": created_edge,
        "flagged": flagged,
        "flag_reasons": flag_reasons,
        "recent_velocity": recent_velocity,
    }


@router.post("", response_model=TransferResult, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    data: TransferCreate,
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Create a financial transfer inside ONE atomic database transaction.
    Demonstrates atomicity: edge creation, velocity checks, and risk updates succeed or fail together.
    """
    if data.from_account_id == data.to_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination accounts must be distinct.",
        )

    txn_id = data.txn_id or f"txn_live_{uuid.uuid4().hex[:10]}"
    ts_iso = data.ts or datetime.now(timezone.utc).isoformat()

    driver = get_driver()
    try:
        with driver.session() as session:
            result = session.execute_write(_atomic_transfer_work, data, txn_id, ts_iso)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Atomic transfer failed: {str(exc)}",
        )

    t_data = result["transfer"]
    return TransferResult(
        transfer=TransferRead(
            txn_id=t_data["txn_id"],
            from_account_id=t_data["from_account_id"],
            to_account_id=t_data["to_account_id"],
            amount=float(t_data["amount"]),
            ts=t_data["ts"],
        ),
        status="flagged" if result["flagged"] else "completed",
        flagged=result["flagged"],
        flag_reasons=result["flag_reasons"],
        velocity_warning=result["recent_velocity"] >= 4,
        atomic_transaction_id=txn_id,
    )


@router.get("", response_model=PaginatedResponse[TransferRead])
async def list_transfers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    account_id: Optional[str] = Query(default=None, description="Filter transfers where account is sender or receiver"),
    from_account: Optional[str] = Query(default=None),
    to_account: Optional[str] = Query(default=None),
    min_amount: Optional[float] = Query(default=None),
    max_amount: Optional[float] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    current_user: UserAuth = Depends(require_analyst),
):
    """
    List transfers with pagination and temporal/amount filters.
    Leverages indexes on SENT.ts and SENT.amount for speed.
    """
    skip = (page - 1) * page_size
    where_clauses = []
    params = {"skip": skip, "limit": page_size}

    if account_id:
        where_clauses.append("(src.id = $account_id OR dst.id = $account_id)")
        params["account_id"] = account_id
    if from_account:
        where_clauses.append("src.id = $from_account")
        params["from_account"] = from_account
    if to_account:
        where_clauses.append("dst.id = $to_account")
        params["to_account"] = to_account
    if min_amount is not None:
        where_clauses.append("r.amount >= $min_amount")
        params["min_amount"] = min_amount
    if max_amount is not None:
        where_clauses.append("r.amount <= $max_amount")
        params["max_amount"] = max_amount
    if start_date:
        where_clauses.append("r.ts >= $start_date")
        params["start_date"] = start_date
    if end_date:
        where_clauses.append("r.ts <= $end_date")
        params["end_date"] = end_date

    where_stmt = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    count_query = f"""
    MATCH (src:Account)-[r:SENT]->(dst:Account)
    {where_stmt}
    RETURN count(r) AS total
    """
    count_res = execute_cypher(count_query, params)
    total = count_res[0]["total"] if count_res else 0

    data_query = f"""
    MATCH (src:Account)-[r:SENT]->(dst:Account)
    {where_stmt}
    RETURN
        r.txn_id AS txn_id,
        src.id AS from_account_id,
        dst.id AS to_account_id,
        r.amount AS amount,
        r.ts AS ts
    ORDER BY r.ts DESC
    SKIP $skip
    LIMIT $limit
    """
    records = execute_cypher(data_query, params)

    items = [
        TransferRead(
            txn_id=r["txn_id"],
            from_account_id=r["from_account_id"],
            to_account_id=r["to_account_id"],
            amount=float(r["amount"]),
            ts=r["ts"],
        )
        for r in records
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse[TransferRead](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{txn_id}", response_model=TransferRead)
async def get_transfer_detail(
    txn_id: str,
    current_user: UserAuth = Depends(require_analyst),
):
    """Retrieve single transfer details by txn_id."""
    query = """
    MATCH (src:Account)-[r:SENT {txn_id: $txn_id}]->(dst:Account)
    RETURN r.txn_id AS txn_id, src.id AS from_account_id, dst.id AS to_account_id,
           r.amount AS amount, r.ts AS ts
    """
    records = execute_cypher(query, {"txn_id": txn_id})
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transfer '{txn_id}' not found")

    r = records[0]
    return TransferRead(
        txn_id=r["txn_id"],
        from_account_id=r["from_account_id"],
        to_account_id=r["to_account_id"],
        amount=float(r["amount"]),
        ts=r["ts"],
    )


@router.get("/{txn_id}/trace")
async def get_transfer_trace(
    txn_id: str,
    current_user: UserAuth = Depends(require_analyst),
):
    """
    Forensic trace of a single transactional money flow edge.
    Retrieves both the sender and receiver accounts, their connected devices,
    IP addresses, legal owners, and checks for shared entities and cycle paths.
    Returns complete React Flow nodes and edges ready for interactive visualization.
    """
    query = """
    MATCH (src:Account)-[r:SENT {txn_id: $txn_id}]->(dst:Account)
    OPTIONAL MATCH (src)-[:USED_DEVICE]->(d1:Device)
    OPTIONAL MATCH (dst)-[:USED_DEVICE]->(d2:Device)
    OPTIONAL MATCH (src)-[:LOGGED_FROM]->(i1:IP)
    OPTIONAL MATCH (dst)-[:LOGGED_FROM]->(i2:IP)
    OPTIONAL MATCH cycle_path = (dst)-[:SENT*1..4]->(src)
    RETURN properties(src) AS src,
           properties(dst) AS dst,
           properties(r) AS r,
           collect(DISTINCT properties(d1)) AS src_devices,
           collect(DISTINCT properties(d2)) AS dst_devices,
           collect(DISTINCT properties(i1)) AS src_ips,
           collect(DISTINCT properties(i2)) AS dst_ips,
           [n IN nodes(cycle_path) | n.id] AS cycle_nodes
    LIMIT 1
    """
    records = execute_cypher(query, {"txn_id": txn_id})
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transfer '{txn_id}' not found")

    rec = records[0]
    src = rec["src"] or {}
    dst = rec["dst"] or {}
    r = rec["r"] or {}

    src_devices = {d["id"]: d for d in rec["src_devices"] if d and "id" in d}
    dst_devices = {d["id"]: d for d in rec["dst_devices"] if d and "id" in d}
    src_ips = {ip["id"]: ip for ip in rec["src_ips"] if ip and "id" in ip}
    dst_ips = {ip["id"]: ip for ip in rec["dst_ips"] if ip and "id" in ip}
    cycle_nodes = rec.get("cycle_nodes") or []

    shared_dev_ids = set(src_devices.keys()) & set(dst_devices.keys())
    shared_ip_ids = set(src_ips.keys()) & set(dst_ips.keys())

    nodes = []
    edges = []
    seen = set()

    # 1. Source Account Node
    nodes.append({
        "id": src["id"],
        "type": "account",
        "data": {
            "label": src["id"],
            "risk_score": round(src.get("risk_score", 0), 1),
            "status": src.get("status", "active"),
            "balance": 25000,
            "role": "Sender (Origin)",
        },
        "position": {"x": 160, "y": 240},
    })
    seen.add(src["id"])

    # 2. Destination Account Node
    nodes.append({
        "id": dst["id"],
        "type": "account",
        "data": {
            "label": dst["id"],
            "risk_score": round(dst.get("risk_score", 0), 1),
            "status": dst.get("status", "active"),
            "balance": 28000,
            "role": "Receiver (Destination)",
        },
        "position": {"x": 640, "y": 240},
    })
    seen.add(dst["id"])

    # 3. Main Transaction Edge
    is_suspicious = len(shared_dev_ids) > 0 or len(shared_ip_ids) > 0 or len(cycle_nodes) > 0
    edge_color = "#DC2626" if is_suspicious else "#4F46E5"
    edges.append({
        "id": f"tx-{txn_id}",
        "source": src["id"],
        "target": dst["id"],
        "label": f":SENT (${float(r.get('amount', 0)):,.2f})",
        "animated": True,
        "style": {"stroke": edge_color, "strokeWidth": 3},
    })

    # 4. Shared Devices (placed centrally above)
    for idx, dev_id in enumerate(shared_dev_ids):
        dev = src_devices[dev_id]
        if dev_id not in seen:
            nodes.append({
                "id": dev_id,
                "type": "device",
                "data": {
                    "label": dev_id,
                    "device_type": dev.get("os", "Device"),
                    "is_shared": True,
                },
                "position": {"x": 400 + idx * 120, "y": 70},
            })
            seen.add(dev_id)
            edges.append({
                "id": f"{src['id']}-SHARED-{dev_id}",
                "source": src["id"],
                "target": dev_id,
                "label": ":USED_DEVICE (SHARED)",
                "style": {"stroke": "#DC2626", "strokeWidth": 2, "strokeDasharray": "4 4"},
            })
            edges.append({
                "id": f"{dst['id']}-SHARED-{dev_id}",
                "source": dst["id"],
                "target": dev_id,
                "label": ":USED_DEVICE (SHARED)",
                "style": {"stroke": "#DC2626", "strokeWidth": 2, "strokeDasharray": "4 4"},
            })

    # 5. Shared IPs (placed centrally below)
    for idx, ip_id in enumerate(shared_ip_ids):
        ip = src_ips[ip_id]
        if ip_id not in seen:
            nodes.append({
                "id": ip_id,
                "type": "ip",
                "data": {
                    "label": ip_id,
                    "country": ip.get("country", "US"),
                    "is_shared": True,
                },
                "position": {"x": 400 + idx * 120, "y": 410},
            })
            seen.add(ip_id)
            edges.append({
                "id": f"{src['id']}-SHARED-{ip_id}",
                "source": src["id"],
                "target": ip_id,
                "label": ":LOGGED_FROM (SHARED)",
                "style": {"stroke": "#DC2626", "strokeWidth": 2, "strokeDasharray": "4 4"},
            })
            edges.append({
                "id": f"{dst['id']}-SHARED-{ip_id}",
                "source": dst["id"],
                "target": ip_id,
                "label": ":LOGGED_FROM (SHARED)",
                "style": {"stroke": "#DC2626", "strokeWidth": 2, "strokeDasharray": "4 4"},
            })

    # 6. Unshared Devices (Left for src, Right for dst)
    for idx, dev_id in enumerate(set(src_devices.keys()) - shared_dev_ids):
        if idx >= 2: break
        dev = src_devices[dev_id]
        if dev_id not in seen:
            nodes.append({
                "id": dev_id,
                "type": "device",
                "data": {"label": dev_id, "device_type": dev.get("os", "Device")},
                "position": {"x": 40, "y": 120 + idx * 100},
            })
            seen.add(dev_id)
            edges.append({
                "id": f"{src['id']}-USED-{dev_id}",
                "source": src["id"],
                "target": dev_id,
                "label": ":USED_DEVICE",
                "style": {"stroke": "#8B5CF6", "strokeWidth": 1.5},
            })

    for idx, dev_id in enumerate(set(dst_devices.keys()) - shared_dev_ids):
        if idx >= 2: break
        dev = dst_devices[dev_id]
        if dev_id not in seen:
            nodes.append({
                "id": dev_id,
                "type": "device",
                "data": {"label": dev_id, "device_type": dev.get("os", "Device")},
                "position": {"x": 780, "y": 120 + idx * 100},
            })
            seen.add(dev_id)
            edges.append({
                "id": f"{dst['id']}-USED-{dev_id}",
                "source": dst["id"],
                "target": dev_id,
                "label": ":USED_DEVICE",
                "style": {"stroke": "#8B5CF6", "strokeWidth": 1.5},
            })

    cypher_query = f"""MATCH (src:Account {{id: '{src['id']}'}})-[r:SENT {{txn_id: '{txn_id}'}}]->(dst:Account {{id: '{dst['id']}'}})
OPTIONAL MATCH (src)-[:USED_DEVICE]->(d1:Device), (dst)-[:USED_DEVICE]->(d2:Device)
OPTIONAL MATCH (src)-[:LOGGED_FROM]->(i1:IP), (dst)-[:LOGGED_FROM]->(i2:IP)
RETURN src, r, dst, d1, d2, i1, i2"""

    return {
        "txn_id": txn_id,
        "from_account_id": src["id"],
        "to_account_id": dst["id"],
        "amount": float(r.get("amount", 0)),
        "ts": r.get("ts"),
        "is_suspicious": is_suspicious,
        "shared_entities": {
            "devices": list(shared_dev_ids),
            "ips": list(shared_ip_ids),
        },
        "cycle_detected": len(cycle_nodes) > 0,
        "cycle_nodes": cycle_nodes,
        "nodes": nodes,
        "edges": edges,
        "cypher_query": cypher_query,
    }


@router.delete("/{txn_id}", response_model=DeleteResponse)
async def delete_transfer(
    txn_id: str,
    confirm: bool = Query(default=False, description="Explicit confirmation flag required for deletion"),
    current_user: UserAuth = Depends(require_admin),
):
    """Admin-only deletion of a transfer edge."""
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deletion of graph edges requires explicit confirmation flag (?confirm=true)",
        )

    check = execute_cypher("MATCH ()-[r:SENT {txn_id: $txn_id}]->() RETURN r.txn_id AS id", {"txn_id": txn_id})
    if not check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transfer '{txn_id}' not found")

    execute_cypher("MATCH ()-[r:SENT {txn_id: $txn_id}]->() DELETE r", {"txn_id": txn_id}, fetch_records=False)

    return DeleteResponse(
        success=True,
        deleted_id=txn_id,
        message=f"Transfer edge '{txn_id}' deleted by admin.",
    )
