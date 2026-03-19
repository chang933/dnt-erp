from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import date
from app.db.session import get_db
from app.schemas.revenue_expense import RevenueExpense, RevenueExpenseCreate, RevenueExpenseUpdate
from app.crud import revenue_expense as crud_revenue_expense
from app.models.revenue_expense import RevenueExpenseType

router = APIRouter()


def convert_revenue_expense_to_dict(revenue_expense: RevenueExpense) -> Dict[str, Any]:
    """RevenueExpense 모델을 dict로 변환하며 revenue_expense_type을 type으로 변환"""
    data = revenue_expense.model_dump()
    if 'revenue_expense_type' in data:
        data['type'] = data.pop('revenue_expense_type')
    return data


@router.post("/", status_code=201)
def create_revenue_expense(
    revenue_expense_data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """새 매출/지출 등록"""
    # type 필드를 revenue_expense_type으로 변환
    if 'type' in revenue_expense_data:
        revenue_expense_data = revenue_expense_data.copy()
        revenue_expense_data['revenue_expense_type'] = revenue_expense_data.pop('type')
    revenue_expense = RevenueExpenseCreate(**revenue_expense_data)
    db_revenue_expense = crud_revenue_expense.create_revenue_expense(db=db, revenue_expense=revenue_expense)
    # SQLAlchemy 모델의 type 필드를 revenue_expense_type으로 변환
    rev_exp_dict = {
        'id': db_revenue_expense.id,
        'date': db_revenue_expense.date,
        'revenue_expense_type': db_revenue_expense.type,
        'amount': db_revenue_expense.amount,
        'memo': db_revenue_expense.memo,
        'created_at': db_revenue_expense.created_at.isoformat() if db_revenue_expense.created_at else None,
        'updated_at': db_revenue_expense.updated_at.isoformat() if db_revenue_expense.updated_at else None,
    }
    result = RevenueExpense.model_validate(rev_exp_dict)
    return convert_revenue_expense_to_dict(result)


@router.get("/")
def get_revenue_expenses(
    skip: int = Query(0, ge=0, description="건너뛸 레코드 수"),
    limit: int = Query(100, ge=1, le=1000, description="가져올 레코드 수"),
    start_date: Optional[date] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    type: Optional[RevenueExpenseType] = Query(None, description="매출/지출 유형"),
    db: Session = Depends(get_db)
):
    """매출/지출 목록 조회"""
    db_revenue_expenses = crud_revenue_expense.get_revenue_expenses(
        db=db,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        type=type
    )
    results = []
    for rev_exp in db_revenue_expenses:
        # SQLAlchemy 모델의 type 필드를 revenue_expense_type으로 변환
        rev_exp_dict = {
            'id': rev_exp.id,
            'date': rev_exp.date,
            'revenue_expense_type': rev_exp.type,
            'amount': rev_exp.amount,
            'memo': rev_exp.memo,
            'created_at': rev_exp.created_at.isoformat() if rev_exp.created_at else None,
            'updated_at': rev_exp.updated_at.isoformat() if rev_exp.updated_at else None,
        }
        result = RevenueExpense.model_validate(rev_exp_dict)
        results.append(convert_revenue_expense_to_dict(result))
    return results


@router.get("/{revenue_expense_id}")
def get_revenue_expense(
    revenue_expense_id: int,
    db: Session = Depends(get_db)
):
    """매출/지출 상세 조회"""
    db_revenue_expense = crud_revenue_expense.get_revenue_expense(db=db, revenue_expense_id=revenue_expense_id)
    if db_revenue_expense is None:
        raise HTTPException(status_code=404, detail="매출/지출을 찾을 수 없습니다")
    # SQLAlchemy 모델의 type 필드를 revenue_expense_type으로 변환
    rev_exp_dict = {
        'id': db_revenue_expense.id,
        'date': db_revenue_expense.date,
        'revenue_expense_type': db_revenue_expense.type,
        'amount': db_revenue_expense.amount,
        'memo': db_revenue_expense.memo,
        'created_at': db_revenue_expense.created_at.isoformat() if db_revenue_expense.created_at else None,
        'updated_at': db_revenue_expense.updated_at.isoformat() if db_revenue_expense.updated_at else None,
    }
    result = RevenueExpense.model_validate(rev_exp_dict)
    return convert_revenue_expense_to_dict(result)


@router.put("/{revenue_expense_id}")
def update_revenue_expense(
    revenue_expense_id: int,
    revenue_expense_data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """매출/지출 수정"""
    # type 필드를 revenue_expense_type으로 변환
    if 'type' in revenue_expense_data:
        revenue_expense_data = revenue_expense_data.copy()
        revenue_expense_data['revenue_expense_type'] = revenue_expense_data.pop('type')
    revenue_expense_update = RevenueExpenseUpdate(**revenue_expense_data)
    db_revenue_expense = crud_revenue_expense.update_revenue_expense(
        db=db,
        revenue_expense_id=revenue_expense_id,
        revenue_expense_update=revenue_expense_update
    )
    if db_revenue_expense is None:
        raise HTTPException(status_code=404, detail="매출/지출을 찾을 수 없습니다")
    # SQLAlchemy 모델의 type 필드를 revenue_expense_type으로 변환
    rev_exp_dict = {
        'id': db_revenue_expense.id,
        'date': db_revenue_expense.date,
        'revenue_expense_type': db_revenue_expense.type,
        'amount': db_revenue_expense.amount,
        'memo': db_revenue_expense.memo,
        'created_at': db_revenue_expense.created_at.isoformat() if db_revenue_expense.created_at else None,
        'updated_at': db_revenue_expense.updated_at.isoformat() if db_revenue_expense.updated_at else None,
    }
    result = RevenueExpense.model_validate(rev_exp_dict)
    return convert_revenue_expense_to_dict(result)


@router.delete("/{revenue_expense_id}", status_code=204)
def delete_revenue_expense(
    revenue_expense_id: int,
    db: Session = Depends(get_db)
):
    """매출/지출 삭제"""
    success = crud_revenue_expense.delete_revenue_expense(db=db, revenue_expense_id=revenue_expense_id)
    if not success:
        raise HTTPException(status_code=404, detail="매출/지출을 찾을 수 없습니다")
    return None


@router.get("/summary/stats")
def get_revenue_summary(
    start_date: Optional[date] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """매출/지출 요약 통계"""
    summary = crud_revenue_expense.get_revenue_summary(db=db, start_date=start_date, end_date=end_date)
    return summary
