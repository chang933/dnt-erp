"""
erp_employees 테이블에 daily_contract_hours 컬럼 추가 (시급·파트알바 일 근무 계약시간)
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine


def add_daily_contract_hours_column():
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    """
                    ALTER TABLE erp_employees
                    ADD COLUMN IF NOT EXISTS daily_contract_hours NUMERIC(4, 1);
                    """
                )
            )
            conn.commit()
            print("[SUCCESS] daily_contract_hours 컬럼이 추가되었습니다!")
    except Exception as e:
        print(f"[ERROR] 컬럼 추가 중 오류: {e}")
        import traceback
        traceback.print_exc()
        return False
    return True


if __name__ == "__main__":
    add_daily_contract_hours_column()
