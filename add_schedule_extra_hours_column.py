"""
erp_schedules 테이블에 extra_hours 컬럼 추가 (시급/알바 해당일 추가 근무 시간)
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine


def add_schedule_extra_hours_column():
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    """
                    ALTER TABLE erp_schedules
                    ADD COLUMN IF NOT EXISTS extra_hours NUMERIC(4, 2) DEFAULT 0;
                    """
                )
            )
            conn.commit()
            print("[SUCCESS] extra_hours 컬럼이 추가되었습니다!")
    except Exception as e:
        print(f"[ERROR] 컬럼 추가 중 오류: {e}")
        import traceback
        traceback.print_exc()
        return False
    return True


if __name__ == "__main__":
    add_schedule_extra_hours_column()
