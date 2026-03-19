from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal
from typing import Optional


# 급여 생성 요청 스키마
class PayrollCreate(BaseModel):
    employee_id: int = Field(..., description="직원 ID")
    year_month: str = Field(..., pattern=r'^\d{4}-\d{2}$', description="년월 (YYYY-MM 형식)")
    work_hours: Decimal = Field(..., ge=0, description="근무시간")
    base_pay: Decimal = Field(..., ge=0, description="기본급")
    weekly_holiday_pay: Decimal = Field(0, ge=0, description="주휴수당")
    insurance_type: str = Field("미가입", description="4대보험 가입유무: '가입', '미가입'")
    absent_count: int = Field(0, ge=0, description="결근횟수")
    deductions: Decimal = Field(0, ge=0, description="공제 (직원 부담분)")
    employer_deductions: Decimal = Field(0, ge=0, description="사업장 공제금액 (사업주 부담분)")
    net_pay: Decimal = Field(..., ge=0, description="실수령액")


# 급여 수정 요청 스키마
class PayrollUpdate(BaseModel):
    work_hours: Optional[Decimal] = Field(None, ge=0, description="근무시간")
    base_pay: Optional[Decimal] = Field(None, ge=0, description="기본급")
    weekly_holiday_pay: Optional[Decimal] = Field(None, ge=0, description="주휴수당")
    insurance_type: Optional[str] = Field(None, description="4대보험 가입유무")
    absent_count: Optional[int] = Field(None, ge=0, description="결근횟수")
    deductions: Optional[Decimal] = Field(None, ge=0, description="공제 (직원 부담분)")
    employer_deductions: Optional[Decimal] = Field(None, ge=0, description="사업장 공제금액 (사업주 부담분)")
    net_pay: Optional[Decimal] = Field(None, ge=0, description="실수령액")


# 급여 계산 요청 스키마 (자동 계산용)
class PayrollCalculate(BaseModel):
    employee_id: int = Field(..., description="직원 ID")
    year_month: str = Field(..., pattern=r'^\d{4}-\d{2}$', description="년월 (YYYY-MM 형식)")
    hourly_wage: Optional[Decimal] = Field(None, description="시급 (미입력 시 직원 정보에서 가져옴)")


# 급여 응답 스키마
class Payroll(BaseModel):
    id: int
    employee_id: int
    year_month: str
    work_hours: Decimal
    base_pay: Decimal
    weekly_holiday_pay: Decimal
    insurance_type: str = "미가입"
    absent_count: int = 0
    deductions: Decimal
    employer_deductions: Decimal = 0
    net_pay: Decimal
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# 급여 응답 (직원 정보 포함)
class PayrollWithEmployee(Payroll):
    employee_name: str
    employee_position: str

    class Config:
        from_attributes = True

