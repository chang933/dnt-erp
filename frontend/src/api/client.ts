import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8001';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10초 타임아웃
});

// 요청 인터셉터 (디버깅용)
apiClient.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터 (디버깅용)
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    // /employees 엔드포인트인 경우 응답 데이터 상세 로깅
    if (response.config.url?.includes('/employees') && response.data) {
      console.log('직원 API 원본 응답 데이터:', response.data);
      if (Array.isArray(response.data) && response.data.length > 0) {
        console.log('첫 번째 직원의 모든 키:', Object.keys(response.data[0]));
        console.log('첫 번째 직원의 모든 값:', response.data[0]);
      }
    }
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// 직원 관리 API (끝 슬래시 필수: 백엔드 리다이렉트 시 CORS 오류 방지)
export const employeeAPI = {
  getAll: (params?: { skip?: number; limit?: number; status?: string }) =>
    apiClient.get('/employees/', { params }).catch(err => {
      console.error('API Error:', err);
      throw err;
    }),
  getById: (id: number) => apiClient.get(`/employees/${id}`),
  create: (data: any) => apiClient.post('/employees/', data),
  update: (id: number, data: any) => apiClient.put(`/employees/${id}`, data),
  delete: (id: number) => apiClient.delete(`/employees/${id}`),
};

// 스케줄 관리 API
export const scheduleAPI = {
  getAll: (params?: any) => apiClient.get('/schedules/', { params }),
  getByMonth: (year: number, month: number) =>
    apiClient.get(`/schedules/month/${year}/${month}`),
  create: (data: any) => apiClient.post('/schedules/', data),
  update: (id: number, data: any) => apiClient.put(`/schedules/${id}`, data),
  delete: (id: number) => apiClient.delete(`/schedules/${id}`),
};

// 출퇴근 관리 API
export const attendanceAPI = {
  getAll: (params?: any) => apiClient.get('/attendance/', { params }),
  getByMonth: (year: number, month: number) =>
    apiClient.get(`/attendance/month/${year}/${month}`),
  getSummary: (employeeId: number, year: number, month: number) =>
    apiClient.get(`/attendance/summary/${employeeId}/${year}/${month}`),
  create: (data: any) => apiClient.post('/attendance/', data),
  update: (id: number, data: any) => apiClient.put(`/attendance/${id}`, data),
  delete: (id: number) => apiClient.delete(`/attendance/${id}`),
};

// 급여 관리 API
export const payrollAPI = {
  getAll: (params?: any) => apiClient.get('/payroll/', { params }),
  getByMonth: (yearMonth: string) =>
    apiClient.get(`/payroll/month/${yearMonth}`),
  calculate: (data: any) => apiClient.post('/payroll/calculate', data),
  create: (data: any) => apiClient.post('/payroll/', data),
  update: (id: number, data: any) => apiClient.put(`/payroll/${id}`, data),
  delete: (id: number) => apiClient.delete(`/payroll/${id}`),
};

// 서류 관리 API
export const documentAPI = {
  getAll: (params?: any) => apiClient.get('/documents/', { params }),
  getByEmployee: (employeeId: number) => apiClient.get('/documents/', { params: { employee_id: employeeId } }),
  getExpiring: (days?: number) =>
    apiClient.get('/documents/expiring', { params: { days } }),
  upload: (formData: FormData, params: any) =>
    apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params,
    }),
  delete: (id: number) => apiClient.delete(`/documents/${id}`),
};

// 서류 생성 API
export const documentGenerateAPI = {
  generate: (employeeId: number, documentType: string, yearMonth?: string, preview?: boolean) =>
    apiClient.get(`/documents-generate/generate/${employeeId}/${documentType}`, {
      params: { year_month: yearMonth, preview },
      responseType: 'text', // HTML 응답을 위해 text 타입으로 변경
    }),
  getDocumentTypes: () => apiClient.get('/documents-generate/document-types'),
};

