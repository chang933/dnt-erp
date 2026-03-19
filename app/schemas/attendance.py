from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional
from app.models.attendance import AttendanceStatus


# 출퇴근 기록 생성 요청 스키마
class AttendanceCreate(BaseModel):
    employee_id: int = Field(..., description="직원 ID")
    attendance_date: date = Field(..., description="날짜", alias="date")
    check_in: Optional[datetime] = Field(None, description="출근 시간")
    check_out: Optional[datetime] = Field(None, description="퇴근 시간")
    status: AttendanceStatus = Field(AttendanceStatus.NORMAL, description="상태 (정상/지각/조퇴/결근)")
    memo: Optional[str] = Field(None, max_length=500, description="메모")
    
    class Config:
        populate_by_name = True


# 출퇴근 기록 수정 요청 스키마
class AttendanceUpdate(BaseModel):
    check_in: Optional[datetime] = Field(None, description="출근 시간")
    check_out: Optional[datetime] = Field(None, description="퇴근 시간")
    status: Optional[AttendanceStatus] = Field(None, description="상태 (정상/지각/조퇴/결근)")
    memo: Optional[str] = Field(None, max_length=500, description="메모")


# 출퇴근 기록 응답 스키마
class Attendance(BaseModel):
    id: int
    employee_id: int
    attendance_date: date = Field(..., alias="date")
    check_in: Optional[datetime]
    check_out: Optional[datetime]
    status: AttendanceStatus
    memo: Optional[str]

    class Config:
        from_attributes = True
        populate_by_name = True


# 출퇴근 기록 응답 (직원 정보 포함)
class AttendanceWithEmployee(Attendance):
    employee_name: str

    class Config:
        from_attributes = True


# 월간 출퇴근 통계
class MonthlyAttendanceSummary(BaseModel):
    employee_id: int
    employee_name: str
    year_month: str  # YYYY-MM 형식
    total_days: int  # 총 출근일수
    work_hours: float  # 총 근무시간 (시간)
    late_count: int  # 지각 횟수
    early_leave_count: int  # 조퇴 횟수
    absent_count: int  # 결근 횟수

