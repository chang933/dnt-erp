from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import LoginRequest, TokenResponse, UserMe
from app.crud import user as user_crud
from app.core.security import verify_password, create_access_token
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = user_crud.get_user_by_username(db, body.username)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")
    token = create_access_token(
        subject=user.username,
        extra_claims={"uid": user.id, "adm": user.is_admin},
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserMe)
def me(current: User = Depends(get_current_user)):
    return UserMe.model_validate(current)
