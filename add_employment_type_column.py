"""
기존 직원 테이블에 employment_type 컬럼 추가 스크립트
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine


def add_employment_type_column():
  """직원 테이블에 employment_type 컬럼 추가 (정규직 / 파트·알바)"""
  try:
    with engine.connect() as conn:
      conn.execute(
        text(
          """
          ALTER TABLE erp_employees
          ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT '정규직' NOT NULL;
          """
        )
      )
      conn.commit()
      print("[SUCCESS] employment_type 컬럼이 추가되었습니다!")
  except Exception as e:
    print(f"[ERROR] employment_type 컬럼 추가 중 오류 발생: {e}")
    import traceback

    traceback.print_exc()
    return False

  return True


if __name__ == "__main__":
  add_employment_type_column()

