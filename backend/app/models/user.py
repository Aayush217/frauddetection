from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    id: Optional[str] = Field(default=None, description="Unique User ID")
    name: str = Field(..., description="User full name or alias")
    email: Optional[str] = Field(default=None, description="Email address to be hashed")
    email_hash: Optional[str] = Field(default=None, description="Pre-hashed email")
    created_at: Optional[str] = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 timestamp"
    )


class UserUpdate(BaseModel):
    name: Optional[str] = None


class UserRead(BaseModel):
    id: str
    name: str
    email_hash: str
    created_at: str
    account_count: int = 0
    accounts: List[str] = Field(default_factory=list)


class AuthLoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
