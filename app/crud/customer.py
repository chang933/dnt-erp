from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate


def get_customer(db: Session, customer_id: int) -> Optional[Customer]:
    """고객 ID로 조회"""
    return db.query(Customer).filter(Customer.id == customer_id).first()


def get_customers(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    is_vip: Optional[bool] = None,
    is_blacklist: Optional[bool] = None,
    search: Optional[str] = None
) -> List[Customer]:
    """고객 목록 조회"""
    query = db.query(Customer)
    
    if is_vip is not None:
        query = query.filter(Customer.is_vip == is_vip)
    if is_blacklist is not None:
        query = query.filter(Customer.is_blacklist == is_blacklist)
    if search:
        query = query.filter(
            or_(
                Customer.name.contains(search),
                Customer.phone.contains(search)
            )
        )
    
    return query.order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()


def create_customer(db: Session, customer: CustomerCreate) -> Customer:
    """새 고객 생성"""
    db_customer = Customer(
        name=customer.name,
        phone=customer.phone,
        memo=customer.memo,
        is_vip=customer.is_vip,
        is_blacklist=False
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


def update_customer(
    db: Session,
    customer_id: int,
    customer_update: CustomerUpdate
) -> Optional[Customer]:
    """고객 정보 수정"""
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        return None
    
    update_data = customer_update.model_dump(exclude_unset=True)
    
    # 블랙리스트로 변경 시 날짜 추가
    if update_data.get('is_blacklist') is True and not db_customer.is_blacklist:
        update_data['blacklist_date'] = datetime.now()
    elif update_data.get('is_blacklist') is False:
        update_data['blacklist_date'] = None
        update_data['blacklist_reason'] = None
    
    for field, value in update_data.items():
        setattr(db_customer, field, value)
    
    db.commit()
    db.refresh(db_customer)
    return db_customer


def delete_customer(db: Session, customer_id: int) -> bool:
    """고객 삭제"""
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        return False
    
    db.delete(db_customer)
    db.commit()
    return True

