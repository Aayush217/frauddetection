from typing import Optional
from pydantic import BaseModel, Field


class IPCreate(BaseModel):
    id: Optional[str] = Field(default=None, description="Unique IP ID")
    address_hash: Optional[str] = Field(default=None, description="Pre-hashed IP address")
    raw_address: Optional[str] = Field(default=None, description="Raw IP to be hashed immediately")
    country: str = Field(default="XX", description="Two-letter ISO country code")


class IPUpdate(BaseModel):
    country: Optional[str] = None


class IPLink(BaseModel):
    account_id: str
    ip_id: str
    count: int = Field(default=1, ge=1)
    last_seen: Optional[str] = None


class IPRead(BaseModel):
    id: str
    address_hash: str
    country: str
    account_count: int = 0
