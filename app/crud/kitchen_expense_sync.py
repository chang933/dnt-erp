"""식자재(사용/입고) 금액을 매출·지출의 주방지출(자동) 레코드와 동기화합니다."""
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.food_cost import FoodCost
from app.models.revenue_expense import RevenueExpense, RevenueExpenseType

# 당일매출/지출관리·손익계산기에서 수동 주방지출과 구분
AUTO_KITCHEN_MEMO = "식자재(자동)"


def _apply_kitchen_sync_for_date(db: Session, store_id: int, target_date: date) -> None:
    total_scalar = (
        db.query(func.coalesce(func.sum(FoodCost.amount), 0))
        .filter(
            FoodCost.store_id == store_id,
            FoodCost.date == target_date,
            FoodCost.record_type == "usage",
        )
        .scalar()
    )
    total = int(total_scalar or 0)

    db.query(RevenueExpense).filter(
        RevenueExpense.store_id == store_id,
        RevenueExpense.date == target_date,
        RevenueExpense.type == RevenueExpenseType.KITCHEN_EXPENSE,
        RevenueExpense.memo == AUTO_KITCHEN_MEMO,
    ).delete(synchronize_session=False)

    if total > 0:
        db.add(
            RevenueExpense(
                store_id=store_id,
                date=target_date,
                type=RevenueExpenseType.KITCHEN_EXPENSE,
                amount=total,
                memo=AUTO_KITCHEN_MEMO,
            )
        )


def apply_kitchen_sync_for_date_no_commit(
    db: Session, store_id: int, target_date: date
) -> None:
    """주방지출(식자재 자동)만 반영. commit은 호출자가 한 번만 수행 (저장 지연·이중 왕복 방지)."""
    _apply_kitchen_sync_for_date(db, store_id, target_date)


def sync_kitchen_expense_for_date(db: Session, store_id: int, target_date: date) -> None:
    _apply_kitchen_sync_for_date(db, store_id, target_date)
    db.commit()


def sync_kitchen_expenses_for_date_range(
    db: Session, store_id: int, start_date: date, end_date: date
) -> None:
    d = start_date
    while d <= end_date:
        _apply_kitchen_sync_for_date(db, store_id, d)
        d += timedelta(days=1)
    db.commit()
