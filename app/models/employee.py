from sqlalchemy import Column, Integer, String, Date, DateTime, Enum as SQLEnum, Numeric
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import enum

class EmployeeStatus(str, enum.Enum):
    ACTIVE = "재직"
    RESIGNED = "퇴사"

class Position(str, enum.Enum):
    HALL = "홀"
    KITCHEN = "주방"
    CEO = "대표"
    PRESIDENT = "사장"


class EmploymentType(str, enum.Enum):
    FULL_TIME = "FULL_TIME"   # 정직원
    PART_TIME = "PART_TIME"   # 파트
    DAILY = "DAILY"           # 일당


class BenefitType(str, enum.Enum):
    FOUR_INSURANCE = "4대보험"
    FREELANCER_3_3 = "3.3% 프리랜서"

class SalaryType(str, enum.Enum):
    HOURLY = "시급"
    MONTHLY = "월급"

class Employee(Base):
    __tablename__ = "erp_employees"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    phone = Column(String(20))
    address = Column(String(200))
    ssn = Column(String(20), nullable=True)  # 주민등록번호
    birth_date = Column(Date)  # 생일
    gender = Column(String(10), nullable=True)  # 성별 (남/여)
    employee_position = Column(SQLEnum(Position, native_enum=False), nullable=False)  # 홀/주방/대표/사장
    employment_type = Column(
        SQLEnum(EmploymentType, native_enum=False),
        nullable=False,
        default=EmploymentType.FULL_TIME,
    )  # 정규직 / 파트·알바
    benefit_type = Column(
        SQLEnum(BenefitType, native_enum=False),
        nullable=True,
    )  # 4대보험 / 3.3% 프리랜서 (선택)
    salary_type = Column(SQLEnum(SalaryType, native_enum=False), nullable=False, default=SalaryType.HOURLY)  # 시급/월급
    hourly_wage = Column(Numeric(10, 2), nullable=True)  # 시급 (시급일 때만 사용)
    monthly_salary = Column(Numeric(12, 2), nullable=True)  # 월급 (월급일 때만 사용)
    daily_contract_hours = Column(Numeric(4, 1), nullable=True)  # 일 근무 계약시간(시급·파트알바용, 예: 3시간·4시간)
    hire_date = Column(Date, nullable=False)  # 입사일
    resign_date = Column(Date, nullable=True)  # 퇴사일
    status = Column(SQLEnum(EmployeeStatus, native_enum=False), default=EmployeeStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    schedules = relationship("Schedule", back_populates="employee", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    payroll_records = relationship("Payroll", back_populates="employee", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="employee", cascade="all, delete-orphan")

