from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field


class TransferCreate(BaseModel):
    from_account_id: str = Field(..., description="Source account ID")
    to_account_id: str = Field(..., description="Destination account ID")
    amount: float = Field(..., gt=0, description="Monetary transfer amount (must be positive)")
    txn_id: Optional[str] = Field(default=None, description="Unique transaction ID (generated if omitted)")
    ts: Optional[str] = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 transaction timestamp"
    )


class TransferRead(BaseModel):
    txn_id: str
    from_account_id: str
    to_account_id: str
    amount: float
    ts: str


class TransferResult(BaseModel):
    transfer: TransferRead
    status: str  # "completed", "flagged"
    flagged: bool = False
    flag_reasons: List[str] = Field(default_factory=list)
    velocity_warning: bool = False
    atomic_transaction_id: Optional[str] = None
