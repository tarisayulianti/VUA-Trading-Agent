-- VUA Trading Agent — TASK-P0-002 Initial Migration
-- This migration creates the foundation schema for VUA persistence.
-- All tables follow ADR-002 Source-of-Truth model.
-- Reconciliation engine and exchange integration are NOT implemented in P0-002.

-- ============================================================
-- System Configuration
-- ============================================================
CREATE TABLE "system_config" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'PAPER',
    "selected_exchange" TEXT NOT NULL DEFAULT 'BINANCE',
    "selected_symbol" TEXT NOT NULL DEFAULT 'BTC/USDT',
    "initial_capital_usd" DECIMAL(18,4) NOT NULL DEFAULT 10000,
    "current_equity_usd" DECIMAL(18,4) NOT NULL DEFAULT 10000,
    "daily_start_equity_usd" DECIMAL(18,4) NOT NULL DEFAULT 10000,
    "high_water_mark_usd" DECIMAL(18,4) NOT NULL DEFAULT 10000,
    "max_drawdown_percent" DECIMAL(8,4) NOT NULL DEFAULT 3.0,
    "autonomous_cycle_seconds" INTEGER NOT NULL DEFAULT 12,
    "auto_trading_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "engine_running" BOOLEAN NOT NULL DEFAULT FALSE,
    "kill_switch_engaged" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Orders (SUBMITTED state)
-- ============================================================
CREATE TABLE "orders" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "client_order_id" TEXT NOT NULL,
    "exchange_order_id" TEXT,
    "decision_id" UUID,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "order_type" TEXT NOT NULL DEFAULT 'MARKET',
    "price" DECIMAL(20,8) NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "cost_usd" DECIMAL(18,4) NOT NULL,
    "leverage" DECIMAL(8,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "filled_quantity" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "avg_fill_price" DECIMAL(20,8),
    "total_fee_usd" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "slippage_percent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "acknowledged_at" TIMESTAMP,
    "filled_at" TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "uniq_client_order_id_exchange_symbol" UNIQUE ("client_order_id", "exchange", "symbol")
);

CREATE INDEX "idx_orders_symbol_exchange_status" ON "orders" ("symbol", "exchange", "status");
CREATE INDEX "idx_orders_status_created_at" ON "orders" ("status", "created_at");
CREATE INDEX "idx_orders_decision_id" ON "orders" ("decision_id");

-- ============================================================
-- Fill Events (Append-Only — OBSERVED)
-- ============================================================
CREATE TABLE "fill_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
    "exchange_fill_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "fill_quantity" DECIMAL(24,8) NOT NULL,
    "fill_price" DECIMAL(20,8) NOT NULL,
    "fee_usd" DECIMAL(18,4) NOT NULL,
    "fee_rate" DECIMAL(8,6) NOT NULL,
    "liquidity" TEXT,
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
    "event_sequence" INTEGER NOT NULL,
    CONSTRAINT "uniq_exchange_fill_id_symbol_timestamp" UNIQUE ("exchange_fill_id", "symbol", "timestamp")
);

CREATE INDEX "idx_fill_events_order_sequence" ON "fill_events" ("order_id", "event_sequence");
CREATE INDEX "idx_fill_events_timestamp" ON "fill_events" ("timestamp");

-- ============================================================
-- Positions (Reconciled Current State)
-- ============================================================
CREATE TABLE "positions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "originating_order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entry_price" DECIMAL(20,8) NOT NULL,
    "current_price" DECIMAL(20,8),
    "quantity" DECIMAL(24,8) NOT NULL,
    "initial_quantity" DECIMAL(24,8) NOT NULL,
    "leverage" DECIMAL(8,2) NOT NULL,
    "initial_margin_usd" DECIMAL(18,4) NOT NULL,
    "unrealized_pnl_usd" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unrealized_pnl_percent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "stop_loss_price" DECIMAL(20,8) NOT NULL,
    "trailing_stop_price" DECIMAL(20,8),
    "take_profit_1_price" DECIMAL(20,8) NOT NULL,
    "take_profit_2_price" DECIMAL(20,8) NOT NULL,
    "take_profit_3_price" DECIMAL(20,8) NOT NULL,
    "liquidation_price" DECIMAL(20,8) NOT NULL,
    "realized_pnl_usd" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "close_reason" TEXT,
    "opened_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "closed_at" TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_positions_symbol_exchange_status" ON "positions" ("symbol", "exchange", "status");
CREATE INDEX "idx_positions_status_opened_at" ON "positions" ("status", "opened_at");
CREATE INDEX "idx_positions_originating_order_id" ON "positions" ("originating_order_id");

-- ============================================================
-- Position Events (Append-Only)
-- ============================================================
CREATE TABLE "position_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "position_id" UUID NOT NULL REFERENCES "positions"("id") ON DELETE RESTRICT,
    "event_type" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "unrealized_pnl_usd" DECIMAL(18,4) NOT NULL,
    "realized_pnl_usd" DECIMAL(18,4),
    "fee_usd" DECIMAL(18,4),
    "metadata_json" JSONB,
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
    "event_sequence" INTEGER NOT NULL,
    CONSTRAINT "uniq_position_event_sequence" UNIQUE ("position_id", "event_sequence")
);

