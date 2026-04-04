// 직원 타입
export interface Employee {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  ssn?: string;
  birth_date?: string;
  gender?: string;
  employee_position: '홀' | '주방' | '대표' | '사장';
  employment_type: 'FULL_TIME' | 'PART_TIME' | 'DAILY';
  benefit_type?: '4대보험' | '3.3% 프리랜서';
  salary_type: '시급' | '월급' | '일급';
  hourly_wage?: number;
  monthly_salary?: number;
  daily_wage_weekday?: number;
  daily_wage_weekend?: number;
  daily_contract_hours?: number;
  hire_date: string;
  resign_date?: string;
  status: '재직' | '퇴사';
  created_at: string;
  updated_at?: string;
}

export interface EmployeeCreate {
  name: string;
  phone?: string;
  address?: string;
  ssn?: string;
  birth_date?: string;
  gender?: string;
  employee_position: '홀' | '주방' | '대표' | '사장';
  employment_type: 'FULL_TIME' | 'PART_TIME' | 'DAILY';
  benefit_type?: '4대보험' | '3.3% 프리랜서';
  salary_type: '시급' | '월급' | '일급';
  hourly_wage?: number;
  monthly_salary?: number;
  daily_wage_weekday?: number;
  daily_wage_weekend?: number;
  daily_contract_hours?: number;
  hire_date: string;
}

// 스케줄 타입
export interface Schedule {
  id: number;
  employee_id: number;
  date: string;
  schedule_type: '출근' | '휴무';
  shift_start?: string;
  shift_end?: string;
  work_position?: '홀' | '주방';
  /** 시급/알바 해당일 추가 근무 시간(시간 단위) */
  extra_hours?: number;
  /** GET /schedules/month/... 응답에만 포함 (직원 목록 추가 요청 생략용) */
  employee_name?: string;
  employee_position?: '홀' | '주방' | '대표' | '사장';
}

// 출퇴근 타입
export interface Attendance {
  id: number;
  employee_id: number;
  date: string;
  check_in?: string;
  check_out?: string;
  status: '정상' | '지각' | '조퇴' | '결근';
  memo?: string;
}

// 급여 타입
export interface Payroll {
  id: number;
  employee_id: number;
  year_month: string;
  work_hours: number;
  base_pay: number;
  weekly_holiday_pay: number;
  insurance_type?: '가입' | '미가입';
  absent_count?: number;
  deductions: number;
  employer_deductions?: number;
  net_pay: number;
}

// 서류 타입
export interface Document {
  id: number;
  employee_id: number;
  document_type: '보건증' | '근로계약서';
  file_url: string;
  issue_date?: string;
  expiry_date?: string;
}

// 식자재 타입
export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  unit_price: number;
  stock: number;
}

// 예약 타입
export interface Reservation {
  id: number;
  reservation_date: string;
  reservation_time?: string;
  guest_name: string;
  head_count: number;
  memo?: string;
}

export interface ReservationCreate {
  reservation_date: string;
  reservation_time?: string;
  guest_name: string;
  head_count: number;
  memo?: string;
}

// 고객 타입
export interface Customer {
  id: number;
  name: string;
  phone?: string;
  memo?: string;
  is_vip: boolean;
  is_blacklist: boolean;
  blacklist_reason?: string;
}

// 매출/지출 타입
export type RevenueExpenseType = 
  | '홀매출_주간'
  | '홀매출_야간'
  | '배달매출_주간'
  | '배달매출_야간'
  | '홀매출_실입금'
  | '배달매출_실입금'
  | '고정지출'
  | '일반지출'
  | '주방지출'
  | '주류지출'
  | '음료지출'
  | '로얄티'
  | '급여'
  | '카드수수료'
  | '4대보험료'
  | '마케팅비'
  | '관리비';export interface RevenueExpense {
  id: number;
  date: string;
  type: RevenueExpenseType;
  amount: number;
  memo?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RevenueExpenseCreate {
  date: string;
  type: RevenueExpenseType;
  amount: number;
  memo?: string;
}

export interface RevenueExpenseUpdate {
  date?: string;
  type?: RevenueExpenseType;
  amount?: number;
  memo?: string;
}

// KDS 주문 타입 (도원반점 KDS)
export type KitchenPart = '면파트' | '웍파트' | '튀김파트' | '떨파트';

export interface CourseItem {
  name: string;
  parts: KitchenPart[];
}

export interface MenuItem {
  id: string;
  name: string;
  shortName?: string;
  aliases: string[];
  parts: KitchenPart[];
  price?: number;              // 가격 (선택)
  category: string;
  description?: string;
  // 코스 메뉴 전용
  isCourse?: boolean;
  courseDesc?: string;
  maxPerPlate?: number;        // 접시당 최대 인원 (기본 4)
  courseItems?: CourseItem[];  // 코스에 포함된 요리들 (면 제외)
  canGop?: boolean;            // 곱빼기 가능 여부 (면류/밥류)
}

export type OrderItemStatus = 'pending' | 'cooking' | 'ready' | 'served';

export interface OrderItemType {
  id: number;
  order_id: number;
  menu_id: string;
  menu_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  parts: string[];
  options?: string;
  note?: string;
  status: OrderItemStatus;
  part_status: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  /** API 확장: getByPart / getServingItems 응답 시 포함 */
  order_number?: number;
  table_number?: number;
  order_type?: string;
}

export interface OrderType {
  id: number;
  order_number: number;
  table_number?: number;
  order_type: string;
  status: string;
  total_amount: number;
  note?: string;
  customer_phone?: string;
  created_at?: string;
  updated_at?: string;
  items: OrderItemType[];
}

// 식자재 비용
export interface FoodCost {
  id: number;
  date: string;
  supplier: string;
  record_type: 'usage' | 'payment';
  amount: number;
  memo?: string;
}

export interface FoodCostCreate {
  date: string;
  supplier: string;
  record_type: 'usage' | 'payment';
  amount: number;
  memo?: string;
}
