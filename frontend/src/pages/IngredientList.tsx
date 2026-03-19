import React, { useState, useEffect, useMemo } from 'react';
import { foodCostAPI } from '../api/client';
import { FoodCost, FoodCostCreate } from '../types';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

const SUPPLIERS = ['G월드', 'CJ', '참다운', '쿠팡'] as const;
type Supplier = typeof SUPPLIERS[number];

const SUPPLIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'G월드':  { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  'CJ':     { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  '참다운': { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
  '쿠팡':   { bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' },
};

const PAYMENT_COLOR = { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const EMPTY_FORM: FoodCostCreate = {
  date: new Date().toISOString().split('T')[0],
  supplier: 'G월드',
  record_type: 'usage',
  amount: 0,
  memo: '',
};

const IngredientList: React.FC = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [records, setRecords] = useState<FoodCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FoodCost | null>(null);
  const [formData, setFormData] = useState<FoodCostCreate>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // 해당 월 데이터 로드
  useEffect(() => {
    fetchRecords();
  }, [year, month]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const startDate = toDateStr(year, month, 1);
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = toDateStr(year, month, lastDay);
      const res = await foodCostAPI.getAll({ start_date: startDate, end_date: endDate, limit: 2000 });
      setRecords(normalizeList<FoodCost>(res.data));
    } catch (err) {
      console.error('식자재 데이터 로딩 실패:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // 날짜별 맵
  const recordMap = useMemo(() => {
    const map: Record<string, FoodCost[]> = {};
    records.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [records]);

  // 달력 셀
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  // 월별 통계
  const monthlySummary = useMemo(() => {
    const usage: Record<string, number> = {};
    const payment: Record<string, number> = {};
    SUPPLIERS.forEach(s => { usage[s] = 0; payment[s] = 0; });
    records.forEach(r => {
      if (r.record_type === 'usage') usage[r.supplier] = (usage[r.supplier] || 0) + r.amount;
      else payment[r.supplier] = (payment[r.supplier] || 0) + r.amount;
    });
    const totalUsage = Object.values(usage).reduce((a, b) => a + b, 0);
    const totalPayment = Object.values(payment).reduce((a, b) => a + b, 0);
    return { usage, payment, totalUsage, totalPayment };
  }, [records]);

  const selectedRecords = selectedDate ? (recordMap[selectedDate] || []) : [];

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
    const ds = toDateStr(year, month, day);
    setSelectedDate(prev => prev === ds ? null : ds);
    setShowForm(false);
    setEditingRecord(null);
  };

  const openNewForm = (dateStr?: string, defaultType: 'usage' | 'payment' = 'usage') => {
    setEditingRecord(null);
    setFormData({ ...EMPTY_FORM, date: dateStr || selectedDate || todayStr, record_type: defaultType });
    setShowForm(true);
  };

  const openEditForm = (r: FoodCost) => {
    setEditingRecord(r);
    setFormData({
      date: r.date,
      supplier: r.supplier,
      record_type: r.record_type,
      amount: r.amount,
      memo: r.memo || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) {
      alert('금액을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...formData, memo: formData.memo || null };
      if (editingRecord) {
        await foodCostAPI.update(editingRecord.id, { amount: payload.amount, memo: payload.memo });
      } else {
        await foodCostAPI.create(payload);
      }
      closeForm();
      await fetchRecords();
    } catch (err: any) {
      alert(err.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      await foodCostAPI.delete(id);
      await fetchRecords();
    } catch (err: any) {
      alert(err.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="card card-fullheight">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">식자재 관리</h2>
        <button className="btn btn-primary" onClick={() => openNewForm()}>
          + 입력
        </button>
      </div>

      {/* 월별 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', margin: '1rem 0' }}>
        {SUPPLIERS.map(s => {
          const c = SUPPLIER_COLORS[s];
          const diff = (monthlySummary.usage[s] || 0) - (monthlySummary.payment[s] || 0);
          return (
            <div key={s} style={{
              border: `1px solid ${c.border}`,
              borderRadius: '8px',
              padding: '0.6rem 0.75rem',
              backgroundColor: c.bg,
            }}>
              <div style={{ fontWeight: 700, color: c.text, fontSize: '0.85rem', marginBottom: '4px' }}>{s}</div>
              <div style={{ fontSize: '0.78rem', color: '#374151' }}>
                <div>사용: <b>{formatCurrency(monthlySummary.usage[s] || 0)}</b>원</div>
                <div>지급: <b>{formatCurrency(monthlySummary.payment[s] || 0)}</b>원</div>
                <div style={{ color: diff > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  미지급: {formatCurrency(diff)}원
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 월 합계 */}
      <div style={{
        display: 'flex', gap: '1.5rem', alignItems: 'center',
        padding: '0.6rem 1rem', backgroundColor: '#f8fafc',
        borderRadius: '8px', marginBottom: '0.8rem', fontSize: '0.88rem',
      }}>
        <span>총 사용: <b style={{ color: '#dc2626' }}>{formatCurrency(monthlySummary.totalUsage)}원</b></span>
        <span>총 지급: <b style={{ color: '#16a34a' }}>{formatCurrency(monthlySummary.totalPayment)}원</b></span>
        <span>미지급 잔액: <b style={{ color: '#7c3aed' }}>
          {formatCurrency(monthlySummary.totalUsage - monthlySummary.totalPayment)}원
        </b></span>
      </div>

      {/* 달력 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '0.8rem' }}>
        <button onClick={handlePrevMonth}
          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer', fontSize: '1.1rem' }}>
          ‹
        </button>
        <span style={{ fontSize: '1.2rem', fontWeight: 700, minWidth: '130px', textAlign: 'center' }}>
          {year}년 {month + 1}월
        </span>
        <button onClick={handleNextMonth}
          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer', fontSize: '1.1rem' }}>
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
                  padding: '8px 0', textAlign: 'center', fontSize: '0.82rem', fontWeight: 600,
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
                  const ds = day ? toDateStr(year, month, day) : '';
                  const dayRecs = day ? (recordMap[ds] || []) : [];
                  const usageRecs = dayRecs.filter(r => r.record_type === 'usage');
                  const payRecs = dayRecs.filter(r => r.record_type === 'payment');
                  const isToday = ds === todayStr;
                  const isSelected = ds === selectedDate;
                  const isSun = colIdx === 0;
                  const isSat = colIdx === 6;

                  return (
                    <td key={colIdx}
                      onClick={day ? () => handleDayClick(day) : undefined}
                      style={{
                        flex: 1,
                        verticalAlign: 'top', padding: '4px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: isSelected ? '#eff6ff' : isToday ? '#fefce8' : '#fff',
                        cursor: day ? 'pointer' : 'default',
                        overflow: 'hidden',
                      }}
                    >
                      {day && (
                        <>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '24px', height: '24px', borderRadius: '50%',
                            fontSize: '0.83rem', fontWeight: isToday ? 700 : 400,
                            color: isToday ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : '#111',
                            backgroundColor: isToday ? '#6366f1' : 'transparent',
                            marginBottom: '2px',
                          }}>
                            {day}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {/* 사용 내역 */}
                            {usageRecs.slice(0, 2).map(r => {
                              const c = SUPPLIER_COLORS[r.supplier] || SUPPLIER_COLORS['G월드'];
                              return (
                                <div key={r.id} style={{
                                  background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                                  borderRadius: '3px', padding: '1px 3px', fontSize: '0.67rem',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {r.supplier} {formatCurrency(r.amount)}
                                </div>
                              );
                            })}
                            {usageRecs.length > 2 && (
                              <div style={{ fontSize: '0.65rem', color: '#6366f1', paddingLeft: '2px' }}>
                                +{usageRecs.length - 2}건
                              </div>
                            )}
                            {/* 지급 내역 */}
                            {payRecs.slice(0, 1).map(r => (
                              <div key={r.id} style={{
                                background: '#f0fdf4', color: '#166534', border: '1px solid #86efac',
                                borderRadius: '3px', padding: '1px 3px', fontSize: '0.67rem',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                💳 {r.supplier} {formatCurrency(r.amount)}
                              </div>
                            ))}
                            {payRecs.length > 1 && (
                              <div style={{ fontSize: '0.65rem', color: '#16a34a', paddingLeft: '2px' }}>
                                +지급{payRecs.length - 1}건
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

      {/* 선택 날짜 상세 */}
      {selectedDate && (
        <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e5e7eb', paddingTop: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              {selectedDate} ({WEEKDAY[new Date(selectedDate + 'T00:00:00').getDay()]})
              <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '0.85rem', fontWeight: 400 }}>
                사용 {formatCurrency(selectedRecords.filter(r => r.record_type === 'usage').reduce((s, r) => s + r.amount, 0))}원 / 지급 {formatCurrency(selectedRecords.filter(r => r.record_type === 'payment').reduce((s, r) => s + r.amount, 0))}원
              </span>
            </h3>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '4px 10px' }}
                onClick={() => openNewForm(selectedDate, 'usage')}>
                + 사용 입력
              </button>
              <button className="btn btn-sm" style={{ fontSize: '0.82rem', padding: '4px 10px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }}
                onClick={() => openNewForm(selectedDate, 'payment')}>
                + 지급 입력
              </button>
            </div>
          </div>

          {selectedRecords.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', padding: '0.5rem 0' }}>이 날 입력된 내역이 없습니다.</p>
          ) : (
            <>
              {/* 사용 내역 */}
              {selectedRecords.filter(r => r.record_type === 'usage').length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem' }}>📦 식자재 사용 (입고)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {selectedRecords.filter(r => r.record_type === 'usage').map(r => {
                      const c = SUPPLIER_COLORS[r.supplier] || SUPPLIER_COLORS['G월드'];
                      return (
                        <div key={r.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          background: '#f8fafc', borderRadius: '8px', padding: '0.6rem 0.9rem',
                          border: '1px solid #e2e8f0',
                        }}>
                          <div style={{
                            background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                            borderRadius: '5px', padding: '3px 10px', fontSize: '0.82rem', fontWeight: 700,
                            flexShrink: 0, minWidth: '50px', textAlign: 'center',
                          }}>
                            {r.supplier}
                          </div>
                          <div style={{ flex: 1, fontWeight: 600 }}>
                            {formatCurrency(r.amount)}원
                            {r.memo && <span style={{ marginLeft: '0.5rem', fontWeight: 400, color: '#64748b', fontSize: '0.82rem' }}>| {r.memo}</span>}
                          </div>
                          <button className="btn btn-sm"
                            style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', fontSize: '0.78rem', padding: '2px 8px' }}
                            onClick={() => openEditForm(r)}>수정</button>
                          <button className="btn btn-danger btn-sm"
                            style={{ fontSize: '0.78rem', padding: '2px 8px' }}
                            onClick={() => handleDelete(r.id)}>삭제</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 지급 내역 */}
              {selectedRecords.filter(r => r.record_type === 'payment').length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#15803d', marginBottom: '0.4rem' }}>💳 실 지급</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {selectedRecords.filter(r => r.record_type === 'payment').map(r => {
                      const c = SUPPLIER_COLORS[r.supplier] || SUPPLIER_COLORS['G월드'];
                      return (
                        <div key={r.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          background: '#f0fdf4', borderRadius: '8px', padding: '0.6rem 0.9rem',
                          border: '1px solid #bbf7d0',
                        }}>
                          <div style={{
                            background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                            borderRadius: '5px', padding: '3px 10px', fontSize: '0.82rem', fontWeight: 700,
                            flexShrink: 0, minWidth: '50px', textAlign: 'center',
                          }}>
                            {r.supplier}
                          </div>
                          <div style={{ flex: 1, fontWeight: 600, color: '#15803d' }}>
                            {formatCurrency(r.amount)}원
                            {r.memo && <span style={{ marginLeft: '0.5rem', fontWeight: 400, color: '#64748b', fontSize: '0.82rem' }}>| {r.memo}</span>}
                          </div>
                          <button className="btn btn-sm"
                            style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', fontSize: '0.78rem', padding: '2px 8px' }}
                            onClick={() => openEditForm(r)}>수정</button>
                          <button className="btn btn-danger btn-sm"
                            style={{ fontSize: '0.78rem', padding: '2px 8px' }}
                            onClick={() => handleDelete(r.id)}>삭제</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 입력/수정 모달 */}
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
            width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.05rem', fontWeight: 700 }}>
              {editingRecord ? '수정' : (formData.record_type === 'usage' ? '식자재 사용 입력' : '실 지급 입력')}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">날짜 *</label>
                <input type="date" className="form-input" value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required disabled={!!editingRecord} />
              </div>

              {!editingRecord && (
                <div className="form-group">
                  <label className="form-label">구분 *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['usage', 'payment'] as const).map(rt => (
                      <button key={rt} type="button"
                        onClick={() => setFormData({ ...formData, record_type: rt })}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: '6px', cursor: 'pointer',
                          fontWeight: formData.record_type === rt ? 700 : 400,
                          background: formData.record_type === rt
                            ? (rt === 'usage' ? '#6366f1' : '#16a34a')
                            : '#f3f4f6',
                          color: formData.record_type === rt ? '#fff' : '#374151',
                          border: '1px solid ' + (formData.record_type === rt ? 'transparent' : '#d1d5db'),
                          fontSize: '0.88rem',
                        }}>
                        {rt === 'usage' ? '📦 사용 (입고)' : '💳 실 지급'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">물류센터 *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
                  {SUPPLIERS.map(s => {
                    const c = SUPPLIER_COLORS[s];
                    const isSelected = formData.supplier === s;
                    return (
                      <button key={s} type="button"
                        onClick={() => setFormData({ ...formData, supplier: s })}
                        disabled={!!editingRecord}
                        style={{
                          padding: '0.5rem', borderRadius: '6px', cursor: editingRecord ? 'not-allowed' : 'pointer',
                          fontWeight: isSelected ? 700 : 400,
                          background: isSelected ? c.bg : '#f9fafb',
                          color: isSelected ? c.text : '#374151',
                          border: `1.5px solid ${isSelected ? c.border : '#e5e7eb'}`,
                          fontSize: '0.88rem',
                        }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">금액 *</label>
                <input type="number" className="form-input"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value, 10) || 0 })}
                  placeholder="금액 입력 (원)"
                  min={1} required autoFocus={!!editingRecord} />
              </div>

              <div className="form-group">
                <label className="form-label">메모</label>
                <input type="text" className="form-input"
                  value={formData.memo || ''}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="비고 (선택)" />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? '저장 중...' : (editingRecord ? '수정 완료' : '저장')}
                </button>
                <button type="button" className="btn"
                  style={{ flex: 1, background: '#f3f4f6', color: '#374151' }}
                  onClick={closeForm}>
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

export default IngredientList;
