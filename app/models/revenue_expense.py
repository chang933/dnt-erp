from sqlalchemy import Column, Integer, String, Date, DateTime, Enum as SQLEnum, Numeric, Text, ForeignKey
from app.db.base import Base
from datetime import datetime
import enum

class RevenueExpenseType(str, enum.Enum):
    # 매출
    HALL_SALES_DAY = "홀매출_주간"
    HALL_SALES_NIGHT = "홀매출_야간"
    DELIVERY_SALES_DAY = "배달매출_주간"
    DELIVERY_SALES_NIGHT = "배달매출_야간"
    # 실입금 (매출 대비 실제 입금액, 입금일 기준 저장)
    HALL_DEPOSIT = "홀매출_실입금"
    DELIVERY_DEPOSIT = "배달매출_실입금"
    # 지출
    FIXED_EXPENSE = "고정지출"
    GENERAL_EXPENSE = "일반지출"
    KITCHEN_EXPENSE = "주방지출"
    ALCOHOL_EXPENSE = "주류지출"
    BEVERAGE_EXPENSE = "음료지출"
    ROYALTY = "로얄티"
    SALARY = "급여"
    CARD_FEE = "카드수수료"
    INSURANCE = "4대보험료"
    MARKETING = "마케팅비"
    MANAGEMENT_FEE = "관리비"

class RevenueExpense(Base):
    __tablename__ = "erp_revenue_expense"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("erp_stores.id"), nullable=False, index=True, server_default="1")
    date = Column(Date, nullable=False, index=True)
    type = Column(SQLEnum(RevenueExpenseType, native_enum=False), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

