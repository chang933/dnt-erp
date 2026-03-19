from sqlalchemy import Column, Integer, Date, Time, ForeignKey, Enum as SQLEnum, Numeric
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.employee import Position
import enum

class ScheduleType(str, enum.Enum):
    WORK = "출근"
    OFF = "휴무"

class Schedule(Base):
    __tablename__ = "erp_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("erp_employees.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    schedule_type = Column(SQLEnum(ScheduleType, native_enum=False), nullable=False, default=ScheduleType.WORK, name="type")  # 출근/휴무
    shift_start = Column(Time, nullable=True)  # 근무 시작 시간
    shift_end = Column(Time, nullable=True)  # 근무 종료 시간
    work_position = Column(SQLEnum(Position, native_enum=False), nullable=True)  # 홀/주방 (해당 날짜의 포지션)
    extra_hours = Column(Numeric(4, 2), nullable=True, default=0)  # 시급/알바 해당일 추가 근무 시간(시간 단위)
    
    # Relationships
    employee = relationship("Employee", back_populates="schedules")

