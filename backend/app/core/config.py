import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings for FraudGraph.
    Configured via environment variables or .env file.
    """
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & JWT
    SECRET_KEY: str = "supersecret-fraudgraph-jwt-key-2026-viva-ready"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Seed User Credentials
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "adminpassword123"
    ANALYST_USERNAME: str = "analyst"
    ANALYST_PASSWORD: str = "analystpassword123"

    # Neo4j Graph Database
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "fraudgraphpassword"

    # PostgreSQL (Used for Cypher vs SQL benchmark)
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5433
    POSTGRES_USER: str = "frauduser"
    POSTGRES_PASSWORD: str = "fraudpassword"
    POSTGRES_DB: str = "fraudgraph"

    # Server Configuration
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8008
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3008",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3008",
    ]

    # Risk Scoring Model Weights (Sum = 100)
    # Configurable in one location per specification
    RISK_WEIGHT_CYCLE: float = 35.0
    RISK_WEIGHT_SHARED_DEVICE: float = 25.0
    RISK_WEIGHT_MULE: float = 25.0
    RISK_WEIGHT_VELOCITY: float = 15.0

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            import json
            return json.loads(v)
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
