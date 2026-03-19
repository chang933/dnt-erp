"""
Supabase 연동 전부 테스트 (잠금 해제 후 정상 동작 확인)
"""
import sys
from sqlalchemy import create_engine, text, inspect
from app.core.config import settings

# 앱이 사용하는 테이블 목록
EXPECTED_TABLES = [
    "erp_employees",
    "erp_schedules",
    "erp_attendance",
    "erp_payroll",
    "erp_documents",
    "erp_ingredients",
    "erp_inventory_log",
    "erp_customers",
    "erp_visits",
    "erp_revenue_expense",
]

def main():
    results = []
    engine = create_engine(
        settings.database_url,
        connect_args={"sslmode": "require", "connect_timeout": 15},
        pool_pre_ping=True,
    )

    # 1) 기본 연결
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        results.append(("1. 기본 연결 (SELECT 1)", True, "OK"))
    except Exception as e:
        results.append(("1. 기본 연결 (SELECT 1)", False, str(e)))
        for r in results:
            print(f"[{'PASS' if r[1] else 'FAIL'}] {r[0]}: {r[2]}")
        sys.exit(1)

    # 2) PostgreSQL 버전
    try:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version()")).fetchone()
        results.append(("2. PostgreSQL 버전", True, (row[0][:50] + "...") if row and len(row[0]) > 50 else (row[0] if row else "N/A")))
    except Exception as e:
        results.append(("2. PostgreSQL 버전", False, str(e)))

    # 3) 존재하는 테이블 목록
    try:
        inspector = inspect(engine)
        existing = set(inspector.get_table_names())
        results.append(("3. DB 내 테이블 수", True, f"{len(existing)}개"))
    except Exception as e:
        results.append(("3. DB 내 테이블 수", False, str(e)))
        existing = set()

    # 4) 필수 테이블 존재 여부
    missing = [t for t in EXPECTED_TABLES if t not in existing]
    if not missing:
        results.append(("4. 필수 테이블 존재", True, f"전부 존재 ({len(EXPECTED_TABLES)}개)"))
    else:
        results.append(("4. 필수 테이블 존재", False, f"누락: {missing}"))

    # 5) 각 테이블 SELECT 1건 (읽기 테스트)
    for table in EXPECTED_TABLES:
        if table not in existing:
            results.append((f"5. 읽기 [{table}]", False, "테이블 없음"))
            continue
        try:
            with engine.connect() as conn:
                row = conn.execute(text(f'SELECT * FROM "{table}" LIMIT 1')).fetchone()
            count_sql = text(f'SELECT COUNT(*) FROM "{table}"')
            with engine.connect() as conn:
                count = conn.execute(count_sql).scalar()
            results.append((f"5. 읽기 [{table}]", True, f"OK (행 수: {count})"))
        except Exception as e:
            results.append((f"5. 읽기 [{table}]", False, str(e)[:80]))

    # 6) 세션/트랜잭션 (get_db와 동일 방식)
    try:
        from app.db.session import SessionLocal, get_db
        db = next(get_db())
        try:
            db.execute(text("SELECT 1"))
            db.commit()
            results.append(("6. app 세션 (get_db)", True, "OK"))
        finally:
            db.close()
    except Exception as e:
        results.append(("6. app 세션 (get_db)", False, str(e)))

    # 7) 직원 목록 API와 동일 쿼리 (CRUD 경로)
    try:
        from app.db.session import get_db
        from app.crud import employee as crud_employee
        db = next(get_db())
        try:
            employees = crud_employee.get_employees(db=db, skip=0, limit=10)
            results.append(("7. 직원 목록 CRUD", True, f"OK (조회 {len(employees)}건)"))
        finally:
            db.close()
    except Exception as e:
        results.append(("7. 직원 목록 CRUD", False, str(e)))

    # 결과 출력
    print("\n=== Supabase 연동 전체 테스트 결과 ===\n")
    passed = sum(1 for r in results if r[1])
    total = len(results)
    for r in results:
        status = "PASS" if r[1] else "FAIL"
        print(f"  [{status}] {r[0]}: {r[2]}")
    print(f"\n  총 {passed}/{total} 항목 성공")
    if passed < total:
        sys.exit(1)
    print("\n  연동 완전 정상입니다.\n")
    sys.exit(0)

if __name__ == "__main__":
    main()
