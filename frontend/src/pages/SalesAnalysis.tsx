import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { revenueExpenseAPI } from '../api/client';
import { useWindowWidth } from '../hooks/useWindowWidth';

type ViewMode = 'daily' | 'weekly';

type ChartTarget =
  | '홀매출'
  | '배달의민족'
  | '쿠팡이츠'
  | '요기요'
  | '인천이음'
  | '배달플랫폼전체'
  | '전체';

const CHART_TARGETS: { key: ChartTarget; label: string; color: string }[] = [
  { key: '홀매출', label: '홀매출', color: '#4f8ef7' },
  { key: '배달의민족', label: '배달의민족', color: '#3bc97e' },
  { key: '쿠팡이츠', label: '쿠팡이츠', color: '#f7844f' },
  { key: '요기요', label: '요기요', color: '#a855f7' },
  { key: '인천이음', label: '인천이음', color: '#f7c948' },
  { key: '배달플랫폼전체', label: '배달플랫폼 전체', color: '#ef4444' },
  { key: '전체', label: '전체 합계', color: '#2c3e50' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const formatCurrency = (val: number) =>
  val >= 10000
    ? `${(val / 10000).toFixed(1)}만`
    : val.toLocaleString();

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
      padding: '0.75rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <p style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#2c3e50' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color, margin: '0.2rem 0', fontSize: '0.875rem' }}>
          {p.name}: {p.value.toLocaleString()}원
        </p>
      ))}
    </div>
  );
};

