"""
기존 erp_employees.employment_type 값을 SQLAlchemy Enum과 맞추는 스크립트
 - '정규직' -> 'FULL_TIME'
 - '파트/알바' -> 'PART_TIME'
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine


def fix_employment_type_values():
  try:
    with engine.connect() as conn:
      # 값 매핑
      conn.execute(
        text(
          """
          UPDATE erp_employees
          SET employment_type = 'FULL_TIME'
          WHERE employment_type = '정규직';
          """
        )
      )
      conn.execute(
        text(
          """
          UPDATE erp_employees
          SET employment_type = 'PART_TIME'
          WHERE employment_type = '파트/알바';
          """
        )
      )
      # 기본값도 FULL_TIME으로 통일
      conn.execute(
        text(
          """
          ALTER TABLE erp_employees
          ALTER COLUMN employment_type SET DEFAULT 'FULL_TIME';
          """
        )
      )
      conn.commit()
      print("[SUCCESS] employment_type 값이 FULL_TIME / PART_TIME 로 정규화되었습니다.")
  except Exception as e:
    print(f"[ERROR] employment_type 값 정규화 중 오류 발생: {e}")
    import traceback

    traceback.print_exc()
    return False
  return True


if __name__ == "__main__":
  fix_employment_type_values()

