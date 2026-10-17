from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.core.config import settings
from app.core.security import (
    USERS_DB,
    UserAuth,
    create_access_token,
    get_current_user,
    verify_password,
)
from app.models.user import AuthLoginRequest, Token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(credentials: AuthLoginRequest):
    """
    Authenticate analyst or admin and return signed JWT token.
    Accepts JSON body: {username, password}
    """
    user = USERS_DB.get(credentials.username)
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
    )


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 standard password form endpoint for Swagger UI documentation integration.
    """
    user = USERS_DB.get(form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
    )


@router.get("/me")
async def get_my_profile(current_user: UserAuth = Depends(get_current_user)):
    """
    Returns authenticated user's profile and active role permissions.
    """
    return {
        "username": current_user.username,
        "role": current_user.role,
        "is_admin": current_user.role == "admin",
        "is_analyst": current_user.role in ["analyst", "admin"],
    }
