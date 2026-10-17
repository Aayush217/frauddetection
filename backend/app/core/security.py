import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class UserAuth(BaseModel):
    username: str
    role: str  # "admin" or "analyst"
    hashed_password: str


# Initial in-memory user registry (seeded from configuration)
def _hash_password(raw: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(raw.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


# In-memory user database initialized with admin and analyst users
USERS_DB: Dict[str, UserAuth] = {
    settings.ADMIN_USERNAME: UserAuth(
        username=settings.ADMIN_USERNAME,
        role="admin",
        hashed_password=_hash_password(settings.ADMIN_PASSWORD),
    ),
    settings.ANALYST_USERNAME: UserAuth(
        username=settings.ANALYST_USERNAME,
        role="analyst",
        hashed_password=_hash_password(settings.ANALYST_PASSWORD),
    ),
}


def hash_pii(value: str) -> str:
    """
    Cryptographic SHA-256 hash for personal identifiers (email, IP, canvas fingerprint).
    Ensures zero raw PII is stored in graph nodes.
    """
    if not value:
        return ""
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generate signed JWT bearer token containing username, role, and expiration.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> TokenData:
    """
    Decode and validate JWT token signature and expiry.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
        return TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserAuth:
    """
    FastAPI dependency extracting and validating the authenticated user.
    """
    token_data = decode_access_token(token)
    user = USERS_DB.get(token_data.username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(allowed_roles: List[str]):
    """
    Role-Based Access Control (RBAC) dependency factory.
    Verifies that the caller's role belongs to the allowed set.
    """
    async def role_checker(current_user: UserAuth = Depends(get_current_user)) -> UserAuth:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires one of roles: {', '.join(allowed_roles)} (current role: {current_user.role})",
            )
        return current_user

    return role_checker


# Role dependencies for route protection
require_analyst = require_role(["analyst", "admin"])
require_admin = require_role(["admin"])
