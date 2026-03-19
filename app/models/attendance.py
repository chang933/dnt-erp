from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, Enum as SQLEnum, String
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum

class AttendanceStatus(str, enum.Enum):
    NORMAL = "정상"
    LATE = "지각"
    EARLY_LEAVE = "조퇴"
    ABSENT = "결근"

class Attendance(Base):
    __tablename__ = "erp_attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("erp_employees.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    check_in = Column(DateTime, nullable=True)  # 출근 시간
    check_out = Column(DateTime, nullable=True)  # 퇴근 시간
    status = Column(SQLEnum(AttendanceStatus, native_enum=False), default=AttendanceStatus.NORMAL, nullable=False)
    memo = Column(String(500), nullable=True)  # 메모 (사장/매니저가 수기 입력)
    
    # Relationships
    employee = relationship("Employee", back_populates="attendance_records")

