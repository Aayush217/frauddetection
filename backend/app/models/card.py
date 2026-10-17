from typing import Optional
from pydantic import BaseModel, Field


class CardCreate(BaseModel):
    id: Optional[str] = Field(default=None, description="Unique Card ID")
    last4: str = Field(..., min_length=4, max_length=4, description="Last 4 digits of card")
    issuer: str = Field(..., description="Issuer name (e.g., Visa, Mastercard, Amex)")


class CardUpdate(BaseModel):
    issuer: Optional[str] = None


class CardLink(BaseModel):
    account_id: str
    card_id: str


class CardRead(BaseModel):
    id: str
    last4: str
    issuer: str
    account_count: int = 0
