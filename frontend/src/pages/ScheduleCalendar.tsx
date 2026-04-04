import React, { useState, useEffect, useMemo } from 'react';
import { scheduleAPI } from '../api/client';
import { Schedule } from '../types';
import { useWindowWidth } from '../hooks/useWindowWidth';

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const ScheduleCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState<'전체' | '홀' | '주방'>('전체');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    fetchData();
  }, [year, month]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const scheduleRes = await scheduleAPI.getByMonth(year, month);
      setSchedules(normalizeList<Schedule>(scheduleRes.data));
    } catch (err: any) {
      console.error('데이터 로딩 실패:', err);
      console.error('에러 상세:', err.response?.data || err.message);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(year, month - 1 + delta, 1));
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=일, 1=월, …, 6=토

  /** 주간과 동일: 월요일 시작(월~일). 1일이 해당 요일 열에 오도록 앞에 빈 칸 수 = (getDay(1)+6)%7 */
  const buildCalendarGrid = (): (number | null)[][] => {
    const padCount = (firstDayOfMonth + 6) % 7;
    const flat: (number | null)[] = [];
    for (let i = 0; i < padCount; i++) flat.push(null);
    for (let d = 1; d <= daysInMonth; d++) flat.push(d);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < flat.length; i += 7) {
      const row = flat.slice(i, i + 7);
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  };
  const calendarGrid = buildCalendarGrid();

  const getEmployeeName = (schedule: Schedule) =>
    schedule.employee_name?.trim() || `직원 #${schedule.employee_id}`;

  const getEmployeePosition = (schedule: Schedule) => {
    const pos = schedule.employee_position;
    if (pos === '홀' || pos === '주방') return pos;
    if (schedule.work_position === '홀' || schedule.work_position === '주방') {
      return schedule.work_position;
    }
    return null;
  };

  /** 출근 스케줄만 날짜 문자열(YYYY-MM-DD) → 배열로 인덱싱 (셀마다 전체 filter 방지) */
  const schedulesByDateStr = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    for (const s of schedules) {
      if (s.schedule_type !== '출근') continue;
      const d = s.date;
      const normalized = typeof d === 'string' ? d.split('T')[0] : String(d);
      if (!map[normalized]) map[normalized] = [];
      map[normalized].push(s);
    }
    return map;
  }, [schedules]);

  const getSchedulesForDate = (day: number) => {
    if (day === null) return [];
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let daySchedules = schedulesByDateStr[dateStr] || [];
    if (positionFilter !== '전체') {
      daySchedules = daySchedules.filter(
        (schedule) => getEmployeePosition(schedule) === positionFilter,
      );
    }
    return daySchedules;
  };

  const getPositionColor = (position: string | null) => {
    if (position === '홀') {
      return '#d4edda'; // 초록 계열
    } else if (position === '주방') {
      return '#cfe2ff'; // 파란 계열
    }
    return '#f8f9fa'; // 기본 회색
  };

  const weekDays = ['월', '화', '수', '목', '금', '토', '일'];
  const weekDaysFull = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

  const handleDayClick = (day: number) => {
    if (!isMobile) return;
    setSelectedDay(day);
  };

  // 선택된 날짜 상세 모달 (모바일 전용)
  const DayDetailModal = () => {
    if (!selectedDay) return null;
    const daySchedules = getSchedulesForDate(selectedDay);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    const dayOfWeek = new Date(dateStr).getDay();
    const weekLabel = weekDaysFull[(dayOfWeek + 6) % 7];

    return (
      <>
        {/* 딤 배경 */}
        <div
          onClick={() => setSelectedDay(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }}
        />
        {/* 바텀 시트 */}
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
          background: '#fff', borderRadius: '16px 16px 0 0',
          padding: '1rem 1rem 2rem',
          maxHeight: '75vh', overflowY: 'auto',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}>
          {/* 핸들 */}
          <div style={{ width: '40px', height: '4px', background: '#dee2e6', borderRadius: '2px', margin: '0 auto 1rem' }} />

          {/* 날짜 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
              {month}월 {selectedDay}일 <span style={{ fontSize: '0.9rem', color: '#6c757d', fontWeight: 400 }}>({weekLabel})</span>
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#6c757d', cursor: 'pointer', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* 출근 직원 목록 */}
          {daySchedules.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#adb5bd', padding: '2rem 0', fontSize: '0.95rem' }}>
              출근 예정 직원이 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {daySchedules.map((schedule) => {
                const position = getEmployeePosition(schedule);
                const name = getEmployeeName(schedule);
                const bgColor = position === '홀' ? '#d4edda' : position === '주방' ? '#cfe2ff' : '#f8f9fa';
                const badgeColor = position === '홀' ? '#28a745' : position === '주방' ? '#0d6efd' : '#6c757d';

                return (
                  <div key={schedule.id} style={{
                    background: bgColor,
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}>
                    {/* 포지션 배지 */}
                    <span style={{
                      background: badgeColor, color: '#fff',
                      borderRadius: '6px', padding: '0.2rem 0.55rem',
                      fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                    }}>
                      {position || '기타'}
                    </span>

                    {/* 이름 + 시간 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{name}</div>
                      {(schedule.shift_start || schedule.shift_end) && (
                        <div style={{ fontSize: '0.82rem', color: '#495057', marginTop: '0.15rem' }}>
                          {schedule.shift_start && schedule.shift_end
                            ? `${schedule.shift_start} ~ ${schedule.shift_end}`
                            : schedule.shift_start || schedule.shift_end}
                        </div>
                      )}
                      {schedule.extra_hours && (
                        <div style={{ fontSize: '0.78rem', color: '#868e96', marginTop: '0.1rem' }}>
                          추가근무 {schedule.extra_hours}시간
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 요약 */}
          {daySchedules.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.6rem 1rem', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem', color: '#495057' }}>
              총 <strong>{daySchedules.length}명</strong> 출근
              {daySchedules.filter(s => getEmployeePosition(s) === '홀').length > 0 &&
                ` · 홀 ${daySchedules.filter(s => getEmployeePosition(s) === '홀').length}명`}
              {daySchedules.filter(s => getEmployeePosition(s) === '주방').length > 0 &&
                ` · 주방 ${daySchedules.filter(s => getEmployeePosition(s) === '주방').length}명`}
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="card card-fullheight">
      <div className="card-header">
        <button className="btn btn-secondary" onClick={() => changeMonth(-1)}>
          이전 달
        </button>
        <h2 className="card-title">
          {year}년 {month}월 스케줄
        </h2>
        <button className="btn btn-secondary" onClick={() => changeMonth(1)}>
          다음 달
        </button>
      </div>

      <div
        style={{
          margin: '0.5rem 1rem 1rem',
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.875rem', color: '#555', marginRight: '0.5rem' }}>
          보기:
        </span>
        <button
          onClick={() => setPositionFilter('전체')}
          style={{
            padding: '0.35rem 0.8rem',
            border: positionFilter === '전체' ? '2px solid #007bff' : '1px solid #dee2e6',
            borderRadius: 4,
            fontSize: '0.8rem',
            fontWeight: positionFilter === '전체' ? 600 : 400,
            backgroundColor: positionFilter === '전체' ? '#007bff' : '#fff',
            color: positionFilter === '전체' ? '#fff' : '#6c757d',
            cursor: 'pointer',
          }}
        >
          전체
        </button>
        <button
          onClick={() => setPositionFilter('홀')}
          style={{
            padding: '0.35rem 0.8rem',
            border: positionFilter === '홀' ? '2px solid #28a745' : '1px solid #dee2e6',
            borderRadius: 4,
            fontSize: '0.8rem',
            fontWeight: positionFilter === '홀' ? 600 : 400,
            backgroundColor: positionFilter === '홀' ? '#28a745' : '#fff',
            color: positionFilter === '홀' ? '#fff' : '#6c757d',
            cursor: 'pointer',
          }}
        >
          홀만
        </button>
        <button
          onClick={() => setPositionFilter('주방')}
          style={{
            padding: '0.35rem 0.8rem',
            border: positionFilter === '주방' ? '2px solid #0d6efd' : '1px solid #dee2e6',
            borderRadius: 4,
            fontSize: '0.8rem',
            fontWeight: positionFilter === '주방' ? 600 : 400,
            backgroundColor: positionFilter === '주방' ? '#0d6efd' : '#fff',
            color: positionFilter === '주방' ? '#fff' : '#6c757d',
            cursor: 'pointer',
          }}
        >
          주방만
        </button>
      </div>

      <div className="table-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <thead style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
            <tr>
              {weekDays.map((day) => (
                <th key={day} style={{ width: '14.28%', padding: '8px 0', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontSize: '0.85rem', fontWeight: 600 }}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {calendarGrid.map((row, weekIndex) => (
              <tr key={weekIndex} style={{ display: 'flex', flex: 1 }}>
                {row.map((day, dayIndex) => {
                  const daySchedules = day !== null ? getSchedulesForDate(day) : [];

                  return (
                    <td
                      key={dayIndex}
                      onClick={() => day !== null && handleDayClick(day)}
                      style={{
                        flex: 1,
                        verticalAlign: 'top',
                        padding: '0.25rem',
                        border: '1px solid #e0e0e0',
                        overflow: 'hidden',
                        cursor: isMobile && day !== null ? 'pointer' : 'default',
                        background: isMobile && selectedDay === day ? '#e8f4ff' : undefined,
                      }}
                    >
                      {day !== null && (
                        <>
                          <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: isMobile ? '0.95rem' : undefined }}>{day}</div>

                          {/* 모바일: 인원 수 뱃지만 표시 */}
                          {isMobile ? (
                            daySchedules.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {(() => {
                                  const hallCount = daySchedules.filter(s => getEmployeePosition(s) === '홀').length;
                                  const kitchenCount = daySchedules.filter(s => getEmployeePosition(s) === '주방').length;
                                  const otherCount = daySchedules.length - hallCount - kitchenCount;
                                  return (
                                    <>
                                      {hallCount > 0 && (
                                        <span style={{ fontSize: '0.68rem', background: '#d4edda', color: '#155724', borderRadius: '3px', padding: '1px 4px', fontWeight: 600 }}>
                                          홀{hallCount}
                                        </span>
                                      )}
                                      {kitchenCount > 0 && (
                                        <span style={{ fontSize: '0.68rem', background: '#cfe2ff', color: '#084298', borderRadius: '3px', padding: '1px 4px', fontWeight: 600 }}>
                                          주{kitchenCount}
                                        </span>
                                      )}
                                      {otherCount > 0 && (
                                        <span style={{ fontSize: '0.68rem', background: '#f8f9fa', color: '#495057', borderRadius: '3px', padding: '1px 4px', fontWeight: 600 }}>
                                          +{otherCount}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )
                          ) : (
                            /* PC: 기존 이름 칩 표시 */
                            <div
                              style={{
                                fontSize: '0.75rem',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '0.125rem',
                              }}
                            >
                              {daySchedules.map((schedule) => {
                                const position = getEmployeePosition(schedule);
                                return (
                                  <div
                                    key={schedule.id}
                                    style={{
                                      backgroundColor: getPositionColor(position),
                                      padding: '0.125rem 0.25rem',
                                      borderRadius: '2px',
                                      fontSize: '0.7rem',
                                      textAlign: 'center',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {getEmployeeName(schedule)}
                                    {position && ` (${position})`}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 날짜 상세 모달 */}
      {isMobile && <DayDetailModal />}
    </div>
  );
};

export default ScheduleCalendar;

