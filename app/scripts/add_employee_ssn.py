"""
erp_employees 테이블에 ssn(주민등록번호) 컬럼이 없으면 추가합니다.
실행: 프로젝트 루트에서
  python -m app.scripts.add_employee_ssn
"""
import sys
from pathlib import Path

# 프로젝트 루트를 path에 추가
root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))

from sqlalchemy import text
from app.db.session import engine


def main():
    sql = """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'erp_employees'
          AND column_name = 'ssn'
      ) THEN
        ALTER TABLE erp_employees ADD COLUMN ssn VARCHAR(20) NULL;
        RAISE NOTICE '컬럼 erp_employees.ssn 이 추가되었습니다.';
      ELSE
        RAISE NOTICE '컬럼 erp_employees.ssn 이 이미 존재합니다.';
      END IF;
    END $$;
    """
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    print("완료: 주민번호(ssn) 컬럼 확인/추가됨.")


if __name__ == "__main__":
    main()
