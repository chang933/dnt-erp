import React, { useState, useEffect } from 'react';
import { customerAPI } from '../api/client';
import { Customer } from '../types';

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const CustomerList: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    memo: '',
    is_vip: false,
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    try {
      if (!silent) setLoading(true);
      const response = await customerAPI.getAll({ limit: 100 });
      setCustomers(normalizeList<Customer>(response.data));
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
      if (!silent) setCustomers([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await customerAPI.create(formData);
      setShowForm(false);
      setFormData({ name: '', phone: '', memo: '', is_vip: false });
      fetchCustomers({ silent: true });
    } catch (err: any) {
      alert(err.response?.data?.detail || '고객 등록에 실패했습니다.');
    }
  };

  if (loading && customers.length === 0) {
    return (
      <div className="card">
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">고객 관리</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '취소' : '고객 등록'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginTop: '1rem' }}>
          <h3>새 고객 등록</h3>
          <div className="form-group">
            <label className="form-label">이름 *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">연락처</label>
            <input
              type="text"
              className="form-input"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">메모</label>
            <textarea
              className="form-textarea"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.is_vip}
                onChange={(e) => setFormData({ ...formData, is_vip: e.target.checked })}
              />
              {' '}VIP
            </label>
          </div>
          <button type="submit" className="btn btn-primary">
            등록
          </button>
        </form>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>이름</th>
              <th>연락처</th>
              <th>VIP</th>
              <th>블랙리스트</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center">
                  등록된 고객이 없습니다.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>{customer.is_vip ? '✓' : '-'}</td>
                  <td>
                    {customer.is_blacklist ? (
                      <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>블랙리스트</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{customer.memo || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerList;

