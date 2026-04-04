import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { employeeAPI, documentAPI } from '../api/client';
import { Employee, EmployeeCreate, Document } from '../types';
import './EmployeeDetail.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8001';

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function employmentTypeLabel(t: string | undefined): string {
  if (t === 'DAILY') return '일당';
  if (t === 'PART_TIME') return '파트';
  if (t === 'FULL_TIME') return '정직원';
  return t || '-';
}

function benefitTypeLabel(t: string | undefined): string {
  if (t === '3.3% 프리랜서') return '3.3% 프리랜서';
  if (t === '4대보험') return '4대보험 근로자';
  return t || '-';
}

const EmployeeDetail: React.FC = () => {
  const { canMutate } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [healthCertFile, setHealthCertFile] = useState<File | null>(null);
  const [healthCertIssueDate, setHealthCertIssueDate] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractIssueDate, setContractIssueDate] = useState('');
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
    hire_date: '',
  });

  useEffect(() => {
    if (id) {
      loadEmployeePage(parseInt(id, 10));
    }
  }, [id]);

  useEffect(() => {
    if (!canMutate) setIsEditing(false);
  }, [canMutate]);

  const loadEmployeePage = async (employeeId: number) => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, docRes] = await Promise.all([
        employeeAPI.getById(employeeId),
        documentAPI.getByEmployee(employeeId),
      ]);
      const data = empRes.data;
      setEmployee(data);
      setFormData({
        name: data.name,
        phone: data.phone || '',
        address: data.address || '',
        ssn: (data as any).ssn || '',
        birth_date: data.birth_date || '',
        gender: (data as any).gender || '',
        employee_position: data.employee_position,
        employment_type: (data as any).employment_type || 'FULL_TIME',
        benefit_type: (data as any).benefit_type || '4대보험',
        salary_type: data.salary_type,
        hourly_wage: data.hourly_wage || 0,
        monthly_salary: data.monthly_salary || undefined,
        daily_wage_weekday: (data as any).daily_wage_weekday ?? undefined,
        daily_wage_weekend: (data as any).daily_wage_weekend ?? undefined,
        daily_contract_hours: (data as any).daily_contract_hours ?? undefined,
        hire_date: data.hire_date,
      });
      setDocuments(normalizeList<Document>(docRes.data));
    } catch (err: any) {
      console.error('직원/서류 로딩 에러:', err);
      setError(err.response?.data?.detail || '직원 정보를 불러오는데 실패했습니다.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const printDocument = (document: Document) => {
    const imageUrl = `${API_BASE_URL}${document.file_url}`;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${document.document_type} 출력</title>
            <style>
              @media print {
                @page {
                  size: A4;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                }
                img {
                  width: 100%;
                  height: auto;
                  page-break-inside: avoid;
                }
              }
              body {
                margin: 0;
                padding: 20px;
              }
              img {
                max-width: 100%;
                height: auto;
                display: block;
                margin: 0 auto;
              }
            </style>
          </head>
          <body>
            <img src="${imageUrl}" alt="${document.document_type}" onload="window.print(); window.onafterprint = function() { window.close(); }" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !canMutate) return;

    try {
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

      const updateData: any = {
        name: formData.name,
        employee_position: formData.employee_position,
        employment_type: (formData as any).employment_type || 'FULL_TIME',
        benefit_type: (formData as any).benefit_type || '4대보험',
        salary_type: formData.salary_type,
        daily_contract_hours: (formData as any).daily_contract_hours ?? null,
        gender: formData.gender || null,
      };
      
      if (formData.phone && formData.phone.trim()) {
        updateData.phone = formData.phone.trim();
      } else {
        updateData.phone = null;
      }
      if (formData.address && formData.address.trim()) {
        updateData.address = formData.address.trim();
      } else {
        updateData.address = null;
      }
      // ssn: 입력값이 있으면 저장, 비어있으면 기존 값 유지 (null 덮어쓰기 방지)
      if (formData.ssn && formData.ssn.trim()) {
        updateData.ssn = formData.ssn.trim();
      }
      if (formData.birth_date) {
        updateData.birth_date = formData.birth_date;
      } else {
        updateData.birth_date = null;
      }
      // 입사일
      if (formData.hire_date) {
        updateData.hire_date = formData.hire_date;
      }
      
      if (formData.salary_type === '시급') {
        if (formData.hourly_wage && formData.hourly_wage > 0) {
          updateData.hourly_wage = formData.hourly_wage;
        } else {
          updateData.hourly_wage = null;
        }
        updateData.monthly_salary = null;
        updateData.daily_wage_weekday = null;
        updateData.daily_wage_weekend = null;
      } else if (formData.salary_type === '월급') {
        if (formData.monthly_salary && formData.monthly_salary > 0) {
          updateData.monthly_salary = formData.monthly_salary;
        } else {
          updateData.monthly_salary = null;
        }
        updateData.hourly_wage = null;
        updateData.daily_wage_weekday = null;
        updateData.daily_wage_weekend = null;
        updateData.daily_contract_hours = null;
      } else if (formData.salary_type === '일급') {
        updateData.daily_wage_weekday = formData.daily_wage_weekday;
        updateData.daily_wage_weekend = formData.daily_wage_weekend;
        updateData.hourly_wage = null;
        updateData.monthly_salary = null;
        updateData.daily_contract_hours = null;
      }
      
      const response = await employeeAPI.update(parseInt(id), updateData);

      if (healthCertFile && healthCertIssueDate) {
        const healthCertFormData = new FormData();
        healthCertFormData.append('file', healthCertFile);
        healthCertFormData.append('issue_date', healthCertIssueDate);
        
        const issueDateObj = new Date(healthCertIssueDate);
        issueDateObj.setFullYear(issueDateObj.getFullYear() + 1);
        const calculatedExpiryDate = issueDateObj.toISOString().split('T')[0];
        healthCertFormData.append('expiry_date', calculatedExpiryDate);

        try {
          const uploadParams: any = {
            employee_id: parseInt(id),
            document_type: '보건증',
            issue_date: healthCertIssueDate,
            expiry_date: calculatedExpiryDate,
          };
          
          await documentAPI.upload(healthCertFormData, uploadParams);
        } catch (err: any) {
          console.error('보건증 업로드 실패:', err);
        }
      }

      if (contractFile) {
        const contractFormData = new FormData();
        contractFormData.append('file', contractFile);
        
        try {
          const uploadParams: any = {
            employee_id: parseInt(id),
            document_type: '근로계약서',
          };
          if (contractIssueDate) uploadParams.issue_date = contractIssueDate;
          
          await documentAPI.upload(contractFormData, uploadParams);
        } catch (err: any) {
          console.error('근로계약서 업로드 실패:', err);
        }
      }

      setHealthCertFile(null);
      setHealthCertIssueDate('');
      setContractFile(null);
      setContractIssueDate('');
      
      await loadEmployeePage(parseInt(id, 10));
      
      setIsEditing(false);
      alert('직원 정보가 수정되었습니다.');
    } catch (err: any) {
      console.error('수정 에러:', err);
      const errorMessage = err.response?.data?.detail || err.message || '직원 정보 수정에 실패했습니다.';
      alert(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    }
  };

  const handleDelete = async () => {
    if (!id || !canMutate) return;
    if (!window.confirm('정말 퇴사 처리하시겠습니까?')) return;

    try {
      await employeeAPI.delete(parseInt(id));
      alert('퇴사 처리되었습니다.');
      navigate('/employees');
    } catch (err: any) {
      alert(err.response?.data?.detail || '퇴사 처리에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="employee-detail-state employee-detail-state--loading loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="card">
        <div className="employee-detail-state">
          <div className="employee-detail-state--error error">{error || '직원 정보를 찾을 수 없습니다.'}</div>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/employees')}>
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const emp = employee as Employee & {
    gender?: string;
    employment_type?: string;
    benefit_type?: string;
    daily_contract_hours?: number;
    daily_wage_weekday?: number;
    daily_wage_weekend?: number;
  };
  const avatarLetter = (emp.name?.trim()?.[0] || '?').toUpperCase();
  const employment = employmentTypeLabel(emp.employment_type);

  return (
    <div className="card">
      <div className="card-header employee-detail-card-header">
        <h2 className="card-title">직원 상세</h2>
        <div className="employee-detail-actions">
          {!isEditing ? (
            <>
              {canMutate && (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => setIsEditing(true)}>
                    수정
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleDelete}>
                    퇴사 처리
                  </button>
                </>
              )}
            </>
          ) : (
            canMutate && (
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                취소
              </button>
            )
          )}
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/employees')}>
            목록으로
          </button>
        </div>
      </div>

      {!isEditing ? (
        <div className="employee-detail-page">
          <header className="employee-detail-hero">
            <div className="employee-detail-avatar" aria-hidden>
              {avatarLetter}
            </div>
            <div className="employee-detail-hero-main">
              <h1 className="employee-detail-name">{emp.name || '이름 없음'}</h1>
              <div className="employee-detail-tags">
                <span className="employee-detail-tag employee-detail-tag--position">{emp.employee_position || '—'}</span>
                <span className="employee-detail-tag">{employment}</span>
                <span
                  className={
                    emp.status === '재직'
                      ? 'employee-detail-tag employee-detail-tag--status-active'
                      : 'employee-detail-tag employee-detail-tag--status-inactive'
                  }
                >
                  {emp.status || '—'}
                </span>
              </div>
            </div>
          </header>

          <div className="employee-detail-panels">
            <section className="employee-detail-panel">
              <h3 className="employee-detail-panel-title">기본 정보</h3>
              <dl className="employee-detail-dl">
                <div className="employee-detail-row">
                  <dt>연락처</dt>
                  <dd className={emp.phone ? '' : 'employee-detail-value--muted'}>{emp.phone || '미등록'}</dd>
                </div>
                <div className="employee-detail-row">
                  <dt>주소</dt>
                  <dd className={emp.address ? '' : 'employee-detail-value--muted'}>{emp.address || '미등록'}</dd>
                </div>
                <div className="employee-detail-row">
                  <dt>주민등록번호</dt>
                  <dd className={emp.ssn ? '' : 'employee-detail-value--muted'}>{emp.ssn || '미등록'}</dd>
                </div>
                <div className="employee-detail-row">
                  <dt>생년월일</dt>
                  <dd className={emp.birth_date ? '' : 'employee-detail-value--muted'}>{emp.birth_date || '—'}</dd>
                </div>
                <div className="employee-detail-row">
                  <dt>성별</dt>
                  <dd className={emp.gender ? '' : 'employee-detail-value--muted'}>{emp.gender || '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="employee-detail-panel">
              <h3 className="employee-detail-panel-title">근무 · 급여</h3>
              <dl className="employee-detail-dl">
                <div className="employee-detail-row">
                  <dt>고용 구분</dt>
                  <dd>
                    <span className="employee-detail-pill employee-detail-pill--violet">{employment}</span>
                  </dd>
                </div>
                <div className="employee-detail-row">
                  <dt>보험 · 세금</dt>
                  <dd className={emp.benefit_type ? '' : 'employee-detail-value--muted'}>
                    {benefitTypeLabel(emp.benefit_type)}
                  </dd>
                </div>
                <div className="employee-detail-row">
                  <dt>급여 유형</dt>
                  <dd>
                    <span className="employee-detail-pill employee-detail-pill--amber">{emp.salary_type || '—'}</span>
                  </dd>
                </div>
                {emp.salary_type === '시급' && (
                  <div className="employee-detail-row">
                    <dt>시급</dt>
                    <dd className="employee-detail-money">{`${(emp.hourly_wage ?? 0).toLocaleString()}원`} / 시간</dd>
                  </div>
                )}
                {emp.salary_type === '월급' && (
                  <div className="employee-detail-row">
                    <dt>월급</dt>
                    <dd className="employee-detail-money">{`${(emp.monthly_salary ?? 0).toLocaleString()}원`} / 월</dd>
                  </div>
                )}
                {emp.salary_type === '일급' && (
                  <>
                    <div className="employee-detail-row">
                      <dt>평일 일급</dt>
                      <dd className="employee-detail-money">
                        {(emp.daily_wage_weekday ?? 0).toLocaleString()}원 <span className="employee-detail-value--muted">/ 일 (월~금)</span>
                      </dd>
                    </div>
                    <div className="employee-detail-row">
                      <dt>주말 일급</dt>
                      <dd className="employee-detail-money">
                        {(emp.daily_wage_weekend ?? 0).toLocaleString()}원 <span className="employee-detail-value--muted">/ 일 (토·일)</span>
                      </dd>
                    </div>
                  </>
                )}
                {emp.salary_type === '시급' && (
                  <div className="employee-detail-row">
                    <dt>일 근무 계약시간</dt>
                    <dd>
                      {emp.daily_contract_hours != null ? `${emp.daily_contract_hours}시간` : <span className="employee-detail-value--muted">미지정 (기본 10h·주말 11h)</span>}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="employee-detail-panel">
              <h3 className="employee-detail-panel-title">재직 이력</h3>
              <dl className="employee-detail-dl">
                <div className="employee-detail-row">
                  <dt>입사일</dt>
                  <dd>{emp.hire_date || '—'}</dd>
                </div>
                <div className="employee-detail-row">
                  <dt>퇴사일</dt>
                  <dd className={emp.resign_date ? '' : 'employee-detail-value--muted'}>{emp.resign_date || '—'}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="employee-detail-panel employee-detail-documents-panel">
            <h3 className="employee-detail-panel-title">등록 서류</h3>
            <div className="employee-detail-doc-grid">
              {documents.map((doc) => (
                <article key={doc.id} className="employee-detail-doc-card">
                  <div className="employee-detail-doc-card-title">
                    <span className="icon" aria-hidden>
                      {doc.document_type === '보건증' ? '📋' : '📄'}
                    </span>
                    {doc.document_type}
                  </div>
                  {doc.file_url && (
                    <div className="employee-detail-doc-thumb-wrap">
                      <img
                        src={`${API_BASE_URL}${doc.file_url}`}
                        alt={doc.document_type}
                        className="employee-detail-doc-thumb"
                        onClick={() => {
                          const newWindow = window.open('', '_blank');
                          if (newWindow) {
                            newWindow.document.write(`
                              <html>
                                <head>
                                  <title>${doc.document_type}</title>
                                  <style>
                                    body { margin: 0; padding: 20px; text-align: center; }
                                    img { max-width: 100%; height: auto; }
                                  </style>
                                </head>
                                <body>
                                  <img src="${API_BASE_URL}${doc.file_url}" alt="${doc.document_type}" />
                                </body>
                              </html>
                            `);
                            newWindow.document.close();
                          }
                        }}
                      />
                    </div>
                  )}
                  {doc.issue_date && <div className="employee-detail-doc-meta">발급일 {doc.issue_date}</div>}
                  {doc.expiry_date && <div className="employee-detail-doc-meta">만료일 {doc.expiry_date}</div>}
                  <button type="button" className="btn btn-secondary" onClick={() => printDocument(doc)} style={{ width: '100%', marginTop: '0.35rem' }}>
                    A4 출력
                  </button>
                </article>
              ))}
              {documents.length === 0 && <div className="employee-detail-doc-empty">등록된 서류가 없습니다. 수정 화면에서 보건증·근로계약서를 추가할 수 있습니다.</div>}
            </div>
          </section>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="employee-detail-form-shell">
          <p className="employee-detail-form-section-title">인적 사항</p>
          <div className="form-grid">
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
            <div className="form-group full-width">
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
            <div className="form-group full-width" style={{ marginBottom: 0 }}>
              <p className="employee-detail-form-section-title" style={{ marginTop: '0.25rem' }}>
                근무 · 급여
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">포지션 *</label>
              <select
                className="form-select"
                value={formData.employee_position}
                onChange={(e) => setFormData({ ...formData, employee_position: e.target.value as '홀' | '주방' | '대표' | '사장' })}
                required
              >
                <option value="홀">홀</option>
                <option value="주방">주방</option>
                <option value="대표">대표</option>
                <option value="사장">사장</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">고용 구분 *</label>
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
              <label className="form-label">보험 · 세금 *</label>
              <select
                className="form-select"
                value={(formData as any).benefit_type || '4대보험'}
                onChange={(e) =>
                  setFormData({
                    ...(formData as any),
                    benefit_type: e.target.value as '4대보험' | '3.3% 프리랜서',
                  })
                }
                required
              >
                <option value="4대보험">4대보험 근로자</option>
                <option value="3.3% 프리랜서">3.3% 프리랜서</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">급여 유형 *</label>
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
                      setFormData({
                        ...formData,
                        daily_wage_weekday: e.target.value ? Number(e.target.value) : undefined,
                      })
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
                      setFormData({
                        ...formData,
                        daily_wage_weekend: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    required
                    min="0"
                    placeholder="예: 200000"
                  />
                </div>
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

          <p className="employee-detail-form-section-title">서류 업로드 (선택)</p>

          <div className="form-grid">
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
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary">
              저장
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EmployeeDetail;

