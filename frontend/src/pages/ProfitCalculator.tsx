import React, { useState, useEffect, useRef } from 'react';
import { revenueExpenseAPI, apiClient } from '../api/client';
import { RevenueExpense, RevenueExpenseType } from '../types';
import { useWindowWidth } from '../hooks/useWindowWidth';

const SETTINGS_KEY_ITEMS = 'profit-fixed-expense-items';
const SETTINGS_KEY_PAYMENTS = 'profit-fixed-expense-payments';

async function fetchSetting<T>(key: string): Promise<T | null> {
  try {
    const res = await apiClient.get(`/settings/${key}`);
    return res.data?.value ?? null;
  } catch {
    return null;
  }
}

async function saveSetting(key: string, value: any): Promise<void> {
  try {
    await apiClient.put(`/settings/${key}`, { value });
  } catch {
    // 백엔드 저장 실패 시 무시 (localStorage는 이미 저장됨)
  }
}

const EXPENSE_TYPES: RevenueExpenseType[] = [
  '고정지출', '일반지출', '주방지출', '주류지출', '음료지출', '로얄티', '급여', '카드수수료', '4대보험료', '마케팅비', '관리비'
];

// 고정지출: 품목명 + 매월 나가는 금액 + 나가는 날(일)
export interface FixedExpenseItem {
  name: string;
  amount: number;
  dayOfMonth: number; // 1~31
}

const DEFAULT_FIXED_EXPENSE_ITEMS: FixedExpenseItem[] = [
  { name: '임대료', amount: 0, dayOfMonth: 1 },
  { name: '세스코', amount: 0, dayOfMonth: 1 },
  { name: '캡스', amount: 0, dayOfMonth: 1 },
];
const FIXED_EXPENSE_ITEMS_STORAGE_KEY = 'profit-calculator-fixed-expense-items';
const SHARED_CUSTOM_EXPENSE_ITEMS_KEY = 'shared-custom-expense-items';

function loadFixedExpenseItems(): FixedExpenseItem[] {
  try {
    const raw = localStorage.getItem(FIXED_EXPENSE_ITEMS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const migrated = parsed.map((x: any) => {
          if (typeof x === 'string' && x.trim()) {
            return { name: x.trim(), amount: 0, dayOfMonth: 1 };
          }
          if (x && typeof x.name === 'string' && typeof x.amount === 'number' && typeof x.dayOfMonth === 'number') {
            const day = Math.min(31, Math.max(1, Math.floor(x.dayOfMonth)));
            return { name: x.name.trim(), amount: Number(x.amount) || 0, dayOfMonth: day };
          }
          return null;
        }).filter(Boolean) as FixedExpenseItem[];
        if (migrated.length) return migrated;
      }
    }
  } catch (_) {}
  return DEFAULT_FIXED_EXPENSE_ITEMS;
}

function saveFixedExpenseItems(items: FixedExpenseItem[]) {
  try {
    localStorage.setItem(FIXED_EXPENSE_ITEMS_STORAGE_KEY, JSON.stringify(items));
  } catch (_) {}
}

// 기간 내 매월 해당일 고정지출 합계
function computeScheduledFixedExpenseTotal(
  items: FixedExpenseItem[],
  startDateStr: string,
  endDateStr: string
): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  let total = 0;
  const y1 = start.getFullYear();
  const m1 = start.getMonth();
  const y2 = end.getFullYear();
  const m2 = end.getMonth();
  for (let y = y1; y <= y2; y++) {
    const mStart = y === y1 ? m1 : 0;
    const mEnd = y === y2 ? m2 : 11;
    for (let m = mStart; m <= mEnd; m++) {
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      items.forEach((item) => {
        if (item.amount <= 0 || item.dayOfMonth < 1) return;
        const day = Math.min(item.dayOfMonth, daysInMonth);
        const d = new Date(y, m, day);
        if (d >= start && d <= end) total += item.amount;
      });
    }
  }
  return total;
}

function loadSharedCustomExpenseItems(): string[] {
  try {
    const raw = localStorage.getItem(SHARED_CUSTOM_EXPENSE_ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string' && x.trim())) {
        return parsed;
      }
    }
  } catch (_) {}
  return [];
}

