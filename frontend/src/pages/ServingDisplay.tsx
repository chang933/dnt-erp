/**
 * 홀 서빙 화면 - 픽업 대기(ready) / 진행 중 주문 표시, 서빙완료 처리
 */
import React, { useState, useEffect } from 'react';
import { orderAPI } from '../api/client';
import { OrderItemType } from '../types';

interface GroupedByOrder {
  orderId: number;
  orderNumber: number;
  tableNumber?: number;
  orderType: string;
  items: OrderItemType[];
}

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const ServingDisplay: React.FC = () => {
  const [items, setItems] = useState<OrderItemType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await orderAPI.getServingItems();
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
  }, []);

  const markServed = async (itemId: number) => {
    try {
      await orderAPI.updateItemStatus(itemId, { status: 'served' });
      fetchItems();
    } catch (e) {
      console.error(e);
    }
  };

  const readyItems = items.filter(i => i.status === 'ready');
  const pendingItems = items.filter(i => i.status === 'pending' || i.status === 'cooking');

  const groupByOrder = (list: OrderItemType[]): GroupedByOrder[] => {
    const map = new Map<number, GroupedByOrder>();
    for (const item of list) {
      const orderId = item.order_id;
      const existing = map.get(orderId);
      const orderNum = item.order_number ?? orderId;
      const tableNum = item.table_number;
      const orderType = item.order_type ?? 'dine_in';
      if (!existing) {
        map.set(orderId, { orderId, orderNumber: orderNum, tableNumber: tableNum, orderType, items: [item] });
      } else {
        existing.items.push(item);
      }
    }
    return Array.from(map.values());
  };

  const readyGroups = groupByOrder(readyItems);
  const pendingGroups = groupByOrder(pendingItems);

  const orderLabel = (g: GroupedByOrder): string => {
    const num = `#${String(g.orderNumber).padStart(3, '0')}`;
    if (g.orderType === 'takeout') return `${num} 포장`;
    if (g.orderType === 'delivery') return `${num} 배달`;
    return `${num} 홀 ${g.tableNumber ?? '-'}번 테이블`;
  };

  return (
    <div className="page-container">
      <h1 className="page-title">홀 서빙</h1>
      <div className="text-muted small mb-3">{new Date().toLocaleTimeString('ko-KR')}</div>

      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <>
          <section className="mb-4">
            <h5 className="mb-3">📢 픽업 대기 (조리 완료)</h5>
            {readyGroups.length === 0 ? (
              <p className="text-muted">픽업 대기 주문이 없습니다.</p>
            ) : (
              <div className="row g-3">
                {readyGroups.map(g => (
                  <div key={g.orderId} className="col-12 col-md-6">
                    <div className="card">
                      <div className="card-header fw-bold">{orderLabel(g)}</div>
                      <ul className="list-group list-group-flush">
                        {g.items.map(item => (
                          <li key={item.id} className="list-group-item d-flex justify-content-between align-items-center">
                            <span>✅ {item.menu_name} x{item.quantity}</span>
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => markServed(item.id)}>
                              서빙완료
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <hr />

          <section>
            <h5 className="mb-3">📋 진행 중인 주문</h5>
            {pendingGroups.length === 0 ? (
              <p className="text-muted">진행 중인 주문이 없습니다.</p>
            ) : (
              <ul className="list-group">
                {pendingGroups.map(g => {
                  const statusText = g.items.some(i => i.status === 'cooking') ? '조리중' : '대기중';
                  const partText = g.items.some(i => (i.part_status && Object.values(i.part_status).some(s => s === 'cooking'))) ? '조리중' : '대기중';
                  return (
                    <li key={g.orderId} className="list-group-item d-flex justify-content-between align-items-center">
                      <span>{orderLabel(g)}: {g.items.map(i => `${i.menu_name} x${i.quantity}`).join(', ')}</span>
                      <span className="badge bg-warning text-dark">{partText}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default ServingDisplay;
