import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { employeeAPI, documentAPI } from '../api/client';
import { Employee, EmployeeCreate, Document } from '../types';
import { useWindowWidth } from '../hooks/useWindowWidth';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8001';

type EmploymentFilter = 'ALL' | 'FULL_TIME' | 'PART_TIME' | 'DAILY';

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizeEmployeeList(payload: any): Employee[] {
  return normalizeList<Employee>(payload);
}

/** API 실패 시 사용자에게 보여 줄 본문 + 배포/로컬 안내 */
function describeEmployeeListError(err: any): { message: string; hint: string } {
  const status = err?.response?.status as number | undefined;
  const raw = err?.response?.data?.detail;
  let detail = '';
  if (typeof raw === 'string') detail = raw;
  else if (Array.isArray(raw)) detail = raw.map((x: any) => x?.msg || JSON.stringify(x)).join(' ');
  else if (raw != null) detail = String(raw);

  if (status === 500) {
    return {
      message: detail || '서버 내부 오류(500)',
      hint:
        '배포 사이트에서도 이 메시지가 뜰 수 있습니다. 서버가 꺼진 것이 아니라, 운영 서버에서 예외가 난 경우입니다. Render 대시보드 → Logs에서 원인을 확인하세요. 최근 배포 직후라면 DB에 새 컬럼(예: 일급 필드)이 아직 없을 수 있어, 서버 재시작으로 마이그레이션이 돌았는지 확인해 보세요.',
    };
  }
  if (status === 401) {
    return {
      message: detail || '로그인이 필요합니다',
      hint: '다시 로그인한 뒤 직원 관리를 열어 주세요.',
    };
  }
  if (status === 403) {
    return { message: detail || '접근이 제한된 계정입니다', hint: '관리자 또는 권한이 맞는 계정으로 로그인했는지 확인하세요.' };
  }
  if (!err?.response) {
    return {
      message: err?.message || '네트워크 오류',
      hint: `API 주소: ${API_BASE_URL}. 프론트 빌드의 REACT_APP_API_BASE_URL과 CORS·방화벽을 확인하세요.`,
    };
  }
  return {
    message: detail || err?.message || '직원 목록을 불러오지 못했습니다.',
    hint: '',
  };
}

