from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="1-indexed page number")
    page_size: int = Field(default=50, ge=1, le=500, description="Items per page")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class ErrorResponse(BaseModel):
    """
    Standard error envelope {error, detail} required by specification.
    """
    error: str
    detail: str


class DeleteResponse(BaseModel):
    success: bool
    deleted_id: str
    message: str


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None
