from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class DeviceCreate(BaseModel):
    id: Optional[str] = Field(default=None, description="Unique device ID")
    fingerprint_hash: Optional[str] = Field(default=None, description="Pre-hashed fingerprint or will be computed")
    raw_fingerprint: Optional[str] = Field(default=None, description="Raw fingerprint to be hashed immediately")
    os: str = Field(default="Unknown", description="Operating system")
    first_seen: Optional[str] = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 timestamp"
    )


class DeviceUpdate(BaseModel):
    os: Optional[str] = None


class DeviceLink(BaseModel):
    account_id: str
    device_id: str
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None


class DeviceRead(BaseModel):
    id: str
    fingerprint_hash: str
    os: str
    first_seen: str
    account_count: int = 0
