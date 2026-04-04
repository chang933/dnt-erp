"""KDS 주문/주문아이템 CRUD"""
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from app.models.order import Order, OrderItem
from app.schemas.order import OrderCreate


def get_next_order_number(db: Session, store_id: int) -> int:
    """다음 주문번호 반환 (지점 내 #001, #002 ...)"""
    r = (
        db.query(func.coalesce(func.max(Order.order_number), 0) + 1)
        .filter(Order.store_id == store_id)
        .scalar()
    )
    return r


def create_order(db: Session, store_id: int, order: OrderCreate) -> Order:
    """주문 생성 (아이템 포함)"""
    order_number = get_next_order_number(db, store_id)
    db_order = Order(
        store_id=store_id,
        order_number=order_number,
        table_number=order.table_number,
        order_type=order.order_type,
        status=order.status,
        total_amount=order.total_amount,
        note=order.note,
        customer_phone=order.customer_phone,
    )
    db.add(db_order)
    db.flush()
    for it in order.items:
        part_status = {p: "pending" for p in it.parts}
        db_item = OrderItem(
            order_id=db_order.id,
            menu_id=it.menu_id,
            menu_name=it.menu_name,
            quantity=it.quantity,
            unit_price=it.unit_price,
            total_price=it.total_price,
            parts=it.parts,
            options=it.options,
            note=it.note,
            status="pending",
            part_status=part_status,
        )
        db.add(db_item)
    db.commit()
    db.refresh(db_order)
    return db_order


def get_order(db: Session, order_id: int, store_id: int) -> Optional[Order]:
    """주문 1건 조회"""
    return (
        db.query(Order)
        .filter(Order.id == order_id, Order.store_id == store_id)
        .first()
    )


def get_orders(
    db: Session,
    store_id: int,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
) -> List[Order]:
    """주문 목록 조회"""
    q = (
        db.query(Order)
        .filter(Order.store_id == store_id)
        .order_by(desc(Order.id))
    )
    if status:
        q = q.filter(Order.status == status)
    return q.offset(skip).limit(limit).all()


def get_order_items_by_part(
    db: Session, store_id: int, part: str, statuses: Optional[List[str]] = None
) -> List[OrderItem]:
    """특정 파트의 주문 아이템 조회 (KDS용). parts 배열에 part 포함된 것. order 관계 로드."""
    from sqlalchemy.orm import joinedload

    q = (
        db.query(OrderItem)
        .options(joinedload(OrderItem.order))
        .join(Order)
        .filter(
            Order.store_id == store_id,
            Order.status == "active",
            OrderItem.parts.contains([part]),
        )
    )
    if statuses is not None:
        q = q.filter(OrderItem.status.in_(statuses))
    return q.order_by(OrderItem.created_at).all()


def get_order_items_for_serving(
    db: Session, store_id: int, status: str = "ready"
) -> List[OrderItem]:
    """서빙 화면용: ready 또는 cooking인 아이템 (주문 단위로). order 관계 로드."""
    from sqlalchemy.orm import joinedload

    return (
        db.query(OrderItem)
        .options(joinedload(OrderItem.order))
        .join(Order)
        .filter(
            Order.store_id == store_id,
            Order.status == "active",
            OrderItem.status.in_(["ready", "cooking", "pending"]),
        )
        .order_by(OrderItem.order_id, OrderItem.created_at)
        .all()
    )


def _order_item_for_store(
    db: Session, store_id: int, item_id: int
) -> Optional[OrderItem]:
    return (
        db.query(OrderItem)
        .join(Order)
        .filter(OrderItem.id == item_id, Order.store_id == store_id)
        .first()
    )


def update_order_item_status(
    db: Session,
    store_id: int,
    item_id: int,
    status: Optional[str] = None,
    part_status: Optional[dict] = None,
) -> Optional[OrderItem]:
    """주문 아이템 상태 변경 (KDS 조리시작/조리완료, 홀 서빙완료)"""
    item = _order_item_for_store(db, store_id, item_id)
    if not item:
        return None
    if status is not None:
        item.status = status
    if part_status is not None:
        item.part_status = {**item.part_status, **part_status}
        if all(item.part_status.get(p) == "ready" for p in item.parts):
            item.status = "ready"
    db.commit()
    db.refresh(item)
    return item


def update_order_item_part_status(
    db: Session, store_id: int, item_id: int, part: str, part_state: str
) -> Optional[OrderItem]:
    """특정 파트 상태만 변경 (cooking / ready)"""
    item = _order_item_for_store(db, store_id, item_id)
    if not item or part not in item.parts:
        return None
    item.part_status = {**(item.part_status or {}), part: part_state}
    if all(item.part_status.get(p) == "ready" for p in item.parts):
        item.status = "ready"
    db.commit()
    db.refresh(item)
    return item


def get_order_item(db: Session, item_id: int, store_id: int) -> Optional[OrderItem]:
    """주문 아이템 1건 조회 (지점 소속 주문에 한함)"""
    return _order_item_for_store(db, store_id, item_id)
