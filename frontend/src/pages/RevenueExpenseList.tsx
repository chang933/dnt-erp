import React, { useState, useEffect, useMemo } from 'react';
import { revenueExpenseAPI, payrollAPI, employeeAPI, apiClient } from '../api/client';
import { RevenueExpense, RevenueExpenseCreate, RevenueExpenseType } from '../types';
import type { Employee } from '../types';
import { useWindowWidth } from '../hooks/useWindowWidth';

// 매출 입력용 표시 타입 (주/야 구분 없이 홀·배달만, 백엔드 저장은 _주간 사용)
const DISPLAY_REVENUE_TYPES = ['홀매출', '배달매출'] as const;
const BACKEND_REVENUE_TYPES: RevenueExpenseType[] = ['홀매출_주간', '홀매출_야간', '배달매출_주간', '배달매출_야간'];

const EXPENSE_TYPES: RevenueExpenseType[] = [
  '일반지출', '주방지출', '주류지출', '음료지출', '로얄티', '급여', '카드수수료', '4대보험료', '마케팅비', '관리비'
];

// 당일 매출/지출 추가 품목 저장 (순익계산기와 공유)
const SHARED_CUSTOM_EXPENSE_ITEMS_KEY = 'shared-custom-expense-items';
const SETTINGS_KEY_CUSTOM_EXPENSE_ITEMS = 'shared-custom-expense-items';

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
    // 설정 저장 실패 시 로컬 저장만 유지
  }
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

function saveSharedCustomExpenseItems(items: string[]) {
  try {
    localStorage.setItem(SHARED_CUSTOM_EXPENSE_ITEMS_KEY, JSON.stringify(items));
  } catch (_) {}
}

function normalizeCustomExpenseItems(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean);
}

