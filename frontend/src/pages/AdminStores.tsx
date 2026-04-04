import React, { useCallback, useEffect, useState } from 'react';
import { storeAPI, type StoreOut } from '../api/client';
import './AdminStores.css';

export default function AdminStores() {
  const [stores, setStores] = useState<StoreOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await storeAPI.list({ active_only: false });
      setStores(data);
    } catch {
      setError('지점 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    setError(null);
    try {
      await storeAPI.create({
        name: n,
        code: code.trim() || undefined,
        is_active: true,
      });
      setName('');
      setCode('');
      await load();
    } catch {
      setError('지점 등록에 실패했습니다. 관리자 권한과 입력값을 확인해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: StoreOut) => {
    try {
      await storeAPI.update(row.id, { is_active: !row.is_active });
      await load();
    } catch {
      setError('상태 변경에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="admin-stores-page"><p className="admin-muted">불러오는 중…</p></div>;
  }

  return (
    <div className="admin-stores-page">
      <h1 className="admin-stores-heading">지점 관리</h1>
      <p className="admin-muted">
        새 지점을 등록하거나 비활성화할 수 있습니다. 비활성 지점은 헤더 지점 선택에 나오지 않습니다.
      </p>

      <section className="admin-card">
        <h2 className="admin-card-title">새 지점 등록</h2>
        <form onSubmit={onCreate} className="admin-create-form">
          <input
            type="text"
            placeholder="지점 이름 (필수)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="admin-input"
          />
          <input
            type="text"
            placeholder="코드 (선택)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="admin-input"
          />
          <button type="submit" className="admin-btn primary" disabled={saving || !name.trim()}>
            등록
          </button>
        </form>
      </section>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <section className="admin-card">
        <h2 className="admin-card-title">지점 목록</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>코드</th>
                <th>상태</th>
                <th>등록일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.code ?? '—'}</td>
                  <td>
                    <span className={s.is_active ? 'badge on' : 'badge off'}>
                      {s.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="admin-muted">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleString('ko-KR')
                      : '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn small"
                      onClick={() => toggleActive(s)}
                    >
                      {s.is_active ? '비활성화' : '활성화'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
