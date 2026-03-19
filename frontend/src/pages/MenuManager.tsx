/**
 * 메뉴관리 - 메뉴 추가/삭제, 주방 파트 지정 (1~2개)
 * 데이터는 localStorage에 저장
 */
import React, { useState, useEffect } from 'react';
import { MenuItem, KitchenPart } from '../types';
import {
  KITCHEN_PARTS,
  MENU_CATEGORIES,
  loadMenuData, saveMenuData,
  loadCourseData,
} from '../data/menuData';
import { useWindowWidth } from '../hooks/useWindowWidth';

// ── 상수 ─────────────────────────────────────────────────────────────────────

const PART_COLORS: Record<string, string> = {
  '면파트':   '#3b82f6',
  '볶음파트': '#f59e0b',
  '튀김파트': '#ef4444',
  '홀파트':   '#8b5cf6',
};

const CATEGORY_COLORS: Record<string, string> = {
  '면류': '#3b82f6', '튀김류': '#f59e0b', '밥류': '#10b981',
  '셋트': '#8b5cf6', '사이드': '#6b7280', '코스': '#ef4444',
};

const NONCOURSE_CATS = MENU_CATEGORIES.filter(c => c !== '코스');

function genId() {
  return 'menu-' + Math.random().toString(36).slice(2, 9);
}

// ── 폼 기본 상태 ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  shortName: '',
  aliases: '',       // 쉼표 구분
  category: '면류' as string,
  parts: [] as KitchenPart[],
  canGop: false,
};

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

