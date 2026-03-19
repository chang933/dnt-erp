import React, { useState, useEffect } from 'react';
import { documentAPI, documentGenerateAPI, employeeAPI } from '../api/client';
import { Employee } from '../types';

interface DocumentType {
  type: string;
  name: string;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8001';

const getFullImageUrl = (fileUrl: string): string => {
  if (!fileUrl) return '';
  // fileUrl이 이미 전체 URL인 경우
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  // 상대 경로인 경우 API_BASE_URL과 결합
  return `${API_BASE_URL}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`;
};

const DocumentList: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState<number | null>(null);
  
  // 서류 생성 상태
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 이미지 모달 상태
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    fetchDocumentTypes();
  }, [employeeFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = employeeFilter ? { employee_id: employeeFilter } : {};
      const [documentRes, employeeRes] = await Promise.all([
        documentAPI.getAll(params),
        employeeAPI.getAll({ limit: 100 }),
      ]);
      setDocuments(documentRes.data || []);
      setEmployees(employeeRes.data || []);
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
      setDocuments([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const res = await documentGenerateAPI.getDocumentTypes();
      setDocumentTypes(res.data.document_types || []);
    } catch (err) {
      console.error('서류 타입 로딩 실패:', err);
    }
  };

  const handleGenerate = async (preview: boolean = false) => {
    if (!selectedEmployeeId || !selectedDocumentType) {
      alert('직원과 서류 종류를 선택해주세요.');
      return;
    }

    try {
      setIsGenerating(true);
      const response = await documentGenerateAPI.generate(
        selectedEmployeeId,
        selectedDocumentType,
        selectedYearMonth || undefined,
        preview
      );

      // HTML 응답 처리
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        const htmlContent = typeof response.data === 'string' ? response.data : response.data;
        
        if (preview) {
          // 미리보기: 새 창에서 열기
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(htmlContent);
            newWindow.document.close();
          }
        } else {
          // 다운로드: HTML 파일로 다운로드
          const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          
          // 파일명 생성
          const documentNames: Record<string, string> = {
            'receipt_of_employment': '재직증명서',
            'career_certificate': '경력증명서',
            'pay_stub': '급여명세서',
            'withholding_receipt': '원천징수영수증',
            'resignation_certificate': '퇴직증명서',
            'severance_settlement': '퇴직금정산서',
          };
          const doc_name = documentNames[selectedDocumentType] || selectedDocumentType;
          const employee = employees.find(e => e.id === selectedEmployeeId);
          const employeeName = employee?.name || '직원';
          const filename = `${doc_name}_${employeeName}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.html`;
          
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => window.URL.revokeObjectURL(url), 100);
        }
        return;
      }
      
      // DOCX 파일 처리 (기존 로직 - 현재는 사용 안 함)
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = window.URL.createObjectURL(blob);

      const contentDisposition = response.headers['content-disposition'];
      let filename = 'document.docx';
      if (contentDisposition) {
        const matches = /filename\*=UTF-8''(.+?)(?:;|$)/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = decodeURIComponent(matches[1]);
        } else {
          const matches2 = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
          if (matches2 && matches2[1]) {
            filename = matches2[1].replace(/['"]/g, '');
          }
        }
      }
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (err: any) {
      console.error('서류 생성 실패:', err);
      console.error('서류 생성 실패 상세:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });
      
      let errorMessage = '알 수 없는 오류가 발생했습니다';
      
      if (err.response) {
        // Blob 응답인 경우 JSON으로 파싱 시도
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            const json = JSON.parse(text);
            errorMessage = json.detail || json.message || errorMessage;
          } catch (e) {
            errorMessage = `서버 오류 (${err.response.status}): ${err.response.statusText || '서류 생성 중 오류가 발생했습니다'}`;
          }
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else {
          errorMessage = err.response.data?.detail || err.response.data?.message || `서버 오류 (${err.response.status})`;
        }
      } else {
        errorMessage = err.message || errorMessage;
      }
      
      alert(`서류 생성에 실패했습니다: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 년월 선택 옵션 생성 (최근 12개월)
  const getYearMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
      options.push({ value: yearMonth, label });
    }
    return options;
  };

  const needsYearMonth = selectedDocumentType === 'pay_stub' || selectedDocumentType === 'withholding_receipt';

  if (loading && documents.length === 0) {
    return (
      <div className="card">
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">서류 관리</h2>
      </div>

      {/* 서류 생성 섹션 */}
      <div style={{
        marginBottom: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6',
      }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
          서류 생성
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              직원 선택
            </label>
            <select
              className="form-select"
              value={selectedEmployeeId || ''}
              onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            >
              <option value="">직원을 선택하세요</option>
              {employees
                .filter(emp => emp.status === '재직')
                .map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employee_position})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              서류 종류
            </label>
            <select
              className="form-select"
              value={selectedDocumentType}
              onChange={(e) => {
                setSelectedDocumentType(e.target.value);
                if (e.target.value !== 'pay_stub' && e.target.value !== 'withholding_receipt') {
                  setSelectedYearMonth('');
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            >
              <option value="">서류 종류를 선택하세요</option>
              {documentTypes.map(docType => (
                <option key={docType.type} value={docType.type}>
                  {docType.name}
                </option>
              ))}
            </select>
          </div>

          {needsYearMonth && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                년월 선택
              </label>
              <select
                className="form-select"
                value={selectedYearMonth}
                onChange={(e) => setSelectedYearMonth(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              >
                <option value="">최근 급여 사용</option>
                {getYearMonthOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => handleGenerate(true)}
            disabled={isGenerating || !selectedEmployeeId || !selectedDocumentType}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isGenerating || !selectedEmployeeId || !selectedDocumentType ? 'not-allowed' : 'pointer',
              opacity: isGenerating || !selectedEmployeeId || !selectedDocumentType ? 0.6 : 1,
            }}
          >
            미리보기
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleGenerate(false)}
            disabled={isGenerating || !selectedEmployeeId || !selectedDocumentType}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isGenerating || !selectedEmployeeId || !selectedDocumentType ? 'not-allowed' : 'pointer',
              opacity: isGenerating || !selectedEmployeeId || !selectedDocumentType ? 0.6 : 1,
            }}
          >
            {isGenerating ? '생성 중...' : '다운로드'}
          </button>
        </div>
      </div>

      {/* 기존 서류 목록 */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>기존 서류 목록</h3>
        <select
          className="form-select"
          value={employeeFilter || ''}
          onChange={(e) => setEmployeeFilter(e.target.value ? Number(e.target.value) : null)}
          style={{
            width: 'auto',
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        >
          <option value="">전체 직원</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>직원</th>
              <th>서류 종류</th>
              <th>발급일</th>
              <th>만료일</th>
              <th>파일</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center">
                  서류가 없습니다.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.employee_name || doc.employee_id}</td>
                  <td>{doc.document_type}</td>
                  <td>{doc.issue_date || '-'}</td>
                  <td>{doc.expiry_date || '-'}</td>
                  <td>
                    {doc.file_url && (
                      <button
                        className="btn btn-sm"
                        onClick={() => setSelectedImageUrl(getFullImageUrl(doc.file_url))}
                        style={{
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.875rem',
                          backgroundColor: '#007bff',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        보기
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 이미지 모달 */}
      {selectedImageUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '2rem',
          }}
          onClick={() => setSelectedImageUrl(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImageUrl(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
              }}
            >
              ×
            </button>
            <img
              src={selectedImageUrl}
              alt="서류"
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(90vh - 4rem)',
                objectFit: 'contain',
                display: 'block',
              }}
              onError={(e) => {
                console.error('이미지 로드 실패:', selectedImageUrl);
                alert('이미지를 불러올 수 없습니다.');
                setSelectedImageUrl(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentList;
