"""
테이블 생성 스크립트
Supabase 데이터베이스에 모든 테이블을 생성합니다.
"""
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.base import Base
from app.db.session import engine
from app.models import (
    Employee, Schedule, Attendance, Payroll, Document,
    Ingredient, InventoryLog, Customer, Visit, RevenueExpense,
    Reservation,
)

def create_tables():
    """모든 모델의 테이블을 생성합니다."""
    print("테이블 생성 시작...")
    
    # 모든 모델을 Base.metadata에 등록하기 위해 import
    # models/__init__.py에서 이미 import되어 있음
    
    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
        print("[SUCCESS] 모든 테이블이 성공적으로 생성되었습니다!")
        print("\n생성된 테이블:")
        for table_name in Base.metadata.tables.keys():
            print(f"  - {table_name}")
    except Exception as e:
        print(f"[ERROR] 테이블 생성 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    create_tables()