const MenuManager: React.FC = () => {
  const [menus, setMenus]         = useState<MenuItem[]>([]);
  const [courses]                 = useState<MenuItem[]>(loadCourseData);
  const [activeTab, setActiveTab] = useState<string>('면류');
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [partError, setPartError] = useState('');
  const isMobile = useWindowWidth() <= 768;

  useEffect(() => { setMenus(loadMenuData()); }, []);

  const save = (next: MenuItem[]) => {
    setMenus(next);
    saveMenuData(next);
  };

  // ── 파트 토글 (최대 4개) ───────────────────────────────────────────────────

  const togglePart = (part: KitchenPart) => {
    setPartError('');
    setForm(f => {
      if (f.parts.includes(part)) {
        return { ...f, parts: f.parts.filter(p => p !== part) };
      }
      if (f.parts.length >= 4) {
        setPartError('파트는 최대 4개까지 선택 가능합니다.');
        return f;
      }
      return { ...f, parts: [...f.parts, part] };
    });
  };

  // ── 메뉴 열기/닫기 ────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, category: activeTab === '코스' ? '면류' : activeTab });
    setPartError('');
    setShowForm(true);
  };

  const openEdit = (menu: MenuItem) => {
    setEditId(menu.id);
    setForm({
      name:      menu.name,
      shortName: menu.shortName ?? '',
      aliases:   menu.aliases.join(', '),
      category:  menu.category,
      parts:     [...menu.parts],
      canGop:    menu.canGop ?? false,
    });
    setPartError('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); };

  // ── 폼 저장 ───────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!form.name.trim()) return alert('메뉴명을 입력하세요');
    if (form.parts.length === 0) { setPartError('파트를 최소 1개 선택하세요'); return; }

    const item: MenuItem = {
      id:        editId ?? genId(),
      name:      form.name.trim(),
      shortName: form.shortName.trim() || form.name.trim(),
      aliases:   form.aliases.split(',').map(s => s.trim()).filter(Boolean),
      category:  form.category,
      parts:     form.parts,
      canGop:    form.canGop,
    };
    if (!item.aliases.length) item.aliases = [item.shortName ?? item.name];

    const next = editId
      ? menus.map(m => m.id === editId ? item : m)
      : [...menus, item];
    save(next);
    closeForm();
  };

  // ── 메뉴 삭제 ─────────────────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    if (!window.confirm('이 메뉴를 삭제할까요?')) return;
    save(menus.filter(m => m.id !== id));
  };

  // ── 현재 탭 메뉴 목록 ─────────────────────────────────────────────────────

  const displayed = activeTab === '코스'
    ? courses
    : menus.filter(m => m.category === activeTab);

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#111827', minHeight: '100vh', color: '#f9fafb', fontFamily: 'system-ui, sans-serif', padding: isMobile ? '0.75rem 0.5rem' : '1rem' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>🍜 메뉴관리</h2>
        {activeTab !== '코스' && (
          <button onClick={openAdd} style={{
            padding: '0.5rem 1.1rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
            background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
          }}>
            + 메뉴 추가
          </button>
        )}
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {MENU_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveTab(cat)} style={{
            padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.85rem',
            background: activeTab === cat ? (CATEGORY_COLORS[cat] ?? '#6366f1') : '#1f2937',
            color: activeTab === cat ? '#fff' : '#9ca3af',
          }}>
            {cat} <span style={{ opacity: 0.7 }}>
              {cat === '코스' ? `(${courses.length})` : `(${menus.filter(m => m.category === cat).length})`}
            </span>
          </button>
        ))}
      </div>

      {/* 메뉴 목록 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.6rem' }}>
        {displayed.length === 0 && (
          <p style={{ color: '#6b7280', gridColumn: '1/-1', padding: '1rem 0' }}>
            {activeTab === '코스' ? '코스 메뉴는 코드에서 관리됩니다.' : '등록된 메뉴가 없습니다. 추가 버튼을 눌러 추가하세요'}
          </p>
        )}
        {displayed.map(menu => (
          <div key={menu.id} style={{
            background: '#1f2937', border: '1px solid #374151', borderRadius: '10px',
            padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem',
          }}>
            {/* 메뉴명 + 액션 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{menu.name}</span>
                {menu.shortName && menu.shortName !== menu.name && (
                  <span style={{ marginLeft: '6px', fontSize: '0.78rem', color: '#9ca3af' }}>({menu.shortName})</span>
                )}
                {menu.canGop && (
                  <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#6ee7b7', background: '#052e16', padding: '1px 5px', borderRadius: '4px' }}>곱빼기</span>
                )}
                {menu.isCourse && (
                  <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#ef4444', background: '#450a0a', padding: '1px 5px', borderRadius: '4px' }}>코스</span>
                )}
              </div>
              {!menu.isCourse && (
                <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                  <button onClick={() => openEdit(menu)} style={{
                    padding: '3px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                    background: '#374151', color: '#d1d5db', fontSize: '0.78rem',
                  }}>수정</button>
                  <button onClick={() => handleDelete(menu.id)} style={{
                    padding: '3px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                    background: '#450a0a', color: '#fca5a5', fontSize: '0.78rem',
                  }}>삭제</button>
                </div>
              )}
            </div>

            {/* 별칭 */}
            {menu.aliases.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                별칭: {menu.aliases.join(' / ')}
              </div>
            )}

            {/* 코스 설명 */}
            {menu.isCourse && menu.courseDesc && (
              <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{menu.courseDesc}</div>
            )}

            {/* 파트 배지 */}
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {menu.isCourse
                ? menu.courseItems?.map(ci =>
                    ci.parts.map(p => (
                      <span key={ci.name + p} style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                        background: PART_COLORS[p] ?? '#374151', color: '#fff', opacity: 0.85,
                      }}>{ci.name} · {p.replace('파트', '')}</span>
                    ))
                  )
                : menu.parts.length > 0
                  ? menu.parts.map(p => (
                      <span key={p} style={{
                        padding: '2px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700,
                        background: PART_COLORS[p] ?? '#374151', color: '#fff',
                      }}>{p.replace('파트', '')}</span>
                    ))
                  : <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>파트 미설정</span>
              }
            </div>
          </div>
        ))}
      </div>

      {/* 메뉴 추가/수정 모달 폼 */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
        }}
          onClick={e => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div style={{
            background: '#1f2937', border: '1px solid #374151', borderRadius: '12px',
            padding: '1.75rem', width: '420px', maxWidth: '95vw', color: '#f9fafb',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 1.2rem', fontSize: '1.05rem', fontWeight: 700 }}>
              {editId ? '메뉴 수정' : '메뉴 추가'}
            </h3>

            {/* 메뉴명 */}
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={labelStyle}>메뉴명 *</label>
              <input
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예) 도원짜장면"
                style={inputStyle}
              />
            </div>

            {/* 별칭 */}
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={labelStyle}>별칭 / 별명 <span style={{ color: '#6b7280', fontWeight: 400 }}>(쉼표로 구분)</span></label>
              <input
                value={form.aliases} onChange={e => setForm(f => ({ ...f, aliases: e.target.value }))}
                placeholder="예) 도짜, 도원짜장"
                style={inputStyle}
              />
            </div>

            {/* 축약명 */}
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={labelStyle}>축약명 <span style={{ color: '#6b7280', fontWeight: 400 }}>(검색 버튼에 표시)</span></label>
              <input
                value={form.shortName} onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))}
                placeholder="예) 도원짜장 (비워두면 메뉴명 사용)"
                style={inputStyle}
              />
            </div>

            {/* 카테고리 */}
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={labelStyle}>카테고리 *</label>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {NONCOURSE_CATS.map(cat => (
                  <button key={cat} type="button" onClick={() => setForm(f => ({ ...f, category: cat }))} style={{
                    padding: '0.35rem 0.9rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
                    background: form.category === cat ? (CATEGORY_COLORS[cat] ?? '#6366f1') : '#374151',
                    color: form.category === cat ? '#fff' : '#9ca3af',
                  }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 파트 선택 */}
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={labelStyle}>
                주방 파트 * <span style={{ color: '#6b7280', fontWeight: 400 }}>(1~4개 선택)</span>
              </label>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {(KITCHEN_PARTS as readonly string[]).map(part => {
                  const selected = form.parts.includes(part as KitchenPart);
                  return (
                    <button key={part} type="button" onClick={() => togglePart(part as KitchenPart)} style={{
                      padding: '0.4rem 0.9rem', borderRadius: '6px', border: selected ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
                      background: selected ? (PART_COLORS[part] ?? '#6366f1') : '#374151',
                      color: selected ? '#fff' : '#9ca3af',
                    }}>
                      {part.replace('파트', '')}
                      {selected && <span style={{ marginLeft: '4px' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              {partError && <p style={{ margin: '0.4rem 0 0', color: '#f87171', fontSize: '0.82rem' }}>{partError}</p>}
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
                선택됨: {form.parts.length === 0 ? '없음' : form.parts.map(p => p.replace('파트', '')).join(' + ')}
              </p>
            </div>

            {/* 곱빼기 */}
            {['면류', '밥류'].includes(form.category) && (
              <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="checkbox" id="canGop" checked={form.canGop}
                  onChange={e => setForm(f => ({ ...f, canGop: e.target.checked }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="canGop" style={{ cursor: 'pointer', fontSize: '0.88rem', color: '#d1d5db' }}>
                  곱빼기 가능 (면류/밥류)
                </label>
              </div>
            )}

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={handleSubmit} style={{
                flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none',
                background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
              }}>
                {editId ? '수정 완료' : '추가'}
              </button>
              <button onClick={closeForm} style={{
                flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none',
                background: '#374151', color: '#9ca3af', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
              }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#d1d5db',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '7px',
  border: '1px solid #4b5563', background: '#374151', color: '#f9fafb',
  fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box',
};

export default MenuManager;
