from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class AccountStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    FROZEN = "frozen"
    CLOSED = "closed"


class ReviewState(str, Enum):
    UNREVIEWED = "unreviewed"
    UNDER_REVIEW = "under_review"
    CONFIRMED = "confirmed"
    FALSE_POSITIVE = "false_positive"


class AccountCreate(BaseModel):
    id: Optional[str] = Field(default=None, description="Unique account ID (e.g., acc_1001)")
    user_id: Optional[str] = Field(default=None, description="Optional owning User ID")
    status: AccountStatus = Field(default=AccountStatus.ACTIVE)
    opened_at: Optional[str] = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 timestamp"
    )
    risk_score: float = Field(default=0.0, ge=0.0, le=100.0)
    risk_reasons: List[str] = Field(default_factory=list)
    review_state: ReviewState = Field(default=ReviewState.UNREVIEWED)


class AccountUpdate(BaseModel):
    status: Optional[AccountStatus] = None
    risk_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    risk_reasons: Optional[List[str]] = None
    review_state: Optional[ReviewState] = None


class AccountReviewUpdate(BaseModel):
    review_state: ReviewState = Field(..., description="confirmed | false_positive | under_review")
    note: Optional[str] = Field(default=None, description="Analyst review notes")


class AccountRead(BaseModel):
    id: str
    status: str
    opened_at: str
    risk_score: float
    risk_reasons: List[str] = Field(default_factory=list)
    review_state: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    device_count: int = 0
    ip_count: int = 0
    card_count: int = 0
    sent_count: int = 0
    received_count: int = 0
    total_sent_amount: float = 0.0
    total_received_amount: float = 0.0