const REVENUE_LABELS: Record<RevenueExpenseType, string> = {
  '홀매출_주간': '홀매출 (주간)',
  '홀매출_야간': '홀매출 (야간)',
  '배달매출_주간': '배달매출 (주간)',
  '배달매출_야간': '배달매출 (야간)',
  '홀매출_실입금': '홀매출 (실입금)',
  '배달매출_실입금': '배달매출 (실입금)',
  '고정지출': '고정지출',
  '일반지출': '일반지출',
  '주방지출': '주방지출',
  '주류지출': '주류지출',
  '음료지출': '음료지출',
  '로얄티': '로얄티',
  '급여': '급여',
  '카드수수료': '카드수수료',
  '4대보험료': '4대보험료',
  '마케팅비': '마케팅비',
  '관리비': '관리비',
};

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const ProfitCalculator: React.FC = () => {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // 고정지출 품목: 이름 + 금액 + 매월 나가는 날(일)
  const [fixedExpenseItems, setFixedExpenseItemsState] = useState<FixedExpenseItem[]>(loadFixedExpenseItems);
  const itemsSyncedRef = useRef(false);

  const setFixedExpenseItems = (updater: FixedExpenseItem[] | ((prev: FixedExpenseItem[]) => FixedExpenseItem[])) => {
    setFixedExpenseItemsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveFixedExpenseItems(next);
      saveSetting(SETTINGS_KEY_ITEMS, next);
      return next;
    });
  };
  const [fixedExpenseItemInput, setFixedExpenseItemInput] = useState<string>('');
  const [editingFixedItem, setEditingFixedItem] = useState<string | null>(null);

  // 지급 날짜 관련 상태 (localStorage + 백엔드 동기화)
  const [paymentDates, setPaymentDatesState] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('fixed-expense-payment-dates');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const paymentsSyncedRef = useRef(false);

  const setPaymentDates = (next: Record<string, string>) => {
    setPaymentDatesState(next);
    try { localStorage.setItem('fixed-expense-payment-dates', JSON.stringify(next)); } catch (_) {}
    saveSetting(SETTINGS_KEY_PAYMENTS, next);
  };

  const [showPaymentPicker, setShowPaymentPicker] = useState<Record<string, boolean>>({});

  // 앱 시작 시 백엔드에서 최신 데이터 로드 (다기기 동기화)
  useEffect(() => {
    if (!itemsSyncedRef.current) {
      itemsSyncedRef.current = true;
      fetchSetting<FixedExpenseItem[]>(SETTINGS_KEY_ITEMS).then((serverItems) => {
        if (serverItems && Array.isArray(serverItems) && serverItems.length > 0) {
          setFixedExpenseItemsState(serverItems);
          saveFixedExpenseItems(serverItems);
        }
      });
    }
    if (!paymentsSyncedRef.current) {
      paymentsSyncedRef.current = true;
      fetchSetting<Record<string, string>>(SETTINGS_KEY_PAYMENTS).then((serverPayments) => {
        if (serverPayments && typeof serverPayments === 'object') {
          setPaymentDatesState(serverPayments);
          try { localStorage.setItem('fixed-expense-payment-dates', JSON.stringify(serverPayments)); } catch (_) {}
        }
      });
    }
  }, []);

  // 당일 매출/지출에서 추가한 공유 품목 (지출 항목별 매출 대비 비율에만 표시)
  const [sharedCustomItems] = useState<string[]>(loadSharedCustomExpenseItems);
  const [expenseByCustomMemo, setExpenseByCustomMemo] = useState<Record<string, number>>({});
  // 당일 매출/지출 관리의 실입금 합계 (선택 기간 내)
  const [totalDeposit, setTotalDeposit] = useState<number>(0);

  useEffect(() => {
    fetchSummary();
  }, [startDate, endDate]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      // getSummary 대신 getAll로 직접 집계 (급여·로얄티 누락 + 일반지출 오합산 문제 해결)
      const listRes = await revenueExpenseAPI.getAll({
        start_date: startDate,
        end_date: endDate,
        limit: 500,
      });
      const list: RevenueExpense[] = normalizeList<RevenueExpense>(listRes.data);

      let totalRevenue = 0;
      let totalExpense = 0;
      const expenseByType: Record<string, number> = {};
      const byMemo: Record<string, number> = {};
      sharedCustomItems.forEach((memo) => { byMemo[memo] = 0; });
      let depositSum = 0;

      const REVENUE_TYPES = ['홀매출_주간', '홀매출_야간', '배달매출_주간', '배달매출_야간'];
      const DEPOSIT_TYPES = ['홀매출_실입금', '배달매출_실입금'];
      const TRACKED_EXPENSE_TYPES = [
        '일반지출', '주방지출', '주류지출', '음료지출', '로얄티',
        '급여', '카드수수료', '4대보험료', '마케팅비', '관리비', '고정지출',
      ];

      list.forEach((item) => {
        const amount = Number(item.amount);
        const type = item.type;

        if (REVENUE_TYPES.includes(type)) {
          totalRevenue += amount;
          return;
        }
        if (DEPOSIT_TYPES.includes(type)) {
          depositSum += amount;
          return;
        }
        if (!TRACKED_EXPENSE_TYPES.includes(type)) return;

        totalExpense += amount;

        if (type === '일반지출') {
          // 커스텀 항목(급여 3.3%, 주차권지출 등)은 별도 집계, 일반지출에서 제외
          if (item.memo && sharedCustomItems.includes(item.memo)) {
            byMemo[item.memo] = (byMemo[item.memo] || 0) + amount;
          } else {
            expenseByType['일반지출'] = (expenseByType['일반지출'] || 0) + amount;
          }
        } else {
          expenseByType[type] = (expenseByType[type] || 0) + amount;
        }
      });

      setSummary({
        total_revenue: totalRevenue,
        total_expense: totalExpense,
        net_profit: totalRevenue - totalExpense,
        expense_by_type: expenseByType,
      });
      setExpenseByCustomMemo(byMemo);
      setTotalDeposit(depositSum);
    } catch (err: any) {
      console.error('데이터 로딩 실패:', err);
      setSummary({ total_revenue: 0, total_expense: 0, net_profit: 0, expense_by_type: {} });
      setExpenseByCustomMemo({});
      setTotalDeposit(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFixedExpenseUpdate = (itemName: string, field: 'amount' | 'dayOfMonth', value: number) => {
    setFixedExpenseItems((prev) =>
      prev.map((it) =>
        it.name === itemName
          ? field === 'amount'
            ? { ...it, amount: value }
            : { ...it, dayOfMonth: Math.min(31, Math.max(1, Math.floor(value))) }
          : it
      )
    );
  };

  const handleSaveFixedExpenseItem = (item: FixedExpenseItem) => {
    if (item.amount <= 0) {
      alert('금액을 입력해주세요.');
      return;
    }
    saveFixedExpenseItems(fixedExpenseItems);
    saveSetting(SETTINGS_KEY_ITEMS, fixedExpenseItems);
    alert(`"${item.name}" 저장 완료`);
  };

  const handleAddFixedExpenseItem = () => {
    const trimmed = fixedExpenseItemInput.trim();
    if (trimmed && !fixedExpenseItems.some((i) => i.name === trimmed)) {
      setFixedExpenseItems([...fixedExpenseItems, { name: trimmed, amount: 0, dayOfMonth: 1 }]);
      setFixedExpenseItemInput('');
      setEditingFixedItem(null);
    }
  };

  const handleEditFixedExpenseItem = (oldName: string, newName: string) => {
    if (newName.trim() && newName.trim() !== oldName) {
      setFixedExpenseItems((prev) =>
        prev.map((it) => (it.name === oldName ? { ...it, name: newName.trim() } : it))
      );
    }
    setEditingFixedItem(null);
  };

  const handleDeleteFixedExpenseItem = (item: FixedExpenseItem) => {
    if (window.confirm(`"${item.name}" 품목을 삭제하시겠습니까?`)) {
      setFixedExpenseItems((prev) => prev.filter((i) => i.name !== item.name));
    }
  };

  // 실제 지급일이 선택 기간 내에 있는 항목만 집계 (지급 버튼으로 날짜 찍은 것만)
  const scheduledFixedTotal = React.useMemo(
    () => fixedExpenseItems.reduce((sum, item) => {
      const payDate = paymentDates[item.name];
      if (!payDate) return sum;
      if (payDate >= startDate && payDate <= endDate) return sum + item.amount;
      return sum;
    }, 0),
    [fixedExpenseItems, paymentDates, startDate, endDate]
  );
  const displaySummary = summary
    ? {
        ...summary,
        total_expense: summary.total_expense + scheduledFixedTotal,
        expense_by_type: {
          ...summary.expense_by_type,
          고정지출: (summary.expense_by_type['고정지출'] || 0) + scheduledFixedTotal,
        },
        net_profit: summary.net_profit - scheduledFixedTotal,
      }
    : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  // 입력란 표시용 콤마 포맷
  const fmtInput = (amount: number) => {
    if (!amount) return '';
    return amount.toLocaleString('ko-KR');
  };

  // 지급일 저장
  const savePaymentDate = (itemName: string, date: string) => {
    const next = { ...paymentDates, [itemName]: date };
    setPaymentDates(next);
    setShowPaymentPicker(prev => ({ ...prev, [itemName]: false }));
  };

  // 지급 메시지 계산
  const getPaymentMessage = (item: FixedExpenseItem): { message: string; color: string; bg: string } | null => {
    const dateStr = paymentDates[item.name];
    if (!dateStr) return null;
    const payDate = new Date(dateStr);
    const scheduledDate = new Date(payDate.getFullYear(), payDate.getMonth(), item.dayOfMonth);
    const diffDays = Math.round((payDate.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { message: '정시 지급 ✓', color: '#15803d', bg: '#dcfce7' };
    if (diffDays > 0) return { message: `${diffDays}일 연체 후 지급`, color: '#dc2626', bg: '#fee2e2' };
    return { message: `${Math.abs(diffDays)}일 선지급`, color: '#2563eb', bg: '#dbeafe' };
  };

  const getExpensePercentage = (expenseAmount: number, totalRevenue: number) => {
    if (totalRevenue === 0) return 0;
    return ((expenseAmount / totalRevenue) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">순익계산기</h2>
        </div>

        <div style={{ marginBottom: isMobile ? '1rem' : '1.5rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.4rem' : '0.75rem', justifyContent: 'center' }}>
          {isMobile ? (
            <>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>기간 선택</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '0.9rem', color: '#666', flexShrink: 0 }}>~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <label style={{ fontWeight: 600 }}>기간 선택:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  minWidth: '200px',
                  cursor: 'pointer',
                }}
              />
              <span>~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  minWidth: '200px',
                  cursor: 'pointer',
                }}
              />
            </>
          )}
        </div>

        {/* 고정지출 */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.125rem' }}>고정지출</h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditingFixedItem('NEW')}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
            >
              품목 추가
            </button>
          </div>
          
          {editingFixedItem === 'NEW' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={fixedExpenseItemInput}
                onChange={(e) => setFixedExpenseItemInput(e.target.value)}
                placeholder="새 품목 이름 입력"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAddFixedExpenseItem}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                추가
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditingFixedItem(null);
                  setFixedExpenseItemInput('');
                }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                취소
              </button>
            </div>
          )}
          
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#666' }}>
            금액과 매월 나가는 날(일)을 입력한 뒤 저장하면, 선택한 기간 집계에 매달 해당일에 지출로 반영됩니다.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
            {fixedExpenseItems.map((item) => (
              <div
                key={item.name}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #e0e0e0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* 모바일: 1행 타이틀+삭제·저장·지급 / 2행 금액+매월+일 */}
                {isMobile ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#2c3e50', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {editingFixedItem === item.name ? (
                          <input
                            type="text"
                            defaultValue={item.name}
                            onBlur={(e) => handleEditFixedExpenseItem(item.name, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditFixedExpenseItem(item.name, (e.target as HTMLInputElement).value);
                            }}
                            autoFocus
                            style={{ width: '100%', padding: '0.2rem 0.3rem', border: '1px solid #007bff', borderRadius: '4px', fontSize: '0.8rem' }}
                          />
                        ) : (
                          <span onDoubleClick={() => setEditingFixedItem(item.name)} style={{ cursor: 'pointer' }}>{item.name}</span>
                        )}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                        <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteFixedExpenseItem(item)}
                      style={{ padding: isMobile ? '0.2rem 0.35rem' : '0.25rem 0.45rem', fontSize: isMobile ? '0.7rem' : '0.75rem' }}
                    >
                      삭제
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSaveFixedExpenseItem(item)}
                      style={{ padding: isMobile ? '0.2rem 0.35rem' : '0.25rem 0.5rem', fontSize: isMobile ? '0.7rem' : '0.75rem' }}
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setShowPaymentPicker(prev => ({ ...prev, [item.name]: !prev[item.name] }))}
                      style={{
                        padding: isMobile ? '0.2rem 0.35rem' : '0.25rem 0.5rem',
                        fontSize: isMobile ? '0.7rem' : '0.75rem',
                        backgroundColor: paymentDates[item.name] ? '#7c3aed' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      지급
                    </button>
                    {/* 데스크톱만 1행에 날짜 선택 (모바일은 2행으로) */}
                    {showPaymentPicker[item.name] && !isMobile && (
                      <>
                        <input
                          type="date"
                          defaultValue={paymentDates[item.name] || new Date().toISOString().split('T')[0]}
                          onChange={(e) => e.target.value && savePaymentDate(item.name, e.target.value)}
                          style={{
                            padding: '0.2rem 0.35rem',
                            border: '1px solid #7c3aed',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />
                        {paymentDates[item.name] && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...paymentDates };
                              delete next[item.name];
                              setPaymentDates(next);
                              setShowPaymentPicker(prev => ({ ...prev, [item.name]: false }));
                            }}
                            style={{ fontSize: '0.65rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                          >
                            초기화
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {(() => {
                    const msg = getPaymentMessage(item);
                    if (!msg || showPaymentPicker[item.name]) return null;
                    return (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: isMobile ? '0.65rem' : '0.75rem',
                          color: msg.color,
                          backgroundColor: msg.bg,
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {msg.message}
                      </span>
                    );
                  })()}
                </div>
                {/* 모바일 2행: 금액 원 매월 N일 + 지급날짜 선택 (한 줄 유지, 넘치면 스크롤) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap', minWidth: 0, overflowX: 'auto' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fmtInput(item.amount)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '');
                      handleFixedExpenseUpdate(item.name, 'amount', Number(raw) || 0);
                    }}
                    placeholder="금액"
                    style={{ width: '160px', flexShrink: 0, padding: '0.3rem 0.4rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.8rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#666', flexShrink: 0, marginRight: '0.5rem' }}>원</span>
                  <span style={{ fontSize: '0.75rem', color: '#666', flexShrink: 0 }}>매월</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={item.dayOfMonth}
                    onChange={(e) => handleFixedExpenseUpdate(item.name, 'dayOfMonth', Number(e.target.value) || 1)}
                    style={{ width: '36px', padding: '0.3rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.8rem', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>일</span>
                  {showPaymentPicker[item.name] && (
                    <>
                      <span style={{ fontSize: '0.75rem', color: '#555', flexShrink: 0 }}>실지급:</span>
                      <input
                        type="date"
                        defaultValue={paymentDates[item.name] || new Date().toISOString().split('T')[0]}
                        onChange={(e) => e.target.value && savePaymentDate(item.name, e.target.value)}
                        style={{ padding: '0.2rem 0.35rem', border: '1px solid #7c3aed', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}
                      />
                      {paymentDates[item.name] && (
                        <button type="button" onClick={() => { const next = { ...paymentDates }; delete next[item.name]; setPaymentDates(next); setShowPaymentPicker(prev => ({ ...prev, [item.name]: false })); }} style={{ fontSize: '0.65rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>초기화</button>
                      )}
                    </>
                  )}
                </div>
                  </>
                ) : (
                <>
                {/* 데스크톱 1행: 타이틀 + 삭제·저장·지급 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap', minWidth: 0 }}>
                  <label style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 600, color: '#2c3e50', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {editingFixedItem === item.name ? (
                      <input
                        type="text"
                        defaultValue={item.name}
                        onBlur={(e) => handleEditFixedExpenseItem(item.name, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditFixedExpenseItem(item.name, (e.target as HTMLInputElement).value); }}
                        autoFocus
                        style={{ width: '100%', minWidth: 0, padding: '0.2rem 0.4rem', border: '1px solid #007bff', borderRadius: '4px', fontSize: '0.875rem' }}
                      />
                    ) : (
                      <span onDoubleClick={() => setEditingFixedItem(item.name)} style={{ cursor: 'pointer' }}>{item.name}</span>
                    )}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteFixedExpenseItem(item)} style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem' }}>삭제</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSaveFixedExpenseItem(item)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>저장</button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setShowPaymentPicker(prev => ({ ...prev, [item.name]: !prev[item.name] }))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: paymentDates[item.name] ? '#7c3aed' : '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      지급
                    </button>
                    {showPaymentPicker[item.name] && (
                      <>
                        <input type="date" defaultValue={paymentDates[item.name] || new Date().toISOString().split('T')[0]} onChange={(e) => e.target.value && savePaymentDate(item.name, e.target.value)} style={{ padding: '0.2rem 0.35rem', border: '1px solid #7c3aed', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }} />
                        {paymentDates[item.name] && <button type="button" onClick={() => { const next = { ...paymentDates }; delete next[item.name]; setPaymentDates(next); setShowPaymentPicker(prev => ({ ...prev, [item.name]: false })); }} style={{ fontSize: '0.65rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>초기화</button>}
                      </>
                    )}
                  </div>
                  {(() => { const msg = getPaymentMessage(item); if (!msg || showPaymentPicker[item.name]) return null; return <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: msg.color, backgroundColor: msg.bg, padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{msg.message}</span>; })()}
                </div>
                {/* 데스크톱 2행: [금액] 원 매월 [일] 일 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap', minWidth: 0 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fmtInput(item.amount)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '');
                      handleFixedExpenseUpdate(item.name, 'amount', Number(raw) || 0);
                    }}
                    placeholder="금액"
                    style={{
                      width: isMobile ? '160px' : '220px',
                      flexShrink: 0,
                      padding: isMobile ? '0.3rem 0.4rem' : '0.4rem 0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: isMobile ? '0.8rem' : '0.875rem',
                    }}
                  />
                  <span style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#666', flexShrink: 0, marginRight: '0.5rem' }}>원</span>
                  <span style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#666', flexShrink: 0 }}>매월</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={item.dayOfMonth}
                    onChange={(e) => handleFixedExpenseUpdate(item.name, 'dayOfMonth', Number(e.target.value) || 1)}
                    style={{
                      width: isMobile ? '36px' : '44px',
                      padding: isMobile ? '0.3rem' : '0.4rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: isMobile ? '0.8rem' : '0.875rem',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#666', flexShrink: 0 }}>일</span>
                  {/* 모바일: 지급 날짜 선택을 2행에 배치 (1행 넘어가지 않게) */}
                  {isMobile && showPaymentPicker[item.name] && (
                    <>
                      <span style={{ fontSize: '0.75rem', color: '#555', flexShrink: 0 }}>실지급:</span>
                      <input
                        type="date"
                        defaultValue={paymentDates[item.name] || new Date().toISOString().split('T')[0]}
                        onChange={(e) => e.target.value && savePaymentDate(item.name, e.target.value)}
                        style={{
                          padding: '0.2rem 0.35rem',
                          border: '1px solid #7c3aed',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      />
                      {paymentDates[item.name] && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...paymentDates };
                            delete next[item.name];
                            setPaymentDates(next);
                            setShowPaymentPicker(prev => ({ ...prev, [item.name]: false }));
                          }}
                          style={{ fontSize: '0.65rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                        >
                          초기화
                        </button>
                      )}
                    </>
                  )}
                </div>
                </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 요약 섹션 (고정지출 매월 해당일 합산 포함, 입금액 = 당일 매출/지출 실입금 합계) */}
        {displaySummary && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '1rem', color: '#2c3e50', fontSize: '1.125rem' }}>요약</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>총 매출</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1976d2' }}>
                  {formatCurrency(displaySummary.total_revenue)}원
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#e8eaf6', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>입금액</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#3949ab' }}>
                  {formatCurrency(totalDeposit)}원
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>총 지출</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f57c00' }}>
                  {formatCurrency(displaySummary.total_expense)}원
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: displaySummary.net_profit >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>순이익</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: displaySummary.net_profit >= 0 ? '#2e7d32' : '#c62828' }}>
                  {formatCurrency(displaySummary.net_profit)}원
                </div>
              </div>
            </div>
            
            <div>
              <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#2c3e50' }}>지출 항목별 매출 대비 비율</h4>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '0.75rem' }}>
                {EXPENSE_TYPES.map((type) => {
                  const expenseAmount = displaySummary.expense_by_type[type] || 0;
                  const percentage = getExpensePercentage(expenseAmount, displaySummary.total_revenue);
                  return (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'white', borderRadius: '4px' }}>
                      <span style={{ fontWeight: 500 }}>{REVENUE_LABELS[type]}:</span>
                      <span style={{ color: '#666' }}>
                        {formatCurrency(expenseAmount)}원 ({percentage}%)
                      </span>
                    </div>
                  );
                })}
                {sharedCustomItems.map((memo) => {
                  const expenseAmount = expenseByCustomMemo[memo] || 0;
                  const percentage = getExpensePercentage(expenseAmount, displaySummary.total_revenue);
                  return (
                    <div key={memo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'white', borderRadius: '4px' }}>
                      <span style={{ fontWeight: 500 }}>{memo}:</span>
                      <span style={{ color: '#666' }}>
                        {formatCurrency(expenseAmount)}원 ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfitCalculator;


