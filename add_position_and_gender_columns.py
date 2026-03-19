"""
직원 테이블에 gender 컬럼 추가 및 Position Enum 확장에 따른 업데이트
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import SessionLocal, engine

def add_gender_column():
    """gender 컬럼 추가"""
    db = SessionLocal()
    try:
        # gender 컬럼이 이미 있는지 확인
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='erp_employees' AND column_name='gender'
        """))
        
        if result.fetchone() is None:
            print("gender column adding...")
            db.execute(text("ALTER TABLE erp_employees ADD COLUMN gender VARCHAR(10)"))
            db.commit()
            print("gender column added successfully")
        else:
            print("gender column already exists")
    except Exception as e:
        db.rollback()
        print(f"gender 컬럼 추가 실패: {e}")
    finally:
        db.close()

def update_employee_positions():
    """특정 직원들의 직위 업데이트"""
    db = SessionLocal()
    try:
        # 먼저 employee_position 컬럼 크기 확인 및 확장
        result = db.execute(text("""
            SELECT character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name='erp_employees' AND column_name='employee_position'
        """))
        row = result.fetchone()
        if row and row[0] and row[0] < 10:
            print(f"Expanding employee_position column size from {row[0]} to 20...")
            db.execute(text("ALTER TABLE erp_employees ALTER COLUMN employee_position TYPE VARCHAR(20)"))
            db.commit()
            print("employee_position column size expanded")
        
        from app.models.employee import Employee, Position
        
        # 이천화, 장민욱: 대표
        employees_to_ceo = db.query(Employee).filter(
            Employee.name.in_(['이천화', '장민욱'])
        ).all()
        
        for emp in employees_to_ceo:
            emp.employee_position = Position.CEO
            print(f"Updated {emp.name} position to CEO (대표)")
        
        # 김서은: 사장
        employee_president = db.query(Employee).filter(
            Employee.name == '김서은'
        ).first()
        
        if employee_president:
            employee_president.employee_position = Position.PRESIDENT
            print(f"Updated {employee_president.name} position to PRESIDENT (사장)")
        
        db.commit()
        print("Employee positions updated successfully")
    except Exception as e:
        db.rollback()
        print(f"직원 직위 업데이트 실패: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting employee table update...")
    add_gender_column()
    update_employee_positions()
    print("All tasks completed!")