CREATE INDEX "idx_position_events_position_timestamp" ON "position_events" ("position_id", "timestamp");
CREATE INDEX "idx_position_events_type_timestamp" ON "position_events" ("event_type", "timestamp");

-- ============================================================
-- Decisions (AI Proposals)
-- ============================================================
CREATE TABLE "decisions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "snapshot_hash" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "regime_at_decision" TEXT NOT NULL,
    "regime_confidence" DECIMAL(6,4) NOT NULL,
    "trend_direction" TEXT,
    "volatility_state" TEXT,
    "macro_analyst_verdict" TEXT NOT NULL,
    "technical_strategist_verdict" TEXT NOT NULL,
    "contrarian_skeptic_verdict" TEXT NOT NULL,
    "risk_officer_verdict" TEXT NOT NULL,
    "cio_synthesizer_verdict" TEXT NOT NULL,
    "cio_final_verdict" TEXT NOT NULL,
    "confidence_score" DECIMAL(6,4) NOT NULL,
    "edge_probability" DECIMAL(6,4) NOT NULL,
    "synthesis_rationale" TEXT NOT NULL,
    "trade_hypothesis_json" JSONB,
    "engine_mode" TEXT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_decisions_symbol_exchange_created" ON "decisions" ("symbol", "exchange", "created_at");
CREATE INDEX "idx_decisions_final_verdict_created" ON "decisions" ("cio_final_verdict", "created_at");

-- ============================================================
-- Risk Decisions (Append-Only — Hard Veto Audit)
-- ============================================================
CREATE TABLE "risk_decisions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "decision_id" UUID REFERENCES "decisions"("id") ON DELETE SET NULL,
    "order_id" UUID,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "veto_reason" TEXT,
    "checks_passed_json" JSONB NOT NULL,
    "max_allowed_risk_usd" DECIMAL(18,4) NOT NULL,
    "recommended_position_size_usd" DECIMAL(18,4) NOT NULL,
    "recommended_leverage" DECIMAL(8,2) NOT NULL,
    "estimated_liquidation_price" DECIMAL(20,8) NOT NULL,
    "kelly_fraction" DECIMAL(8,4) NOT NULL,
    "circuit_breaker_status" TEXT NOT NULL,
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_risk_decisions_symbol_exchange_timestamp" ON "risk_decisions" ("symbol", "exchange", "timestamp");
CREATE INDEX "idx_risk_decisions_approved_timestamp" ON "risk_decisions" ("approved", "timestamp");
CREATE INDEX "idx_risk_decisions_decision_id" ON "risk_decisions" ("decision_id");

-- ============================================================
-- Config History (Append-Only)
-- ============================================================
CREATE TABLE "config_history" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "config_type" TEXT NOT NULL,
    "previous_config_json" JSONB NOT NULL,
    "new_config_json" JSONB NOT NULL,
    "changed_by" TEXT NOT NULL,
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_config_history_type_timestamp" ON "config_history" ("config_type", "timestamp");

-- ============================================================
-- Reconciliation Events (Append-Only — RECONCILED)
-- ============================================================
CREATE TABLE "reconciliation_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "db_state_json" JSONB NOT NULL,
    "exchange_state_json" JSONB NOT NULL,
    "discrepancy_description" TEXT NOT NULL,
    "resolution_action" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_reconciliation_events_symbol_exchange_timestamp" ON "reconciliation_events" ("symbol", "exchange", "timestamp");
CREATE INDEX "idx_reconciliation_events_type_timestamp" ON "reconciliation_events" ("event_type", "timestamp");
CREATE INDEX "idx_reconciliation_events_severity_timestamp" ON "reconciliation_events" ("severity", "timestamp");

-- ============================================================
-- System Events (Append-Only)
-- ============================================================
CREATE TABLE "system_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "metadata_json" JSONB,
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_system_events_type_timestamp" ON "system_events" ("event_type", "timestamp");
CREATE INDEX "idx_system_events_severity_timestamp" ON "system_events" ("severity", "timestamp");

-- ============================================================
-- Market Data Candles (Historical — NOT Real-Time)
-- ============================================================
CREATE TABLE "market_data_candles" (
    "id" BIGSERIAL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "open" DECIMAL(20,8) NOT NULL,
    "high" DECIMAL(20,8) NOT NULL,
    "low" DECIMAL(20,8) NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,
    "volume" DECIMAL(24,8) NOT NULL,
    "timestamp" TIMESTAMP NOT NULL,
    "ingested_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "uniq_candle_symbol_exchange_interval_timestamp" UNIQUE ("symbol", "exchange", "interval", "timestamp")
);

CREATE INDEX "idx_candles_symbol_exchange_interval_timestamp" ON "market_data_candles" ("symbol", "exchange", "interval", "timestamp");

-- Foreign key constraints added after all tables exist
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_decision" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE SET NULL;

-- Insert default system config
INSERT INTO "system_config" (id) VALUES (gen_random_uuid());
