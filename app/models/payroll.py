from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class Payroll(Base):
    __tablename__ = "erp_payroll"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("erp_stores.id"), nullable=False, index=True, server_default="1")
    employee_id = Column(Integer, ForeignKey("erp_employees.id"), nullable=False, index=True)
    year_month = Column(String(7), nullable=False, index=True)  # YYYY-MM 형식
    work_hours = Column(Numeric(10, 2), nullable=False, default=0)  # 근무시간
    base_pay = Column(Numeric(12, 2), nullable=False, default=0)  # 기본급
    weekly_holiday_pay = Column(Numeric(12, 2), nullable=False, default=0)  # 주휴수당
    insurance_type = Column(String(20), nullable=True)  # 4대보험 가입유무: '가입', '미가입'
    absent_count = Column(Integer, nullable=False, default=0)  # 결근횟수
    deductions = Column(Numeric(12, 2), nullable=False, default=0)  # 공제 (직원 부담분)
    employer_deductions = Column(Numeric(12, 2), nullable=False, default=0)  # 사업장 공제금액 (사업주 부담분)
    net_pay = Column(Numeric(12, 2), nullable=False, default=0)  # 실수령액
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    employee = relationship("Employee", back_populates="payroll_records")

