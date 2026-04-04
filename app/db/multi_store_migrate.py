"""
기존 DB에 지점(store) 스키마를 붙입니다. PostgreSQL(Supabase/Render) 기준.
create_all 이후 호출합니다.
"""
from sqlalchemy import text
from sqlalchemy.engine import Engine


def run(engine: Engine) -> None:
    stmts = [
        text(
            """
            CREATE TABLE IF NOT EXISTS erp_stores (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50),
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
            )
            """
        ),
        text(
            """
            INSERT INTO erp_stores (id, name, is_active)
            SELECT 1, '검단점', true
            WHERE NOT EXISTS (SELECT 1 FROM erp_stores WHERE id = 1)
            """
        ),
        text(
            "SELECT setval(pg_get_serial_sequence('erp_stores', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM erp_stores), 1))"
        ),
    ]

    tenant_tables = [
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
        "erp_food_costs",
        "erp_reservations",
        "kds_orders",
    ]

    with engine.begin() as conn:
        for s in stmts:
            try:
                conn.execute(s)
            except Exception:
                pass

        for tbl in tenant_tables:
            try:
                conn.execute(
                    text(
                        f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES erp_stores(id)"
                    )
                )
            except Exception:
                pass
            try:
                conn.execute(
                    text(f"UPDATE {tbl} SET store_id = 1 WHERE store_id IS NULL")
                )
            except Exception:
                pass

        # 앱 설정: 지점별 키
        try:
            conn.execute(
                text(
                    "ALTER TABLE erp_app_settings ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES erp_stores(id)"
                )
            )
            conn.execute(
                text(
                    "UPDATE erp_app_settings SET store_id = 1 WHERE store_id IS NULL"
                )
            )
        except Exception:
            pass

        try:
            conn.execute(
                text("ALTER TABLE erp_app_settings DROP CONSTRAINT IF EXISTS erp_app_settings_key_key")
            )
        except Exception:
            pass
        try:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_app_settings_store_key ON erp_app_settings (store_id, key)"
                )
            )
        except Exception:
            pass

        # KDS 주문번호: 지점별 유일
        try:
            conn.execute(
                text("ALTER TABLE kds_orders DROP CONSTRAINT IF EXISTS kds_orders_order_number_key")
            )
        except Exception:
            pass
        try:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_kds_orders_store_order_number ON kds_orders (store_id, order_number)"
                )
            )
        except Exception:
            pass

        # 직원: 일급(평일/주말) 컬럼
        try:
            conn.execute(
                text(
                    "ALTER TABLE erp_employees ADD COLUMN IF NOT EXISTS daily_wage_weekday NUMERIC(12,2)"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE erp_employees ADD COLUMN IF NOT EXISTS daily_wage_weekend NUMERIC(12,2)"
                )
            )
        except Exception:
            pass

        # 사용자 권한 모드 (조회전용 / 직원·식자재 한정)
        try:
            conn.execute(
                text(
                    "ALTER TABLE erp_users ADD COLUMN IF NOT EXISTS access_mode VARCHAR(32) NOT NULL DEFAULT 'full'"
                )
            )
        except Exception:
            pass
