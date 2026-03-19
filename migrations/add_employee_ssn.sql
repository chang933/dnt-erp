-- 직원 테이블에 주민등록번호(ssn) 컬럼 추가
-- 실행: psql 또는 Supabase SQL Editor에서 실행
-- 이미 컬럼이 있으면 에러가 나므로, 한 번만 실행하세요.
ALTER TABLE erp_employees ADD COLUMN ssn VARCHAR(20) NULL;
