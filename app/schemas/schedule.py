import datetime as dt
from pydantic import BaseModel, Field, field_serializer, field_validator
from datetime import date, time
from typing import Optional, Union
from app.models.schedule import ScheduleType
from app.models.employee import Position


def _parse_date_only(v: Union[date, str]) -> date:
    """날짜 문자열을 시간/타임존 없이 YYYY-MM-DD만 파싱 (한 칸 밀림 방지)"""
    if isinstance(v, date):
        return v
    s = str(v).strip()[:10]
    return date.fromisoformat(s)


# 스케줄 생성 요청 스키마
class ScheduleCreate(BaseModel):
    employee_id: int = Field(..., description="직원 ID")
    schedule_date: date = Field(..., description="날짜", alias="date")
    schedule_type: ScheduleType = Field(..., description="출근/휴무")
    shift_start: Optional[time] = Field(None, description="근무 시작 시간")
    shift_end: Optional[time] = Field(None, description="근무 종료 시간")
    work_position: Optional[Position] = Field(None, description="홀/주방 (해당 날짜의 포지션)")
    extra_hours: Optional[float] = Field(None, ge=0, description="시급/알바 해당일 추가 근무 시간(시간)")

    @field_validator("schedule_date", mode="before")
    @classmethod
    def parse_date_only(cls, v: Union[date, str]) -> date:
        return _parse_date_only(v)

    class Config:
        populate_by_name = True


# 스케줄 수정 요청 스키마
class ScheduleUpdate(BaseModel):
    schedule_type: Optional[ScheduleType] = Field(None, description="출근/휴무")
    shift_start: Optional[time] = Field(None, description="근무 시작 시간")
    shift_end: Optional[time] = Field(None, description="근무 종료 시간")
    work_position: Optional[Position] = Field(None, description="홀/주방")
    extra_hours: Optional[float] = Field(None, ge=0, description="추가 근무 시간(시간)")


# 스케줄 응답 스키마 (직원 정보 포함)
class Schedule(BaseModel):
    id: int
    employee_id: int
    schedule_date: date = Field(..., alias="date")
    schedule_type: ScheduleType
    shift_start: Optional[time]
    shift_end: Optional[time]
    work_position: Optional[Position]
    extra_hours: Optional[float] = None

    @field_serializer("schedule_date")
    def serialize_date(self, v: Optional[date]) -> Optional[str]:
        return v.isoformat() if v else None

    class Config:
        from_attributes = True
        populate_by_name = True


# 월간 스케줄 조회용 (직원 정보 포함)
class ScheduleWithEmployee(Schedule):
    employee_name: str
    employee_position: Position

    class Config:
        from_attributes = True


# 월간 스케줄 일괄 생성 요청
class ScheduleBatchCreate(BaseModel):
    employee_id: int = Field(..., description="직원 ID")
    year: int = Field(..., ge=2000, le=2100, description="년도")
    month: int = Field(..., ge=1, le=12, description="월")
    schedules: list[ScheduleCreate] = Field(..., description="스케줄 목록")


class ScheduleWeekDayItem(BaseModel):
    """주간 저장: 하루 한 줄 (프론트 주간 스케줄과 동일)"""

    # 필드명이 date라 타입 힌트에 date를 쓰면 클래스 스코프에서 FieldInfo로 해석되는 오류 방지
    date: dt.date = Field(..., description="YYYY-MM-DD")
    schedule_type: str = Field("출근", description="출근 또는 휴무")
    extra_hours: Optional[float] = Field(None, ge=0, description="출근일 추가 근무 시간")

    @field_validator("date", mode="before")
    @classmethod
    def parse_day_date(cls, v: Union[dt.date, str]) -> dt.date:
        return _parse_date_only(v)


class ScheduleWeekBatchCreate(BaseModel):
    """한 직원의 주(여러 날짜) 스케줄을 한 트랜잭션으로 저장 (동시 POST로 DB 풀 오류 방지)"""

    employee_id: int = Field(..., description="직원 ID")
    days: list[ScheduleWeekDayItem] = Field(..., min_length=1, description="날짜별 스케줄")

