#!/usr/bin/env python3
"""
P0-002 PostgreSQL Schema Validation — Minimal check that core entities exist.
Task scope: P0-002 only (persistence foundation). No trading logic.
"""
import psycopg2
import os
import sys

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/vua_trading")

REQUIRED_TABLES = [
    "system_config",
    "orders",
    "fill_events",
    "positions",
    "position_events",
    "decisions",
    "risk_decisions",
    "config_history",
    "reconciliation_events",
    "system_events",
    "market_data_candles",
]

REQUIRED_CONSTRAINTS = [
    ("orders", "uniq_client_order_id_exchange_symbol"),  # UNIQUE(client_order_id, exchange, symbol)
]

def main():
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        failures = []
        for table in REQUIRED_TABLES:
            cur.execute("SELECT to_regclass(%s)", (table,))
            result = cur.fetchone()
            if result[0] is None:
                failures.append(f"Table missing: {table}")
            else:
                print(f"  ✓ Table exists: {table}")
        # Check orders idempotency unique constraint by inspecting pg_constraint
        cur.execute("SELECT conname FROM pg_constraint WHERE conrelid = 'orders'::regclass AND contype = 'u'")
        uniques = [r[0] for r in cur.fetchall()]
        if any("client_order_id" in u for u in uniques):
            print(f"  ✓ Idempotency constraint found: orders(client_order_id, ...)")
        else:
            failures.append("orders idempotency unique constraint missing")
        if failures:
            print("FAILED:")
            for f in failures:
                print(f"  ✗ {f}")
            sys.exit(1)
        else:
            print("P0-002 SCHEMA VALIDATION: PASS")
            sys.exit(0)
    except Exception as e:
        print(f"Connection or validation error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
