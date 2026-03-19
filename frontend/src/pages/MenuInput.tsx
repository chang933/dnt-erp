/**
 * 메뉴 입력 POS
 */
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { orderAPI } from '../api/client';
import { MENU_CATEGORIES, GOP_CATEGORIES, loadMenuData, loadCourseData } from '../data/menuData';
import { searchMenu } from '../utils/koreanFuzzySearch';
import { MenuItem } from '../types';
import { useWindowWidth } from '../hooks/useWindowWidth';

interface CartItem {
  cartId: string;
  menu: MenuItem;
  quantity: number;
  unitPrice: number;
  gop: boolean;
  isCourse?: boolean;
  noodleSummary?: string;
  noodleJjajang?: number;
  noodleJjamppong?: number;
  headCount?: number;
}

interface CourseModal {
  menu: MenuItem;
  headCount: number;
  jjajang: number;
  jjamppong: number;
}

const ORDER_TYPES = [
  { value: 'dine_in',  label: '홀',   emoji: '🍽️' },
  { value: 'takeout',  label: '포장', emoji: '🥡' },
  { value: 'delivery', label: '배달', emoji: '🛵' },
] as const;

const CAT_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#6b7280', '#ef4444'];
const getCatColor = (cat: string) => CAT_COLORS[MENU_CATEGORIES.indexOf(cat as any)] ?? '#6366f1';

let cartSeq = 0;
const nextCartId = () => `c${++cartSeq}`;