// 식자재 관리 API
export const ingredientAPI = {
  getAll: (params?: any) => apiClient.get('/ingredients/', { params }),
  create: (data: any) => apiClient.post('/ingredients/', data),
  update: (id: number, data: any) => apiClient.put(`/ingredients/${id}`, data),
  delete: (id: number) => apiClient.delete(`/ingredients/${id}`),
};

// 입출고 관리 API
export const inventoryLogAPI = {
  getAll: (params?: any) => apiClient.get('/inventory-logs/', { params }),
  create: (data: any) => apiClient.post('/inventory-logs/', data),
  delete: (id: number) => apiClient.delete(`/inventory-logs/${id}`),
};

// 고객 관리 API
export const customerAPI = {
  getAll: (params?: any) => apiClient.get('/customers/', { params }),
  getBlacklist: (params?: any) => apiClient.get('/customers/blacklist', { params }),
  create: (data: any) => apiClient.post('/customers/', data),
  update: (id: number, data: any) => apiClient.put(`/customers/${id}`, data),
  delete: (id: number) => apiClient.delete(`/customers/${id}`),
};

// 예약 API
export const reservationAPI = {
  getAll: (params?: { start_date?: string; end_date?: string; skip?: number; limit?: number }) =>
    apiClient.get('/reservations/', { params }),
  getById: (id: number) => apiClient.get(`/reservations/${id}`),
  create: (data: any) => apiClient.post('/reservations/', data),
  update: (id: number, data: any) => apiClient.put(`/reservations/${id}`, data),
  delete: (id: number) => apiClient.delete(`/reservations/${id}`),
};

// 방문 기록 API
export const visitAPI = {
  getAll: (customerId: number, params?: any) =>
    apiClient.get('/visits/', { params: { customer_id: customerId, ...params } }),
  create: (data: any) => apiClient.post('/visits/', data),
  delete: (id: number) => apiClient.delete(`/visits/${id}`),
};

// 재직증명서 API
export const certificateAPI = {
  getEmployment: (employeeId: number, params?: any) =>
    apiClient.get(`/certificates/employment/${employeeId}`, {
      params,
      responseType: 'blob',
    }),
};

// 매출/지출 관리 API
export const revenueExpenseAPI = {
  getAll: (params?: { skip?: number; limit?: number; start_date?: string; end_date?: string; type?: string }) =>
    apiClient.get('/revenue-expense/', { params }),
  getById: (id: number) => apiClient.get(`/revenue-expense/${id}`),
  create: (data: any) => apiClient.post('/revenue-expense/', data),
  update: (id: number, data: any) => apiClient.put(`/revenue-expense/${id}`, data),
  delete: (id: number) => apiClient.delete(`/revenue-expense/${id}`),
  getSummary: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get('/revenue-expense/summary/stats', { params }),
};// KDS 주문 API (메뉴입력 / 주방 KDS / 홀 서빙)
export const orderAPI = {
  create: (data: { table_number?: number; order_type?: string; total_amount?: number; items: any[] }) =>
    apiClient.post('/orders/', data),
  getAll: (params?: { skip?: number; limit?: number; status?: string }) =>
    apiClient.get('/orders/', { params }),
  getById: (id: number) => apiClient.get(`/orders/${id}`),
  getByPart: (part: string, params?: { status?: string }) =>
    apiClient.get(`/orders/part/${encodeURIComponent(part)}`, { params }),
  getServingItems: () => apiClient.get('/orders/serving/items'),
  updateItemStatus: (itemId: number, params?: { status?: string; part?: string; part_state?: string }) =>
    apiClient.patch(`/orders/items/${itemId}`, { params }),
};

// 식자재 비용 API
export const foodCostAPI = {
  getAll: (params?: { start_date?: string; end_date?: string; supplier?: string; record_type?: string; limit?: number }) =>
    apiClient.get('/food-costs/', { params }),
  create: (data: any) => apiClient.post('/food-costs/', data),
  update: (id: number, data: any) => apiClient.put(`/food-costs/${id}`, data),
  delete: (id: number) => apiClient.delete(`/food-costs/${id}`),
};