# FraudGraph: Detection Algorithms & Graph Analytics

This document explains the detection algorithms, graph analytics, and explainable risk-scoring mechanics used in FraudGraph in plain language suitable for a university viva and technical review.

---

## 1. Pattern P1: Shared-Device & Shared-IP Rings

### Plain Language Explanation
Legitimate individuals typically own their own personal mobile device or laptop. When dozens of distinct bank accounts log in from the exact same hardware fingerprint, it indicates an organized syndicate operating from a fraud farm or automated emulator.

### Cypher Query
```cypher
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
```

### Key Nuances
* **Noise vs Fraud**: Families and shared office workstations frequently have 2 or 3 users on a single iPad or desktop. Setting `$min_accounts >= 4` effectively filters out benign household sharing while capturing organized rings (which contain 4 to 10 accounts).

---

## 2. Pattern P2: Circular Money Flow

### Plain Language Explanation
Fraudsters move money through a chain of accounts (e.g. Account A &rarr; Account B &rarr; Account C &rarr; Account A) to disguise the origin of funds (layering). In a legitimate economy, money rarely moves in a complete directed circle within hours while preserving the principal sum.

### Cypher Query
```cypher
MATCH path = (start:Account)-[r:SENT*3..6]->(start)
WHERE ALL(i IN range(0, size(nodes(path))-2) 
      WHERE ALL(j IN range(i+1, size(nodes(path))-2) 
      WHERE nodes(path)[i] <> nodes(path)[j]))
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
```

### Computational Defenses Against Combinatorial Explosion
1. **Depth Capping**: Path length is capped strictly between 3 and 6 hops (`*3..6`). In graph theory, unrestricted variable-length paths (`*`) on dense graphs trigger factorial $O(V!)$ traversal explosions.
2. **Canonical Cycle Symmetry Breaking**: `ALL(n IN nodes(path)[1..-1] WHERE n.id > start.id)` ensures each cycle is traversed starting from its lexicographically smallest node ID, eliminating duplicate rotated permutations.
3. **Chronological Monotonicity**: `datetime(txns[i].ts) <= datetime(txns[i+1].ts)` requires money to move forward in time.
4. **Temporal Window**: `dur_sec <= $window_seconds` (default 72 hours) prunes stale connections.

---

## 3. Pattern P3: Mule Accounts (Fan-In / Fan-Out)

### Plain Language Explanation
A money mule acts as an intermediary. Many victims or compromised accounts deposit funds into the mule's account within a short period (high fan-in). Shortly thereafter (short dwell time), the mule transfers the aggregated sum out to 1 to 3 cash-out destination accounts (sinks) before the victim realizes and files a fraud claim.

### Cypher Query
```cypher
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
```

---

## 4. Graph Data Science (GDS) Algorithms

FraudGraph leverages Neo4j GDS 2.13 on an in-memory projected graph `(:Account)-[:SENT {amount}]->(:Account)`:

1. **Louvain Community Detection (`gds.louvain`)**:
   * Partitions the transaction graph into modular communities by maximizing community modularity.
   * Fraud rings naturally form dense sub-communities separate from the sparse retail background.
2. **PageRank Centrality (`gds.pageRank`)**:
   * Evaluates capital concentration and authority. Accounts receiving large transitive inflows from multiple influential nodes exhibit high PageRank.
3. **Betweenness Centrality (`gds.betweenness`)**:
   * Measures how often a node falls on the shortest path between all pairs of accounts. Mule accounts acting as bottlenecks or bridges between victim clusters and cash-out sinks exhibit high betweenness.
4. **Weakly Connected Components (`gds.wcc`)**:
   * Identifies disjoint transaction subgraphs to isolate disconnected criminal syndicates.

---

## 5. Explainable Risk Scoring Engine

Risk scores range from `0.0` to `100.0`. Configured in `app/core/config.py`:
$$\text{Score} = w_{\text{cycle}} + w_{\text{device}} + w_{\text{mule}} + w_{\text{velocity}}$$

| Factor | Max Weight | Trigger Condition | Explainable Audit Reason Example |
|---|---|---|---|
| **Cycle Membership** | 35 | Account is a node in a 3–6 hop closed loop | `"Part of a 4-hop cycle totaling $18,400 within 36h"` |
| **Shared Device** | 25 | Account accesses device with $\ge 4$ accounts | `"Shared hardware device dev_0001 with 7 other accounts"` |
| **Mule Centrality** | 25 | Mule fan-in/dwell time pattern or high betweenness | `"Identified as mule account: 8 inflows rapidly fanned out to 2 sinks in 3.1h"` |
| **Velocity** | 15 | Elevated transfer frequency in rolling window | `"Elevated transfer frequency: 16 outbound transfers"` |

Every risk score update persists human-readable explanations in `Account.risk_reasons` for analyst review.

---

## 6. Precision & Recall Accuracy Report

Evaluated against `scripts/ground_truth.json`:

```
=============================================================================================================
FRAUDGRAPH DETECTION ACCURACY EVALUATION REPORT
=============================================================================================================
Pattern  | Description              | GT   | Det  | TP   | FP   | FN   | Precision  | Recall     | F1-Score  
-------------------------------------------------------------------------------------------------------------
P1       | Shared-Device Rings      | 15   | 15   | 15   | 0    | 0    | 100.00%    | 100.00%    | 100.00%   
P2       | Circular Money Flows     | 10   | 10   | 10   | 0    | 0    | 100.00%    | 100.00%    | 100.00%   
P3       | Mule Accounts            | 8    | 8    | 8    | 0    | 0    | 100.00%    | 100.00%    | 100.00%   
=============================================================================================================
```