const EmployeeList: React.FC = () => {
  const { canMutate } = useAuth();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentFilter>('ALL');
  const [formData, setFormData] = useState<EmployeeCreate>({
    name: '',
    phone: '',
    address: '',
    ssn: '',
    birth_date: '',
    gender: '',
    employee_position: '홀',
    employment_type: 'FULL_TIME',
    benefit_type: '4대보험',
    salary_type: '시급',
    hourly_wage: 0,
    monthly_salary: undefined,
    daily_wage_weekday: undefined,
    daily_wage_weekend: undefined,
    daily_contract_hours: undefined,
    hire_date: new Date().toISOString().split('T')[0],
  });
  const [healthCertFile, setHealthCertFile] = useState<File | null>(null);
  const [healthCertIssueDate, setHealthCertIssueDate] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractIssueDate, setContractIssueDate] = useState('');
  const [documentsMap, setDocumentsMap] = useState<Record<number, Document[]>>({});

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const fetchDocuments = async () => {
      if (employees.length === 0) {
        setDocumentsMap({});
        return;
      }
      const idSet = new Set(employees.map((e) => e.id));
      const docsMap: Record<number, Document[]> = {};
      employees.forEach((e) => {
        docsMap[e.id] = [];
      });
      try {
        const response = await documentAPI.getAll();
        const allDocs = normalizeList<Document>(response.data);
        allDocs.forEach((doc: Document) => {
          if (idSet.has(doc.employee_id)) {
            docsMap[doc.employee_id].push(doc);
          }
        });
      } catch (err) {
        console.error('서류 일괄 로딩 에러:', err);
      }
      setDocumentsMap(docsMap);
    };

    if (employees.length > 0) {
      fetchDocuments();
    }
  }, [employees]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('직원 목록 불러오기 시작...');
      const response = await employeeAPI.getAll({ limit: 100 });
      console.log('직원 목록 응답:', response.data);
      setEmployees(normalizeEmployeeList(response.data));
    } catch (err: any) {
      console.error('직원 목록 로딩 에러:', err);
      console.error('에러 상세:', err.response?.data || err.message);
      const { message, hint } = describeEmployeeListError(err);
      setError(hint ? `${message}\n\n${hint}` : message);
      // 에러가 발생해도 빈 배열로 설정하여 UI가 표시되도록 함
      setEmployees([]);
    } finally {
      setLoading(false);
      console.log('직원 목록 로딩 완료');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) return;
    try {
      // 급여 형태에 따라 필드 검증
      if (formData.salary_type === '시급' && (!formData.hourly_wage || formData.hourly_wage <= 0)) {
        alert('시급을 입력해주세요.');
        return;
      }
      if (formData.salary_type === '월급' && (!formData.monthly_salary || formData.monthly_salary <= 0)) {
        alert('월급을 입력해주세요.');
        return;
      }
      if (formData.salary_type === '일급') {
        if (!formData.daily_wage_weekday || formData.daily_wage_weekday <= 0) {
          alert('평일 일급을 입력해주세요.');
          return;
        }
        if (!formData.daily_wage_weekend || formData.daily_wage_weekend <= 0) {
          alert('주말 일급을 입력해주세요.');
          return;
        }
      }
      
      // 직원 등록 (주민번호 포함, 빈 값은 null로 전달해 백엔드가 필드 수신하도록 함)
      const ssnVal = formData.ssn?.trim() || null;
      const createPayload = {
        ...formData,
        ssn: ssnVal,
      };
      const response = await employeeAPI.create(createPayload);
      const employeeId = response.data.id;
      
      // 보건증 업로드
      if (healthCertFile && healthCertIssueDate) {
        const healthCertFormData = new FormData();
        healthCertFormData.append('file', healthCertFile);
        healthCertFormData.append('issue_date', healthCertIssueDate);

        // 만료일 자동 계산 (발급일 + 1년)
        const issueDateObj = new Date(healthCertIssueDate);
        issueDateObj.setFullYear(issueDateObj.getFullYear() + 1);
        const calculatedExpiryDate = issueDateObj.toISOString().split('T')[0];
        healthCertFormData.append('expiry_date', calculatedExpiryDate);
        
        try {
          await fetch(`${API_BASE_URL}/api/v1/employees/${employeeId}/health-certificate`, {
            method: 'POST',
            body: healthCertFormData,
          });
        } catch (err) {
          console.error('보건증 업로드 실패:', err);
        }
      }
      
      // 근로계약서 업로드
      if (contractFile) {
        const contractFormData = new FormData();
        contractFormData.append('file', contractFile);
        if (contractIssueDate) {
          contractFormData.append('issue_date', contractIssueDate);
        }
        
        try {
          await fetch(`${API_BASE_URL}/api/v1/employees/${employeeId}/employment-contract`, {
            method: 'POST',
            body: contractFormData,
          });
        } catch (err) {
          console.error('근로계약서 업로드 실패:', err);
        }
      }
      
      setShowForm(false);
      setFormData({
        name: '',
        phone: '',
        address: '',
        ssn: '',
        birth_date: '',
        gender: '',
        employee_position: '홀',
        employment_type: 'FULL_TIME',
        benefit_type: '4대보험',
        salary_type: '시급',
        hourly_wage: 0,
        monthly_salary: undefined,
        daily_wage_weekday: undefined,
        daily_wage_weekend: undefined,
        daily_contract_hours: undefined,
        hire_date: new Date().toISOString().split('T')[0],
      });
      setHealthCertFile(null);
      setHealthCertIssueDate('');
      setContractFile(null);
      setContractIssueDate('');
      fetchEmployees();
      alert('직원이 성공적으로 등록되었습니다.');
    } catch (err: any) {
      alert(err.response?.data?.detail || '직원 등록에 실패했습니다.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 퇴사 처리하시겠습니까?')) return;
    
    try {
      await employeeAPI.delete(id);
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.detail || '퇴사 처리에 실패했습니다.');
    }
  };

  const filteredEmployees = useMemo(() => {
    const list = employees.filter((e) => {
      const type = (e as any).employment_type;
      if (employmentFilter === 'ALL') return type !== 'DAILY';
      return type === employmentFilter;
    });
    const sortOrder = (e: Employee): number => {
      const pos = e.employee_position;
      const type = (e as any).employment_type;
      const status = e.status === '재직' ? 0 : 1;
      let group = 0;
      if (pos === '홀' && type === 'FULL_TIME') group = 0;
      else if (pos === '홀' && type === 'PART_TIME') group = 1;
      else if (pos === '주방' && type === 'FULL_TIME') group = 2;
      else if (pos === '주방' && type === 'PART_TIME') group = 3;
      else if (pos === '홀' && type === 'DAILY') group = 4;
      else if (pos === '주방' && type === 'DAILY') group = 5;
      else if (pos === '대표') group = 6;
      else if (pos === '사장') group = 7;
      else group = 8;
      return status * 100 + group;
    };
    return [...list].sort((a, b) => sortOrder(a) - sortOrder(b));
  }, [employees, employmentFilter]);

  const filterBtn = (value: EmploymentFilter, label: string) => (
    <button
      type="button"
      key={value}
      onClick={() => setEmploymentFilter(value)}
      className="btn"
      style={{
        padding: '0.4rem 0.75rem',
        fontSize: '0.9rem',
        fontWeight: employmentFilter === value ? 600 : 400,
        backgroundColor: employmentFilter === value ? '#007bff' : '#f0f0f0',
        color: employmentFilter === value ? '#fff' : '#333',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {filterBtn('ALL', '전체')}
          {filterBtn('FULL_TIME', '정직원')}
          {filterBtn('PART_TIME', '파트')}
          {filterBtn('DAILY', '일당')}
        </div>
        <h2 className="card-title" style={{ margin: 0, flex: 1, textAlign: 'center', minWidth: '120px' }}>직원 관리</h2>
        {canMutate && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '0.4rem 1rem' }}
          >
            {showForm ? '취소' : '직원 등록'}
          </button>
        )}
      </div>

      {error && (
        <div className="error" style={{ whiteSpace: 'pre-line' }}>
          <strong>오류</strong>
          <div style={{ marginTop: '0.35rem' }}>{error}</div>
          <small style={{ display: 'block', marginTop: '0.65rem', color: '#5c6c7c' }}>
            API: {API_BASE_URL}
          </small>
          <button type="button" className="btn btn-secondary" onClick={fetchEmployees} style={{ marginTop: '0.65rem' }}>
            다시 시도
          </button>
        </div>
      )}

      {!loading && employees.length > 0 && (() => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const birthdaysThisMonth = employees
          .filter((e) => {
            if (!e.birth_date) return false;
            const b = new Date(e.birth_date);
            return b.getMonth() + 1 === currentMonth;
          })
          .map((e) => ({
            name: e.name,
            month: currentMonth,
            day: new Date(e.birth_date!).getDate(),
          }))
          .sort((a, b) => a.day - b.day);
        if (birthdaysThisMonth.length === 0) return null;
        const text =
          birthdaysThisMonth.length === 1
            ? `이번달은 생일자가 한 분 있는데 ${birthdaysThisMonth[0].name}님 ${birthdaysThisMonth[0].month}월 ${birthdaysThisMonth[0].day}일 생일입니다.`
            : `이번달은 생일자가 ${birthdaysThisMonth.length}명 있는데 ${birthdaysThisMonth.map((b) => `${b.name}님 ${b.month}월 ${b.day}일 생일`).join(', ')}입니다.`;
        return (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem 1.25rem',
              backgroundColor: '#fff8e6',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              fontSize: '0.95rem',
              color: '#856404',
            }}
          >
            🎂 {text}
          </div>
        );
      })()}

      {loading && employees.length === 0 && !error && (
        <div className="loading">데이터를 불러오는 중...</div>
      )}

      {showForm && canMutate && (
        <form onSubmit={handleSubmit} className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>새 직원 등록</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
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
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">주소</label>
              <input
                type="text"
                className="form-input"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">주민등록번호</label>
              <input
                type="text"
                className="form-input"
                placeholder="000000-0000000"
                value={formData.ssn || ''}
                onChange={(e) => setFormData({ ...formData, ssn: e.target.value })}
                maxLength={14}
              />
            </div>
            <div className="form-group">
              <label className="form-label">생년월일</label>
              <input
                type="date"
                className="form-input"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">성별</label>
              <select
                className="form-select"
                value={(formData as any).gender || ''}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value } as any)}
              >
                <option value="">선택하세요</option>
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">직위 *</label>
              <select
                className="form-select"
                value={formData.employee_position}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    employee_position: e.target.value as '홀' | '주방' | '대표' | '사장',
                  })
                }
                required
              >
                <option value="홀">홀</option>
                <option value="주방">주방</option>
                <option value="대표">대표</option>
                <option value="사장">사장</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">급여 형태 *</label>
              <select
                className="form-select"
                value={(formData as any).benefit_type || '4대보험'}
                onChange={(e) =>
                  setFormData({
                    ...(formData as any),
                    benefit_type: e.target.value as '4대보험' | '3.3% 프리랜서',
                  })
                }
              >
                <option value="4대보험">4대보험 근로자</option>
                <option value="3.3% 프리랜서">3.3% 프리랜서</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">구분 *</label>
              <select
                className="form-select"
                value={(formData as any).employment_type || 'FULL_TIME'}
                onChange={(e) =>
                  setFormData({
                    ...(formData as any),
                    employment_type: e.target.value as 'FULL_TIME' | 'PART_TIME' | 'DAILY',
                  })
                }
                required
              >
                <option value="FULL_TIME">정직원</option>
                <option value="PART_TIME">파트</option>
                <option value="DAILY">일당</option>
              </select>
            </div>
          <div className="form-group">
            <label className="form-label">급여 형태 *</label>
            <select
              className="form-select"
              value={formData.salary_type}
              onChange={(e) => {
                const salaryType = e.target.value as '시급' | '월급' | '일급';
                setFormData({
                  ...formData,
                  salary_type: salaryType,
                  hourly_wage: salaryType === '시급' ? (formData.hourly_wage || 0) : undefined,
                  monthly_salary: salaryType === '월급' ? (formData.monthly_salary || 0) : undefined,
                  daily_wage_weekday: salaryType === '일급' ? formData.daily_wage_weekday : undefined,
                  daily_wage_weekend: salaryType === '일급' ? formData.daily_wage_weekend : undefined,
                  daily_contract_hours: salaryType === '시급' ? formData.daily_contract_hours : undefined,
                });
              }}
              required
            >
              <option value="시급">시급</option>
              <option value="월급">월급</option>
              <option value="일급">일급</option>
            </select>
          </div>
          {formData.salary_type === '시급' && (
            <div className="form-group">
              <label className="form-label">시급 *</label>
              <input
                type="number"
                className="form-input"
                value={formData.hourly_wage || ''}
                onChange={(e) => setFormData({ ...formData, hourly_wage: Number(e.target.value) })}
                required
                min="0"
              />
            </div>
          )}
          {formData.salary_type === '월급' && (
            <div className="form-group">
              <label className="form-label">월급 *</label>
              <input
                type="number"
                className="form-input"
                value={formData.monthly_salary || ''}
                onChange={(e) => setFormData({ ...formData, monthly_salary: Number(e.target.value) })}
                required
                min="0"
              />
            </div>
          )}
          {formData.salary_type === '일급' && (
            <>
              <div className="form-group">
                <label className="form-label">평일 일급 (월~금 출근) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.daily_wage_weekday ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, daily_wage_weekday: e.target.value ? Number(e.target.value) : undefined })
                  }
                  required
                  min="0"
                  placeholder="예: 180000"
                />
              </div>
              <div className="form-group">
                <label className="form-label">주말 일급 (토·일 출근) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.daily_wage_weekend ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, daily_wage_weekend: e.target.value ? Number(e.target.value) : undefined })
                  }
                  required
                  min="0"
                  placeholder="예: 200000"
                />
              </div>
              <p className="form-hint" style={{ gridColumn: '1 / -1', fontSize: '0.85rem', color: '#666', margin: 0 }}>
                급여 명세는 주간 스케줄의 출근일 기준으로 평일·주말 일급을 합산합니다.
              </p>
            </>
          )}
          {formData.salary_type === '시급' && (
            <div className="form-group">
              <label className="form-label">일 근무 계약시간 (시간)</label>
              <input
                type="number"
                className="form-input"
                placeholder="예: 3, 4, 5"
                value={(formData as any).daily_contract_hours ?? ''}
                onChange={(e) => setFormData({ ...formData, daily_contract_hours: e.target.value ? Number(e.target.value) : undefined } as any)}
                min="0.5"
                max="24"
                step="0.5"
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">입사일 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.hire_date}
              onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
              required
            />
          </div>
          </div>
          
          <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />
          
          <h4 style={{ marginBottom: '1rem' }}>서류 업로드 (선택사항)</h4>
          
          <div className="form-group">
            <label className="form-label">보건증 사진</label>
            <input
              type="file"
              accept="image/*"
              className="form-input"
              onChange={(e) => setHealthCertFile(e.target.files?.[0] || null)}
            />
            {healthCertFile && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                선택된 파일: {healthCertFile.name}
              </div>
            )}
            <div style={{ marginTop: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>발급일 (만료일은 자동으로 1년 후로 설정됩니다)</label>
              <input
                type="date"
                className="form-input"
                value={healthCertIssueDate}
                onChange={(e) => setHealthCertIssueDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">근로계약서 사진</label>
            <input
              type="file"
              accept="image/*"
              className="form-input"
              onChange={(e) => setContractFile(e.target.files?.[0] || null)}
            />
            {contractFile && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                선택된 파일: {contractFile.name}
              </div>
            )}
            <div style={{ marginTop: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>계약일</label>
              <input
                type="date"
                className="form-input"
                value={contractIssueDate}
                onChange={(e) => setContractIssueDate(e.target.value)}
              />
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary">
              등록
            </button>
          </div>
        </form>
      )}

      {!loading && employees.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#7f8c8d' }}>
          등록된 직원이 없습니다.
        </div>
      )}

      {!loading && employees.length > 0 && filteredEmployees.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#7f8c8d' }}>
          선택한 구분에 해당하는 직원이 없습니다.
        </div>
      )}

      {!loading && employees.length > 0 && filteredEmployees.length > 0 && (
        <div className="employee-grid" style={{ marginTop: '1.5rem' }}>
          {filteredEmployees.map(employee => {
            const getBirthdayAlert = () => {
              if (!employee.birth_date) return null;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const birthDate = new Date(employee.birth_date);
              
              let upcomingBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
              
              if (upcomingBirthday < today) {
                upcomingBirthday.setFullYear(today.getFullYear() + 1);
              }
              
              const diffTime = upcomingBirthday.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays >= 0 && diffDays <= 3) {
                if (diffDays === 0) {
                  return '🎂 오늘 생일입니다!';
                } else if (diffDays === 1) {
                  return '🎂 생일 1일 전입니다';
                } else if (diffDays === 2) {
                  return '🎂 생일 2일 전입니다';
                } else if (diffDays === 3) {
                  return '🎂 생일 3일 전입니다';
                }
              }
              return null;
            };

            const getHealthCertAlert = () => {
              const documents = documentsMap[employee.id] || [];
              const healthCert = documents.find((doc: Document) => doc.document_type === '보건증' && doc.expiry_date);
              
              if (!healthCert || !healthCert.expiry_date) return { message: null, daysLeft: null };
              
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const expiryDate = new Date(healthCert.expiry_date);
              expiryDate.setHours(0, 0, 0, 0);
              
              const diffTime = expiryDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays >= 0 && diffDays <= 14) {
                return { message: `🏥 보건증 만료일이 ${diffDays}일 남았습니다`, daysLeft: diffDays };
              }
              return { message: null, daysLeft: null };
            };

            const birthdayAlert = getBirthdayAlert();
            const healthCertAlert = getHealthCertAlert();

            return (
              <Link
                key={employee.id}
                to={`/employees/${employee.id}`}
                className="employee-card"
              >
                <div className="employee-card-info">
                  <h3 className="employee-card-name">{employee.name}</h3>
                  <p className="employee-card-phone">
                    {employee.phone ? `📞 ${employee.phone}` : '연락처 없음'}
                  </p>
                  <p className="employee-card-date">
                    입사일: {employee.hire_date}
                  </p>
                  {birthdayAlert && (
                    <div style={{ 
                      marginTop: '0.5rem', 
                      padding: '0.25rem 0.5rem', 
                      backgroundColor: '#fff3cd', 
                      color: '#856404',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }}>
                      {birthdayAlert}
                    </div>
                  )}
                  {healthCertAlert.message && (
                    <div style={{ 
                      marginTop: '0.5rem', 
                      padding: '0.25rem 0.5rem', 
                      backgroundColor: healthCertAlert.daysLeft !== null && healthCertAlert.daysLeft <= 7 ? '#f8d7da' : '#d1ecf1', 
                      color: healthCertAlert.daysLeft !== null && healthCertAlert.daysLeft <= 7 ? '#721c24' : '#0c5460',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }}>
                      {healthCertAlert.message}
                    </div>
                  )}
                  <div className="employee-card-meta" style={{ marginTop: '0.75rem' }}>
                    {(() => {
                      const et = (employee as any).employment_type;
                      const typeLabel = et === 'DAILY' ? '일당' : et === 'PART_TIME' ? '파트' : '정직원';
                      const typeClass = et === 'DAILY' ? 'employment-daily' : et === 'PART_TIME' ? 'employment-part' : 'employment-full';
                      return (
                        <span className={`employee-badge ${typeClass}`} style={{ marginRight: '0.35rem' }}>
                          {typeLabel}
                        </span>
                      );
                    })()}
                    <span className={`employee-badge position-${employee.employee_position.toLowerCase()}`}>
                      {employee.employee_position}
                    </span>
                    {(!isMobile || employee.status !== '재직') && (
                      <span className={`employee-badge status-${employee.status === '재직' ? 'active' : 'inactive'}`}>
                        {employee.status}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeList;

