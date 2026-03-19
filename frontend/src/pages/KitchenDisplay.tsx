/**
 * 주방 KDS (Kitchen Display System) - 파트별 태블릿 화면
 * 해당 파트 주문만 표시, 조리시작/조리완료 버튼
 */
import React, { useState, useEffect } from 'react';
import { orderAPI } from '../api/client';
import { OrderItemType } from '../types';

const PARTS = [
  { id: '면파트',   label: '🍜 면파트' },
  { id: '웍파트',   label: '웍파트' },
  { id: '튀김파트', label: '튀김파트' },
  { id: '떨파트',   label: '떨파트' },
];

function formatWaitingTime(createdAt?: string): string {
  if (!createdAt) return '0:00';
  const sec = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const KitchenDisplay: React.FC = () => {
  const [part, setPart] = useState('면파트');
  const [items, setItems] = useState<OrderItemType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await orderAPI.getByPart(part);
      setItems(normalizeList<OrderItemType>(res.data));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    const t = setInterval(fetchItems, 3000);
    return () => clearInterval(t);
  }, [part]);

  const setPartStatus = async (itemId: number, partState: 'cooking' | 'ready') => {
    try {
      await orderAPI.updateItemStatus(itemId, { part, part_state: partState });
      fetchItems();
    } catch (e) {
      console.error(e);
    }
  };

  const getOrderLabel = (item: OrderItemType): string => {
    const orderNum = item.order_number ?? item.order_id;
    const type = item.order_type === 'takeout' ? '포장' : item.order_type === 'delivery' ? '배달' : `홀 ${item.table_number ?? '-'}번`;
    return `#${String(orderNum).padStart(3, '0')} ${type}`;
  };

  return (
    <div className="page-container">
      <h1 className="page-title">주방 KDS</h1>
      <div className="d-flex gap-2 mb-3 flex-wrap">
        {PARTS.map(p => (
          <button
            key={p.id}
            type="button"
            className={`btn ${part === p.id ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setPart(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="text-muted small mb-2">
        {new Date().toLocaleTimeString('ko-KR')} · {items.length}건
      </div>
      {loading ? (
        <p>로딩 중...</p>
      ) : items.length === 0 ? (
        <p className="text-muted">해당 파트 대기 주문이 없습니다.</p>
      ) : (
        <div className="row g-3">
          {items.map(item => {
            const partStat = item.part_status?.[part] ?? 'pending';
            const otherParts = (item.parts || []).filter(p => p !== part);
            const otherStatus = otherParts.map(p => item.part_status?.[p] ?? 'pending').join(', ');
            const isOver3min = item.created_at && (Date.now() - new Date(item.created_at).getTime()) > 180000;
            return (
              <div key={item.id} className="col-md-4 col-lg-3">
                <div className={`card h-100 ${isOver3min ? 'border-danger' : ''}`}>
                  <div className="card-header d-flex justify-content-between align-items-center py-2">
                    <span className="small fw-bold">{getOrderLabel(item)}</span>
                    <span className={`badge ${isOver3min ? 'bg-danger' : 'bg-secondary'}`}>
                      ⏱ {formatWaitingTime(item.created_at)}
                    </span>
                  </div>
                  <div className="card-body py-2">
                    <div className="fw-bold">{item.menu_name} x{item.quantity}</div>
                    {otherParts.length > 0 && (
                      <div className="small text-muted">({otherParts.join(', ')} {otherStatus})</div>
                    )}
                  </div>
                  <div className="card-footer py-2">
                    {partStat === 'pending' && (
                      <button type="button" className="btn btn-sm btn-success w-100" onClick={() => setPartStatus(item.id, 'cooking')}>
                        조리시작
                      </button>
                    )}
                    {partStat === 'cooking' && (
                      <button type="button" className="btn btn-sm btn-primary w-100" onClick={() => setPartStatus(item.id, 'ready')}>
                        조리완료
                      </button>
                    )}
                    {partStat === 'ready' && (
                      <span className="badge bg-success w-100 py-2">완료</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
