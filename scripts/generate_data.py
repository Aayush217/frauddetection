#!/usr/bin/env python3
"""
FraudGraph Synthetic Data Generator
-----------------------------------
Generates realistic financial graph data with reproducible Faker seeding:
- ~5,000 accounts with realistic ownership, devices, IPs, and cards
- ~20,000 normal transactions exhibiting realistic diurnal (day/night) curves
- Benign shared devices (families, offices) to test detector specificity
- Labeled fraud rings injected and recorded in ground_truth.json:
    * 15 Shared-device rings (4 to 10 accounts each)
    * 10 Circular-flow rings (3 to 6 hops, completing within 72h)
    * 8 Mule account structures (high fan-in, short dwell time, rapid fan-out)

Usage:
    python scripts/generate_data.py [--scale 1.0] [--reset] [--seed 42]
"""

import argparse
import hashlib
import json
import logging
import math
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from faker import Faker

# Adjust path to import backend modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app.db.neo4j import get_driver, init_schema, execute_cypher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fraudgraph.generator")

BATCH_SIZE = 500


def sha256(val: str) -> str:
    """Generate SHA-256 hash for personal identifiers to ensure zero raw PII."""
    return hashlib.sha256(val.strip().lower().encode("utf-8")).hexdigest()


def generate_diurnal_timestamp(start_date: datetime, end_date: datetime, rng: random.Random) -> datetime:
    """
    Generates a timestamp between start_date and end_date following a realistic
    human diurnal activity curve (peak between 10am-9pm, minimal between 2am-5am).
    """
    total_seconds = int((end_date - start_date).total_seconds())
    # Loop until an acceptance-rejection sample passes the diurnal probability distribution
    while True:
        rand_sec = rng.randint(0, total_seconds)
        dt = start_date + timedelta(seconds=rand_sec)
        hour = dt.hour + dt.minute / 60.0
        # Activity probability modeled via inverted Gaussian / cosine curve: peak around 15:00 (3pm)
        # Low around 04:00 (4am)
        prob = 0.15 + 0.85 * ((1.0 + math.cos((hour - 15.0) * math.pi / 12.0)) / 2.0) ** 1.5
        if rng.random() <= prob:
            return dt


def generate_realistic_amount(rng: random.Random) -> float:
    """
    Log-normal retail transaction distribution with median ~$45 and tail up to ~$3,500.
    """
    # mu=3.8 (~$45), sigma=1.0
    val = rng.lognormvariate(3.8, 1.0)
    # round to 2 decimal places, cap between $1.00 and $10,000
    return round(min(max(val, 1.50), 9999.00), 2)


def wipe_database():
    """Wipes existing data from Neo4j prior to fresh seed."""
    logger.info("Wiping existing graph data...")
    execute_cypher("MATCH (n) DETACH DELETE n")
    logger.info("Graph data cleared. Re-verifying constraints...")
    init_schema()


def batch_insert(query: str, items: List[Dict[str, Any]], item_key: str = "batch"):
    """Inserts a list of dictionaries in parameterized batches."""
    driver = get_driver()
    total = len(items)
    for i in range(0, total, BATCH_SIZE):
        chunk = items[i : i + BATCH_SIZE]
        with driver.session() as session:
            session.run(query, {item_key: chunk})
        logger.debug(f"Inserted batch {i + len(chunk)}/{total}")


