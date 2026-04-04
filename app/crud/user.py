from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.models.user import User
from app.core.security import get_password_hash


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    key = username.strip().lower()
    if not key:
        return None
    return (
        db.query(User)
        .filter(func.lower(User.username) == key)
        .first()
    )


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def create_user(
    db: Session,
    *,
    username: str,
    password: str,
    is_admin: bool = False,
    is_active: bool = True,
    access_mode: str = "full",
) -> User:
    row = User(
        username=username.strip().lower(),
        password_hash=get_password_hash(password),
        is_admin=is_admin,
        is_active=is_active,
        access_mode=access_mode or "full",
    )
    db.add(row)
    db.commit()
    return row
