import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useWindowWidth } from './hooks/useWindowWidth';
import './App.css';
import Home from './pages/Home';
import EmployeeList from './pages/EmployeeList';
import EmployeeDetail from './pages/EmployeeDetail';
import ScheduleCalendar from './pages/ScheduleCalendar';
import WeeklySchedule from './pages/WeeklySchedule';
import AttendanceList from './pages/AttendanceList';
import PayrollList from './pages/PayrollList';
import DocumentList from './pages/DocumentList';
import IngredientList from './pages/IngredientList';
import CustomerList from './pages/CustomerList';
import ReservationList from './pages/ReservationList';
import RevenueExpenseList from './pages/RevenueExpenseList';
import ProfitCalculator from './pages/ProfitCalculator';
import MenuInput from './pages/MenuInput';
import MenuManager from './pages/MenuManager';
import SalesAnalysis from './pages/SalesAnalysis';
import KitchenDisplay from './pages/KitchenDisplay';
import ServingDisplay from './pages/ServingDisplay';
import Footer from './components/Footer';

const NAV_GROUPS = [
  {
    id: 'employees',
    label: '👥 직원',
    items: [
      { path: '/employees',       label: '직원 관리' },
      { path: '/weekly-schedule', label: '주간 스케줄' },
      { path: '/schedules',       label: '월간 스케줄' },
      { path: '/attendance',      label: '출퇴근' },
      { path: '/payroll',         label: '급여' },
      { path: '/documents',       label: '서류' },
    ],
  },
  {
    id: 'restaurant',
    label: '🍽️ 식당 운영',
    items: [
      { path: '/ingredients',  label: '식자재' },
      { path: '/reservations', label: '예약' },
      { path: '/customers',    label: '고객' },
    ],
  },
  {
    id: 'revenue',
    label: '💰 매출/정산',
    items: [
      { path: '/revenue-expense',    label: '당일 매출/지출관리' },
      { path: '/profit-calculator',  label: '순익계산기' },
      { path: '/sales-analysis',     label: '분석' },
    ],
  },
  {
    id: 'menu',
    label: '📋 메뉴',
    items: [
      { path: '/menu-input',   label: '메뉴입력' },
      { path: '/menu-manager', label: '메뉴관리' },
    ],
  },
];

function Navigation({ isMobile, navOpen, onClose }: { isMobile: boolean; navOpen: boolean; onClose: () => void }) {
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // 라우트 변경 시 드롭다운 닫기, 모바일에서는 메뉴 닫기
  useEffect(() => {
    setOpenGroup(null);
    if (isMobile) onClose();
  }, [location.pathname, isMobile, onClose]);

  // 외부 클릭 시 드롭다운 닫기 (데스크톱)
  useEffect(() => {
    if (isMobile) return;
    const handleOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isMobile]);

  const isGroupActive = (items: { path: string }[]) =>
    items.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'));

  return (
    <>
      {isMobile && navOpen && (
        <div className="nav-backdrop" onClick={onClose} aria-hidden="true" />
      )}
      <nav className={`app-nav${isMobile ? ' app-nav-mobile' : ''}${navOpen ? ' app-nav-open' : ''}`} ref={navRef}>
        {isMobile && (
          <div className="nav-mobile-header">
            <span>메뉴</span>
            <button type="button" className="nav-close-btn" onClick={onClose} aria-label="메뉴 닫기">✕</button>
          </div>
        )}
        <ul className="nav-groups">
          {NAV_GROUPS.map(group => {
            const active = isGroupActive(group.items);
            const open = openGroup === group.id;
            return (
              <li key={group.id} className={`nav-group${open ? ' open' : ''}${active ? ' active' : ''}`}>
                <button
                  className={`nav-group-label${active ? ' active' : ''}`}
                  onClick={() => setOpenGroup(prev => prev === group.id ? null : group.id)}
                >
                  <span>{group.label}</span>
                  <span className="nav-chevron">{open ? '▲' : '▼'}</span>
                </button>
                <ul className="nav-dropdown">
                  {group.items.map(item => (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={location.pathname === item.path ? 'active' : ''}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function App() {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  // 데스크톱으로 전환 시 메뉴 닫기
  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);

  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <Link to="/" className="header-logo-link" title="처음 화면으로">
                <img 
                  src={`${process.env.PUBLIC_URL || ''}/logo.png`} 
                  alt="도원반점 로고" 
                  className="header-logo"
                  onError={(e) => {
                    console.log('로고 이미지를 불러올 수 없습니다. logo.png 파일을 public 폴더에 저장해주세요.');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </Link>
              <div className="header-text">
                <h1>도원반점 검단점</h1>
                <p className="app-subtitle">식당 관리 시스템</p>
              </div>
            </div>
            {isMobile && (
              <button
                type="button"
                className={`nav-hamburger${navOpen ? ' active' : ''}`}
                onClick={() => setNavOpen(v => !v)}
                aria-label={navOpen ? '메뉴 닫기' : '메뉴 열기'}
              >
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </button>
            )}
          </div>
        </header>
        <Navigation isMobile={isMobile} navOpen={navOpen} onClose={closeNav} />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/employees/:id" element={<EmployeeDetail />} />
            <Route path="/weekly-schedule" element={<WeeklySchedule />} />
            <Route path="/schedules" element={<ScheduleCalendar />} />
            <Route path="/attendance" element={<AttendanceList />} />
            <Route path="/payroll" element={<PayrollList />} />
            <Route path="/documents" element={<DocumentList />} />
            <Route path="/ingredients" element={<IngredientList />} />
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/reservations" element={<ReservationList />} />
            <Route path="/revenue-expense" element={<RevenueExpenseList />} />
            <Route path="/menu-input" element={<MenuInput />} />
            <Route path="/menu-manager" element={<MenuManager />} />
            <Route path="/sales-analysis" element={<SalesAnalysis />} />
            <Route path="/profit-calculator" element={<ProfitCalculator />} />
            <Route path="/kds" element={<KitchenDisplay />} />
            <Route path="/serving" element={<ServingDisplay />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