def run_generator(scale: float = 1.0, reset: bool = False, seed: int = 42, output_dir: Path = None):
    logger.info(f"Starting FraudGraph data generator (scale={scale}, reset={reset}, seed={seed})")

    rng = random.Random(seed)
    fake = Faker()
    fake.seed_instance(seed)

    if reset:
        wipe_database()
    else:
        init_schema()

    if output_dir is None:
        output_dir = Path(__file__).resolve().parent

    now = datetime.now(timezone.utc)
    start_history = now - timedelta(days=60)

    num_accounts = max(50, int(5000 * scale))
    num_users = int(num_accounts * 0.85)
    num_devices = int(num_accounts * 1.05)
    num_ips = int(num_accounts * 0.55)
    num_cards = int(num_accounts * 0.75)
    num_normal_txns = max(200, int(20000 * scale))

    # Calculate number of fraud rings scaled
    num_sd_rings = max(2, int(15 * scale))
    num_cf_rings = max(2, int(10 * scale))
    num_mule_rings = max(2, int(8 * scale))

    logger.info(
        f"Target counts: {num_accounts} accounts, {num_users} users, {num_devices} devices, "
        f"{num_ips} IPs, {num_cards} cards, {num_normal_txns} normal txns"
    )

    # -------------------------------------------------------------
    # 1. Generate Users
    # -------------------------------------------------------------
    logger.info(f"Generating {num_users} Users...")
    users = []
    for i in range(num_users):
        user_id = f"usr_{i+1:05d}"
        name = fake.name()
        email = f"{name.lower().replace(' ', '.')}_{i}@{fake.free_email_domain()}"
        users.append({
            "id": user_id,
            "name": name,
            "email_hash": sha256(email),
            "created_at": (now - timedelta(days=rng.randint(60, 365))).isoformat(),
        })

    insert_users_query = """
    UNWIND $batch AS u
    MERGE (user:User {id: u.id})
    ON CREATE SET
        user.name = u.name,
        user.email_hash = u.email_hash,
        user.created_at = u.created_at
    """
    batch_insert(insert_users_query, users)

    # -------------------------------------------------------------
    # 2. Generate Accounts
    # -------------------------------------------------------------
    logger.info(f"Generating {num_accounts} Accounts...")
    accounts = []
    user_account_links = []
    account_ids = [f"acc_{i+1:05d}" for i in range(num_accounts)]

    for idx, acc_id in enumerate(account_ids):
        # assign owning user (some users own multiple accounts)
        owner_user_id = users[idx % num_users]["id"]
        opened_at = (now - timedelta(days=rng.randint(10, 300))).isoformat()
        status = "active" if rng.random() < 0.96 else rng.choice(["suspended", "closed"])

        accounts.append({
            "id": acc_id,
            "status": status,
            "opened_at": opened_at,
            "risk_score": 0.0,
            "risk_reasons": [],
            "review_state": "unreviewed",
        })
        user_account_links.append({
            "user_id": owner_user_id,
            "account_id": acc_id,
        })

    insert_accounts_query = """
    UNWIND $batch AS a
    MERGE (acc:Account {id: a.id})
    ON CREATE SET
        acc.status = a.status,
        acc.opened_at = a.opened_at,
        acc.risk_score = a.risk_score,
        acc.risk_reasons = a.risk_reasons,
        acc.review_state = a.review_state
    """
    batch_insert(insert_accounts_query, accounts)

    insert_owns_query = """
    UNWIND $batch AS link
    MATCH (u:User {id: link.user_id})
    MATCH (a:Account {id: link.account_id})
    MERGE (u)-[:OWNS]->(a)
    """
    batch_insert(insert_owns_query, user_account_links)

    # -------------------------------------------------------------
    # 3. Generate Devices & USED_DEVICE relationships
    # -------------------------------------------------------------
    logger.info(f"Generating {num_devices} Devices...")
    devices = []
    os_choices = ["iOS", "Android", "macOS", "Windows", "Linux"]
    os_weights = [0.38, 0.35, 0.14, 0.11, 0.02]

    for i in range(num_devices):
        dev_id = f"dev_{i+1:05d}"
        raw_fp = f"fp_{dev_id}_{rng.randint(100000, 999999)}"
        devices.append({
            "id": dev_id,
            "fingerprint_hash": sha256(raw_fp),
            "os": rng.choices(os_choices, weights=os_weights, k=1)[0],
            "first_seen": (now - timedelta(days=rng.randint(10, 200))).isoformat(),
        })

    insert_devices_query = """
    UNWIND $batch AS d
    MERGE (dev:Device {id: d.id})
    ON CREATE SET
        dev.fingerprint_hash = d.fingerprint_hash,
        dev.os = d.os,
        dev.first_seen = d.first_seen
    """
    batch_insert(insert_devices_query, devices)

    # Link accounts to devices:
    # 1. Benign shared devices (families, offices: 2 to 3 accounts per device)
    # 2. Individual devices (1 account per device)
    # 3. Injected syndicate rings (4 to 10 accounts per device)
    device_links = []
    dev_cursor = 0
    acc_cursor = 0

    # Create 150 benign shared devices (household/office noise with 2 or 3 accounts each)
    num_benign = int(150 * scale)
    for _ in range(num_benign):
        if acc_cursor + 3 >= len(account_ids) - 300:
            break
        dev_id = devices[dev_cursor]["id"]
        dev_cursor += 1
        share_size = rng.choice([2, 3])
        group = account_ids[acc_cursor : acc_cursor + share_size]
        acc_cursor += share_size

        for acc_id in group:
            first = (now - timedelta(days=rng.randint(15, 60))).isoformat()
            last = (now - timedelta(days=rng.randint(0, 5))).isoformat()
            device_links.append({
                "account_id": acc_id,
                "device_id": dev_id,
                "first_seen": first,
                "last_seen": last,
            })

    # Remaining accounts get individual 1-to-1 devices
    while acc_cursor < len(account_ids):
        acc_id = account_ids[acc_cursor]
        acc_cursor += 1
        dev_id = devices[dev_cursor % len(devices)]["id"]
        dev_cursor += 1
        first = (now - timedelta(days=rng.randint(10, 100))).isoformat()
        last = (now - timedelta(days=rng.randint(0, 5))).isoformat()
        device_links.append({
            "account_id": acc_id,
            "device_id": dev_id,
            "first_seen": first,
            "last_seen": last,
        })

    insert_used_device_query = """
    UNWIND $batch AS link
    MATCH (a:Account {id: link.account_id})
    MATCH (d:Device {id: link.device_id})
    MERGE (a)-[r:USED_DEVICE]->(d)
    ON CREATE SET
        r.first_seen = link.first_seen,
        r.last_seen = link.last_seen
    """
    batch_insert(insert_used_device_query, device_links)

    # -------------------------------------------------------------
    # 4. Generate IPs & LOGGED_FROM relationships
    # -------------------------------------------------------------
    logger.info(f"Generating {num_ips} IPs...")
    ips = []
    country_choices = ["US", "GB", "DE", "FR", "CA", "IN", "SG", "AU"]
    country_weights = [0.45, 0.15, 0.10, 0.08, 0.07, 0.07, 0.04, 0.04]

    for i in range(num_ips):
        ip_id = f"ip_{i+1:05d}"
        raw_ip = fake.ipv4()
        ips.append({
            "id": ip_id,
            "address_hash": sha256(raw_ip),
            "country": rng.choices(country_choices, weights=country_weights, k=1)[0],
        })

    insert_ips_query = """
    UNWIND $batch AS i
    MERGE (ip:IP {id: i.id})
    ON CREATE SET
        ip.address_hash = i.address_hash,
        ip.country = i.country
    """
    batch_insert(insert_ips_query, ips)

    # Link accounts to IPs
    ip_links = []
    for idx, acc_id in enumerate(account_ids):
        ip_id = ips[idx % num_ips]["id"]
        ip_links.append({
            "account_id": acc_id,
            "ip_id": ip_id,
            "count": rng.randint(3, 45),
            "last_seen": (now - timedelta(days=rng.randint(0, 7))).isoformat(),
        })

    insert_logged_from_query = """
    UNWIND $batch AS link
    MATCH (a:Account {id: link.account_id})
    MATCH (i:IP {id: link.ip_id})
    MERGE (a)-[r:LOGGED_FROM]->(i)
    ON CREATE SET
        r.count = link.count,
        r.last_seen = link.last_seen
    """
    batch_insert(insert_logged_from_query, ip_links)

    # -------------------------------------------------------------
    # 5. Generate Cards & PAID_WITH relationships
    # -------------------------------------------------------------
    logger.info(f"Generating {num_cards} Cards...")
    cards = []
    issuers = ["Visa", "Mastercard", "Amex", "Discover"]
    issuer_weights = [0.50, 0.35, 0.10, 0.05]

    for i in range(num_cards):
        crd_id = f"crd_{i+1:05d}"
        last4 = f"{rng.randint(1000, 9999)}"
        cards.append({
            "id": crd_id,
            "last4": last4,
            "issuer": rng.choices(issuers, weights=issuer_weights, k=1)[0],
        })

    insert_cards_query = """
    UNWIND $batch AS c
    MERGE (crd:Card {id: c.id})
    ON CREATE SET
        crd.last4 = c.last4,
        crd.issuer = c.issuer
    """
    batch_insert(insert_cards_query, cards)

    # Link cards to accounts
    card_links = []
    for i in range(num_cards):
        acc_id = account_ids[i % num_accounts]
        card_links.append({
            "account_id": acc_id,
            "card_id": cards[i]["id"],
        })

    insert_paid_with_query = """
    UNWIND $batch AS link
    MATCH (a:Account {id: link.account_id})
    MATCH (c:Card {id: link.card_id})
    MERGE (a)-[:PAID_WITH]->(c)
    """
    batch_insert(insert_paid_with_query, card_links)

    # -------------------------------------------------------------
    # 6. Generate Normal Transactions (Diurnal Pattern)
    # -------------------------------------------------------------
    logger.info(f"Generating {num_normal_txns} Normal Transactions with diurnal curve...")
    # Sample normal background transactions from non-fraud accounts (accounts 300 onwards)
    normal_account_pool = account_ids[300:]
    normal_txns = []
    for i in range(num_normal_txns):
        src, dst = rng.sample(normal_account_pool, 2)
        amount = generate_realistic_amount(rng)
        ts = generate_diurnal_timestamp(start_history, now, rng).isoformat()
        normal_txns.append({
            "txn_id": f"txn_norm_{i+1:07d}",
            "from_account_id": src,
            "to_account_id": dst,
            "amount": amount,
            "ts": ts,
        })

    insert_sent_query = """
    UNWIND $batch AS t
    MATCH (src:Account {id: t.from_account_id})
    MATCH (dst:Account {id: t.to_account_id})
    CREATE (src)-[r:SENT {
        txn_id: t.txn_id,
        amount: t.amount,
        ts: t.ts
    }]->(dst)
    """
    batch_insert(insert_sent_query, normal_txns)

    # -------------------------------------------------------------
    # 7. Inject Labeled Fraud Rings & Save Ground Truth
    # -------------------------------------------------------------
    ground_truth = {
        "metadata": {
            "generated_at": now.isoformat(),
            "scale": scale,
            "seed": seed,
            "total_accounts": num_accounts,
            "total_normal_transactions": num_normal_txns,
        },
        "rings": [],
    }

    fraud_account_pool_idx = 0

    # -------------------------------------------------------------
    # P1: Shared-device / Shared-IP Rings (15 rings, 4-10 accounts each)
    # -------------------------------------------------------------
    logger.info(f"Injecting {num_sd_rings} Shared-Device Rings (Pattern P1)...")
    sd_device_links = []
    sd_ip_links = []
    sd_devices = []
    sd_ips = []
    sd_txns = []

    for ring_num in range(num_sd_rings):
        ring_id = f"ring_sd_{ring_num+1:02d}"
        cluster_size = rng.randint(4, 10)
        member_accs = account_ids[fraud_account_pool_idx : fraud_account_pool_idx + cluster_size]
        fraud_account_pool_idx += cluster_size

        # Create a dedicated shared device for this syndicate
        dev_id = f"dev_syndicate_{ring_num+1:03d}"
        dev_os = rng.choice(["Android", "Windows", "iOS"])
        shared_dev = {
            "id": dev_id,
            "fingerprint_hash": sha256(f"syndicate_fingerprint_{ring_id}_{rng.randint(1000, 9999)}"),
            "os": dev_os,
            "first_seen": (now - timedelta(days=rng.randint(15, 30))).isoformat(),
        }
        sd_devices.append(shared_dev)

        # Shared IP for the syndicate
        ip_id = f"ip_syndicate_{ring_num+1:03d}"
        shared_ip = {
            "id": ip_id,
            "address_hash": sha256(fake.ipv4()),
            "country": "US",
        }
        sd_ips.append(shared_ip)

        for acc in member_accs:
            sd_device_links.append({
                "account_id": acc,
                "device_id": dev_id,
                "first_seen": shared_dev["first_seen"],
                "last_seen": (now - timedelta(days=rng.randint(0, 3))).isoformat(),
            })
            sd_ip_links.append({
                "account_id": acc,
                "ip_id": ip_id,
                "count": rng.randint(15, 50),
                "last_seen": (now - timedelta(days=rng.randint(0, 3))).isoformat(),
            })

        # Inject rapid internal cross-transfers between members of the shared-device ring
        for step in range(cluster_size):
            src = member_accs[step]
            dst = member_accs[(step + 1) % cluster_size]
            sd_txns.append({
                "txn_id": f"txn_{ring_id}_{step+1}",
                "from_account_id": src,
                "to_account_id": dst,
                "amount": round(rng.uniform(1500.0, 4800.0), 2),
                "ts": (now - timedelta(days=rng.randint(1, 5), hours=rng.randint(1, 12))).isoformat(),
            })

        ground_truth["rings"].append({
            "ring_id": ring_id,
            "pattern": "P1",
            "type": "shared_device",
            "device_id": dev_id,
            "ip_id": ip_id,
            "member_count": cluster_size,
            "member_account_ids": member_accs,
            "description": f"Syndicate of {cluster_size} accounts accessing via shared device {dev_id}",
        })

    # Insert P1 devices, IPs, and links
    batch_insert(insert_devices_query, sd_devices)
    batch_insert(insert_ips_query, sd_ips)
    batch_insert(insert_used_device_query, sd_device_links)
    batch_insert(insert_logged_from_query, sd_ip_links)
    batch_insert(insert_sent_query, sd_txns)

    # -------------------------------------------------------------
    # P2: Circular Money Flow Rings (10 rings, 3-6 hops, within 72 hours)
    # -------------------------------------------------------------
    logger.info(f"Injecting {num_cf_rings} Circular-Flow Rings (Pattern P2)...")
    cf_txns = []

    for ring_num in range(num_cf_rings):
        ring_id = f"ring_cf_{ring_num+1:02d}"
        hops = rng.randint(3, 6)
        member_accs = account_ids[fraud_account_pool_idx : fraud_account_pool_idx + hops]
        fraud_account_pool_idx += hops

        # Start time for cycle
        cycle_start_time = now - timedelta(days=rng.randint(2, 20), hours=rng.randint(0, 23))
        # Initial laundering sum (e.g. $10,000 to $45,000)
        curr_amount = round(rng.uniform(8500.0, 35000.0), 2)
        total_cycle_volume = curr_amount

        txn_ids = []
        hop_duration_hours = rng.uniform(4.0, 14.0)  # Total cycle closes well within 72h

        for h in range(hops):
            src = member_accs[h]
            dst = member_accs[(h + 1) % hops]
            hop_time = cycle_start_time + timedelta(hours=(h + 1) * hop_duration_hours)
            # Laundering fee shaved at each hop: 1.0% to 2.5%
            haircut = round(curr_amount * rng.uniform(0.01, 0.025), 2)
            curr_amount = round(curr_amount - haircut, 2)

            t_id = f"txn_{ring_id}_hop{h+1}"
            txn_ids.append(t_id)
            cf_txns.append({
                "txn_id": t_id,
                "from_account_id": src,
                "to_account_id": dst,
                "amount": curr_amount,
                "ts": hop_time.isoformat(),
            })

        duration_hours = round((hops * hop_duration_hours), 1)

        ground_truth["rings"].append({
            "ring_id": ring_id,
            "pattern": "P2",
            "type": "cycle",
            "hop_count": hops,
            "duration_hours": duration_hours,
            "initial_amount": total_cycle_volume,
            "final_amount": curr_amount,
            "member_account_ids": member_accs,
            "txn_ids": txn_ids,
            "description": f"Closed loop money cycle of {hops} hops totaling ~${total_cycle_volume:,.2f} within {duration_hours}h",
        })

    batch_insert(insert_sent_query, cf_txns)

    # -------------------------------------------------------------
    # P3: Mule Accounts (8 rings, high fan-in, short dwell, rapid fan-out)
    # -------------------------------------------------------------
    logger.info(f"Injecting {num_mule_rings} Mule Account Structures (Pattern P3)...")
    mule_txns = []

    for ring_num in range(num_mule_rings):
        ring_id = f"ring_mule_{ring_num+1:02d}"
        fan_in_count = rng.randint(5, 12)
        fan_out_count = rng.randint(1, 3)

        mule_acc = account_ids[fraud_account_pool_idx]
        fraud_account_pool_idx += 1

        feeders = account_ids[fraud_account_pool_idx : fraud_account_pool_idx + fan_in_count]
        fraud_account_pool_idx += fan_in_count

        sinks = account_ids[fraud_account_pool_idx : fraud_account_pool_idx + fan_out_count]
        fraud_account_pool_idx += fan_out_count

        mule_time_base = now - timedelta(days=rng.randint(2, 25))
        total_inflow = 0.0

        # High fan-in: multiple feeders deposit within 12 hours
        for idx, feeder in enumerate(feeders):
            dep_amount = round(rng.uniform(1200.0, 4800.0), 2)
            total_inflow += dep_amount
            deposit_time = mule_time_base + timedelta(hours=idx * rng.uniform(0.5, 1.5))
            mule_txns.append({
                "txn_id": f"txn_{ring_id}_in_{idx+1}",
                "from_account_id": feeder,
                "to_account_id": mule_acc,
                "amount": dep_amount,
                "ts": deposit_time.isoformat(),
            })

        # Fast fan-out: short dwell time (1 to 4 hours after final deposit)
        final_deposit_time = mule_time_base + timedelta(hours=fan_in_count * 1.5)
        fan_out_time = final_deposit_time + timedelta(hours=rng.uniform(1.0, 4.0))

        # Distribute 95% of total accumulated inflow across sinks
        available_outflow = total_inflow * 0.95
        amount_per_sink = round(available_outflow / fan_out_count, 2)

        for s_idx, sink in enumerate(sinks):
            mule_txns.append({
                "txn_id": f"txn_{ring_id}_out_{s_idx+1}",
                "from_account_id": mule_acc,
                "to_account_id": sink,
                "amount": amount_per_sink,
                "ts": (fan_out_time + timedelta(minutes=s_idx * 15)).isoformat(),
            })

        ground_truth["rings"].append({
            "ring_id": ring_id,
            "pattern": "P3",
            "type": "mule",
            "mule_account_id": mule_acc,
            "feeder_account_ids": feeders,
            "sink_account_ids": sinks,
            "total_inflow": round(total_inflow, 2),
            "fan_in_count": fan_in_count,
            "fan_out_count": fan_out_count,
            "member_account_ids": [mule_acc] + feeders + sinks,
            "description": f"Mule {mule_acc}: {fan_in_count} deposits in, rapid transfer to {fan_out_count} sinks within 3h",
        })

    batch_insert(insert_sent_query, mule_txns)

    # -------------------------------------------------------------
    # 8. Save Ground Truth File
    # -------------------------------------------------------------
    gt_file_scripts = output_dir / "ground_truth.json"
    with open(gt_file_scripts, "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2)
    logger.info(f"Saved ground truth to {gt_file_scripts}")

    # Also save a copy to backend/data/ground_truth.json so backend services can access it
    backend_data_dir = Path(__file__).resolve().parent.parent / "backend" / "data"
    backend_data_dir.mkdir(parents=True, exist_ok=True)
    gt_file_backend = backend_data_dir / "ground_truth.json"
    with open(gt_file_backend, "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2)
    logger.info(f"Saved ground truth replica to {gt_file_backend}")

    # Final summary
    total_rings = len(ground_truth["rings"])
    p1_count = sum(1 for r in ground_truth["rings"] if r["pattern"] == "P1")
    p2_count = sum(1 for r in ground_truth["rings"] if r["pattern"] == "P2")
    p3_count = sum(1 for r in ground_truth["rings"] if r["pattern"] == "P3")

    logger.info("=" * 60)
    logger.info("DATA GENERATION COMPLETE")
    logger.info(f"Total Accounts: {num_accounts}")
    logger.info(f"Total Normal Transactions: {num_normal_txns}")
    logger.info(f"Injected Fraud Rings: {total_rings} (P1 Shared-Device: {p1_count}, P2 Cycles: {p2_count}, P3 Mules: {p3_count})")
    logger.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic financial graph data for FraudGraph")
    parser.add_argument("--scale", type=float, default=1.0, help="Scale factor (default 1.0 for ~5k accounts)")
    parser.add_argument("--reset", action="store_true", help="Wipe database before generating")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    run_generator(scale=args.scale, reset=args.reset, seed=args.seed)
