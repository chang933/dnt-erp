import React, { useState, useEffect } from 'react';
import { employeeAPI, scheduleAPI } from '../api/client';
import { Employee } from '../types';
import { useWindowWidth } from '../hooks/useWindowWidth';

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const WeeklySchedule: React.FC = () => {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [positionFilter, setPositionFilter] = useState<'전체' | '홀' | '주방' | '일당'>('전체');
  /** 직원별 휴무일 (dateStr Set) */
  const [selectedDays, setSelectedDays] = useState<Record<number, Set<string>>>({});
  /** 시급 직원만: 직원별·날짜별 추가 근무 시간(시간 단위) */
  const [extraHours, setExtraHours] = useState<Record<number, Record<string, number>>>({});

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      loadExistingSchedules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeAPI.getAll({ status: '재직' });
      const employeeList = normalizeList<Employee>(response.data);
      setEmployees(employeeList);
      const initialSelections: Record<number, Set<string>> = {};
      employeeList.forEach((emp: Employee) => {
        initialSelections[emp.id] = new Set<string>();
      });
      setSelectedDays(initialSelections);
      if (employeeList.length > 0) {
        await loadExistingSchedules(employeeList);
      }
    } catch (err: any) {
      console.error('직원 목록 로딩 에러:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingSchedules = async (employeeList?: Employee[]) => {
    try {
      const employeesToUse = employeeList || employees;
      if (employeesToUse.length === 0) {
        return;
      }

      const weekDates = getWeekDates(selectedWeek);
      const startDate = weekDates[0].dateStr;
      const endDate = weekDates[6].dateStr;
      const allWeekDateStrs = weekDates.map((d) => d.dateStr);

      const newSelections: Record<number, Set<string>> = {};
      const newExtraHours: Record<number, Record<string, number>> = {};

      for (const employee of employeesToUse) {
        const isDaily = (employee as any).employment_type === 'DAILY';
        try {
          const response = await scheduleAPI.getAll({
            employee_id: employee.id,
            start_date: startDate,
            end_date: endDate,
          });
          const schedules = normalizeList<any>(response.data);

          const holidayDates = new Set<string>();
          const empExtra: Record<string, number> = {};
          schedules.forEach((schedule: any) => {
            const raw = schedule.date ?? schedule.schedule_date ?? '';
            const scheduleDate = typeof raw === 'string' ? raw.slice(0, 10) : raw;
            if (scheduleDate && scheduleDate.length === 10) {
              if (schedule.schedule_type === '휴무') {
                holidayDates.add(scheduleDate);
              }
              empExtra[scheduleDate] = Number(schedule.extra_hours ?? 0);
            }
          });
          // 일당: 해당 주에 저장된 스케줄이 없으면 기본 전체 휴무(나오는 날만 근무로 토글)
          if (isDaily && schedules.length === 0) {
            allWeekDateStrs.forEach((ds) => holidayDates.add(ds));
          }
          newSelections[employee.id] = holidayDates;
          newExtraHours[employee.id] = empExtra;
        } catch (err) {
          console.error(`직원 ${employee.id}의 스케줄 로딩 실패:`, err);
          newSelections[employee.id] = isDaily ? new Set(allWeekDateStrs) : new Set<string>();
          newExtraHours[employee.id] = {};
        }
      }

      setSelectedDays(newSelections);
      setExtraHours(newExtraHours);
    } catch (err) {
      console.error('기존 스케줄 로딩 실패:', err);
    }
  };

  const getWeekDates = (weekOffset: number) => {
    const today = new Date();
    const currentDay = today.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayDate = today.getDate() + diffToMonday + (weekOffset * 7);
    const monday = new Date(today.getFullYear(), today.getMonth(), mondayDate);

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dates: Array<{ date: Date; dateStr: string; dayName: string }> = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dates.push({
        date,
        dateStr,
        dayName: dayNames[date.getDay()],
      });
    }
    return dates;
  };

  const WEEK_OFFSETS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;
  const getWeekLabel = (offset: number) => {
    if (offset === 0) return '이번 주';
    if (offset === -1) return '저번 주';
    if (offset === 1) return '다음 주';
    if (offset < 0) return `${-offset}주 전`;
    return `${offset}주 후`;
  };
  const displayDates = getWeekDates(selectedWeek);

  const toggleDay = (employeeId: number, dateStr: string) => {
    setSelectedDays((prev) => {
      const newSelections = { ...prev };
      if (!newSelections[employeeId]) {
        newSelections[employeeId] = new Set<string>();
      }
      const employeeDays = new Set(newSelections[employeeId]);
      if (employeeDays.has(dateStr)) {
        employeeDays.delete(dateStr);
      } else {
        employeeDays.add(dateStr);
      }
      newSelections[employeeId] = employeeDays;
      return newSelections;
    });
  };

  /** 시급 직원의 해당일 추가 근무 시간을 30분/1시간 단위로 증감 (delta: 0.5, 1, -0.5, -1) */
  const addExtraHours = (employeeId: number, dateStr: string, delta: number) => {
    setExtraHours((prev) => {
      const cur = (prev[employeeId] ?? {})[dateStr] ?? 0;
      const val = Math.max(0, Math.round((cur + delta) * 2) / 2); // 0.5 단위, 최소 0
      const next = { ...prev };
      if (!next[employeeId]) next[employeeId] = {};
      next[employeeId] = { ...next[employeeId], [dateStr]: val };
      return next;
    });
  };

  const saveSchedule = async (employeeId: number, weekDates: Array<{ date: Date; dateStr: string; dayName: string }>) => {
    try {
      const selectedDaysForEmployee = selectedDays[employeeId] || new Set<string>();
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) {
        alert('직원 정보를 찾을 수 없습니다.');
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];
      
      for (const { dateStr } of weekDates) {
        const isHoliday = selectedDaysForEmployee.has(dateStr);
        const addHours = (extraHours[employeeId] ?? {})[dateStr] ?? 0;
        const scheduleData: any = {
          employee_id: employeeId,
          date: dateStr,
          schedule_type: isHoliday ? '휴무' : '출근',
          work_position: employee.employee_position,
        };
        if (!isHoliday) {
          scheduleData.extra_hours = addHours;
        }
        
        try {
          await scheduleAPI.create(scheduleData);
          successCount++;
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || err.message || '알 수 없는 오류';
          errors.push(`${dateStr}: ${errorMsg}`);
          failCount++;
        }
      }

      if (failCount === 0) {
        alert(`스케줄이 성공적으로 저장되었습니다.\n(저장된 항목: ${successCount}개)`);
        await loadExistingSchedules();
      } else if (successCount > 0) {
        alert(`일부 스케줄 저장 완료\n성공: ${successCount}개\n실패: ${failCount}개\n\n실패 상세:\n${errors.join('\n')}`);
        await loadExistingSchedules();
      } else {
        alert(`스케줄 저장에 실패했습니다.\n\n실패 상세:\n${errors.join('\n')}`);
      }
    } catch (err: any) {
      console.error('스케줄 저장 중 전체 오류:', err);
      const errorDetail = err.response?.data?.detail || err.message || '알 수 없는 오류';
      alert(`스케줄 저장 중 오류가 발생했습니다:\n${errorDetail}`);
    }
  };

  // 필터링된 직원 목록 (전체/홀/주방은 일당 제외, 일당 버튼 시 일당만)
  const filteredEmployees = (() => {
    const list = employees.filter(employee => {
      const isDaily = (employee as any).employment_type === 'DAILY';
      if (positionFilter === '일당') return isDaily;
      if (isDaily) return false;
      if (positionFilter === '전체') return true;
      return employee.employee_position === positionFilter;
    });
    if (positionFilter === '홀') {
      return [...list].sort((a, b) => {
        const typeA = (a as any).employment_type;
        const typeB = (b as any).employment_type;
        const order = (t: string) => (t === 'PART_TIME' ? 0 : t === 'FULL_TIME' ? 1 : 2);
        return order(typeA) - order(typeB);
      });
    }
    return list;
  })();

  if (loading) {
    return (
      <div className="card">
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">주간 스케줄</h2>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
          {WEEK_OFFSETS.map((offset) => {
            const weekDates = getWeekDates(offset);
            const rangeStr = `${weekDates[0].date.getMonth() + 1}/${weekDates[0].date.getDate()} ~ ${weekDates[6].date.getMonth() + 1}/${weekDates[6].date.getDate()}`;
            return (
              <button
                key={offset}
                className={`btn ${selectedWeek === offset ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedWeek(offset)}
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                title={`${rangeStr}`}
              >
                {getWeekLabel(offset)}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setPositionFilter('전체')}
            style={{
              padding: '0.5rem 1rem',
              border: positionFilter === '전체' ? '2px solid #007bff' : '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: positionFilter === '전체' ? 600 : 400,
              backgroundColor: positionFilter === '전체' ? '#007bff' : '#fff',
              color: positionFilter === '전체' ? '#fff' : '#6c757d',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            전체
          </button>
          <button
            onClick={() => setPositionFilter('홀')}
            style={{
              padding: '0.5rem 1rem',
              border: positionFilter === '홀' ? '2px solid #007bff' : '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: positionFilter === '홀' ? 600 : 400,
              backgroundColor: positionFilter === '홀' ? '#007bff' : '#fff',
              color: positionFilter === '홀' ? '#fff' : '#6c757d',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            홀
          </button>
          <button
            onClick={() => setPositionFilter('주방')}
            style={{
              padding: '0.5rem 1rem',
              border: positionFilter === '주방' ? '2px solid #007bff' : '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: positionFilter === '주방' ? 600 : 400,
              backgroundColor: positionFilter === '주방' ? '#007bff' : '#fff',
              color: positionFilter === '주방' ? '#fff' : '#6c757d',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            주방
          </button>
          <button
            onClick={() => setPositionFilter('일당')}
            style={{
              padding: '0.5rem 1rem',
              border: positionFilter === '일당' ? '2px solid #7b1fa2' : '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: positionFilter === '일당' ? 600 : 400,
              backgroundColor: positionFilter === '일당' ? '#7b1fa2' : '#fff',
              color: positionFilter === '일당' ? '#fff' : '#6c757d',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            일당
          </button>
        </div>
      </div>

      {filteredEmployees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#7f8c8d' }}>
          선택한 필터에 해당하는 직원이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1.5rem' }}>
          {filteredEmployees.map((employee) => {
          const employeeSelectedDays = selectedDays[employee.id] || new Set<string>();
          return (
            <div
              key={employee.id}
              style={{
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '1rem',
                backgroundColor: '#fff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '2px solid #dee2e6',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{employee.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6c757d', marginTop: '0.25rem' }}>
                    {employee.employee_position}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => saveSchedule(employee.id, displayDates)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  저장
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '0.5rem',
                }}
              >
                {displayDates.map(({ date, dateStr, dayName }) => {
                  const isSelected = employeeSelectedDays.has(dateStr);
                  const isHourly = (employee as any)?.salary_type === '시급';
                  const currentExtra = (extraHours[employee.id] ?? {})[dateStr] ?? 0;
                  const hasExtra = currentExtra > 0;
                  const h = Math.floor(currentExtra);
                  const hasHalf = currentExtra % 1 === 0.5;
                  const extraLabel = currentExtra === 0 ? '0' : h === 0 ? '30분' : hasHalf ? `${h}h 30분` : `${h}시간`;
                  return (
                    <div key={dateStr} style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#6c757d',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {date.getDate()}({dayName})
                      </div>
                      <button
                        onClick={() => toggleDay(employee.id, dateStr)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.25rem',
                          border: `2px solid ${isSelected ? '#dc3545' : '#28a745'}`,
                          borderRadius: '4px',
                          backgroundColor: isSelected ? '#f8d7da' : '#d4edda',
                          color: isSelected ? '#721c24' : '#155724',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: '0.75rem',
                        }}
                      >
                        {isSelected ? '휴무' : '근무'}
                      </button>
                      {isHourly && !isSelected && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.7rem' }}>
                          <div style={{ marginBottom: '0.2rem', fontWeight: 600, color: '#495057' }}>
                            추가 {extraLabel}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => addExtraHours(employee.id, dateStr, 0.5)}
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', border: '1px solid #0d6efd', borderRadius: '4px', backgroundColor: '#e7f1ff', color: '#0d6efd', cursor: 'pointer', fontWeight: 500 }}
                            >
                              +30분
                            </button>
                            <button
                              type="button"
                              onClick={() => addExtraHours(employee.id, dateStr, 1)}
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', border: '1px solid #0d6efd', borderRadius: '4px', backgroundColor: '#0d6efd', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
                            >
                              +1시간
                            </button>
                            {hasExtra && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => addExtraHours(employee.id, dateStr, -0.5)}
                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', border: '1px solid #6c757d', borderRadius: '4px', backgroundColor: '#f8f9fa', color: '#6c757d', cursor: 'pointer', fontWeight: 500 }}
                                >
                                  −30분
                                </button>
                                <button
                                  type="button"
                                  onClick={() => addExtraHours(employee.id, dateStr, -1)}
                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', border: '1px solid #6c757d', borderRadius: '4px', backgroundColor: '#f8f9fa', color: '#6c757d', cursor: 'pointer', fontWeight: 500 }}
                                >
                                  −1시간
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#e7f3ff', borderRadius: '4px', fontSize: '0.875rem' }}>
        <strong>사용 방법:</strong>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
          <li>각 날짜 버튼을 클릭하면 휴무일/근무일을 토글할 수 있습니다.</li>
          <li>
            <strong>일당</strong> 직원은 해당 주에 아직 저장된 스케줄이 없으면{' '}
            <strong>전체 휴무(빨간색)</strong>에서 시작합니다. 실제 출근하는 날만 클릭해{' '}
            <strong>근무(녹색)</strong>로 바꿔 주세요.
          </li>
          <li>그 외 직원은 초기 상태가 모두 근무일(녹색)입니다. 쉬는 날을 빨간색(휴무)으로 바꿉니다.</li>
          <li><strong>시급·알바</strong> 직원은 근무일마다 <strong>+30분</strong>, <strong>+1시간</strong> 버튼으로 추가 근무를 쌓고, <strong>−30분</strong>, <strong>−1시간</strong>으로 줄일 수 있습니다. (예: 2시간 30분 연장 시 +1시간 두 번, +30분 한 번)</li>
          <li>각 직원의 스케줄을 설정한 후 '저장' 버튼을 클릭하여 저장하세요.</li>
        </ul>
      </div>
    </div>
  );
};

export default WeeklySchedule;

