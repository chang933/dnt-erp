import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeAPI, documentAPI } from '../api/client';
import { Employee, EmployeeCreate, Document } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8001';

const EmployeeDetail: React.FC = () => {
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
    daily_contract_hours: undefined,
    hire_date: '',
  });

  useEffect(() => {
    if (id) {
      fetchEmployee(parseInt(id));
      fetchDocuments(parseInt(id));
    }
  }, [id]);

  const fetchEmployee = async (employeeId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await employeeAPI.getById(employeeId);
      setEmployee(response.data);
      const newFormData: any = {
        name: response.data.name,
        phone: response.data.phone || '',
        address: response.data.address || '',
        ssn: (response.data as any).ssn || '',
        birth_date: response.data.birth_date || '',
        gender: (response.data as any).gender || '',
        employee_position: response.data.employee_position,
        employment_type: (response.data as any).employment_type || 'FULL_TIME',
        benefit_type: (response.data as any).benefit_type || '4대보험',
        salary_type: response.data.salary_type,
        hourly_wage: response.data.hourly_wage || 0,
        monthly_salary: response.data.monthly_salary || undefined,
        daily_contract_hours: (response.data as any).daily_contract_hours ?? undefined,
        hire_date: response.data.hire_date,
      };
      setFormData(newFormData);
    } catch (err: any) {
      console.error('직원 정보 로딩 에러:', err);
      setError(err.response?.data?.detail || '직원 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (employeeId: number) => {
    try {
      const response = await documentAPI.getByEmployee(employeeId);
      setDocuments(response.data || []);
    } catch (err) {
      console.error('서류 정보 로딩 에러:', err);
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
    if (!id) return;

    try {
      if (formData.salary_type === '시급' && (!formData.hourly_wage || formData.hourly_wage <= 0)) {
        alert('시급을 입력해주세요.');
        return;
      }
      if (formData.salary_type === '월급' && (!formData.monthly_salary || formData.monthly_salary <= 0)) {
        alert('월급을 입력해주세요.');
        return;
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
      } else if (formData.salary_type === '월급') {
        if (formData.monthly_salary && formData.monthly_salary > 0) {
          updateData.monthly_salary = formData.monthly_salary;
        } else {
          updateData.monthly_salary = null;
        }
        updateData.hourly_wage = null;
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
      
      await fetchEmployee(parseInt(id));
      await fetchDocuments(parseInt(id));
      
      setIsEditing(false);
      alert('직원 정보가 수정되었습니다.');
    } catch (err: any) {
      console.error('수정 에러:', err);
      const errorMessage = err.response?.data?.detail || err.message || '직원 정보 수정에 실패했습니다.';
      alert(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
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
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="card">
        <div className="error">{error || '직원 정보를 찾을 수 없습니다.'}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/employees')}>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">직원 상세 정보</h2>
        <div>
          {!isEditing ? (
            <>
              <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                수정
              </button>
              <button className="btn btn-danger" onClick={handleDelete} style={{ marginLeft: '0.5rem' }}>
                퇴사 처리
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                취소
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/employees')} style={{ marginLeft: '0.5rem' }}>
            목록으로
          </button>
        </div>
      </div>

      {!isEditing ? (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="employee-detail-grid">
            <div className="detail-item">
              <label>이름</label>
              <div className="detail-value">{employee.name || '-'}</div>
            </div>
            <div className="detail-item">
              <label>연락처</label>
              <div className="detail-value">{employee.phone || '-'}</div>
            </div>
            <div className="detail-item">
              <label>주소</label>
              <div className="detail-value">{employee.address || '-'}</div>
            </div>
            <div className="detail-item">
              <label>주민등록번호</label>
              <div className="detail-value">{employee.ssn || '-'}</div>
            </div>
            <div className="detail-item">
              <label>생년월일</label>
              <div className="detail-value">{employee.birth_date || '-'}</div>
            </div>
            <div className="detail-item">
              <label>성별</label>
              <div className="detail-value">{(employee as any).gender || '-'}</div>
            </div>
            <div className="detail-item">
              <label>포지션</label>
              <div className="detail-value">{employee.employee_position || '-'}</div>
            </div>
            <div className="detail-item">
              <label>구분</label>
              <div className="detail-value">
                {((employee as any).employment_type === 'DAILY' && '일당') ||
                  ((employee as any).employment_type === 'PART_TIME' && '파트') ||
                  ((employee as any).employment_type === 'FULL_TIME' && '정직원') ||
                  (employee as any).employment_type ||
                  '-'}
              </div>
            </div>
            <div className="detail-item">
              <label>급여 형태</label>
              <div className="detail-value">
                {((employee as any).benefit_type === '3.3% 프리랜서' && '3.3% 프리랜서') ||
                  ((employee as any).benefit_type === '4대보험' && '4대보험 근로자') ||
                  (employee as any).benefit_type ||
                  '-'}
              </div>
            </div>
            <div className="detail-item">
              <label>급여 형태</label>
              <div className="detail-value">{employee.salary_type || '-'}</div>
            </div>
            <div className="detail-item">
              <label>{employee.salary_type === '시급' ? '시급' : '월급'}</label>
              <div className="detail-value">
                {employee.salary_type === '시급'
                  ? `${employee.hourly_wage?.toLocaleString() || 0}원/시간`
                  : `${employee.monthly_salary?.toLocaleString() || 0}원/월`}
              </div>
            </div>
            {employee.salary_type === '시급' && (
              <div className="detail-item">
                <label>일 근무 계약시간</label>
                <div className="detail-value">
                  {(employee as any).daily_contract_hours != null ? `${(employee as any).daily_contract_hours}시간` : '-'}
                </div>
              </div>
            )}
            <div className="detail-item">
              <label>입사일</label>
              <div className="detail-value">{employee.hire_date || '-'}</div>
            </div>
            <div className="detail-item">
              <label>퇴사일</label>
              <div className="detail-value">{employee.resign_date || '-'}</div>
            </div>
            <div className="detail-item">
              <label>상태</label>
              <div className="detail-value">
                <span className={`status-badge ${employee.status === '재직' ? 'active' : 'inactive'}`}>
                  {employee.status || '-'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e0e0e0' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>서류</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {documents.map((doc) => (
                <div key={doc.id} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem', background: '#f8f9fa' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong>{doc.document_type}</strong>
                  </div>
                  {doc.file_url && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <img 
                        src={`${API_BASE_URL}${doc.file_url}`} 
                        alt={doc.document_type}
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer' }}
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
                  {doc.issue_date && (
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>
                      발급일: {doc.issue_date}
                    </div>
                  )}
                  {doc.expiry_date && (
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                      만료일: {doc.expiry_date}
                    </div>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => printDocument(doc)}
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  >
                    A4 출력
                  </button>
                </div>
              ))}
              {documents.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#999' }}>
                  등록된 서류가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: '800px', margin: '0 auto' }}>
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
              <label className="form-label">급여 형태 *</label>
              <select
                className="form-select"
                value={formData.salary_type}
                onChange={(e) => {
                  const salaryType = e.target.value as '시급' | '월급';
                  setFormData({
                    ...formData,
                    salary_type: salaryType,
                    hourly_wage: salaryType === '시급' ? (formData.hourly_wage || 0) : undefined,
                    monthly_salary: salaryType === '월급' ? (formData.monthly_salary || 0) : undefined,
                  });
                }}
                required
              >
                <option value="시급">시급</option>
                <option value="월급">월급</option>
              </select>
            </div>
            {formData.salary_type === '시급' ? (
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
            ) : (
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

          <h4 style={{ marginBottom: '1rem', textAlign: 'center' }}>서류 업로드 (선택사항)</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

