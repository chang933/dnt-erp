import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, ProgrammingError
from typing import List, Optional
from app.db.session import get_db
from app.api.deps import get_store_id
from app.schemas.employee import Employee, EmployeeCreate, EmployeeUpdate, EmployeeListItem
from app.crud import employee as crud_employee
from sqlalchemy import text
from app.db.session import engine
from app.models.employee import EmployeeStatus

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/check-ssn-column")
def check_ssn_column():
    """DB에 ssn 컬럼 존재 여부 확인 (디버깅용)"""
    with engine.connect() as conn:
        r = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'erp_employees' AND column_name = 'ssn'"
        ))
        row = r.fetchone()
    return {"ssn_column_exists": row is not None}


def _handle_db_error(e: Exception):
    """DB 스키마 불일치 등 오류 시 JSON으로 안내 (프론트가 500 메시지 표시 가능)"""
    err = str(e).lower()
    if "ssn" in err and ("does not exist" in err or "column" in err):
        raise HTTPException(
            status_code=500,
            detail="DB에 주민번호(ssn) 컬럼이 없습니다. 프로젝트 루트에서: python -m app.scripts.add_employee_ssn 실행 후 서버를 재시작하세요.",
        )
    if "daily_wage" in err and ("does not exist" in err or "column" in err):
        raise HTTPException(
            status_code=500,
            detail="DB에 일급 컬럼(daily_wage_weekday / daily_wage_weekend)이 없습니다. Render에서 서버를 재시작해 기동 시 마이그레이션을 실행하거나, Supabase SQL에서 해당 컬럼을 추가하세요.",
        )
    if "column" in err or "does not exist" in err:
        raise HTTPException(
            status_code=500,
            detail="DB 스키마가 앱 버전과 맞지 않습니다(컬럼 누락 등). Render Logs에서 원인을 확인하고 서버를 재시작해 마이그레이션을 적용하세요.",
        )
    raise e


def _employee_response(db_employee, db: Session) -> dict:
    """응답 dict에 ssn 반드시 포함 (Pydantic 직렬화 + DB에서 ssn 재조회)"""
    data = Employee.model_validate(db_employee).model_dump(mode="json")
    # ssn은 DB에서 직접 조회해 넣기 (ORM에 안 잡혀 있을 수 있음)
    try:
        row = db.execute(
            text("SELECT ssn FROM erp_employees WHERE id = :id"),
            {"id": db_employee.id}
        ).fetchone()
        data["ssn"] = (str(row[0]).strip() or None) if (row and row[0] is not None) else None
    except Exception:
        data["ssn"] = None
    return data


@router.post("/", status_code=201)
async def create_employee(
    request: Request,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """새 직원 등록 (주민번호는 본문에서 명시 추출 후 저장)"""
    body = await request.json()
    ssn_raw = body.get("ssn")  # 본문에서 그대로 추출
    if isinstance(ssn_raw, str):
        ssn_raw = ssn_raw.strip() or None
    else:
        ssn_raw = None
    logger.info("직원 등록 본문 ssn=%s", ssn_raw)
    employee = EmployeeCreate(**{k: v for k, v in body.items() if k in EmployeeCreate.model_fields})
    if ssn_raw is not None:
        employee.ssn = ssn_raw
    try:
        db_employee = crud_employee.create_employee(
            db=db, store_id=store_id, employee=employee, ssn_override=ssn_raw
        )
    except (OperationalError, ProgrammingError) as e:
        _handle_db_error(e)
    logger.info("직원 등록 저장 후 ssn=%s", getattr(db_employee, "ssn", "MISSING"))
    data = _employee_response(db_employee, db)
    return JSONResponse(status_code=201, content=data)


@router.get("/")
def get_employees(
    skip: int = Query(0, ge=0, description="건너뛸 레코드 수"),
    limit: int = Query(100, ge=1, le=1000, description="가져올 레코드 수"),
    status: Optional[EmployeeStatus] = Query(None, description="상태 필터 (재직/퇴사)"),
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """직원 목록 조회 (ssn 필드 포함)"""
    try:
        db_employees = crud_employee.get_employees(
            db=db, store_id=store_id, skip=skip, limit=limit, status=status
        )
        payload = [_employee_response(emp, db) for emp in db_employees]
        return JSONResponse(content=payload, headers={"X-Employee-Response-Has-Ssn": "1"})
    except (OperationalError, ProgrammingError) as e:
        _handle_db_error(e)


@router.get("/{employee_id}")
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """직원 상세 조회 (ssn 필드 항상 포함)"""
    try:
        db_employee = crud_employee.get_employee(db=db, employee_id=employee_id, store_id=store_id)
        if db_employee is None:
            raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
        data = _employee_response(db_employee, db)
        return JSONResponse(content=data, headers={"X-Employee-Response-Has-Ssn": "1"})
    except HTTPException:
        raise
    except (OperationalError, ProgrammingError) as e:
        _handle_db_error(e)


@router.put("/{employee_id}")
async def update_employee(
    employee_id: int,
    request: Request,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """직원 정보 수정 (주민번호는 본문에서 명시 추출 후 저장)"""
    body = await request.json()
    ssn_raw = body.get("ssn")
    if isinstance(ssn_raw, str):
        ssn_raw = ssn_raw.strip() or None
    else:
        ssn_raw = None
    logger.info("직원 수정 본문 ssn=%s", ssn_raw)
    employee_update = EmployeeUpdate(**{k: v for k, v in body.items() if k in EmployeeUpdate.model_fields})
    if ssn_raw is not None:
        employee_update.ssn = ssn_raw
    elif "ssn" in body:
        employee_update.ssn = None
    try:
        db_employee = crud_employee.update_employee(
            db=db,
            store_id=store_id,
            employee_id=employee_id,
            employee_update=employee_update,
            ssn_override=ssn_raw if "ssn" in body else None,
        )
    except (OperationalError, ProgrammingError) as e:
        _handle_db_error(e)
    if db_employee:
        logger.info("직원 수정 저장 후 ssn=%s", getattr(db_employee, "ssn", "MISSING"))
    if db_employee is None:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    data = _employee_response(db_employee, db)
    return JSONResponse(content=data)


@router.delete("/{employee_id}", status_code=204)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """직원 퇴사 처리"""
    success = crud_employee.delete_employee(db=db, store_id=store_id, employee_id=employee_id)
    if not success:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    return None

