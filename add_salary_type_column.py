"""
기존 직원 테이블에 salary_type, monthly_salary 컬럼 추가 스크립트
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine

def add_salary_type_columns():
    """직원 테이블에 salary_type과 monthly_salary 컬럼 추가"""
    try:
        with engine.connect() as conn:
            # salary_type 컬럼 추가 (기본값: 시급)
            conn.execute(text("""
                ALTER TABLE erp_employees 
                ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT '시급' NOT NULL;
            """))
            
            # monthly_salary 컬럼 추가
            conn.execute(text("""
                ALTER TABLE erp_employees 
                ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12, 2);
            """))
            
            # hourly_wage를 nullable로 변경 (월급일 때는 null 가능)
            conn.execute(text("""
                ALTER TABLE erp_employees 
                ALTER COLUMN hourly_wage DROP NOT NULL;
            """))
            
            conn.commit()
            print("[SUCCESS] salary_type 및 monthly_salary 컬럼이 추가되었습니다!")
            
    except Exception as e:
        print(f"[ERROR] 컬럼 추가 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    add_salary_type_columns()

