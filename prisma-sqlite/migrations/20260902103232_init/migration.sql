-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'PAPER',
    "selected_exchange" TEXT NOT NULL DEFAULT 'BINANCE',
    "selected_symbol" TEXT NOT NULL DEFAULT 'BTC/USDT',
    "initial_capital_usd" DECIMAL NOT NULL DEFAULT 10000,
    "current_equity_usd" DECIMAL NOT NULL DEFAULT 10000,
    "daily_start_equity_usd" DECIMAL NOT NULL DEFAULT 10000,
    "high_water_mark_usd" DECIMAL NOT NULL DEFAULT 10000,
    "max_drawdown_percent" DECIMAL NOT NULL DEFAULT 3.0,
    "autonomous_cycle_seconds" INTEGER NOT NULL DEFAULT 12,
    "auto_trading_enabled" BOOLEAN NOT NULL DEFAULT false,
    "engine_running" BOOLEAN NOT NULL DEFAULT false,
    "kill_switch_engaged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "config_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "config_type" TEXT NOT NULL,
    "previous_config_json" JSONB NOT NULL,
    "new_config_json" JSONB NOT NULL,
    "changed_by" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshot_hash" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "regime_at_decision" TEXT NOT NULL,
    "regime_confidence" DECIMAL NOT NULL,
    "trend_direction" TEXT,
    "volatility_state" TEXT,
    "macro_analyst_verdict" TEXT NOT NULL,
    "technical_strategist_verdict" TEXT NOT NULL,
    "contrarian_skeptic_verdict" TEXT NOT NULL,
    "risk_officer_verdict" TEXT NOT NULL,
    "cio_synthesizer_verdict" TEXT NOT NULL,
    "cio_final_verdict" TEXT NOT NULL,
    "confidence_score" DECIMAL NOT NULL,
    "edge_probability" DECIMAL NOT NULL,
    "synthesis_rationale" TEXT NOT NULL,
    "trade_hypothesis_json" JSONB,
    "engine_mode" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_order_id" TEXT NOT NULL,
    "exchange_order_id" TEXT,
    "decision_id" TEXT,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "order_type" TEXT NOT NULL DEFAULT 'MARKET',
    "price" DECIMAL NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "cost_usd" DECIMAL NOT NULL,
    "leverage" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "filled_quantity" DECIMAL NOT NULL DEFAULT 0,
    "avg_fill_price" DECIMAL,
    "total_fee_usd" DECIMAL NOT NULL DEFAULT 0,
    "slippage_percent" DECIMAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" DATETIME,
    "filled_at" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "orders_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fill_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "exchange_fill_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "fill_quantity" DECIMAL NOT NULL,
    "fill_price" DECIMAL NOT NULL,
    "fee_usd" DECIMAL NOT NULL,
    "fee_rate" DECIMAL NOT NULL,
    "liquidity" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_sequence" INTEGER NOT NULL,
    CONSTRAINT "fill_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originating_order_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entry_price" DECIMAL NOT NULL,
    "current_price" DECIMAL,
    "quantity" DECIMAL NOT NULL,
    "initial_quantity" DECIMAL NOT NULL,
    "leverage" DECIMAL NOT NULL,
    "initial_margin_usd" DECIMAL NOT NULL,
    "unrealized_pnl_usd" DECIMAL NOT NULL DEFAULT 0,
    "unrealized_pnl_percent" DECIMAL NOT NULL DEFAULT 0,
    "stop_loss_price" DECIMAL NOT NULL,
    "trailing_stop_price" DECIMAL,
    "take_profit_1_price" DECIMAL NOT NULL,
    "take_profit_2_price" DECIMAL NOT NULL,
    "take_profit_3_price" DECIMAL NOT NULL,
    "liquidation_price" DECIMAL NOT NULL,
    "realized_pnl_usd" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "close_reason" TEXT,
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "positions_originating_order_id_fkey" FOREIGN KEY ("originating_order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "position_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "position_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unrealized_pnl_usd" DECIMAL NOT NULL,
    "realized_pnl_usd" DECIMAL,
    "fee_usd" DECIMAL,
    "metadata_json" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_sequence" INTEGER NOT NULL,
    CONSTRAINT "position_events_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "risk_decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "decision_id" TEXT,
    "order_id" TEXT,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "veto_reason" TEXT,
    "checks_passed_json" JSONB NOT NULL,
    "max_allowed_risk_usd" DECIMAL NOT NULL,
    "recommended_position_size_usd" DECIMAL NOT NULL,
    "recommended_leverage" DECIMAL NOT NULL,
    "estimated_liquidation_price" DECIMAL NOT NULL,
    "kelly_fraction" DECIMAL NOT NULL,
    "circuit_breaker_status" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_decisions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reconciliation_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "db_state_json" JSONB NOT NULL,
    "exchange_state_json" JSONB NOT NULL,
    "discrepancy_description" TEXT NOT NULL,
    "resolution_action" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "system_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "metadata_json" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "market_data_candles" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "open" DECIMAL NOT NULL,
    "high" DECIMAL NOT NULL,
    "low" DECIMAL NOT NULL,
    "close" DECIMAL NOT NULL,
    "volume" DECIMAL NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "ingested_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "config_history_config_type_timestamp_idx" ON "config_history"("config_type", "timestamp");

-- CreateIndex
CREATE INDEX "decisions_symbol_exchange_created_at_idx" ON "decisions"("symbol", "exchange", "created_at");

-- CreateIndex
CREATE INDEX "decisions_cio_final_verdict_created_at_idx" ON "decisions"("cio_final_verdict", "created_at");

-- CreateIndex
CREATE INDEX "orders_symbol_exchange_status_idx" ON "orders"("symbol", "exchange", "status");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_client_order_id_exchange_symbol_key" ON "orders"("client_order_id", "exchange", "symbol");

-- CreateIndex
CREATE INDEX "fill_events_order_id_event_sequence_idx" ON "fill_events"("order_id", "event_sequence");

-- CreateIndex
CREATE INDEX "fill_events_timestamp_idx" ON "fill_events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "fill_events_exchange_fill_id_symbol_timestamp_key" ON "fill_events"("exchange_fill_id", "symbol", "timestamp");

-- CreateIndex
CREATE INDEX "positions_symbol_exchange_status_idx" ON "positions"("symbol", "exchange", "status");

-- CreateIndex
CREATE INDEX "positions_status_opened_at_idx" ON "positions"("status", "opened_at");

-- CreateIndex
CREATE INDEX "position_events_position_id_timestamp_idx" ON "position_events"("position_id", "timestamp");

-- CreateIndex
CREATE INDEX "position_events_event_type_timestamp_idx" ON "position_events"("event_type", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "position_events_position_id_event_sequence_key" ON "position_events"("position_id", "event_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "risk_decisions_decision_id_key" ON "risk_decisions"("decision_id");

-- CreateIndex
CREATE INDEX "risk_decisions_symbol_exchange_timestamp_idx" ON "risk_decisions"("symbol", "exchange", "timestamp");

-- CreateIndex
CREATE INDEX "risk_decisions_approved_timestamp_idx" ON "risk_decisions"("approved", "timestamp");

-- CreateIndex
CREATE INDEX "reconciliation_events_symbol_exchange_timestamp_idx" ON "reconciliation_events"("symbol", "exchange", "timestamp");

-- CreateIndex
CREATE INDEX "reconciliation_events_event_type_timestamp_idx" ON "reconciliation_events"("event_type", "timestamp");

-- CreateIndex
CREATE INDEX "reconciliation_events_severity_timestamp_idx" ON "reconciliation_events"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "system_events_event_type_timestamp_idx" ON "system_events"("event_type", "timestamp");

-- CreateIndex
CREATE INDEX "system_events_severity_timestamp_idx" ON "system_events"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "market_data_candles_symbol_exchange_interval_timestamp_idx" ON "market_data_candles"("symbol", "exchange", "interval", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "market_data_candles_symbol_exchange_interval_timestamp_key" ON "market_data_candles"("symbol", "exchange", "interval", "timestamp");
