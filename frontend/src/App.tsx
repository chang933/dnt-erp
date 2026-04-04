import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useWindowWidth } from './hooks/useWindowWidth';
import { useAuth } from './contexts/AuthContext';
import {
  storeAPI,
  getSelectedStoreId,
  setSelectedStoreId,
  type StoreOut,
} from './api/client';
import './App.css';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminStores from './pages/AdminStores';
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

type NavItem = { path: string; label: string; adminOnly?: boolean };

const NAV_GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: 'employees',
    label: '👥 직원',
    items: [
      { path: '/employees', label: '직원 관리' },
      { path: '/weekly-schedule', label: '주간 스케줄' },
      { path: '/schedules', label: '월간 스케줄' },
      { path: '/attendance', label: '출퇴근' },
      { path: '/payroll', label: '급여' },
      { path: '/documents', label: '서류' },
    ],
  },
  {
    id: 'restaurant',
    label: '🍽️ 식당 운영',
    items: [
      { path: '/ingredients', label: '식자재' },
      { path: '/reservations', label: '예약' },
      { path: '/customers', label: '고객' },
    ],
  },
  {
    id: 'revenue',
    label: '💰 매출/정산',
    items: [
      { path: '/revenue-expense', label: '당일 매출/지출관리' },
      { path: '/profit-calculator', label: '순익계산기' },
      { path: '/sales-analysis', label: '분석' },
    ],
  },
  {
    id: 'menu',
    label: '📋 메뉴',
    items: [
      { path: '/menu-input', label: '메뉴입력' },
      { path: '/menu-manager', label: '메뉴관리' },
    ],
  },
  {
    id: 'admin',
    label: '⚙️ 관리',
    items: [{ path: '/admin/stores', label: '지점 관리', adminOnly: true }],
  },
];

function Navigation({
  isMobile,
  navOpen,
  onClose,
}: {
  isMobile: boolean;
  navOpen: boolean;
  onClose: () => void;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpenGroup(null);
    if (isMobile) onClose();
  }, [location.pathname, isMobile, onClose]);

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
    items.some(
      (item) =>
        location.pathname === item.path || location.pathname.startsWith(item.path + '/')
    );

  return (
    <>
      {isMobile && navOpen && (
        <div className="nav-backdrop" onClick={onClose} aria-hidden="true" />
      )}
      <nav
        className={`app-nav${isMobile ? ' app-nav-mobile' : ''}${navOpen ? ' app-nav-open' : ''}`}
        ref={navRef}
      >
        {isMobile && (
          <div className="nav-mobile-header">
            <span>메뉴</span>
            <button type="button" className="nav-close-btn" onClick={onClose} aria-label="메뉴 닫기">
              ✕
            </button>
          </div>
        )}
        <ul className="nav-groups">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.adminOnly || user?.is_admin);
            if (items.length === 0) return null;
            const active = isGroupActive(items);
            const open = openGroup === group.id;
            return (
              <li key={group.id} className={`nav-group${open ? ' open' : ''}${active ? ' active' : ''}`}>
                <button
                  type="button"
                  className={`nav-group-label${active ? ' active' : ''}`}
                  onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
                >
                  <span>{group.label}</span>
                  <span className="nav-chevron">{open ? '▲' : '▼'}</span>
                </button>
                <ul className="nav-dropdown">
                  {items.map((item) => (
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

function StoreBranchSelect({
  onStoreResolved,
}: {
  onStoreResolved?: (info: { id: number; name: string } | null) => void;
}) {
  const [stores, setStores] = useState<StoreOut[]>([]);
  const [selected, setSelected] = useState(() => getSelectedStoreId());

  useEffect(() => {
    let cancelled = false;
    storeAPI
      .list({ active_only: true })
      .then((res) => {
        if (cancelled) return;
        const list = res.data;
        setStores(list);
        let id = getSelectedStoreId();
        if (list.length > 0 && !list.some((s) => s.id === id)) {
          id = list[0].id;
          setSelectedStoreId(id);
        }
        setSelected(id);
        const row = list.find((s) => s.id === id);
        onStoreResolved?.(row ? { id: row.id, name: row.name } : null);
      })
      .catch(() => {
        if (!cancelled) onStoreResolved?.(null);
      });
    return () => {
      cancelled = true;
    };
  }, [onStoreResolved]);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    if (!Number.isFinite(id)) return;
    setSelectedStoreId(id);
    setSelected(id);
    window.location.reload();
  };

  if (stores.length === 0) {
    return (
      <span className="store-branch-label-text" style={{ opacity: 0.75, fontSize: '0.75rem' }}>
        지점 로딩…
      </span>
    );
  }

  return (
    <label className="store-branch-label">
      <span className="store-branch-label-text">지점</span>
      <select
        className="store-branch-select"
        value={selected}
        onChange={onChange}
        aria-label="운영 지점 선택"
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code ? `${s.name} (${s.code})` : s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function HeaderUserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="header-user-menu">
      <span className="header-username" title={user?.username}>
        {user?.username}
      </span>
      <button
        type="button"
        className="header-logout-btn"
        onClick={() => {
          logout();
          navigate('/login', { replace: true });
        }}
      >
        로그아웃
      </button>
    </div>
  );
}

function AppShell() {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const [navOpen, setNavOpen] = useState(false);
  const [branchSubtitle, setBranchSubtitle] = useState<string | null>(null);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const onStoreResolved = useCallback((info: { id: number; name: string } | null) => {
    setBranchSubtitle(info?.name ?? null);
  }, []);

  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);

  return (
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
                  e.currentTarget.style.display = 'none';
                }}
              />
            </Link>
            <div className="header-text">
              <h1>도원반점</h1>
              <p className="app-subtitle">
                {branchSubtitle ? `${branchSubtitle} · 식당 관리 시스템` : '식당 관리 시스템'}
              </p>
            </div>
          </div>
          <div className="header-actions">
            <StoreBranchSelect onStoreResolved={onStoreResolved} />
            <HeaderUserMenu />
            {isMobile && (
              <button
                type="button"
                className={`nav-hamburger${navOpen ? ' active' : ''}`}
                onClick={() => setNavOpen((v) => !v)}
                aria-label={navOpen ? '메뉴 닫기' : '메뉴 열기'}
              >
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </button>
            )}
          </div>
        </div>
      </header>
      <Navigation isMobile={isMobile} navOpen={navOpen} onClose={closeNav} />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function RequireAuth() {
  const { token, user, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="page-loading">
        <p>불러오는 중…</p>
      </div>
    );
  }
  if (!token || !user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from: from || '/' }} />;
  }
  return <Outlet />;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
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
          <Route
            path="/admin/stores"
            element={
              <AdminOnly>
                <AdminStores />
              </AdminOnly>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
