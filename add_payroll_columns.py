"""
급여 테이블에 4대보험 관련 컬럼 추가 스크립트
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.core.config import settings

def add_payroll_columns():
    engine = create_engine(settings.database_url)
    
    with engine.connect() as conn:
        try:
            # insurance_type 컬럼 추가
            conn.execute(text("""
                ALTER TABLE erp_payroll 
                ADD COLUMN IF NOT EXISTS insurance_type VARCHAR(20);
            """))
            
            # absent_count 컬럼 추가
            conn.execute(text("""
                ALTER TABLE erp_payroll 
                ADD COLUMN IF NOT EXISTS absent_count INTEGER NOT NULL DEFAULT 0;
            """))
            
            # employer_deductions 컬럼 추가
            conn.execute(text("""
                ALTER TABLE erp_payroll 
                ADD COLUMN IF NOT EXISTS employer_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0;
            """))
            
            conn.commit()
            print("급여 테이블 컬럼 추가 완료!")
            print("- insurance_type: 4대보험 가입유무")
            print("- absent_count: 결근횟수")
            print("- employer_deductions: 사업장 공제금액")
        except Exception as e:
            conn.rollback()
            print(f"오류 발생: {e}")
            raise

if __name__ == "__main__":
    add_payroll_columns()

