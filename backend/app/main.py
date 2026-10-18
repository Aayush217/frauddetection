import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.accounts import router as accounts_router
from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.cards import router as cards_router
from app.api.devices import router as devices_router
from app.api.ips import router as ips_router
from app.api.transactions import router as transactions_router
from app.core.config import settings
from app.core.logging import RequestLoggingMiddleware
from app.db.neo4j import close_driver, get_driver, init_schema, verify_connection

logger = logging.getLogger("fraudgraph.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager:
    - Runs schema constraint checks on startup
    - Gracefully closes Neo4j connection pool on shutdown
    """
    logger.info("Initializing FraudGraph backend...")
    connected = verify_connection()
    if connected:
        logger.info("Neo4j database verified. Ensuring constraints and indexes...")
        schema_res = init_schema()
        logger.info(f"Schema initialized: {len(schema_res['applied'])} statements verified.")

        # Check if database has accounts; if 0, auto-seed synthetic data on docker compose up
        try:
            from app.db.neo4j import execute_cypher
            node_check = execute_cypher("MATCH (a:Account) RETURN count(a) AS cnt LIMIT 1")
            if node_check and node_check[0]["cnt"] == 0:
                logger.info("Database is empty. Automatically generating initial synthetic fraud graph...")
                import subprocess
                import sys
                from pathlib import Path
                gen_script = Path(__file__).resolve().parent.parent.parent / "scripts" / "generate_data.py"
                if gen_script.exists():
                    subprocess.run([sys.executable, str(gen_script), "--scale", "1.0", "--seed", "42"], check=False)
                    logger.info("Automatic initial seeding completed.")
        except Exception as seed_err:
            logger.warning(f"Could not run initial auto-seed check: {seed_err}")
    else:
        logger.warning("Could not establish immediate Neo4j connection; will retry upon incoming requests.")

    yield

    logger.info("Shutting down FraudGraph backend...")
    close_driver()


app = FastAPI(
    title="FraudGraph API",
    description="Fraud-ring detection and identity-resolution graph platform built on Neo4j",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Request logging middleware
app.add_middleware(RequestLoggingMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Consistent error format {error, detail}
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Formats Pydantic request validation errors into standard {error, detail} envelope.
    """
    error_messages = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "")
        error_messages.append(f"{loc}: {msg}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "detail": "; ".join(error_messages),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Formats HTTP exceptions into standard {error, detail} envelope.
    """
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "Request Error" if exc.status_code < 500 else "Server Error",
            "detail": detail,
        },
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all unhandled exception handler to ensure standard {error, detail} envelope.
    """
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": str(exc),
        },
    )


# Root Health Check
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint reporting Neo4j connectivity and system status.
    """
    neo4j_healthy = verify_connection()
    return {
        "status": "healthy" if neo4j_healthy else "degraded",
        "neo4j": "connected" if neo4j_healthy else "disconnected",
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
    }


from app.api.detection import router as detection_router
from app.api.analysis import router as analysis_router
from app.api.rings import router as rings_router

# Include Routers under /api
app.include_router(auth_router, prefix="/api")
app.include_router(accounts_router, prefix="/api")
app.include_router(devices_router, prefix="/api")
app.include_router(ips_router, prefix="/api")
app.include_router(cards_router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(detection_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(rings_router, prefix="/api")

# Also include directly at root to support spec paths like /detect/cycles or /rings
app.include_router(detection_router)
app.include_router(analysis_router)
app.include_router(rings_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=settings.DEBUG,
    )