const MenuInput: React.FC = () => {
  const [search, setSearch]           = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('면류');
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState<number | ''>('');
  const [orderType, setOrderType]     = useState<'dine_in' | 'takeout' | 'delivery'>('dine_in');
  const [suggestions, setSuggestions] = useState<ReturnType<typeof searchMenu>>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [flash, setFlash]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [courseModal, setCourseModal] = useState<CourseModal | null>(null);
  const [allMenus, setAllMenus]       = useState<MenuItem[]>([]);
  const [allCourses, setAllCourses]   = useState<MenuItem[]>([]);
  const [activeMobilePanel, setActiveMobilePanel] = useState<'menu' | 'cart'>('menu');
  const inputRef   = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLUListElement>(null);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;

  useEffect(() => { setAllMenus(loadMenuData()); setAllCourses(loadCourseData()); }, []);

  useEffect(() => {
    if (!search.trim()) { setSuggestions([]); setSelectedIdx(0); return; }
    setSuggestions(searchMenu(search, [...allMenus, ...allCourses], 8));
    setSelectedIdx(0);
  }, [search, allMenus, allCourses]);

  useEffect(() => {
    const el = suggestRef.current?.children[selectedIdx] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx, suggestions]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const addToCart = (menu: MenuItem, qty: number = 1) => {
    if (menu.isCourse) {
      setCourseModal({ menu, headCount: 2, jjajang: 1, jjamppong: 1 });
      setSearch(''); setSuggestions([]); return;
    }
    setCart((prev: CartItem[]): CartItem[] => {
      const existing = prev.find(x => x.menu.id === menu.id && !x.isCourse && !x.gop);
      if (existing) return prev.map(x => x.cartId === existing.cartId ? { ...x, quantity: x.quantity + qty } : x);
      const item: CartItem = { cartId: nextCartId(), menu, quantity: qty, unitPrice: 0, gop: false };
      return [...prev, item];
    });
    setSearch(''); setSuggestions([]);
    inputRef.current?.focus();
  };

  const removeFromCart = (cartId: string) => setCart(prev => prev.filter(x => x.cartId !== cartId));

  const updateQty = (cartId: string, delta: number) => {
    setCart((prev: CartItem[]): CartItem[] =>
      prev.map((x): CartItem => x.cartId === cartId ? { ...x, quantity: x.quantity + delta } : x).filter(x => x.quantity > 0)
    );
  };

  const toggleGop = (cartId: string) => {
    setCart((prev: CartItem[]): CartItem[] =>
      prev.map((x): CartItem => x.cartId === cartId ? { ...x, gop: !x.gop } : x)
    );
  };

  const confirmCourse = () => {
    if (!courseModal) return;
    const { menu, headCount, jjajang, jjamppong } = courseModal;
    if (jjajang + jjamppong !== headCount) {
      alert(`각 면류 합계(${jjajang + jjamppong}명)이 인원수(${headCount}명)와 같아야 합니다.`);
      return;
    }
    const noodleSummary = [jjajang > 0 ? `짜장${jjajang}` : '', jjamppong > 0 ? `짬뽕${jjamppong}` : ''].filter(Boolean).join(' ');
    const newCourse: CartItem = { cartId: nextCartId(), menu, quantity: 1, unitPrice: 0, gop: false, isCourse: true, noodleSummary, noodleJjajang: jjajang, noodleJjamppong: jjamppong, headCount };
    setCart((prev: CartItem[]): CartItem[] => [...prev, newCourse]);
    setCourseModal(null);
    inputRef.current?.focus();
  };

  const submitOrder = async () => {
    if (cart.length === 0) { setFlash({ type: 'err', text: '장바구니가 비어 있습니다.' }); return; }
    if (orderType === 'dine_in' && !tableNumber) { setFlash({ type: 'err', text: '홀 주문은 테이블 번호가 필요합니다.' }); return; }
    setLoading(true);
    try {
      const items: any[] = [];
      for (const ci of cart) {
        if (ci.isCourse && ci.menu.courseItems) {
          const cg = ci.cartId;
          for (const cItem of ci.menu.courseItems) {
            items.push({ menu_id: `${ci.menu.id}_${cItem.name.replace(/\s/g, '')}`, menu_name: `[${ci.menu.name} ${ci.headCount}명] ${cItem.name}`, quantity: 1, unit_price: 0, total_price: 0, parts: cItem.parts, options: `코스:${ci.menu.name},인원:${ci.headCount}`, note: `courseGroup:${cg}` });
          }
          if ((ci.noodleJjajang ?? 0) > 0) items.push({ menu_id: `${ci.menu.id}_jjajang`, menu_name: '[코스] 짜장', quantity: ci.noodleJjajang, unit_price: 0, total_price: 0, parts: ['면파트'], options: `코스:${ci.menu.name},held:true`, note: `courseGroup:${cg}` });
          if ((ci.noodleJjamppong ?? 0) > 0) items.push({ menu_id: `${ci.menu.id}_jjamppong`, menu_name: '[코스] 짬뽕', quantity: ci.noodleJjamppong, unit_price: 0, total_price: 0, parts: ['면파트'], options: `코스:${ci.menu.name},held:true`, note: `courseGroup:${cg}` });
        } else {
          items.push({ menu_id: ci.menu.id, menu_name: ci.gop ? `${ci.menu.name} [곱배기]` : ci.menu.name, quantity: ci.quantity, unit_price: 0, total_price: 0, parts: ci.menu.parts, options: ci.gop ? '곱배기' : '' });
        }
      }
      await orderAPI.create({ table_number: tableNumber === '' ? undefined : Number(tableNumber), order_type: orderType, total_amount: 0, items });
      setCart([]); setTableNumber('');
      setFlash({ type: 'ok', text: '✓ 주문이 완료 KDS에 전송되었습니다!' });
      if (isMobile) setActiveMobilePanel('menu');
    } catch (err: any) {
      setFlash({ type: 'err', text: err.response?.data?.detail || '오류 발생' });
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = suggestions[selectedIdx];
      if (sel) { addToCart(sel.item); return; }
      if (search.trim()) { const r = searchMenu(search, [...allMenus, ...allCourses], 1); if (r.length) addToCart(r[0]!.item); }
    }
    if (e.key === 'Escape') { setSearch(''); setSuggestions([]); }
  };

  const categoryMenus = (activeCategory === '코스' ? allCourses : allMenus).filter(m => m.category === activeCategory);

  const btnStyle = (active: boolean, color: string): React.CSSProperties => ({ padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, background: active ? color : '#374151', color: active ? '#fff' : '#9ca3af', border: 'none' });
  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #4b5563', background: '#374151', color: '#fff', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' };

  const menuPanel = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: isMobile ? 'none' : '1px solid #374151' }}>
      {/* 검색 */}
      <div style={{ padding: '0.75rem', background: '#1f2937', position: 'relative', flexShrink: 0 }}>
        <input ref={inputRef} autoFocus type="text" value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="메뉴 검색 (예: 짜장, 짬뽕면, 탕수, 깐풍기)"
          style={inputStyle}
        />
        {suggestions.length > 0 && (
          <ul ref={suggestRef} style={{ position: 'absolute', top: '100%', left: '0.75rem', right: '0.75rem', background: '#1f2937', border: '1px solid #4b5563', borderRadius: '8px', maxHeight: '260px', overflow: 'auto', zIndex: 100, margin: 0, padding: 0, listStyle: 'none' }}>
            {suggestions.map((s2, i) => (
              <li key={s2.item.id} onClick={() => addToCart(s2.item)} onMouseEnter={() => setSelectedIdx(i)}
                style={{ padding: '0.55rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: i === selectedIdx ? '#374151' : 'transparent', borderBottom: '1px solid #374151' }}>
                <span>
                  <span style={{ fontWeight: 700 }}>{s2.item.name}</span>
                  <span style={{ color: '#9ca3af', fontSize: '0.8rem', marginLeft: '0.5rem' }}>({s2.item.aliases.slice(0, 2).join(', ')})</span>
                  {s2.item.isCourse && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#ef4444', background: '#450a0a', padding: '1px 6px', borderRadius: '4px' }}>코스</span>}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '0.78rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                  {s2.item.parts.map(p => p.replace('파트', '')).join('+')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', background: '#111827', borderBottom: '1px solid #374151', flexShrink: 0, overflowX: 'auto' }}>
        {MENU_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={{
            flex: isMobile ? '0 0 auto' : 1, padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 0', border: 'none', cursor: 'pointer', fontSize: isMobile ? '0.82rem' : '0.88rem', fontWeight: 700, whiteSpace: 'nowrap',
            background: activeCategory === cat ? getCatColor(cat) : 'transparent',
            color: activeCategory === cat ? '#fff' : '#9ca3af',
            borderBottom: activeCategory === cat ? `2px solid ${getCatColor(cat)}` : '2px solid transparent',
          }}>
            {cat}
          </button>
        ))}
      </div>

      {/* 메뉴 버튼 그리드 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(100px, 1fr))' : 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
        {categoryMenus.map(menu => (
          <button key={menu.id} onClick={() => { addToCart(menu); if (isMobile) setActiveMobilePanel('cart'); }}
            style={{ padding: '0.65rem 0.5rem', borderRadius: '8px', border: `1px solid ${getCatColor(menu.category)}`, background: '#1f2937', color: '#f3f4f6', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#374151')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1f2937')}
          >
            <span style={{ fontWeight: 700, fontSize: isMobile ? '0.82rem' : '0.9rem', lineHeight: 1.2 }}>{menu.name}</span>
            {menu.isCourse && menu.courseDesc && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{menu.courseDesc}</span>}
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{menu.parts.map(p => p.replace('파트', '')).join(' + ')}</span>
            {menu.canGop && <span style={{ fontSize: '0.68rem', color: '#6ee7b7' }}>곱배기 가능</span>}
          </button>
        ))}
      </div>
    </div>
  );

  const cartPanel = (
    <div style={{ width: isMobile ? '100%' : '340px', display: 'flex', flexDirection: 'column', background: '#1f2937', flexShrink: 0, flex: isMobile ? 1 : undefined }}>
      {!isMobile && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>현재 주문목록</span>
          <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{cart.length}건</span>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
        {cart.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0', fontSize: '0.9rem' }}>주문을 추가해주세요</p>
        ) : (
          cart.map(item => (
            <div key={item.cartId} style={{ background: '#111827', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '0.4rem', border: '1px solid #374151' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                    {item.isCourse ? `${item.menu.name} ${item.headCount}명` : item.menu.name}
                    {item.gop && <span style={{ marginLeft: '4px', fontSize: '0.75rem', color: '#f97316', background: '#431407', padding: '1px 5px', borderRadius: '4px' }}>곱배기</span>}
                  </span>
                  {item.isCourse && item.noodleSummary && (
                    <div style={{ fontSize: '0.75rem', color: '#6ee7b7', marginTop: '2px' }}>면선택: {item.noodleSummary}</div>
                  )}
                </div>
                <button onClick={() => removeFromCart(item.cartId)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', padding: '0 2px' }}>✕</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.4rem' }}>
                {!item.isCourse && (
                  <>
                    <button onClick={() => updateQty(item.cartId, -1)} style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>−</button>
                    <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.cartId, 1)}  style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>+</button>
                  </>
                )}
                {!item.isCourse && GOP_CATEGORIES.includes(item.menu.category) && (
                  <button onClick={() => toggleGop(item.cartId)} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, background: item.gop ? '#f97316' : '#374151', color: item.gop ? '#fff' : '#9ca3af' }}>
                    {item.gop ? '곱배기' : '보통'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '0.75rem', borderTop: '1px solid #374151', flexShrink: 0 }}>
        <button onClick={submitOrder} disabled={loading || cart.length === 0} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', background: cart.length === 0 ? '#374151' : '#6366f1', color: cart.length === 0 ? '#6b7280' : '#fff', fontWeight: 700, fontSize: '1rem' }}>
          {loading ? '전송 중...' : '주문 완료 KDS 전송'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111827', color: '#f9fafb', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>

      {/* 상단 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: '#1f2937', borderBottom: '1px solid #374151', flexShrink: 0, flexWrap: 'wrap' }}>
        {ORDER_TYPES.map(t => (
          <button key={t.value} onClick={() => setOrderType(t.value)} style={btnStyle(orderType === t.value, '#6366f1')}>
            {t.emoji} {t.label}
          </button>
        ))}
        {orderType === 'dine_in' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>테이블</span>
            <input type="number" min={1} value={tableNumber}
              onChange={e => setTableNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
              style={{ width: '60px', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #4b5563', background: '#374151', color: '#fff', fontSize: '1rem', fontWeight: 700, textAlign: 'center' }}
            />
          </div>
        )}
        <div style={{ flex: 1 }} />
        {flash && (
          <div style={{ padding: '0.3rem 0.9rem', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, background: flash.type === 'ok' ? '#065f46' : '#7f1d1d', color: flash.type === 'ok' ? '#6ee7b7' : '#fca5a5' }}>
            {flash.text}
          </div>
        )}
        {!isMobile && (
          <>
            <Link to="/kds"     style={{ color: '#9ca3af', fontSize: '0.82rem', textDecoration: 'none', padding: '0.3rem 0.7rem', border: '1px solid #374151', borderRadius: '6px' }}>주방 KDS</Link>
            <Link to="/serving" style={{ color: '#9ca3af', fontSize: '0.82rem', textDecoration: 'none', padding: '0.3rem 0.7rem', border: '1px solid #374151', borderRadius: '6px' }}>홀 현황</Link>
          </>
        )}
      </div>

      {/* 모바일 탭 전환 */}
      {isMobile && (
        <div style={{ display: 'flex', background: '#1f2937', borderBottom: '1px solid #374151', flexShrink: 0 }}>
          <button
            onClick={() => setActiveMobilePanel('menu')}
            style={{ flex: 1, padding: '0.6rem', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', background: activeMobilePanel === 'menu' ? '#6366f1' : 'transparent', color: activeMobilePanel === 'menu' ? '#fff' : '#9ca3af', borderBottom: activeMobilePanel === 'menu' ? '2px solid #6366f1' : '2px solid transparent' }}
          >
            🍽 메뉴
          </button>
          <button
            onClick={() => setActiveMobilePanel('cart')}
            style={{ flex: 1, padding: '0.6rem', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', background: activeMobilePanel === 'cart' ? '#6366f1' : 'transparent', color: activeMobilePanel === 'cart' ? '#fff' : '#9ca3af', borderBottom: activeMobilePanel === 'cart' ? '2px solid #6366f1' : '2px solid transparent', position: 'relative' }}
          >
            🛒 장바구니
            {cart.length > 0 && (
              <span style={{ position: 'absolute', top: '6px', right: '20%', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {cart.length}
              </span>
            )}
          </button>
          <Link to="/kds"     style={{ flex: 1, padding: '0.6rem', color: '#9ca3af', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '2px solid transparent' }}>주방KDS</Link>
          <Link to="/serving" style={{ flex: 1, padding: '0.6rem', color: '#9ca3af', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '2px solid transparent' }}>홀현황</Link>
        </div>
      )}

      {/* 본문 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {isMobile ? (
          activeMobilePanel === 'menu' ? menuPanel : cartPanel
        ) : (
          <>
            {menuPanel}
            {cartPanel}
          </>
        )}
      </div>

      {/* 코스 모달 */}
      {courseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={e => { if (e.target === e.currentTarget) setCourseModal(null); }}>
          <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '1.75rem', width: '360px', maxWidth: '95vw', color: '#f9fafb', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', fontWeight: 700 }}>{courseModal.menu.name}</h3>
            {courseModal.menu.courseDesc && <p style={{ margin: '0 0 1.2rem', fontSize: '0.8rem', color: '#9ca3af' }}>{courseModal.menu.courseDesc}</p>}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.88rem', color: '#d1d5db', display: 'block', marginBottom: '0.4rem' }}>인원수</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => { const jj = Math.ceil(n/2); setCourseModal(m => m ? { ...m, headCount: n, jjajang: jj, jjamppong: n-jj } : m); }}
                    style={{ width: '40px', height: '40px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, background: courseModal.headCount === n ? '#6366f1' : '#374151', color: courseModal.headCount === n ? '#fff' : '#9ca3af', fontSize: '0.95rem' }}>{n}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.88rem', color: '#d1d5db', display: 'block', marginBottom: '0.4rem' }}>
                면 선택 (합계 맞추기) 총 {courseModal.headCount}명
                <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: courseModal.jjajang + courseModal.jjamppong === courseModal.headCount ? '#6ee7b7' : '#f87171' }}>
                  짜장{courseModal.jjajang} + 짬뽕{courseModal.jjamppong} = {courseModal.jjajang + courseModal.jjamppong}명
                </span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {(['jjajang', 'jjamppong'] as const).map(key => (
                  <div key={key} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: '0.3rem' }}>{key === 'jjajang' ? '짜장' : '짬뽕'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <button onClick={() => setCourseModal(m => m ? { ...m, [key]: Math.max(0, m[key]-1) } : m)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem' }}>−</button>
                      <span style={{ fontWeight: 700, fontSize: '1.2rem', minWidth: '24px', textAlign: 'center' }}>{courseModal[key]}</span>
                      <button onClick={() => setCourseModal(m => m ? { ...m, [key]: m[key]+1 } : m)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={confirmCourse} disabled={courseModal.jjajang + courseModal.jjamppong !== courseModal.headCount}
                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: courseModal.jjajang + courseModal.jjamppong === courseModal.headCount ? '#6366f1' : '#374151', color: courseModal.jjajang + courseModal.jjamppong === courseModal.headCount ? '#fff' : '#6b7280', fontWeight: 700, cursor: courseModal.jjajang + courseModal.jjamppong === courseModal.headCount ? 'pointer' : 'not-allowed' }}>
                장바구니 추가
              </button>
              <button onClick={() => setCourseModal(null)} style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#374151', color: '#9ca3af', fontWeight: 700, cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuInput;
