from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.store import Store
from app.schemas.store import StoreCreate, StoreUpdate


def get_store(db: Session, store_id: int) -> Optional[Store]:
    return db.query(Store).filter(Store.id == store_id).first()


def get_stores(db: Session, active_only: bool = False) -> List[Store]:
    q = db.query(Store).order_by(Store.id)
    if active_only:
        q = q.filter(Store.is_active.is_(True))
    return q.all()


def create_store(db: Session, data: StoreCreate) -> Store:
    row = Store(name=data.name, code=data.code, is_active=data.is_active)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_store(db: Session, store_id: int, data: StoreUpdate) -> Optional[Store]:
    row = get_store(db, store_id)
    if not row:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row
