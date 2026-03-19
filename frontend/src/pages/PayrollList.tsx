import React, { useState, useEffect, useMemo } from 'react';
import { payrollAPI, employeeAPI, attendanceAPI, scheduleAPI, revenueExpenseAPI } from '../api/client';
import { Employee, Attendance, Schedule } from '../types';
import { useWindowWidth } from '../hooks/useWindowWidth';

interface PaymentRecord {
  paid: boolean;
  revenueIds: number[];
}

type EmploymentTypeFilter = 'ALL' | 'FULL_TIME' | 'PART_TIME' | 'DAILY';

interface PayrollData {
  id?: number;
  employee_id: number;
  year_month: string;
  work_hours: number;
  base_pay: number;
  weekly_holiday_pay: number;
  insurance_type: '가입' | '미가입';
  absent_count: number;
  absent_deduction: number; // 결근 공제금액
  deductions: number;
  employer_deductions: number;
  net_pay: number;
  this_month_work_days?: number; // 이번달 출근일수
}

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const PayrollList: React.FC = () => {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [payrolls, setPayrolls] = useState<PayrollData[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<Record<number, Attendance[]>>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<EmploymentTypeFilter>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<Record<string, PaymentRecord>>({});

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    fetchData();
  }, [yearMonth]);

  // yearMonth 변경 시 지급 상태 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`payroll_payment_${yearMonth}`);
      setPaymentStatus(raw ? JSON.parse(raw) : {});
    } catch {
      setPaymentStatus({});
    }
  }, [yearMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [payrollRes, employeeRes, attendanceRes, scheduleRes] = await Promise.all([
        payrollAPI.getByMonth(yearMonth).catch(() => ({ data: [] })),
        employeeAPI.getAll({ limit: 100 }), // status 필터 제거하고 전체 조회 후 필터링
        attendanceAPI.getByMonth(year, month).catch(() => ({ data: [] })),
        scheduleAPI.getByMonth(year, month).catch(() => ({ data: [] })),
      ]);

      console.log('직원 API 원본 응답:', employeeRes);
      console.log('직원 API 데이터:', employeeRes.data);

      const payrollsData = normalizeList<any>(payrollRes.data);
      const allEmployeesData = normalizeList<Employee>(employeeRes.data);
      // 재직 직원만 필터링
      const employeesData = allEmployeesData.filter((e: Employee) => e.status === '재직');
      const attendancesData = normalizeList<Attendance>(attendanceRes.data);
      const schedulesData = normalizeList<Schedule>(scheduleRes.data);

      console.log('급여 데이터 로드:', {
        payrollsCount: payrollsData.length,
        employeesCount: employeesData.length,
        attendancesCount: attendancesData.length,
        schedulesCount: schedulesData.length,
      });
      console.log('직원 상세 데이터:', employeesData);
      employeesData.forEach((e: any) => {
        console.log(`직원 ${e.name} 전체 객체:`, e);
        console.log(`직원 ${e.name} 키 목록:`, Object.keys(e));
        console.log(`직원 ${e.name} salary_type 직접 접근:`, e.salary_type, e['salary_type']);
        console.log(`직원 ${e.name} monthly_salary 직접 접근:`, e.monthly_salary, e['monthly_salary']);
        console.log(`직원 ${e.name} hourly_wage 직접 접근:`, e.hourly_wage, e['hourly_wage']);
      });

      // 출퇴근 기록을 직원별로 그룹화
      const attendancesMap: Record<number, Attendance[]> = {};
      attendancesData.forEach((att: Attendance) => {
        if (!attendancesMap[att.employee_id]) {
          attendancesMap[att.employee_id] = [];
        }
        attendancesMap[att.employee_id].push(att);
      });
      setAttendances(attendancesMap);

      // 스케줄을 직원별로 그룹화
      const schedulesMap: Record<number, Schedule[]> = {};
      schedulesData.forEach((s: Schedule) => {
        if (!schedulesMap[s.employee_id]) {
          schedulesMap[s.employee_id] = [];
        }
        schedulesMap[s.employee_id].push(s);
      });

      // 직원별로 급여 데이터 생성 또는 업데이트
      const payrollsMap = new Map<number, PayrollData>();
      
      // 기존 급여 데이터 로드
      payrollsData.forEach((p: any) => {
        payrollsMap.set(p.employee_id, {
          id: p.id,
          employee_id: p.employee_id,
          year_month: p.year_month,
          work_hours: Number(p.work_hours),
          base_pay: Number(p.base_pay),
          weekly_holiday_pay: Number(p.weekly_holiday_pay || 0),
          insurance_type: p.insurance_type || '미가입',
          absent_count: p.absent_count || 0,
          absent_deduction: p.absent_deduction || 0, // 결근 공제금액
          deductions: Number(p.deductions || 0),
          employer_deductions: Number(p.employer_deductions || 0),
          net_pay: Number(p.net_pay),
          this_month_work_days: p.this_month_work_days || 0,
        });
      });

      // 모든 재직 직원에 대해 급여 데이터 계산
      employeesData.forEach((employee: Employee) => {
        const absentCount = countAbsentDays(employee.id, attendancesMap[employee.id] || []);
        
        // 기본급 계산
        let baseSalary = 0;
        let workHours = 0;
        let thisMonthWorkDays = 0; // 이번달 출근일수
        
        // salary_type 확인 및 처리
        const salaryType = (employee as any).salary_type || employee.salary_type;
        console.log(`직원 ${employee.name} 급여 정보:`, {
          salary_type: salaryType,
          monthly_salary: (employee as any).monthly_salary,
          hourly_wage: (employee as any).hourly_wage,
          전체데이터키: Object.keys(employee),
        });
        
        if (salaryType === '월급' || salaryType === 'MONTHLY') {
          const monthlySalary = (employee as any).monthly_salary || employee.monthly_salary;
          baseSalary = Number(monthlySalary || 0);
          console.log(`직원 ${employee.name} (월급): ${baseSalary}원`);
        } else if (salaryType === '시급' || salaryType === 'HOURLY') {
          const hourlyWage = (employee as any).hourly_wage || employee.hourly_wage;
          const dailyContractHours = (employee as any).daily_contract_hours != null ? Number((employee as any).daily_contract_hours) : undefined;
          const workDaysInfo = calculateWorkDays(
            employee.id,
            schedulesMap[employee.id] || [],
            year,
            month,
            dailyContractHours
          );
          workHours = workDaysInfo.totalHours;
          thisMonthWorkDays = workDaysInfo.workDays;
          baseSalary = workHours * Number(hourlyWage || 0);
          console.log(`직원 ${employee.name} (시급): ${workDaysInfo.workDays}일 × ${dailyContractHours ?? '(평일10/주말11)'}시간 × ${Number(hourlyWage || 0)}원 = ${baseSalary}원`);
        } else {
          console.log(`직원 ${employee.name}: 급여 타입이 없거나 잘못됨 - ${salaryType}`, { employee });
        }

        // 기존 급여 데이터가 있으면 업데이트, 없으면 생성
        if (payrollsMap.has(employee.id)) {
          const existing = payrollsMap.get(employee.id)!;
          // 항상 직원 정보에서 급여를 가져와서 업데이트
          existing.base_pay = baseSalary;
          if (employee.salary_type === '시급') {
            existing.work_hours = workHours;
            existing.this_month_work_days = thisMonthWorkDays;
          }
          existing.absent_count = absentCount;
          // 공제금액과 실수령액 재계산 (일당은 100% 지급, 공제 없음)
          const age = calculateAge(employee.birth_date);
          const deductions = isDailyEmployee(employee)
            ? { employee: 0, employer: 0 }
            : calculateDeductions(existing.base_pay, existing.insurance_type, age);
          existing.deductions = deductions.employee;
          existing.employer_deductions = deductions.employer;
          existing.absent_deduction = calculateAbsentDeduction(
            existing.absent_count,
            employee.salary_type,
            employee.monthly_salary,
            employee.hourly_wage,
            (employee as any).daily_contract_hours
          );
          existing.net_pay = calculateNetPay(
            existing.base_pay,
            existing.absent_count,
            deductions.employee,
            employee.salary_type,
            employee.monthly_salary,
            employee.hourly_wage
          );
        } else {
          const age = calculateAge(employee.birth_date);
          const defaultInsurance = getDefaultInsuranceTypeForEmployee(employee);
          const deductions = isDailyEmployee(employee)
            ? { employee: 0, employer: 0 }
            : calculateDeductions(baseSalary, defaultInsurance, age);
          const absentDeduction = calculateAbsentDeduction(
            absentCount,
            employee.salary_type,
            employee.monthly_salary,
            employee.hourly_wage,
            (employee as any).daily_contract_hours
          );
          const netPay = calculateNetPay(
            baseSalary,
            absentCount,
            deductions.employee,
            employee.salary_type,
            employee.monthly_salary,
            employee.hourly_wage
          );

          payrollsMap.set(employee.id, {
            employee_id: employee.id,
            year_month: yearMonth,
            work_hours: workHours,
            base_pay: baseSalary,
            weekly_holiday_pay: 0,
            insurance_type: defaultInsurance,
            absent_count: absentCount,
            absent_deduction: absentDeduction,
            deductions: deductions.employee,
            employer_deductions: deductions.employer,
            net_pay: netPay,
            this_month_work_days: thisMonthWorkDays,
          });
        }
      });

      setEmployees(employeesData);
      setPayrolls(Array.from(payrollsMap.values()));
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const countAbsentDays = (employeeId: number, employeeAttendances: Attendance[]): number => {
    return employeeAttendances.filter(att => att.status === '결근').length;
  };

  const calculateWorkDays = (
    employeeId: number,
    schedules: Schedule[],
    year: number,
    month: number,
    dailyContractHours?: number
  ): { totalHours: number; workDays: number } => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let totalHours = 0;
    let workDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const schedule = schedules.find(s => s.date === dateStr);

      if (schedule && schedule.schedule_type === '출근') {
        workDays++;
        const extra = Number((schedule as any).extra_hours ?? 0) || 0;
        if (dailyContractHours != null && dailyContractHours > 0) {
          totalHours += dailyContractHours + extra;
        } else {
          const base = dayOfWeek === 0 || dayOfWeek === 6 ? 11 : 10;
          totalHours += base + extra;
        }
      }
    }
    return { totalHours, workDays };
  };

  const calculateAge = (birthDate?: string): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const calculateDeductions = (
    basePay: number,
    insuranceType: '가입' | '미가입',
    age: number | null
  ): { employee: number; employer: number } => {
    if (insuranceType === '미가입') {
      // 프리렌서 세금 3.3%
      const deduction = Math.round(basePay * 0.033);
      return { employee: deduction, employer: 0 };
    }

    // 4대보험 가입 시
    // 국민연금: 4.5% (직원 4.5%, 사업주 4.5%)
    // 건강보험: 3.545% (직원 3.545%, 사업주 3.545%)
    // 고용보험: 0.9% (직원 0.9%, 사업주 1.05%)
    // 산재보험: 직종별 차등 (직원 0%, 사업주 약 0.5~1.5%, 평균 1%로 계산)
    // 참고: 3대보험(국민연금, 건강보험, 고용보험)만 가입하는 경우도 있으나, 여기서는 4대보험 모두 가입으로 가정
    
    const nationalPension = Math.round(basePay * 0.045); // 4.5%
    const healthInsurance = Math.round(basePay * 0.03545); // 3.545%
    const employmentInsurance = Math.round(basePay * 0.009); // 0.9%
    const industrialAccident = Math.round(basePay * 0.01); // 산재보험 약 1% (평균)

    const employeeDeduction = nationalPension + healthInsurance + employmentInsurance;
    const employerDeduction = nationalPension + healthInsurance + Math.round(basePay * 0.0105) + industrialAccident;

    return {
      employee: employeeDeduction,
      employer: employerDeduction,
    };
  };

  const calculateAbsentDeduction = (
    absentCount: number,
    salaryType: '시급' | '월급',
    monthlySalary?: number,
    hourlyWage?: number,
    dailyContractHours?: number
  ): number => {
    if (absentCount <= 0) return 0;
    if (salaryType === '월급' && monthlySalary) {
      const dailySalary = Math.round(monthlySalary / 30);
      return dailySalary * absentCount;
    }
    if (salaryType === '시급' && hourlyWage) {
      const hoursPerDay = dailyContractHours != null && dailyContractHours > 0 ? Number(dailyContractHours) : 10;
      const dailySalary = Math.round(hourlyWage * hoursPerDay);
      return dailySalary * absentCount;
    }
    return 0;
  };

  const calculateNetPay = (
    basePay: number,
    absentCount: number,
    deductions: number,
    salaryType: '시급' | '월급',
    monthlySalary?: number,
    hourlyWage?: number,
    dailyContractHours?: number
  ): number => {
    let finalSalary = basePay;
    const absentDeduction = calculateAbsentDeduction(absentCount, salaryType, monthlySalary, hourlyWage, dailyContractHours);
    finalSalary -= absentDeduction;
    finalSalary -= deductions;
    return Math.max(0, Math.round(finalSalary));
  };

  /** 일당 직원은 3.3%/4대보험 미적용, 100% 지급 */
  const isDailyEmployee = (employee: Employee | undefined): boolean =>
    employee != null && (employee as any).employment_type === 'DAILY';

  const getDefaultInsuranceTypeForEmployee = (employee?: Employee): '가입' | '미가입' => {
    if (!employee) return '미가입';
    if (isDailyEmployee(employee)) return '미가입'; // 일당은 100% 지급(공제 없음)
    const benefit = (employee as any).benefit_type;
    if (benefit === '4대보험') return '가입';
    if (benefit === '3.3% 프리랜서') return '미가입'; // 프리랜서는 3.3% 공제
    return '미가입';
  };

  const handleInsuranceTypeChange = (employeeId: number, newType: '가입' | '미가입') => {
    setPayrolls(prev => prev.map(p => {
      if (p.employee_id === employeeId) {
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) return p;
        // 일당은 100% 지급으로 고정(공제 없음)
        const age = calculateAge(employee.birth_date);
        const deductions = isDailyEmployee(employee)
          ? { employee: 0, employer: 0 }
          : calculateDeductions(p.base_pay, newType, age);
        const dailyContractHours = (employee as any).daily_contract_hours;
        const absentDeduction = calculateAbsentDeduction(
          p.absent_count,
          employee.salary_type,
          employee.monthly_salary,
          employee.hourly_wage,
          dailyContractHours
        );
        const netPay = calculateNetPay(
          p.base_pay,
          p.absent_count,
          deductions.employee,
          employee.salary_type,
          employee.monthly_salary,
          employee.hourly_wage,
          dailyContractHours
        );

        return {
          ...p,
          insurance_type: isDailyEmployee(employee) ? '미가입' : newType,
          absent_deduction: absentDeduction,
          deductions: deductions.employee,
          employer_deductions: deductions.employer,
          net_pay: netPay,
        };
      }
      return p;
    }));
  };

  const handleDeductionChange = (employeeId: number, field: 'deductions' | 'employer_deductions', value: number) => {
    setPayrolls(prev => prev.map(p => {
      if (p.employee_id === employeeId) {
        const updatedDeductions = field === 'deductions' ? value : p.deductions;
        const updatedEmployerDeductions = field === 'employer_deductions' ? value : p.employer_deductions;
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) return p;
        const dailyContractHours = (employee as any).daily_contract_hours;
        const absentDeduction = calculateAbsentDeduction(
          p.absent_count,
          employee.salary_type,
          employee.monthly_salary,
          employee.hourly_wage,
          dailyContractHours
        );
        const netPay = calculateNetPay(
          p.base_pay,
          p.absent_count,
          updatedDeductions,
          employee.salary_type,
          employee.monthly_salary,
          employee.hourly_wage,
          dailyContractHours
        );

        return {
          ...p,
          absent_deduction: absentDeduction,
          deductions: updatedDeductions,
          employer_deductions: updatedEmployerDeductions,
          net_pay: netPay,
        };
      }
      return p;
    }));
  };

  const handleSaveAll = async () => {
    try {
      const savePromises = payrolls.map(async (payroll) => {
        if (payroll.id) {
          return payrollAPI.update(payroll.id, {
            insurance_type: payroll.insurance_type,
            absent_count: payroll.absent_count,
            deductions: payroll.deductions,
            employer_deductions: payroll.employer_deductions,
            net_pay: payroll.net_pay,
          });
        } else {
          return payrollAPI.create({
            employee_id: payroll.employee_id,
            year_month: payroll.year_month,
            work_hours: payroll.work_hours,
            base_pay: payroll.base_pay,
            weekly_holiday_pay: payroll.weekly_holiday_pay,
            insurance_type: payroll.insurance_type,
            absent_count: payroll.absent_count,
            deductions: payroll.deductions,
            employer_deductions: payroll.employer_deductions,
            net_pay: payroll.net_pay,
          });
        }
      });

      await Promise.all(savePromises);
      alert('모든 급여 정보가 저장되었습니다.');
      await fetchData();
    } catch (err: any) {
      console.error('저장 실패:', err);
      alert('저장에 실패했습니다: ' + (err.response?.data?.detail || err.message));
    }
  };

  const savePaymentStatus = (status: Record<string, PaymentRecord>) => {
    localStorage.setItem(`payroll_payment_${yearMonth}`, JSON.stringify(status));
    setPaymentStatus(status);
  };

  const handlePaymentToggle = async (payroll: PayrollData) => {
    const key = String(payroll.employee_id);
    const current = paymentStatus[key];

    if (current?.paid) {
      // 취소: 기입된 revenue-expense 항목 삭제
      if (current.revenueIds?.length > 0) {
        await Promise.all(current.revenueIds.map(id => revenueExpenseAPI.delete(id).catch(() => {})));
      }
      savePaymentStatus({ ...paymentStatus, [key]: { paid: false, revenueIds: [] } });
    } else {
      // 지급완료: 항목 기입
      const employee = getEmployee(payroll.employee_id);
      const payDueDate = employee ? getPayDueDate(employee.hire_date) : '-';
      if (!payDueDate || payDueDate === '-') {
        alert('월급일을 확인할 수 없습니다. 입사일 정보를 확인해주세요.');
        return;
      }

      const createdIds: number[] = [];
      try {
        // 1. 실수령액 → 급여 지출
        const salaryRes = await revenueExpenseAPI.create({
          date: payDueDate,
          type: '급여',
          amount: payroll.net_pay,
          memo: employee?.name || '',
        });
        createdIds.push(salaryRes.data.id);

        // 2-A. 4대보험 미가입 → 3.3% 공제액을 '일반지출' (memo: '급여 3.3%')
        if (payroll.insurance_type === '미가입' && payroll.deductions > 0) {
          const taxRes = await revenueExpenseAPI.create({
            date: payDueDate,
            type: '일반지출',
            amount: payroll.deductions,
            memo: '급여 3.3%',
          });
          createdIds.push(taxRes.data.id);
        }

        // 2-B. 4대보험 가입 → 사업주 부담분을 '4대보험료' 지출
        if (payroll.insurance_type === '가입' && payroll.employer_deductions > 0) {
          const insRes = await revenueExpenseAPI.create({
            date: payDueDate,
            type: '4대보험료',
            amount: payroll.employer_deductions,
            memo: employee?.name || '',
          });
          createdIds.push(insRes.data.id);
        }

        savePaymentStatus({ ...paymentStatus, [key]: { paid: true, revenueIds: createdIds } });
      } catch (err: any) {
        // 실패 시 롤백
        await Promise.all(createdIds.map(id => revenueExpenseAPI.delete(id).catch(() => {})));
        alert('지급 처리에 실패했습니다: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(year, month - 1 + delta, 1));
  };

  const getEmployeeName = (employeeId: number) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.name || `직원 #${employeeId}`;
  };

  const getEmployee = (employeeId: number) => {
    return employees.find(e => e.id === employeeId);
  };

  const TYPE_ORDER: Record<string, number> = { FULL_TIME: 0, PART_TIME: 1, DAILY: 2 };

  const filteredPayrolls = useMemo(() => {
    const list = employmentTypeFilter === 'ALL'
      ? payrolls
      : payrolls.filter((p) => {
          const emp = getEmployee(p.employee_id);
          return (emp as any)?.employment_type === employmentTypeFilter;
        });
    return [...list].sort((a, b) => {
      const ta = TYPE_ORDER[(getEmployee(a.employee_id) as any)?.employment_type] ?? 99;
      const tb = TYPE_ORDER[(getEmployee(b.employee_id) as any)?.employment_type] ?? 99;
      return ta - tb;
    });
  }, [payrolls, employmentTypeFilter, employees]);

  // 자동 계산된 예상 공제금액 표시
  const getEstimatedDeductions = (payroll: PayrollData) => {
    const employee = getEmployee(payroll.employee_id);
    if (!employee) return { employee: 0, employer: 0 };
    const age = calculateAge(employee.birth_date);
    return calculateDeductions(payroll.base_pay, payroll.insurance_type, age);
  };

  // 입사일 전일 = 해당 월 급여 지급예정일 (입사일 15일 → 14일, 입사일 1일 → 당월 28일)
  const getPayDueDate = (hireDateStr: string | undefined): string => {
    if (!hireDateStr) return '-';
    const hire = new Date(hireDateStr);
    const hireDay = hire.getDate();
    const payDay = hireDay === 1 ? 28 : hireDay - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const safeDay = Math.min(payDay, daysInMonth);
    return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  };

  /** 월급일 7일 전~당일만 안내 문구 반환, 지난 경우 null */
  const getPayDueMessage = (payDueDateStr: string): string | null => {
    if (!payDueDateStr || payDueDateStr === '-') return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = payDueDateStr.split('-').map(Number);
    const payDay = new Date(y, m - 1, d);
    payDay.setHours(0, 0, 0, 0);
    const diffMs = payDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    if (diffDays > 7) return null;
    if (diffDays === 0) return '월급지급일은 오늘입니다';
    return `월급지급일까지 ${diffDays}일 남았습니다`;
  };

  if (loading && payrolls.length === 0) {
    return (
      <div className="card">
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1.5rem 1rem' }}>
      <div className="card-header">
        <button className="btn btn-secondary" onClick={() => changeMonth(-1)}>
          이전 달
        </button>
        <h2 className="card-title">
          {year}년 {month}월 급여 명세
        </h2>
        <button className="btn btn-secondary" onClick={() => changeMonth(1)}>
          다음 달
        </button>
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, marginRight: '0.25rem' }}>구분:</span>
          {([
            { value: 'ALL',       label: '전체' },
            { value: 'FULL_TIME', label: '정직원' },
            { value: 'PART_TIME', label: '알바' },
            { value: 'DAILY',     label: '일당' },
          ] as { value: EmploymentTypeFilter; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setEmploymentTypeFilter(value)}
              style={{
                padding: '0.35rem 0.9rem',
                borderRadius: '4px',
                border: `2px solid ${employmentTypeFilter === value ? '#007bff' : '#ccc'}`,
                background: employmentTypeFilter === value ? '#007bff' : '#fff',
                color: employmentTypeFilter === value ? '#fff' : '#444',
                fontWeight: employmentTypeFilter === value ? 700 : 400,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
          <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '0.25rem' }}>
            ({filteredPayrolls.length}명)
          </span>
        </div>
        <button
          className="btn"
          onClick={handleSaveAll}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          일괄 저장
        </button>
      </div>

      <div className="table-container">
        <table className="table" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: '56px' }}>구분</th>
              <th style={{ textAlign: 'center' }}>이름</th>
              <th style={{ textAlign: 'center' }}>월급일</th>
              <th style={{ textAlign: 'center' }}>급여</th>
              <th style={{ textAlign: 'center' }}>4대보험<br/>가입유무</th>
              <th style={{ textAlign: 'center' }}>이번달<br/>출근일수</th>
              <th style={{ textAlign: 'center' }}>결근<br/>횟수</th>
              <th style={{ textAlign: 'center' }}>결근공제금액</th>
              <th style={{ textAlign: 'center' }}>공제예상금액<br/>(직원부담)</th>
              <th style={{ textAlign: 'center' }}>사업장 공제예상금액<br/>(사업주부담)</th>
              <th style={{ textAlign: 'center' }}>공제금액<br/>(직원부담)</th>
              <th style={{ textAlign: 'center' }}>사업장공제금액<br/>(사업주부담)</th>
              <th style={{ textAlign: 'center' }}>실수령액</th>
              <th style={{ textAlign: 'center' }}>지급</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayrolls.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center' }}>
                  {payrolls.length === 0 ? '급여 명세가 없습니다.' : '선택한 구분에 해당하는 직원이 없습니다.'}
                </td>
              </tr>
            ) : (
              <>
                {filteredPayrolls.map((payroll) => {
                  const employee = getEmployee(payroll.employee_id);
                  const estimated = getEstimatedDeductions(payroll);
                  const payDueDate = employee ? getPayDueDate(employee.hire_date) : '-';
                  const isDaily = employee && (employee as any).employment_type === 'DAILY';
                  const isHourly = employee?.salary_type === '시급';
                  const isPart = employee && (employee as any).employment_type === 'PART_TIME';
                  const typeLabel = isDaily ? '일당' : isHourly ? '알바' : isPart ? '파트' : '정직원';
                  const typeStyle =
                    typeLabel === '일당'
                      ? { bg: '#f3e5f5', color: '#7b1fa2' }
                      : typeLabel === '알바'
                        ? { bg: '#fce4ec', color: '#c2185b' }
                        : typeLabel === '파트'
                          ? { bg: '#fff3e0', color: '#e65100' }
                          : { bg: '#e3f2fd', color: '#1565c0' };

                  return (
                    <tr key={payroll.employee_id}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <span
                          title={typeLabel}
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: typeStyle.bg,
                            color: typeStyle.color,
                          }}
                        >
                          {typeLabel === '일당' ? '📋 일당' : typeLabel === '알바' ? '🕐 알바' : typeLabel === '파트' ? '🕐 파트' : '👤 정직원'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{getEmployeeName(payroll.employee_id)}</td>
                      <td style={{ textAlign: 'center' }}>{payDueDate}</td>
                      <td style={{ textAlign: 'center' }}>{payroll.base_pay.toLocaleString()}원</td>
                      <td style={{ textAlign: 'center' }}>
                        <select
                          value={payroll.insurance_type}
                          onChange={(e) => {
                            const newType = e.target.value as '가입' | '미가입';
                            handleInsuranceTypeChange(payroll.employee_id, newType);
                          }}
                          style={{
                            padding: '0.25rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            margin: '0 auto',
                            display: 'block',
                          }}
                        >
                          <option value="가입">가입</option>
                          <option value="미가입">미가입</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {payroll.this_month_work_days || (() => {
                          const employeeSchedules = schedules.filter(s => s.employee_id === payroll.employee_id);
                          const workDaysInfo = calculateWorkDays(payroll.employee_id, employeeSchedules, year, month);
                          return workDaysInfo.workDays;
                        })()}일
                      </td>
                      <td style={{ textAlign: 'center' }}>{payroll.absent_count}일</td>
                      <td style={{ textAlign: 'center' }}>{payroll.absent_deduction.toLocaleString()}원</td>
                      <td style={{ textAlign: 'center', color: '#666' }}>
                        {estimated.employee.toLocaleString()}원
                      </td>
                      <td style={{ textAlign: 'center', color: '#666' }}>
                        {estimated.employer.toLocaleString()}원
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          value={payroll.deductions}
                          onChange={(e) => handleDeductionChange(payroll.employee_id, 'deductions', Number(e.target.value))}
                          style={{
                            padding: '0.25rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            width: '120px',
                            textAlign: 'center',
                            margin: '0 auto',
                            display: 'block',
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          value={payroll.employer_deductions}
                          onChange={(e) => handleDeductionChange(payroll.employee_id, 'employer_deductions', Number(e.target.value))}
                          style={{
                            padding: '0.25rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            width: '120px',
                            textAlign: 'center',
                            margin: '0 auto',
                            display: 'block',
                          }}
                        />
                      </td>
                      <td style={{ fontWeight: 'bold', textAlign: 'center' }}>
                        <div>{payroll.net_pay.toLocaleString()}원</div>
                        {typeof payDueDate === 'string' && (() => {
                          const msg = getPayDueMessage(payDueDate);
                          return msg ? (
                            <div style={{ fontSize: '0.75rem', color: '#0d6efd', marginTop: '0.25rem', fontWeight: 500 }}>
                              {msg}
                            </div>
                          ) : null;
                        })()}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        {(() => {
                          const isPaid = paymentStatus[String(payroll.employee_id)]?.paid;
                          return (
                            <button
                              onClick={() => handlePaymentToggle(payroll)}
                              style={{
                                padding: '0.3rem 0.7rem',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: isPaid ? '2px solid #28a745' : '2px solid #adb5bd',
                                backgroundColor: isPaid ? '#28a745' : '#fff',
                                color: isPaid ? '#fff' : '#495057',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s',
                              }}
                            >
                              {isPaid ? '✓ 지급완료' : '지급확인'}
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                  <td colSpan={12} style={{ textAlign: 'center' }}>합계</td>
                  <td style={{ textAlign: 'center' }}>{payrolls.reduce((sum, p) => sum + p.net_pay, 0).toLocaleString()}원</td>
                  <td />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayrollList;
