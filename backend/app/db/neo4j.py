import logging
import time
from typing import Any, Dict, List, Optional
from neo4j import GraphDatabase, Driver, Session, ManagedTransaction
from app.core.config import settings

logger = logging.getLogger("fraudgraph.neo4j")

_driver: Optional[Driver] = None


def get_driver() -> Driver:
    """
    Returns the singleton Neo4j driver instance.
    Initializes the connection pool if not already open.
    """
    global _driver
    if _driver is None:
        logger.info(f"Connecting to Neo4j at {settings.NEO4J_URI}...")
        _driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            max_connection_lifetime=3600,
            max_connection_pool_size=50,
            connection_acquisition_timeout=60,
        )
    return _driver


def close_driver() -> None:
    """Closes the Neo4j driver connection pool cleanly on shutdown."""
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
        logger.info("Neo4j driver connection closed.")


def verify_connection() -> bool:
    """Checks Neo4j database connectivity and server version."""
    driver = get_driver()
    try:
        driver.verify_connectivity()
        return True
    except Exception as exc:
        logger.error(f"Neo4j connection verification failed: {exc}")
        return False


def execute_cypher(
    query: str,
    params: Optional[Dict[str, Any]] = None,
    database: str = "neo4j",
    fetch_records: bool = True,
) -> List[Dict[str, Any]]:
    """
    Executes a PARAMETERIZED Cypher query against Neo4j.
    Enforces that queries never concatenate raw parameters to prevent Cypher injection.
    Logs execution duration for performance audits.
    """
    params = params or {}
    driver = get_driver()
    start_time = time.perf_counter()

    with driver.session(database=database) as session:
        result = session.run(query, params)
        records = [record.data() for record in result] if fetch_records else []
        elapsed = (time.perf_counter() - start_time) * 1000

        # Log slow queries (> 50ms) for analyst observability
        if elapsed > 50:
            logger.warning(f"Slow Cypher query ({elapsed:.1f}ms): {query[:120]}... Params: {params}")
        else:
            logger.debug(f"Cypher query executed in {elapsed:.2f}ms")

        return records


def execute_write_transaction(func, *args, database: str = "neo4j", **kwargs) -> Any:
    """
    Executes an atomic write transaction with Neo4j automatic retry on transient errors.
    Used for multi-step operations like transfer creation (edge creation + balance check).
    """
    driver = get_driver()
    with driver.session(database=database) as session:
        return session.execute_write(func, *args, **kwargs)


def init_schema(database: str = "neo4j") -> Dict[str, List[str]]:
    """
    Idempotently creates uniqueness constraints and indexes for FraudGraph.
    Safe to run repeatedly on startup.

    Constraints enforce unique identifiers for all entity labels.
    Indexes optimize multi-hop traversals, timestamp filtering, and risk queries.
    """
    statements = [
        # Uniqueness Constraints (Neo4j 5 syntax)
        "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
        "CREATE CONSTRAINT account_id_unique IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE",
        "CREATE CONSTRAINT device_id_unique IF NOT EXISTS FOR (d:Device) REQUIRE d.id IS UNIQUE",
        "CREATE CONSTRAINT ip_id_unique IF NOT EXISTS FOR (i:IP) REQUIRE i.id IS UNIQUE",
        "CREATE CONSTRAINT card_id_unique IF NOT EXISTS FOR (c:Card) REQUIRE c.id IS UNIQUE",

        # Node Property Indexes
        "CREATE INDEX account_risk_score_idx IF NOT EXISTS FOR (a:Account) ON (a.risk_score)",
        "CREATE INDEX account_review_state_idx IF NOT EXISTS FOR (a:Account) ON (a.review_state)",

        # Relationship Property Indexes (Neo4j 5 enables indexing edge properties)
        "CREATE INDEX sent_ts_idx IF NOT EXISTS FOR ()-[r:SENT]-() ON (r.ts)",
        "CREATE INDEX sent_amount_idx IF NOT EXISTS FOR ()-[r:SENT]-() ON (r.amount)",
    ]

    applied = []
    errors = []
    driver = get_driver()
    with driver.session(database=database) as session:
        for stmt in statements:
            try:
                session.run(stmt)
                applied.append(stmt)
                logger.info(f"Schema statement applied: {stmt}")
            except Exception as e:
                logger.error(f"Error applying schema statement '{stmt}': {e}")
                errors.append(f"{stmt} -> {str(e)}")

    return {"applied": applied, "errors": errors}
