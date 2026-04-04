from pydantic import BaseModel, Field, model_validator
from datetime import date, datetime
from typing import Optional
from app.models.employee import EmployeeStatus, Position, SalaryType, EmploymentType, BenefitType


# 직원 생성 요청 스키마
class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="직원 이름")
    phone: Optional[str] = Field(None, max_length=20, description="연락처")
    address: Optional[str] = Field(None, max_length=200, description="주소")
    ssn: Optional[str] = Field(None, max_length=20, description="주민등록번호")
    birth_date: Optional[date] = Field(None, description="생년월일")
    gender: Optional[str] = Field(None, description="성별 (남/여)")
    employee_position: Position = Field(..., description="포지션 (홀/주방/대표/사장)")
    employment_type: EmploymentType = Field(EmploymentType.FULL_TIME, description="고용 형태 (정직원/파트/일당)")
    benefit_type: Optional[BenefitType] = Field(None, description="급여 처리 형태 (4대보험 / 3.3% 프리랜서)")
    salary_type: SalaryType = Field(SalaryType.HOURLY, description="시급/월급/일급")
    hourly_wage: Optional[float] = Field(None, gt=0, description="시급 (시급일 때만)")
    monthly_salary: Optional[float] = Field(None, gt=0, description="월급 (월급일 때만)")
    daily_wage_weekday: Optional[float] = Field(None, gt=0, description="평일 일급 (일급일 때, 월~금 출근 스케줄에 적용)")
    daily_wage_weekend: Optional[float] = Field(None, gt=0, description="주말 일급 (일급일 때, 토·일 출근 스케줄에 적용)")
    daily_contract_hours: Optional[float] = Field(None, ge=0.5, le=24, description="일 근무 계약시간(시급·파트알바, 예: 3·4시간)")
    hire_date: date = Field(..., description="입사일")

    @model_validator(mode="after")
    def validate_salary_fields(self):
        if self.salary_type == SalaryType.DAILY:
            wk = self.daily_wage_weekday
            we = self.daily_wage_weekend
            if wk is None or we is None or wk <= 0 or we <= 0:
                raise ValueError("일급 선택 시 평일 일급·주말 일급을 모두 입력해 주세요.")
        return self


# 직원 수정 요청 스키마
class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="직원 이름")
    phone: Optional[str] = Field(None, max_length=20, description="연락처")
    address: Optional[str] = Field(None, max_length=200, description="주소")
    ssn: Optional[str] = Field(None, max_length=20, description="주민등록번호")
    birth_date: Optional[date] = Field(None, description="생년월일")
    gender: Optional[str] = Field(None, description="성별 (남/여)")
    employee_position: Optional[Position] = Field(None, description="포지션 (홀/주방/대표/사장)")
    employment_type: Optional[EmploymentType] = Field(None, description="고용 형태 (정직원/파트/일당)")
    benefit_type: Optional[BenefitType] = Field(None, description="급여 처리 형태 (4대보험 / 3.3% 프리랜서)")
    salary_type: Optional[SalaryType] = Field(None, description="시급/월급/일급")
    hourly_wage: Optional[float] = Field(None, gt=0, description="시급")
    monthly_salary: Optional[float] = Field(None, gt=0, description="월급")
    daily_wage_weekday: Optional[float] = Field(None, gt=0, description="평일 일급")
    daily_wage_weekend: Optional[float] = Field(None, gt=0, description="주말 일급")
    daily_contract_hours: Optional[float] = Field(None, ge=0.5, le=24, description="일 근무 계약시간(시급·파트알바)")
    hire_date: Optional[date] = Field(None, description="입사일")
    resign_date: Optional[date] = Field(None, description="퇴사일")
    status: Optional[EmployeeStatus] = Field(None, description="상태 (재직/퇴사)")


# 직원 응답 스키마
class Employee(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    address: Optional[str]
    ssn: Optional[str]
    birth_date: Optional[date]
    gender: Optional[str]
    employee_position: Position
    employment_type: EmploymentType
    benefit_type: Optional[BenefitType]
    salary_type: SalaryType
    hourly_wage: Optional[float]
    monthly_salary: Optional[float]
    daily_wage_weekday: Optional[float]
    daily_wage_weekend: Optional[float]
    daily_contract_hours: Optional[float]
    hire_date: date
    resign_date: Optional[date]
    status: EmployeeStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# 직원 목록 응답 (간단한 정보)
class EmployeeListItem(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    ssn: Optional[str]
    employee_position: Position
    employment_type: EmploymentType
    benefit_type: Optional[BenefitType]
    status: EmployeeStatus
    hire_date: date

    class Config:
        from_attributes = True

