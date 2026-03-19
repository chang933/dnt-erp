"""
erp_employees 테이블에 benefit_type 컬럼 추가 스크립트
 - 4대보험 / 3.3% 프리랜서 구분 저장용
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine


def add_employee_benefit_type_column():
  try:
    with engine.connect() as conn:
      conn.execute(
        text(
          """
          ALTER TABLE erp_employees
          ADD COLUMN IF NOT EXISTS benefit_type VARCHAR(30);
          """
        )
      )
      conn.commit()
      print("[SUCCESS] benefit_type 컬럼이 추가되었습니다!")
  except Exception as e:
    print(f"[ERROR] benefit_type 컬럼 추가 중 오류 발생: {e}")
    import traceback

    traceback.print_exc()
    return False
  return True


if __name__ == "__main__":
  add_employee_benefit_type_column()

