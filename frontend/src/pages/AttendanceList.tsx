import React, { useState, useEffect } from 'react';
import { attendanceAPI, employeeAPI, scheduleAPI } from '../api/client';
import { Attendance, Employee, Schedule } from '../types';
import { useWindowWidth } from '../hooks/useWindowWidth';

const AttendanceList: React.FC = () => {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [positionFilter, setPositionFilter] = useState<'전체' | '홀' | '주방'>('전체');
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [changedStatuses, setChangedStatuses] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchData();
    setChangedStatuses({});
  }, [selectedDate]);

  // 필터링된 직원 목록
  const filteredEmployees = employees.filter(employee => {
    if (positionFilter === '전체') return true;
    return employee.employee_position === positionFilter;
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [attendanceRes, scheduleRes, employeeRes] = await Promise.all([
        attendanceAPI.getAll({ date: selectedDate }),
        scheduleAPI.getAll({ start_date: selectedDate, end_date: selectedDate }),
        employeeAPI.getAll({ status: '재직', limit: 100 }),
      ]);
      setAttendances(attendanceRes.data || []);
      setSchedules(scheduleRes.data || []);
      setEmployees(employeeRes.data || []);
    } catch (err: any) {
      console.error('데이터 로딩 실패:', err);
      setAttendances([]);
      setSchedules([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeAttendanceStatus = (employee: Employee) => {
    // 해당 날짜의 스케줄 확인
    const schedule = schedules.find(s => s.employee_id === employee.id && s.date === selectedDate);
    
    // 해당 날짜의 출퇴근 기록 확인
    const attendance = attendances.find(a => a.employee_id === employee.id && a.date === selectedDate);

    // 휴무 스케줄이 있으면 휴무
    if (schedule && schedule.schedule_type === '휴무') {
      return { status: '휴무', attendance: null, schedule };
    }

    // 출퇴근 기록이 있으면 그 기록의 상태 사용
    if (attendance) {
      return { status: attendance.status, attendance, schedule };
    }

    // 휴무가 아닌 경우(출근 스케줄이 있거나 스케줄이 없는 경우) 기본값은 출근
    return { status: '정상', attendance: null, schedule };
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, { backgroundColor: string; color: string }> = {
      '정상': { backgroundColor: '#d4edda', color: '#155724' },
      '지각': { backgroundColor: '#fff3cd', color: '#856404' },
      '조퇴': { backgroundColor: '#fff3cd', color: '#856404' },
      '결근': { backgroundColor: '#f8d7da', color: '#721c24' },
      '휴무': { backgroundColor: '#e7f3ff', color: '#004085' },
      '미등록': { backgroundColor: '#f8f9fa', color: '#6c757d' },
    };
    return styles[status] || { backgroundColor: '#f8f9fa', color: '#6c757d' };
  };

  const formatTime = (dateTime?: string) => {
    if (!dateTime) return '-';
    return new Date(dateTime).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return `${dateStr}(${weekdays[date.getDay()]})`;
  };

  const handleStatusChange = async (employeeId: number, newStatus: string) => {
    try {
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) return;

      const existingAttendance = attendances.find(a => a.employee_id === employeeId && a.date === selectedDate);
      
      if (newStatus === '휴무') {
        // 휴무로 변경 - 스케줄 업데이트
        const existingSchedule = schedules.find(s => s.employee_id === employeeId && s.date === selectedDate);
        
        if (existingSchedule) {
          await scheduleAPI.update(existingSchedule.id, {
            schedule_type: '휴무',
            work_position: employee.employee_position,
          });
        } else {
          await scheduleAPI.create({
            employee_id: employeeId,
            date: selectedDate,
            schedule_type: '휴무',
            work_position: employee.employee_position,
          });
        }
        
        // 출퇴근 기록이 있으면 삭제
        if (existingAttendance) {
          await attendanceAPI.delete(existingAttendance.id);
        }
      } else if (newStatus === '출근' || newStatus === '지각' || newStatus === '결근') {
        // 출근/지각/결근으로 변경 - 스케줄을 출근으로 업데이트하고 출퇴근 기록 생성/업데이트
        const existingSchedule = schedules.find(s => s.employee_id === employeeId && s.date === selectedDate);
        
        if (existingSchedule) {
          await scheduleAPI.update(existingSchedule.id, {
            schedule_type: '출근',
            work_position: employee.employee_position,
          });
        } else {
          await scheduleAPI.create({
            employee_id: employeeId,
            date: selectedDate,
            schedule_type: '출근',
            work_position: employee.employee_position,
          });
        }

        // 출퇴근 기록 생성/업데이트
        const statusMap: Record<string, '정상' | '지각' | '조퇴' | '결근'> = {
          '출근': '정상',
          '지각': '지각',
          '결근': '결근',
        };

        const attendanceData: any = {
          employee_id: employeeId,
          date: selectedDate,
          status: statusMap[newStatus] || '정상',
        };

        if (newStatus === '출근' || newStatus === '지각') {
          // 출근이나 지각인 경우 출근 시간 설정
          const now = new Date();
          attendanceData.check_in = now.toISOString();
          // 기존 기록이 있고 퇴근 시간이 있으면 유지
          if (existingAttendance?.check_out) {
            attendanceData.check_out = existingAttendance.check_out;
          }
        }

        if (existingAttendance) {
          await attendanceAPI.update(existingAttendance.id, attendanceData);
        } else {
          await attendanceAPI.create(attendanceData);
        }
      }

      // 변경 상태 저장
      setChangedStatuses(prev => ({ ...prev, [employeeId]: newStatus }));
      
      // 데이터 다시 불러오기
      await fetchData();
    } catch (err: any) {
      console.error('상태 변경 실패:', err);
      alert('상태 변경에 실패했습니다: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading && employees.length === 0) {
    return (
      <div className="card">
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">출퇴근 관리</h2>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ fontWeight: 600 }}>날짜 선택:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
              minWidth: '200px',
              cursor: 'pointer',
            }}
          />
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
        </div>
      </div>

      {employees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#7f8c8d' }}>
          등록된 직원이 없습니다.
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#7f8c8d' }}>
          선택한 필터에 해당하는 직원이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {filteredEmployees.map((employee) => {
            const { status, attendance, schedule } = getEmployeeAttendanceStatus(employee);
            const statusStyle = getStatusStyle(status);

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
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                    {employee.name}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                    {employee.employee_position}
                  </div>
                </div>

                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: statusStyle.backgroundColor,
                  color: statusStyle.color,
                  borderRadius: '4px',
                  textAlign: 'center',
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                }}>
                  {status === '정상' && '✓ 출근'}
                  {status === '지각' && '⚠ 지각'}
                  {status === '조퇴' && '⚠ 조퇴'}
                  {status === '결근' && '✗ 결근'}
                  {status === '휴무' && '○ 휴무'}
                  {status === '미등록' && '? 미등록'}
                  {changedStatuses[employee.id] && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                      (변경됨: {changedStatuses[employee.id]})
                    </div>
                  )}
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)', 
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  <button
                    className="btn"
                    onClick={() => handleStatusChange(employee.id, '휴무')}
                    style={{
                      padding: '0.5rem 0.25rem',
                      fontSize: '0.75rem',
                      backgroundColor: status === '휴무' ? '#e7f3ff' : '#f8f9fa',
                      color: status === '휴무' ? '#004085' : '#6c757d',
                      border: status === '휴무' ? '2px solid #004085' : '1px solid #dee2e6',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: status === '휴무' ? 600 : 400,
                    }}
                  >
                    휴무
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleStatusChange(employee.id, '출근')}
                    style={{
                      padding: '0.5rem 0.25rem',
                      fontSize: '0.75rem',
                      backgroundColor: status === '정상' ? '#d4edda' : '#f8f9fa',
                      color: status === '정상' ? '#155724' : '#6c757d',
                      border: status === '정상' ? '2px solid #155724' : '1px solid #dee2e6',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: status === '정상' ? 600 : 400,
                    }}
                  >
                    출근
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleStatusChange(employee.id, '지각')}
                    style={{
                      padding: '0.5rem 0.25rem',
                      fontSize: '0.75rem',
                      backgroundColor: status === '지각' ? '#fff3cd' : '#f8f9fa',
                      color: status === '지각' ? '#856404' : '#6c757d',
                      border: status === '지각' ? '2px solid #856404' : '1px solid #dee2e6',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: status === '지각' ? 600 : 400,
                    }}
                  >
                    지각
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleStatusChange(employee.id, '결근')}
                    style={{
                      padding: '0.5rem 0.25rem',
                      fontSize: '0.75rem',
                      backgroundColor: status === '결근' ? '#f8d7da' : '#f8f9fa',
                      color: status === '결근' ? '#721c24' : '#6c757d',
                      border: status === '결근' ? '2px solid #721c24' : '1px solid #dee2e6',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: status === '결근' ? 600 : 400,
                    }}
                  >
                    결근
                  </button>
                </div>

                {attendance && (
                  <div style={{ fontSize: '0.875rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <div style={{ color: '#666', marginBottom: '0.25rem' }}>출근 시간</div>
                      <div style={{ fontWeight: 500 }}>{formatTime(attendance.check_in)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#666', marginBottom: '0.25rem' }}>퇴근 시간</div>
                      <div style={{ fontWeight: 500 }}>{formatTime(attendance.check_out)}</div>
                    </div>
                  </div>
                )}

                {attendance?.memo && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #dee2e6' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>메모</div>
                    <div style={{ fontSize: '0.875rem' }}>{attendance.memo}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AttendanceList;
