import React, { useState, useEffect, useMemo } from 'react';
import { reservationAPI } from '../api/client';
import { Reservation, ReservationCreate } from '../types';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

function getWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return WEEKDAY_FULL[d.getDay()];
}

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const EMPTY_FORM: ReservationCreate = {
  reservation_date: new Date().toISOString().split('T')[0],
  reservation_time: '',
  guest_name: '',
  head_count: 2,
  memo: '',
};

const ReservationList: React.FC = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ReservationCreate>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const response = await reservationAPI.getAll({ limit: 1000 });
      setReservations(normalizeList<Reservation>(response.data));
    } catch (err) {
      console.error('예약 목록 로딩 실패:', err);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  const reservationMap = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    reservations.forEach((r) => {
      if (!map[r.reservation_date]) map[r.reservation_date] = [];
      map[r.reservation_date].push(r);
    });
    return map;
  }, [reservations]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedReservations = selectedDate ? (reservationMap[selectedDate] || []) : [];

  const handlePrevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  const handleDayClick = (day: number) => {
    const dateStr = toDateStr(year, month, day);
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
    setShowForm(false);
  };

  const openNewForm = (dateStr?: string) => {
    setEditingId(null);
    setFormData({
      ...EMPTY_FORM,
      reservation_date: dateStr || selectedDate || todayStr,
    });
    setShowForm(true);
  };

  const openEditForm = (r: Reservation) => {
    setEditingId(r.id);
    setFormData({
      reservation_date: r.reservation_date,
      reservation_time: r.reservation_time ? formatTime(r.reservation_time) : '',
      guest_name: r.guest_name,
      head_count: r.head_count,
      memo: r.memo || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guest_name.trim()) {
      alert('예약자 성함을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    const payload = {
      ...formData,
      reservation_time: formData.reservation_time || null,
      head_count: formData.head_count || 1,
      memo: formData.memo || null,
    };
    try {
      if (editingId !== null) {
        await reservationAPI.update(editingId, payload);
      } else {
        await reservationAPI.create(payload);
      }
      closeForm();
      await fetchReservations();
    } catch (err: any) {
      alert(err.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 예약을 삭제하시겠습니까?')) return;
    try {
      await reservationAPI.delete(id);
      await fetchReservations();
    } catch (err: any) {
      alert(err.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="card card-fullheight">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">예약</h2>
        <button className="btn btn-primary" onClick={() => openNewForm()}>
          + 예약 등록
        </button>
      </div>

      {/* 달력 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', margin: '1.2rem 0 0.8rem' }}>
        <button
          onClick={handlePrevMonth}
          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer', fontSize: '1.1rem' }}
        >
          ‹
        </button>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, minWidth: '130px', textAlign: 'center' }}>
          {year}년 {month + 1}월
        </span>
        <button
          onClick={handleNextMonth}
          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer', fontSize: '1.1rem' }}
        >
          ›
        </button>
      </div>

      {/* 달력 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <thead style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
            <tr>
              {WEEKDAY.map((w, i) => (
                <th key={w} style={{
                  padding: '8px 0',
                  textAlign: 'center',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '#374151',
                  borderBottom: '2px solid #e5e7eb',
                }}>
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {Array.from({ length: calendarDays.length / 7 }).map((_, rowIdx) => (
              <tr key={rowIdx} style={{ display: 'flex', flex: 1 }}>
                {calendarDays.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                  const dateStr = day ? toDateStr(year, month, day) : '';
                  const dayReservations = day ? (reservationMap[dateStr] || []) : [];
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const isSun = colIdx === 0;
                  const isSat = colIdx === 6;

                  return (
                    <td
                      key={colIdx}
                      onClick={day ? () => handleDayClick(day) : undefined}
                      style={{
                        flex: 1,
                        verticalAlign: 'top',
                        padding: '4px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: isSelected ? '#eff6ff' : isToday ? '#fefce8' : '#fff',
                        overflow: 'hidden',
                        cursor: day ? 'pointer' : 'default',
                        transition: 'background 0.1s',
                      }}
                    >
                      {day && (
                        <>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            fontSize: '0.85rem',
                            fontWeight: isToday ? 700 : 400,
                            color: isToday ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : '#111',
                            backgroundColor: isToday ? '#6366f1' : 'transparent',
                            marginBottom: '2px',
                          }}>
                            {day}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {dayReservations.slice(0, 3).map((r) => (
                              <div key={r.id} style={{
                                background: '#6366f1',
                                color: '#fff',
                                borderRadius: '3px',
                                padding: '1px 4px',
                                fontSize: '0.7rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {r.reservation_time ? formatTime(r.reservation_time) + ' ' : ''}{r.guest_name} {r.head_count}명
                              </div>
                            ))}
                            {dayReservations.length > 3 && (
                              <div style={{ fontSize: '0.68rem', color: '#6366f1', paddingLeft: '4px' }}>
                                +{dayReservations.length - 3}건 더보기
                              </div>
                            )}
                          </div>
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

      {/* 선택 날짜 예약 상세 */}
      {selectedDate && (
        <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e5e7eb', paddingTop: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              {selectedDate} ({getWeekday(selectedDate)}) 예약
              <span style={{ marginLeft: '8px', color: '#6366f1', fontSize: '0.9rem' }}>
                {selectedReservations.length}건 · 총 {selectedReservations.reduce((sum, r) => sum + r.head_count, 0)}명
              </span>
            </h3>
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '4px 12px' }}
              onClick={() => openNewForm(selectedDate)}
            >
              + 이 날 예약 추가
            </button>
          </div>

          {selectedReservations.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', padding: '1rem 0' }}>이 날 등록된 예약이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[...selectedReservations]
                .sort((a, b) => (a.reservation_time || '99:99') < (b.reservation_time || '99:99') ? -1 : 1)
                .map((r) => (
                  <div key={r.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e2e8f0',
                  }}>
                    {/* 시간 배지 */}
                    <div style={{
                      background: r.reservation_time ? '#6366f1' : '#94a3b8',
                      color: '#fff',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      minWidth: '58px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}>
                      {r.reservation_time ? formatTime(r.reservation_time) : '시간미정'}
                    </div>
                    {/* 내용 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{r.guest_name}</span>
                      <span style={{ marginLeft: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>{r.head_count}명</span>
                      {r.memo && (
                        <span style={{ marginLeft: '0.75rem', color: '#64748b', fontSize: '0.82rem' }}>| {r.memo}</span>
                      )}
                    </div>
                    {/* 수정/삭제 버튼 */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
                        onClick={() => openEditForm(r)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(r.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 예약 등록/수정 모달 폼 */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '2rem',
            width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
              {editingId !== null ? '예약 수정' : '예약 등록'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">예약일 *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.reservation_date}
                  onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                  required
                />
                {formData.reservation_date && (
                  <span style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                    {getWeekday(formData.reservation_date)}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">예약 시간</label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.reservation_time || ''}
                  onChange={(e) => setFormData({ ...formData, reservation_time: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">예약자 성함 *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.guest_name}
                  onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                  placeholder="예약자 이름"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">인원</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  value={formData.head_count}
                  onChange={(e) => setFormData({ ...formData, head_count: parseInt(e.target.value, 10) || 1 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">기타내용</label>
                <textarea
                  className="form-textarea"
                  value={formData.memo || ''}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="연락처, 요청사항 등"
                  rows={3}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? '저장 중...' : (editingId !== null ? '수정 완료' : '저장')}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1, background: '#f3f4f6', color: '#374151' }}
                  onClick={closeForm}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
          불러오는 중...
        </div>
      )}
    </div>
  );
};

export default ReservationList;