const REVENUE_LABELS: Record<string, string> = {
  '홀매출': '홀매출',
  '배달매출': '배달매출',
  '홀매출_주간': '홀매출',
  '홀매출_야간': '홀매출',
  '배달매출_주간': '배달매출',
  '배달매출_야간': '배달매출',
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

const RevenueExpenseList: React.FC = () => {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [revenueExpenses, setRevenueExpenses] = useState<RevenueExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDailyDetail, setShowDailyDetail] = useState<boolean>(false);
  const [monthlyExpenses, setMonthlyExpenses] = useState<RevenueExpense[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  
  // 입력값 상태
  const [revenueInputs, setRevenueInputs] = useState<Record<string, string>>({});
  const [depositInputs, setDepositInputs] = useState<Record<string, string>>({});
  const [expenseInputs, setExpenseInputs] = useState<Record<string, string>>({});
  
  // 배달매출 카테고리 (상태로 관리, 요기요 아래 인천 이음 포함)
  const [deliveryCategories, setDeliveryCategories] = useState<string[]>(['배달의민족', '쿠팡이츠', '요기요', '인천 이음', '기타']);
  const [newDeliveryCategory, setNewDeliveryCategory] = useState<Record<string, string>>({});
  
  // 편집 중인 카테고리 (배달매출용)
  const [editingDeliveryCategories, setEditingDeliveryCategories] = useState<Record<string, boolean>>({});
  
  // 로얄티 가이드라인 (전달 홀매출+배달매출의 2%, 홀 식권대장 제외)
  const [royaltyGuide, setRoyaltyGuide] = useState<number | null>(null);

  // 누적 집계 (월 1일 ~ 선택일)
  const [cumulativeRevenue, setCumulativeRevenue] = useState<Record<string, number>>({});
  const [cumulativeDeposit, setCumulativeDeposit] = useState<Record<string, number>>({});
  const [cumulativeExpense, setCumulativeExpense] = useState<Record<string, number>>({});

  // 지출 항목 관리 (동적으로 추가 가능, localStorage에 저장·순익계산기와 공유)
  const [customExpenseTypes, setCustomExpenseTypesState] = useState<string[]>(loadSharedCustomExpenseItems);
  const customItemsSyncedRef = React.useRef(false);
  const setCustomExpenseTypes = (updater: string[] | ((prev: string[]) => string[])) => {
    setCustomExpenseTypesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveSharedCustomExpenseItems(next);
      saveSetting(SETTINGS_KEY_CUSTOM_EXPENSE_ITEMS, next);
      return next;
    });
  };
  const [newExpenseType, setNewExpenseType] = useState<string>('');
  const [editingExpenseTypes, setEditingExpenseTypes] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  useEffect(() => {
    if (customItemsSyncedRef.current) return;
    customItemsSyncedRef.current = true;

    const localItems = loadSharedCustomExpenseItems();
    fetchSetting<string[]>(SETTINGS_KEY_CUSTOM_EXPENSE_ITEMS).then((serverItems) => {
      const normalizedServerItems = normalizeCustomExpenseItems(serverItems);
      if (normalizedServerItems.length > 0) {
        setCustomExpenseTypesState(normalizedServerItems);
        saveSharedCustomExpenseItems(normalizedServerItems);
        return;
      }
      if (localItems.length > 0) {
        saveSetting(SETTINGS_KEY_CUSTOM_EXPENSE_ITEMS, localItems);
      }
    });
  }, []);

  // 월별 일간 상세 데이터 로드
  const fetchMonthlyData = async () => {
    try {
      setLoadingMonthly(true);
      const date = new Date(selectedDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      // 해당 월의 첫 날과 마지막 날 계산
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      const listRes = await revenueExpenseAPI.getAll({ start_date: startDate, end_date: endDate });
      setMonthlyExpenses(normalizeList<RevenueExpense>(listRes.data));
    } catch (err: any) {
      console.error('월별 데이터 로딩 실패:', err);
      setMonthlyExpenses([]);
    } finally {
      setLoadingMonthly(false);
    }
  };

  useEffect(() => {
    if (showDailyDetail) {
      fetchMonthlyData();
    }
  }, [showDailyDetail, selectedDate]);

  // 일별 집계 데이터 생성
  const dailyDetailData = useMemo(() => {
    if (!showDailyDetail || monthlyExpenses.length === 0) return {};

    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();

    // 1일부터 마지막 날까지의 데이터 구조 생성
    const dailyData: Record<number, Record<string, number>> = {};
    
    for (let day = 1; day <= lastDay; day++) {
      dailyData[day] = {
        '홀매출': 0,
        '배달매출': 0,
        '일반지출': 0,
        '주방지출': 0,
        '주류지출': 0,
        '음료지출': 0,
        '로얄티': 0,
        '급여': 0,
        '카드수수료': 0,
        '4대보험료': 0,
        '마케팅비': 0,
        '관리비': 0,
      };
    }

    // 커스텀 지출 항목도 포함
    customExpenseTypes.forEach(type => {
      for (let day = 1; day <= lastDay; day++) {
        dailyData[day][type] = 0;
      }
    });

    // 월별 데이터를 일별로 집계
    monthlyExpenses.forEach(item => {
      const itemDate = new Date(item.date);
      const day = itemDate.getDate();
      const key = item.type;

      if (!dailyData[day]) return;

      // 매출 항목 (주/야 합산하여 홀매출·배달매출로)
      if (key === '홀매출_주간' || key === '홀매출_야간') {
        dailyData[day]['홀매출'] = (dailyData[day]['홀매출'] || 0) + item.amount;
      } else if (key === '배달매출_주간' || key === '배달매출_야간') {
        dailyData[day]['배달매출'] = (dailyData[day]['배달매출'] || 0) + item.amount;
      }
      // 지출 항목
      else if (EXPENSE_TYPES.includes(key as RevenueExpenseType)) {
        // 커스텀 지출 항목인 경우 (일반지출 타입이고 memo에 커스텀 항목명이 있는 경우)
        if (key === '일반지출' && item.memo && customExpenseTypes.includes(item.memo)) {
          dailyData[day][item.memo] = (dailyData[day][item.memo] || 0) + item.amount;
        } 
        // 일반지출이고 memo가 없거나 커스텀 항목이 아닌 경우
        else if (key === '일반지출' && (!item.memo || !customExpenseTypes.includes(item.memo))) {
          dailyData[day]['일반지출'] = (dailyData[day]['일반지출'] || 0) + item.amount;
        }
        // 기타 지출 항목
        else if (dailyData[day].hasOwnProperty(key)) {
          dailyData[day][key] = (dailyData[day][key] || 0) + item.amount;
        }
      }
    });

    return dailyData;
  }, [monthlyExpenses, selectedDate, showDailyDetail, customExpenseTypes]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const listRes = await revenueExpenseAPI.getAll({ start_date: selectedDate, end_date: selectedDate });
      const listData = normalizeList<RevenueExpense>(listRes.data);
      setRevenueExpenses(listData);

      // 입력값 초기화 (매출: 홀매출·배달매출만, 배달은 카테고리별)
      const revenueKeys: Record<string, string> = {};
      const expenseKeys: Record<string, string> = {};
      DISPLAY_REVENUE_TYPES.forEach(type => {
        revenueKeys[type] = '';
      });
      revenueKeys['홀매출_식권대장'] = '';
      deliveryCategories.forEach(cat => {
        revenueKeys[`배달매출_${cat}`] = '';
      });
      listData.forEach((item: RevenueExpense) => {
        if (item.type === '홀매출_주간' || item.type === '홀매출_야간') {
          if (item.memo === '식권대장') {
            const cur = Number(revenueKeys['홀매출_식권대장'] || 0) || 0;
            revenueKeys['홀매출_식권대장'] = String(cur + Number(item.amount));
          } else {
            const cur = Number(revenueKeys['홀매출'] || 0) || 0;
            revenueKeys['홀매출'] = String(cur + Number(item.amount));
          }
        }
        if (item.type === '배달매출_주간' || item.type === '배달매출_야간') {
          const k = `배달매출_${item.memo || '기타'}`;
          const cur = Number(revenueKeys[k] || 0) || 0;
          revenueKeys[k] = String(cur + Number(item.amount));
        }
      });
      const depositKeys: Record<string, string> = {};
      DISPLAY_REVENUE_TYPES.forEach(type => {
        depositKeys[type] = '';
      });
      deliveryCategories.forEach(cat => {
        depositKeys[`배달매출_${cat}`] = '';
      });
      listData.forEach((item: RevenueExpense) => {
        if (item.type === '홀매출_실입금') {
          const cur = Number(depositKeys['홀매출'] || 0) || 0;
          depositKeys['홀매출'] = String(cur + Number(item.amount));
        }
        if (item.type === '배달매출_실입금') {
          const k = `배달매출_${item.memo || '기타'}`;
          const cur = Number(depositKeys[k] || 0) || 0;
          depositKeys[k] = String(cur + Number(item.amount));
        }
      });
      EXPENSE_TYPES.forEach(type => {
        expenseKeys[type] = '';
      });

      // 선택일이 월급일인 직원의 급여·공제 자동 반영
      const [y, m, d] = selectedDate.split('-').map(Number);
      const year = y;
      const month = m;
      const selectedDay = d;
      const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

      const getPayDueDate = (hireDateStr: string | undefined): string => {
        if (!hireDateStr) return '';
        const hire = new Date(hireDateStr);
        const hireDay = hire.getDate();
        const payDay = hireDay === 1 ? 28 : hireDay - 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        const safeDay = Math.min(payDay, daysInMonth);
        return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
      };

      try {
        const [payrollRes, employeeRes] = await Promise.all([
          payrollAPI.getByMonth(yearMonth).catch(() => ({ data: [] })),
          employeeAPI.getAll({ limit: 200 }).catch(() => ({ data: [] })),
        ]);
        const payrolls = normalizeList<any>(payrollRes.data);
        const employees = normalizeList<Employee>(employeeRes.data).filter((e: Employee) => e.status === '재직');
        const employeeMap = new Map<number, Employee>();
        employees.forEach((emp: Employee) => employeeMap.set(emp.id, emp));

        let salarySum = 0;
        let deductionSum = 0;

        payrolls.forEach((p: { employee_id: number; net_pay: number; deductions: number; insurance_type?: string }) => {
          const emp = employeeMap.get(p.employee_id);
          if (!emp?.hire_date) return;
          const payDueDate = getPayDueDate(emp.hire_date);
          if (payDueDate !== selectedDate) return;
          salarySum += Number(p.net_pay ?? 0);
          deductionSum += Number(p.deductions ?? 0);
        });

        if (salarySum > 0) expenseKeys['급여'] = String(Math.round(salarySum));
        if (deductionSum > 0) expenseKeys['4대보험료'] = String(Math.round(deductionSum));
      } catch (_) {
        // 급여/직원 조회 실패 시 입력란만 비워둠
      }

      // 전달 매출 조회 → 로얄티 2% 가이드라인 계산 (홀 식권대장 제외)
      try {
        const selDate = new Date(selectedDate);
        const prevYear = selDate.getMonth() === 0 ? selDate.getFullYear() - 1 : selDate.getFullYear();
        const prevMonth = selDate.getMonth() === 0 ? 12 : selDate.getMonth();
        const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
        const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
        const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;
        const prevRes = await revenueExpenseAPI.getAll({ start_date: prevStart, end_date: prevEnd });
        let hallRev = 0;
        let deliveryRev = 0;
        normalizeList<RevenueExpense>(prevRes.data).forEach((item: RevenueExpense) => {
          if (item.type === '홀매출_주간' || item.type === '홀매출_야간') {
            if ((item.memo || '') !== '식권대장') hallRev += Number(item.amount);
          }
          if (item.type === '배달매출_주간' || item.type === '배달매출_야간') {
            deliveryRev += Number(item.amount);
          }
        });
        const guide = Math.round((hallRev + deliveryRev) * 0.02);
        setRoyaltyGuide(guide > 0 ? guide : null);
      } catch (_) {
        setRoyaltyGuide(null);
      }

      // ── 누적 집계 (월 1일 ~ 선택일): 매출·실입금·지출 모두 ──────────────────
      try {
        const selD = new Date(selectedDate);
        const cumStart = `${selD.getFullYear()}-${String(selD.getMonth() + 1).padStart(2, '0')}-01`;
        const cumRes = await revenueExpenseAPI.getAll({ start_date: cumStart, end_date: selectedDate, limit: 1000 });
        const cumRev: Record<string, number> = {};
        const cumDep: Record<string, number> = {};
        const cumExp: Record<string, number> = {};
        normalizeList<RevenueExpense>(cumRes.data).forEach((item: RevenueExpense) => {
          // 매출
          if (item.type === '홀매출_주간' || item.type === '홀매출_야간') {
            if (item.memo === '식권대장') {
              cumRev['홀매출_식권대장'] = (cumRev['홀매출_식권대장'] || 0) + Number(item.amount);
            } else {
              cumRev['홀매출'] = (cumRev['홀매출'] || 0) + Number(item.amount);
            }
          }
          if (item.type === '배달매출_주간' || item.type === '배달매출_야간') {
            const k = `배달매출_${item.memo || '기타'}`;
            cumRev[k] = (cumRev[k] || 0) + Number(item.amount);
          }
          // 실입금
          if (item.type === '홀매출_실입금') {
            cumDep['홀매출'] = (cumDep['홀매출'] || 0) + Number(item.amount);
          }
          if (item.type === '배달매출_실입금') {
            const k = `배달매출_${item.memo || '기타'}`;
            cumDep[k] = (cumDep[k] || 0) + Number(item.amount);
          }
          // 지출
          if (EXPENSE_TYPES.includes(item.type as RevenueExpenseType)) {
            if (item.type === '일반지출' && item.memo && customExpenseTypes.includes(item.memo)) {
              // 커스텀 지출: 등록된 커스텀 항목일 때만 memo를 키로 사용
              cumExp[item.memo] = (cumExp[item.memo] || 0) + Number(item.amount);
            } else {
              cumExp[item.type] = (cumExp[item.type] || 0) + Number(item.amount);
            }
          }
        });
        setCumulativeRevenue(cumRev);
        setCumulativeDeposit(cumDep);
        setCumulativeExpense(cumExp);
      } catch (_) {
        setCumulativeRevenue({});
        setCumulativeDeposit({});
        setCumulativeExpense({});
      }

      setRevenueInputs(revenueKeys);
      setDepositInputs(depositKeys);
      setExpenseInputs(expenseKeys);
    } catch (err: any) {
      console.error('데이터 로딩 실패:', err);
      setRevenueExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRevenueChange = (type: string, category: string | null, value: string) => {
    const key = category ? `${type}_${category}` : type;
    setRevenueInputs(prev => ({ ...prev, [key]: value.replace(/,/g, '') }));
  };

  const handleExpenseChange = (type: RevenueExpenseType, category: string | null, value: string) => {
    const key = category ? `${type}_${category}` : type;
    setExpenseInputs(prev => ({ ...prev, [key]: value.replace(/,/g, '') }));
  };

  const handleDepositChange = (type: string, category: string | null, value: string) => {
    const key = category ? `${type}_${category}` : type;
    setDepositInputs(prev => ({ ...prev, [key]: value.replace(/,/g, '') }));
  };

  const handleSaveDeposit = async (displayType: string, category: string | null = null) => {
    const key = category ? `${displayType}_${category}` : displayType;
    const value = depositInputs[key];
    if (!value || parseFloat(value) <= 0) {
      alert('금액을 입력해주세요.');
      return;
    }
    const backendType: RevenueExpenseType = displayType === '홀매출' ? '홀매출_실입금' : '배달매출_실입금';

    try {
      if (displayType === '홀매출') {
        const toDelete = revenueExpenses.filter((r: RevenueExpense) => r.type === '홀매출_실입금');
        for (const r of toDelete) await revenueExpenseAPI.delete(r.id);
      } else if (displayType === '배달매출' && category) {
        const toDelete = revenueExpenses.filter(
          (r: RevenueExpense) => r.type === '배달매출_실입금' && (r.memo || '') === category
        );
        for (const r of toDelete) await revenueExpenseAPI.delete(r.id);
      }
      const data: RevenueExpenseCreate = {
        date: selectedDate,
        type: backendType,
        amount: parseFloat(value),
        memo: category || '',
      };
      await revenueExpenseAPI.create(data);
      setDepositInputs(prev => ({ ...prev, [key]: '' }));
      await fetchData();
    } catch (err: any) {
      console.error('실입금 저장 실패:', err);
      alert('실입금 저장에 실패했습니다: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSaveRevenue = async (displayType: string, category: string | null = null, memoOverride?: string) => {
    const key = category ? `${displayType}_${category}` : displayType;
    const value = revenueInputs[key];
    if (!value || parseFloat(value) <= 0) {
      alert('금액을 입력해주세요.');
      return;
    }
    const backendType: RevenueExpenseType = displayType === '홀매출' || displayType === '홀매출_식권대장' ? '홀매출_주간' : '배달매출_주간';
    const memo = memoOverride !== undefined ? memoOverride : (category || '');

    try {
      if (displayType === '홀매출') {
        const toDelete = revenueExpenses.filter(
          (r: RevenueExpense) =>
            (r.type === '홀매출_주간' || r.type === '홀매출_야간') && (r.memo || '') === ''
        );
        for (const r of toDelete) await revenueExpenseAPI.delete(r.id);
      } else if (displayType === '홀매출_식권대장') {
        const toDelete = revenueExpenses.filter(
          (r: RevenueExpense) =>
            (r.type === '홀매출_주간' || r.type === '홀매출_야간') && (r.memo || '') === '식권대장'
        );
        for (const r of toDelete) await revenueExpenseAPI.delete(r.id);
      } else if (displayType === '배달매출' && category) {
        const toDelete = revenueExpenses.filter(
          (r: RevenueExpense) =>
            (r.type === '배달매출_주간' || r.type === '배달매출_야간') && (r.memo || '') === category
        );
        for (const r of toDelete) await revenueExpenseAPI.delete(r.id);
      }
      const data: RevenueExpenseCreate = {
        date: selectedDate,
        type: backendType,
        amount: parseFloat(value),
        memo,
      };
      await revenueExpenseAPI.create(data);
      setRevenueInputs(prev => ({ ...prev, [key]: '' }));
      await fetchData();
    } catch (err: any) {
      console.error('매출 저장 실패:', err);
      alert('매출 저장에 실패했습니다: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSaveExpense = async (type: RevenueExpenseType, category: string | null = null) => {
    const key = category ? `${type}_${category}` : type;
    const value = expenseInputs[key];
    if (!value || parseFloat(value) <= 0) {
      alert('금액을 입력해주세요.');
      return;
    }

    try {
      const data: RevenueExpenseCreate = {
        date: selectedDate,
        type,
        amount: parseFloat(value),
        memo: category || '',
      };
      await revenueExpenseAPI.create(data);
      setExpenseInputs(prev => ({ ...prev, [key]: '' }));
      await fetchData();
    } catch (err: any) {
      console.error('지출 저장 실패:', err);
      alert('지출 저장에 실패했습니다: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('삭제하시겠습니까?')) return;

    try {
      await revenueExpenseAPI.delete(id);
      await fetchData();
    } catch (err: any) {
      console.error('삭제 실패:', err);
      alert('삭제에 실패했습니다: ' + (err.response?.data?.detail || err.message));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  // 입력란 표시용 콤마 포맷 (상태는 숫자 문자열로 저장, 표시만 콤마)
  const fmtInput = (v: string) => {
    if (!v) return '';
    const n = parseInt(v.replace(/,/g, ''), 10);
    return isNaN(n) ? '' : n.toLocaleString('ko-KR');
  };

  const handleAddDeliveryCategory = (type: string) => {
    const category = newDeliveryCategory[type];
    if (category && category.trim() && !deliveryCategories.includes(category.trim())) {
      setDeliveryCategories([...deliveryCategories, category.trim()]);
      setNewDeliveryCategory(prev => ({ ...prev, [type]: '' }));
      setEditingDeliveryCategories(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleDeleteDeliveryCategory = (category: string) => {
    if (window.confirm(`"${category}" 카테고리를 삭제하시겠습니까?`)) {
      setDeliveryCategories(deliveryCategories.filter(c => c !== category));
    }
  };

  const handleAddExpenseType = () => {
    if (newExpenseType.trim() && !EXPENSE_TYPES.includes(newExpenseType.trim() as RevenueExpenseType) && !customExpenseTypes.includes(newExpenseType.trim())) {
      setCustomExpenseTypes([...customExpenseTypes, newExpenseType.trim()]);
      setNewExpenseType('');
      setEditingExpenseTypes(false);
    }
  };

  const handleDeleteExpenseType = (expenseType: string) => {
    if (window.confirm(`"${expenseType}" 지출 항목을 삭제하시겠습니까?`)) {
      setCustomExpenseTypes(customExpenseTypes.filter(t => t !== expenseType));
    }
  };


  if (loading) {
    return (
      <div className="card">
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  const getDisplayLabel = (item: RevenueExpense) => {
    if ((item.type === '홀매출_주간' || item.type === '홀매출_야간') && item.memo === '식권대장') {
      return '홀 식권대장 매출';
    }
    if (item.memo) {
      return `${REVENUE_LABELS[item.type]} - ${item.memo}`;
    }
    return REVENUE_LABELS[item.type];
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">당일 매출/지출관리</h2>
        </div>

        <div style={{
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: isMobile ? '0.2rem' : '0.75rem',
          flexWrap: 'nowrap',
          minWidth: 0,
          ...(isMobile && { overflowX: 'auto', paddingBottom: '0.25rem' }),
        }}>
          <label style={{ fontWeight: 600, fontSize: isMobile ? '0.9rem' : '1rem', whiteSpace: 'nowrap', flexShrink: 0 }}>날짜</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: isMobile ? '0.4rem 0.4rem' : '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: isMobile ? '0.9rem' : '1rem',
              minWidth: isMobile ? 0 : '200px',
              width: isMobile ? '137px' : undefined,
              flexShrink: isMobile ? 0 : undefined,
              cursor: 'pointer',
            }}
          />
          <button
            className="btn btn-info"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const newValue = !showDailyDetail;
              setShowDailyDetail(newValue);
            }}
            style={{
              padding: isMobile ? '0.4rem 0.6rem' : '0.5rem 1rem',
              fontSize: isMobile ? '0.85rem' : '0.875rem',
              cursor: 'pointer',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: '1px solid #17a2b8',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {showDailyDetail ? '숨기기' : '일간상세'}
          </button>
        </div>

        {/* 일간상세 섹션 - 매출/지출 입력 섹션 대신 표시 */}
        {showDailyDetail && (
          <div style={{ 
            marginBottom: '2rem', 
            marginTop: '1rem',
            padding: '1.5rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px', 
            border: '2px solid #007bff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.125rem', fontWeight: 600 }}>
                {(() => {
                  const date = new Date(selectedDate);
                  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 일간 상세`;
                })()}
              </h3>
            </div>
            {loadingMonthly ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>데이터를 불러오는 중...</div>
            ) : (
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: '100%', fontSize: '0.875rem', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '80px' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 'auto' }} />
                    {customExpenseTypes.map(() => (
                      <col key={Math.random()} style={{ width: 'auto' }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 10, textAlign: 'center' }}>날짜</th>
                      <th style={{ textAlign: 'center' }}>홀매출</th>
                      <th style={{ textAlign: 'center' }}>배달매출</th>
                      <th style={{ textAlign: 'center' }}>일반지출</th>
                      <th style={{ textAlign: 'center' }}>주방지출</th>
                      <th style={{ textAlign: 'center' }}>주류지출</th>
                      <th style={{ textAlign: 'center' }}>음료지출</th>
                      <th style={{ textAlign: 'center' }}>로얄티</th>
                      <th style={{ textAlign: 'center' }}>급여</th>
                      <th style={{ textAlign: 'center' }}>카드수수료</th>
                      <th style={{ textAlign: 'center' }}>4대보험료</th>
                      <th style={{ textAlign: 'center' }}>마케팅비</th>
                      <th style={{ textAlign: 'center' }}>관리비</th>
                      {customExpenseTypes.map((type) => (
                        <th key={type} style={{ textAlign: 'center' }}>{type}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const date = new Date(selectedDate);
                      const year = date.getFullYear();
                      const month = date.getMonth() + 1;
                      const lastDay = new Date(year, month, 0).getDate();
                      const columns = [
                        '홀매출', '배달매출',
                        '일반지출', '주방지출', '주류지출', '음료지출', '로얄티', '급여',
                        '카드수수료', '4대보험료', '마케팅비', '관리비'
                      ];
                      
                      // 총계 계산
                      const totalData: Record<string, number> = {};
                      columns.forEach(col => {
                        totalData[col] = 0;
                      });
                      customExpenseTypes.forEach(type => {
                        totalData[type] = 0;
                      });
                      
                      for (let day = 1; day <= lastDay; day++) {
                        const dayData = dailyDetailData[day] || {};
                        columns.forEach(col => {
                          totalData[col] = (totalData[col] || 0) + (dayData[col] || 0);
                        });
                        customExpenseTypes.forEach(type => {
                          totalData[type] = (totalData[type] || 0) + (dayData[type] || 0);
                        });
                      }
                      
                      return (
                        <>
                          {/* 총계 행 */}
                          <tr style={{ backgroundColor: '#e8f4f8', fontWeight: 600 }}>
                            <td style={{ position: 'sticky', left: 0, backgroundColor: '#e8f4f8', zIndex: 10, fontWeight: 600, textAlign: 'center' }}>총계</td>
                            {columns.map((col) => (
                              <td key={col} style={{ textAlign: 'right' }}>{formatCurrency(totalData[col] || 0)}원</td>
                            ))}
                            {customExpenseTypes.map((type) => (
                              <td key={type} style={{ textAlign: 'right' }}>{formatCurrency(totalData[type] || 0)}원</td>
                            ))}
                          </tr>
                          {/* 일별 행들 */}
                          {Array.from({ length: lastDay }, (_, i) => {
                            const day = i + 1;
                            const dayData = dailyDetailData[day] || {};
                            return (
                              <tr key={day}>
                                <td style={{ position: 'sticky', left: 0, backgroundColor: 'white', fontWeight: 500, textAlign: 'center' }}>{day}일</td>
                                {columns.map((col) => (
                                  <td key={col} style={{ textAlign: 'right' }}>{formatCurrency(dayData[col] || 0)}원</td>
                                ))}
                                {customExpenseTypes.map((type) => (
                                  <td key={type} style={{ textAlign: 'right' }}>{formatCurrency(dayData[type] || 0)}원</td>
                                ))}
                              </tr>
                            );
                          })}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 매출 입력 섹션 - showDailyDetail이 false일 때만 표시 */}
        {!showDailyDetail && (
          <>
            {/* 매출입력 + 실제입금액 가로 배치 (5:5) */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '2rem', marginBottom: '2rem' }}>
        {/* 매출 입력 섹션 */}
        <div style={{ minWidth: 0, padding: '1rem 1rem 1rem 2rem', backgroundColor: '#fafafa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50', fontSize: '1.125rem' }}>매출 입력</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {DISPLAY_REVENUE_TYPES.map((type) => {
              // 배달매출: 세부 카테고리별 입력
              if (type === '배달매출') {
                const selDay = new Date(selectedDate).getDate();
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <label style={{ fontWeight: 600, color: '#2c3e50', fontSize: '0.9rem' }}>{REVENUE_LABELS[type]}</label>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingDeliveryCategories(prev => ({ ...prev, [type]: !prev[type] }))}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                      >
                        수정/추가
                      </button>
                    </div>
                    <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {deliveryCategories.map((category) => {
                        const key = `${type}_${category}`;
                        const cumVal = cumulativeRevenue[`배달매출_${category}`] || 0;
                        const inputW = isMobile ? 144 : 180;
                        return (
                          <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{
                              display: 'flex',
                              gap: '0.5rem',
                              alignItems: 'center',
                              flexWrap: isMobile ? 'nowrap' : 'wrap',
                              flexDirection: 'row',
                            }}>
                              <label style={{ width: isMobile ? 'auto' : '90px', fontSize: '0.875rem', flexShrink: 0, whiteSpace: 'nowrap' }}>{category}:</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={fmtInput(revenueInputs[key] || '')}
                                onChange={(e) => handleRevenueChange(type, category, e.target.value)}
                                placeholder="금액 입력"
                                style={{
                                  width: `${inputW}px`,
                                  flexShrink: 0,
                                  padding: '0.5rem',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '0.875rem',
                                  ...(isMobile && { marginLeft: 'auto', textAlign: 'right' as const }),
                                }}
                              />
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSaveRevenue(type, category)}
                                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flexShrink: 0 }}
                              >
                                저장
                              </button>
                            </div>
                            {cumVal > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: '#1a6bb5', fontWeight: 600, background: '#e8f4ff', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                                  1~{selDay}일 누적: {formatCurrency(cumVal)}원
                                </span>
                              </div>
                            )}
                            {editingDeliveryCategories[type] && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteDeliveryCategory(category)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {editingDeliveryCategories[type] && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                          <input
                            type="text"
                            value={newDeliveryCategory[type] || ''}
                            onChange={(e) => setNewDeliveryCategory(prev => ({ ...prev, [type]: e.target.value }))}
                            placeholder="새 카테고리 입력 (예: 쿠팡이츠, 요기요)"
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
                            onClick={() => handleAddDeliveryCategory(type)}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                          >
                            추가
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingDeliveryCategories(prev => ({ ...prev, [type]: false }));
                              setNewDeliveryCategory(prev => ({ ...prev, [type]: '' }));
                            }}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                          >
                            취소
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // 홀매출 + 홀 식권대장 매출
              const cumHall = cumulativeRevenue['홀매출'] || 0;
              const cumTicket = cumulativeRevenue['홀매출_식권대장'] || 0;
              const selDay = new Date(selectedDate).getDate();
              const inputWidth = isMobile ? 144 : 180; // 모바일: 20% 축소 (180*0.8)
              return (
                <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.4rem' : '0.5rem' }}>
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    flexWrap: isMobile ? 'nowrap' : 'wrap',
                    flexDirection: 'row',
                  }}>
                    <label style={{ width: isMobile ? 'auto' : '110px', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>{REVENUE_LABELS[type]}:</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtInput(revenueInputs[type] || '')}
                      onChange={(e) => handleRevenueChange(type, null, e.target.value)}
                      placeholder="금액 입력"
                      style={{
                        width: `${inputWidth}px`,
                        flexShrink: 0,
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        ...(isMobile && { marginLeft: 'auto', textAlign: 'right' as const }),
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSaveRevenue(type)}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flexShrink: 0 }}
                    >
                      저장
                    </button>
                  </div>
                  {cumHall > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#1a6bb5', fontWeight: 600, background: '#e8f4ff', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                        1~{selDay}일 누적: {formatCurrency(cumHall)}원
                      </span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    flexWrap: isMobile ? 'nowrap' : 'wrap',
                    flexDirection: 'row',
                  }}>
                    <label style={{ width: isMobile ? 'auto' : '110px', fontWeight: 500, fontSize: '0.875rem', flexShrink: 0, whiteSpace: 'nowrap' }}>식권대장:</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtInput(revenueInputs['홀매출_식권대장'] || '')}
                      onChange={(e) => handleRevenueChange('홀매출_식권대장', null, e.target.value)}
                      placeholder="금액 입력"
                      style={{
                        width: `${inputWidth}px`,
                        flexShrink: 0,
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        ...(isMobile && { marginLeft: 'auto', textAlign: 'right' as const }),
                      }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSaveRevenue('홀매출_식권대장', null, '식권대장')}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flexShrink: 0 }}
                    >
                      저장
                    </button>
                  </div>
                  {cumTicket > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#1a6bb5', fontWeight: 600, background: '#e8f4ff', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                        1~{selDay}일 누적: {formatCurrency(cumTicket)}원
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 실제 입금액 섹션 */}
        <div style={{ minWidth: 0, padding: '1rem 1rem 1rem 2rem', backgroundColor: '#f0f7ff', borderRadius: '8px', border: '1px solid #cce5ff' }}>
          <h3 style={{ marginBottom: '0.25rem', color: '#2c3e50', fontSize: '1.125rem' }}>실제 입금액</h3>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#666' }}>
            선택한 날짜는 입금일입니다. 매출은 당일·실입금은 2~5일 후 들어오므로 날짜를 나눠 정리할 수 있습니다.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                flexWrap: isMobile ? 'nowrap' : 'wrap',
                flexDirection: 'row',
              }}>
                <label style={{ width: isMobile ? 'auto' : '140px', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>홀매출 실 입금액:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fmtInput(depositInputs['홀매출'] || '')}
                  onChange={(e) => handleDepositChange('홀매출', null, e.target.value)}
                  placeholder="금액 입력"
                  style={{
                    width: isMobile ? '144px' : '180px',
                    flexShrink: 0,
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    ...(isMobile && { marginLeft: 'auto', textAlign: 'right' as const }),
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveDeposit('홀매출')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flexShrink: 0 }}
                >
                  저장
                </button>
              </div>
              {(cumulativeDeposit['홀매출'] || 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#0d6a1f', fontWeight: 600, background: '#e6f7ec', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                    1~{new Date(selectedDate).getDate()}일 누적: {formatCurrency(cumulativeDeposit['홀매출'])}원
                  </span>
                </div>
              )}
            </div>
              <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, color: '#2c3e50', fontSize: '0.9rem' }}>배달매출 실 입금액</label>
              </div>
              <div style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {deliveryCategories.map((category) => {
                  const key = `배달매출_${category}`;
                  const cumDepVal = cumulativeDeposit[key] || 0;
                  const depInputW = isMobile ? 144 : 180;
                  return (
                    <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        flexWrap: isMobile ? 'nowrap' : 'wrap',
                        flexDirection: 'row',
                      }}>
                        <label style={{ width: isMobile ? 'auto' : '90px', fontSize: '0.875rem', flexShrink: 0, whiteSpace: 'nowrap' }}>{category}:</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={fmtInput(depositInputs[key] || '')}
                          onChange={(e) => handleDepositChange('배달매출', category, e.target.value)}
                          placeholder="금액 입력"
                          style={{
                            width: `${depInputW}px`,
                            flexShrink: 0,
                            padding: '0.5rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            ...(isMobile && { marginLeft: 'auto', textAlign: 'right' as const }),
                          }}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveDeposit('배달매출', category)}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flexShrink: 0 }}
                        >
                          저장
                        </button>
                      </div>
                      {cumDepVal > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: '#0d6a1f', fontWeight: 600, background: '#e6f7ec', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                            1~{new Date(selectedDate).getDate()}일 누적: {formatCurrency(cumDepVal)}원
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </div>{/* grid 컨테이너 끝 */}

        {/* 지출 입력 섹션 */}
        <div style={{ marginBottom: '2rem', padding: '1rem 1rem 1rem 2rem', backgroundColor: '#fff8f5', borderRadius: '8px', border: '1px solid #ffd5c8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.125rem' }}>지출 입력</h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditingExpenseTypes(!editingExpenseTypes)}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
            >
              수정/추가
            </button>
          </div>
          
          {editingExpenseTypes && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <input
                type="text"
                value={newExpenseType}
                onChange={(e) => setNewExpenseType(e.target.value)}
                placeholder="새 지출 항목 입력"
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
                onClick={handleAddExpenseType}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                추가
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditingExpenseTypes(false);
                  setNewExpenseType('');
                }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                취소
              </button>
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
            {EXPENSE_TYPES.map((type) => {
              const key = type;
              const isRoyalty = type === '로얄티';
              const selDay = new Date(selectedDate).getDate();
              const cumExpVal = cumulativeExpense[type] || 0;
              return (
                <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {/* 로얄티: 가이드라인 배너 */}
                  {isRoyalty && royaltyGuide !== null && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.35rem 0.75rem',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fcd34d',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      color: '#92400e',
                    }}>
                      <span style={{ fontWeight: 600 }}>📌 전달 매출 기준 가이드:</span>
                      <span style={{ fontWeight: 700, color: '#b45309' }}>
                        {formatCurrency(royaltyGuide)}원
                      </span>
                      <span style={{ color: '#a16207' }}>(전달 홀+배달 합계의 2%, 식권대장 제외)</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      flexWrap: isMobile ? 'nowrap' : 'wrap',
                      flexDirection: 'row',
                    }}>
                      <label style={{ width: isMobile ? 'auto' : '100px', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>{REVENUE_LABELS[type]}:</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={fmtInput(expenseInputs[key] || '')}
                        onChange={(e) => handleExpenseChange(type, null, e.target.value)}
                        placeholder={isRoyalty && royaltyGuide !== null ? `가이드: ${formatCurrency(royaltyGuide)}원` : '금액 입력'}
                        style={{
                          width: isMobile ? '144px' : '180px',
                          flexShrink: 0,
                          padding: '0.5rem',
                          border: isRoyalty ? '1px solid #fcd34d' : '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          backgroundColor: isRoyalty ? '#fffef7' : '#fff',
                          ...(isMobile && { marginLeft: 'auto', textAlign: 'right' as const }),
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSaveExpense(type)}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flexShrink: 0 }}
                      >
                        저장
                      </button>
                    </div>
                    {cumExpVal > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: '#7c2d12', fontWeight: 600, background: '#fff0ec', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                          1~{selDay}일 누적: {formatCurrency(cumExpVal)}원
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* 커스텀 지출 항목 */}
            {customExpenseTypes.map((expenseType) => {
              const key = expenseType;
              const selDay = new Date(selectedDate).getDate();
              const cumCustomVal = cumulativeExpense[expenseType] || 0;
              return (
                <div key={expenseType} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    flexWrap: isMobile ? 'nowrap' : 'wrap',
                    flexDirection: 'row',
                  }}>
                    <label style={{ width: isMobile ? 'auto' : '100px', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>{expenseType}:</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtInput(expenseInputs[key] || '')}
                      onChange={(e) => {
                        const inputKey = expenseType;
                        setExpenseInputs(prev => ({ ...prev, [inputKey]: e.target.value.replace(/,/g, '') }));
                      }}
                      placeholder="금액 입력"
                      style={{
                        width: isMobile ? '144px' : '180px',
                        flexShrink: 0,
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        ...(isMobile && { marginLeft: 'auto', textAlign: 'right' as const }),
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        const value = expenseInputs[key];
                        if (!value || parseFloat(value) <= 0) {
                          alert('금액을 입력해주세요.');
                          return;
                        }
                        try {
                          const data: RevenueExpenseCreate = {
                            date: selectedDate,
                            type: '일반지출',
                            amount: parseFloat(value),
                            memo: expenseType,
                          };
                          await revenueExpenseAPI.create(data);
                          setExpenseInputs(prev => ({ ...prev, [key]: '' }));
                          await fetchData();
                        } catch (err: any) {
                          console.error('지출 저장 실패:', err);
                          alert('지출 저장에 실패했습니다: ' + (err.response?.data?.detail || err.message));
                        }
                      }}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flexShrink: 0 }}
                    >
                      저장
                    </button>
                    {editingExpenseTypes && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteExpenseType(expenseType)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  {cumCustomVal > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#7c2d12', fontWeight: 600, background: '#fff0ec', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                        1~{selDay}일 누적: {formatCurrency(cumCustomVal)}원
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 누적 매출/지출 전체 요약 */}
        {(() => {
          const totalCumRev = Object.keys(cumulativeRevenue).reduce((s, k) => s + (cumulativeRevenue[k] || 0), 0);
          const totalCumExp = Object.keys(cumulativeExpense).reduce((s, k) => s + (cumulativeExpense[k] || 0), 0);
          if (totalCumRev === 0 && totalCumExp === 0) return null;
          return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {totalCumRev > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#666' }}>누적 매출 전체</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1976d2', marginLeft: 'auto', textAlign: 'right' }}>
                    {formatCurrency(totalCumRev)}원
                  </span>
                </div>
              )}
              {totalCumExp > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#666' }}>누적 지출 전체</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#f57c00', marginLeft: 'auto', textAlign: 'right' }}>
                    {formatCurrency(totalCumExp)}원
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* 목록 */}
        <div>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50', fontSize: '1.125rem' }}>입력 내역</h3>
          {revenueExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>
              입력된 내역이 없습니다.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>금액</th>
                    <th>메모</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueExpenses.map((item) => (
                    <tr key={item.id}>
                      <td>{getDisplayLabel(item)}</td>
                      <td>{formatCurrency(item.amount)}원</td>
                      <td>{item.memo || '-'}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(item.id)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RevenueExpenseList;
