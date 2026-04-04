from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_
from typing import List, Optional
from datetime import date
from app.models.revenue_expense import RevenueExpense, RevenueExpenseType
from app.schemas.revenue_expense import RevenueExpenseCreate, RevenueExpenseUpdate


def get_revenue_expense(
    db: Session, revenue_expense_id: int, store_id: int
) -> Optional[RevenueExpense]:
    """매출/지출 ID로 조회"""
    return (
        db.query(RevenueExpense)
        .filter(
            RevenueExpense.id == revenue_expense_id,
            RevenueExpense.store_id == store_id,
        )
        .first()
    )


def get_revenue_expenses(
    db: Session,
    store_id: int,
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    type: Optional[RevenueExpenseType] = None,
) -> List[RevenueExpense]:
    """매출/지출 목록 조회"""
    query = db.query(RevenueExpense).filter(RevenueExpense.store_id == store_id)

    if start_date:
        query = query.filter(RevenueExpense.date >= start_date)
    if end_date:
        query = query.filter(RevenueExpense.date <= end_date)
    if type:
        query = query.filter(RevenueExpense.type == type)

    return (
        query.order_by(desc(RevenueExpense.date), desc(RevenueExpense.id))
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_revenue_expense(
    db: Session, store_id: int, revenue_expense: RevenueExpenseCreate
) -> RevenueExpense:
    """새 매출/지출 생성"""
    db_revenue_expense = RevenueExpense(
        store_id=store_id,
        date=revenue_expense.date,
        type=revenue_expense.revenue_expense_type,
        amount=revenue_expense.amount,
        memo=revenue_expense.memo,
    )
    db.add(db_revenue_expense)
    db.commit()
    return db_revenue_expense


def update_revenue_expense(
    db: Session,
    store_id: int,
    revenue_expense_id: int,
    revenue_expense_update: RevenueExpenseUpdate,
) -> Optional[RevenueExpense]:
    """매출/지출 수정"""
    db_revenue_expense = get_revenue_expense(db, revenue_expense_id, store_id)
    if not db_revenue_expense:
        return None

    update_data = revenue_expense_update.model_dump(exclude_unset=True, by_alias=False)
    if "revenue_expense_type" in update_data:
        update_data["type"] = update_data.pop("revenue_expense_type")
    for field, value in update_data.items():
        setattr(db_revenue_expense, field, value)

    db.commit()
    return db_revenue_expense


def delete_revenue_expense(db: Session, store_id: int, revenue_expense_id: int) -> bool:
    """매출/지출 삭제"""
    db_revenue_expense = get_revenue_expense(db, revenue_expense_id, store_id)
    if not db_revenue_expense:
        return False

    db.delete(db_revenue_expense)
    db.commit()
    return True


def _base_q(db: Session, store_id: int):
    return db.query(RevenueExpense).filter(RevenueExpense.store_id == store_id)


def get_revenue_summary(
    db: Session,
    store_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """매출/지출 요약 정보"""
    revenue_types = [
        RevenueExpenseType.HALL_SALES_DAY,
        RevenueExpenseType.HALL_SALES_NIGHT,
        RevenueExpenseType.DELIVERY_SALES_DAY,
        RevenueExpenseType.DELIVERY_SALES_NIGHT,
    ]

    revenue_query = _base_q(db, store_id).with_entities(
        func.sum(RevenueExpense.amount)
    ).filter(RevenueExpense.type.in_(revenue_types))
    if start_date:
        revenue_query = revenue_query.filter(RevenueExpense.date >= start_date)
    if end_date:
        revenue_query = revenue_query.filter(RevenueExpense.date <= end_date)

    total_revenue = revenue_query.scalar() or 0

    expense_types = [
        RevenueExpenseType.FIXED_EXPENSE,
        RevenueExpenseType.GENERAL_EXPENSE,
        RevenueExpenseType.KITCHEN_EXPENSE,
        RevenueExpenseType.ALCOHOL_EXPENSE,
        RevenueExpenseType.BEVERAGE_EXPENSE,
        RevenueExpenseType.CARD_FEE,
        RevenueExpenseType.INSURANCE,
        RevenueExpenseType.MARKETING,
    ]

    expense_query = _base_q(db, store_id).with_entities(
        func.sum(RevenueExpense.amount)
    ).filter(RevenueExpense.type.in_(expense_types))
    if start_date:
        expense_query = expense_query.filter(RevenueExpense.date >= start_date)
    if end_date:
        expense_query = expense_query.filter(RevenueExpense.date <= end_date)

    total_expense = expense_query.scalar() or 0

    expense_by_type = {}
    for expense_type in expense_types:
        type_query = _base_q(db, store_id).with_entities(
            func.sum(RevenueExpense.amount)
        ).filter(RevenueExpense.type == expense_type)
        if start_date:
            type_query = type_query.filter(RevenueExpense.date >= start_date)
        if end_date:
            type_query = type_query.filter(RevenueExpense.date <= end_date)
        amount = type_query.scalar() or 0
        expense_by_type[expense_type.value] = float(amount)

    return {
        "total_revenue": float(total_revenue),
        "total_expense": float(total_expense),
        "net_profit": float(total_revenue) - float(total_expense),
        "expense_by_type": expense_by_type,
    }
