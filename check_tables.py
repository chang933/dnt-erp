"""
데이터베이스에 생성된 테이블 목록을 확인하는 스크립트
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import inspect, text
from app.db.session import engine

def check_tables():
    """데이터베이스에 생성된 테이블 목록을 조회합니다."""
    print("데이터베이스 연결 확인 중...")
    print(f"Database URL: {engine.url}")
    print("\n" + "="*50)
    
    try:
        with engine.connect() as conn:
            # PostgreSQL에서 erp_로 시작하는 테이블 목록 조회
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name LIKE 'erp_%'
                ORDER BY table_name;
            """))
            
            tables = [row[0] for row in result.fetchall()]
            
            if tables:
                print(f"\n[확인됨] 총 {len(tables)}개의 테이블이 존재합니다:\n")
                for table in tables:
                    print(f"  - {table}")
                    
                # 각 테이블의 컬럼 정보도 확인
                print("\n" + "="*50)
                print("테이블별 컬럼 정보:")
                print("="*50)
                
                for table in tables:
                    result = conn.execute(text(f"""
                        SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns
                        WHERE table_name = '{table}'
                        ORDER BY ordinal_position;
                    """))
                    
                    columns = result.fetchall()
                    print(f"\n{table}:")
                    for col in columns:
                        nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
                        print(f"  - {col[0]} ({col[1]}) {nullable}")
            else:
                print("\n[경고] erp_로 시작하는 테이블이 없습니다!")
                print("테이블을 생성해야 합니다.")
                
                # 모든 테이블 목록 확인
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name;
                """))
                
                all_tables = [row[0] for row in result.fetchall()]
                if all_tables:
                    print(f"\n데이터베이스에 존재하는 다른 테이블들 ({len(all_tables)}개):")
                    for table in all_tables[:10]:  # 최대 10개만 표시
                        print(f"  - {table}")
                    if len(all_tables) > 10:
                        print(f"  ... 외 {len(all_tables) - 10}개")
                        
    except Exception as e:
        print(f"\n[오류] 데이터베이스 연결 또는 쿼리 실행 중 오류 발생:")
        print(f"  {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    check_tables()