export default function SalesAnalysis() {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selected, setSelected] = useState<ChartTarget>('전체');
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [year, month]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      const res = await revenueExpenseAPI.getAll({ start_date: startDate, end_date: endDate, limit: 500 });
      setRawData(normalizeList<any>(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 날짜별 집계
  const dailyData = useMemo(() => {
    const lastDay = new Date(year, month, 0).getDate();
    const map: Record<string, Record<string, number>> = {};
    for (let d = 1; d <= lastDay; d++) {
      const key = `${String(d).padStart(2, '0')}일`;
      map[key] = { 홀매출: 0, 배달의민족: 0, 쿠팡이츠: 0, 요기요: 0, 인천이음: 0 };
    }
    rawData.forEach((item: any) => {
      const d = parseInt(item.date?.split('-')[2] || '0', 10);
      const key = `${String(d).padStart(2, '0')}일`;
      if (!map[key]) return;
      const t = item.type || '';
      if ((t === '홀매출_주간' || t === '홀매출_야간') && (item.memo || '') !== '식권대장') {
        map[key].홀매출 += item.amount || 0;
      } else if (t === '배달매출_주간' || t === '배달매출_야간') {
        const memo = item.memo || '';
        if (memo === '배달의민족') map[key].배달의민족 += item.amount || 0;
        else if (memo === '쿠팡이츠') map[key].쿠팡이츠 += item.amount || 0;
        else if (memo === '요기요') map[key].요기요 += item.amount || 0;
        else if (memo === '인천이음') map[key].인천이음 += item.amount || 0;
      }
    });
    return Object.entries(map).map(([date, vals]) => ({
      date,
      홀매출: vals.홀매출,
      배달의민족: vals.배달의민족,
      쿠팡이츠: vals.쿠팡이츠,
      요기요: vals.요기요,
      인천이음: vals.인천이음,
      배달플랫폼전체: vals.배달의민족 + vals.쿠팡이츠 + vals.요기요 + vals.인천이음,
      전체: vals.홀매출 + vals.배달의민족 + vals.쿠팡이츠 + vals.요기요 + vals.인천이음,
    }));
  }, [rawData, year, month]);

  // 요일별 집계
  const weeklyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    WEEKDAYS.forEach(w => {
      map[w] = { 홀매출: 0, 배달의민족: 0, 쿠팡이츠: 0, 요기요: 0, 인천이음: 0 };
    });
    rawData.forEach((item: any) => {
      if (!item.date) return;
      const dt = new Date(item.date);
      const wd = WEEKDAYS[dt.getDay()];
      const t = item.type || '';
      if ((t === '홀매출_주간' || t === '홀매출_야간') && (item.memo || '') !== '식권대장') {
        map[wd].홀매출 += item.amount || 0;
      } else if (t === '배달매출_주간' || t === '배달매출_야간') {
        const memo = item.memo || '';
        if (memo === '배달의민족') map[wd].배달의민족 += item.amount || 0;
        else if (memo === '쿠팡이츠') map[wd].쿠팡이츠 += item.amount || 0;
        else if (memo === '요기요') map[wd].요기요 += item.amount || 0;
        else if (memo === '인천이음') map[wd].인천이음 += item.amount || 0;
      }
    });
    return WEEKDAYS.map(wd => ({
      date: `${wd}요일`,
      홀매출: map[wd].홀매출,
      배달의민족: map[wd].배달의민족,
      쿠팡이츠: map[wd].쿠팡이츠,
      요기요: map[wd].요기요,
      인천이음: map[wd].인천이음,
      배달플랫폼전체: map[wd].배달의민족 + map[wd].쿠팡이츠 + map[wd].요기요 + map[wd].인천이음,
      전체: map[wd].홀매출 + map[wd].배달의민족 + map[wd].쿠팡이츠 + map[wd].요기요 + map[wd].인천이음,
    }));
  }, [rawData]);

  const chartData = viewMode === 'daily' ? dailyData : weeklyData;
  const targetInfo = CHART_TARGETS.find(t => t.key === selected)!;

  // 선택된 항목의 합계
  const total = chartData.reduce((s, d) => s + (d[selected] || 0), 0);
  const avg = chartData.length > 0 ? Math.round(total / chartData.filter(d => d[selected] > 0).length || 0) : 0;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', color: '#2c3e50', fontSize: '1.5rem', fontWeight: 700 }}>매출 분석</h2>
        <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>월별 매출 데이터를 날짜별·요일별로 시각화합니다.</p>
      </div>

      {/* 연월 선택 */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.95rem' }}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.95rem' }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>

        {/* 뷰 모드 버튼 */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['daily', 'weekly'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '6px',
                border: '2px solid',
                borderColor: viewMode === mode ? '#4f8ef7' : '#ddd',
                background: viewMode === mode ? '#4f8ef7' : '#fff',
                color: viewMode === mode ? '#fff' : '#555',
                fontWeight: viewMode === mode ? 700 : 400,
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.15s',
              }}
            >
              {mode === 'daily' ? '날짜별' : '요일별'}
            </button>
          ))}
        </div>
      </div>

      {/* 항목 선택 버튼 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {CHART_TARGETS.map(t => (
          <button
            key={t.key}
            onClick={() => setSelected(t.key)}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '20px',
              border: '2px solid',
              borderColor: selected === t.key ? t.color : '#e2e8f0',
              background: selected === t.key ? t.color : '#fff',
              color: selected === t.key ? '#fff' : '#555',
              fontWeight: selected === t.key ? 700 : 400,
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: '기간 합계', value: `${total.toLocaleString()}원` },
          { label: viewMode === 'daily' ? '일 평균' : '요일 평균', value: `${avg.toLocaleString()}원` },
          { label: '최고 매출', value: `${Math.max(...chartData.map(d => d[selected] || 0)).toLocaleString()}원` },
        ].map(card => (
          <div key={card.label} style={{
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            background: '#f8faff',
            border: `1px solid ${targetInfo.color}33`,
            borderLeft: `4px solid ${targetInfo.color}`,
          }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#888' }}>{card.label}</p>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: targetInfo.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* 그래프 */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e9ecef',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <h3 style={{ margin: '0 0 1.25rem', color: '#2c3e50', fontSize: '1rem', fontWeight: 600 }}>
          {targetInfo.label} — {viewMode === 'daily' ? '날짜별' : '요일별'} 매출
          <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 400, marginLeft: '0.5rem' }}>
            ({year}년 {month}월)
          </span>
        </h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>데이터 불러오는 중...</div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            {viewMode === 'daily' ? (
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} interval={viewMode === 'daily' ? 1 : 0} />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#666' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={selected} name={targetInfo.label} fill={targetInfo.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 13, fill: '#444', fontWeight: 600 }} />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#666' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={selected} name={targetInfo.label} fill={targetInfo.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* 전체 항목 비교 그래프 */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e9ecef',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        marginTop: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 1.25rem', color: '#2c3e50', fontSize: '1rem', fontWeight: 600 }}>
          전체 항목 비교 — {viewMode === 'daily' ? '날짜별' : '요일별'}
          <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 400, marginLeft: '0.5rem' }}>
            ({year}년 {month}월)
          </span>
        </h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>데이터 불러오는 중...</div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} interval={viewMode === 'daily' ? 1 : 0} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#666' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {CHART_TARGETS.filter(t => t.key !== '배달플랫폼전체' && t.key !== '전체').map(t => (
                <Line
                  key={t.key}
                  type="monotone"
                  dataKey={t.key}
                  name={t.label}
                  stroke={t.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
