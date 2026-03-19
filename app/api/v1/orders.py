"""KDS 주문 API (카운터 주문 입력, KDS/서빙 상태 변경)"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.schemas.order import Order, OrderCreate, OrderItem, OrderItemUpdate
from app.crud import order as crud_order

router = APIRouter()


@router.post("", response_model=Order, status_code=201)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """카운터에서 주문 생성 (메뉴입력 완료)"""
    db_order = crud_order.create_order(db=db, order=order)
    return Order.model_validate(db_order)


@router.get("", response_model=List[Order])
def get_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = Query(None, description="active | completed | cancelled"),
    db: Session = Depends(get_db),
):
    """주문 목록 조회"""
    orders = crud_order.get_orders(db=db, skip=skip, limit=limit, status=status)
    return [Order.model_validate(o) for o in orders]


@router.get("/serving/items")
def get_serving_items(db: Session = Depends(get_db)):
    """서빙 화면용: 픽업대기/조리중 아이템 목록 (order_number, table_number, order_type 포함)"""
    items = crud_order.get_order_items_for_serving(db=db)
    result = []
    for i in items:
        d = OrderItem.model_validate(i).model_dump()
        d["order_number"] = i.order.order_number
        d["table_number"] = i.order.table_number
        d["order_type"] = i.order.order_type
        result.append(d)
    return result


@router.get("/part/{part}")
def get_order_items_by_part(
    part: str,
    status: Optional[str] = Query(None, description="pending | cooking | ready"),
    db: Session = Depends(get_db),
):
    """KDS용: 특정 파트(면파트/웍파트/튀김파트 등)의 주문 아이템 목록 (order_number, table_number, order_type 포함)"""
    statuses = [status] if status else None
    items = crud_order.get_order_items_by_part(db=db, part=part, statuses=statuses)
    result = []
    for i in items:
        d = OrderItem.model_validate(i).model_dump()
        d["order_number"] = i.order.order_number
        d["table_number"] = i.order.table_number
        d["order_type"] = i.order.order_type
        result.append(d)
    return result


@router.get("/{order_id}", response_model=Order)
def get_order(order_id: int, db: Session = Depends(get_db)):
    """주문 1건 조회"""
    db_order = crud_order.get_order(db=db, order_id=order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    return Order.model_validate(db_order)


@router.patch("/items/{item_id}", response_model=OrderItem)
def update_order_item(
    item_id: int,
    status: Optional[str] = Query(None),
    part: Optional[str] = Query(None, description="파트명 (면파트 등)"),
    part_state: Optional[str] = Query(None, description="cooking | ready"),
    db: Session = Depends(get_db),
):
    """주문 아이템 상태 변경 (KDS 조리시작/조리완료, 홀 서빙완료)"""
    if part and part_state:
        item = crud_order.update_order_item_part_status(db=db, item_id=item_id, part=part, part_state=part_state)
    else:
        item = crud_order.update_order_item_status(db=db, item_id=item_id, status=status)
    if not item:
        raise HTTPException(status_code=404, detail="주문 아이템을 찾을 수 없습니다")
    return OrderItem.model_validate(item)
