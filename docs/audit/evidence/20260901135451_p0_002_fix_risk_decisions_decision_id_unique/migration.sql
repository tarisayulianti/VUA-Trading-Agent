/*
  Warnings:

  - The primary key for the `config_history` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `decisions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `fill_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `orders` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `position_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `positions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `reconciliation_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `risk_decisions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `system_config` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `system_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[decision_id]` on the table `risk_decisions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "fill_events" DROP CONSTRAINT "fill_events_order_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "fk_orders_decision";

-- DropForeignKey
ALTER TABLE "position_events" DROP CONSTRAINT "position_events_position_id_fkey";

-- DropForeignKey
ALTER TABLE "positions" DROP CONSTRAINT "positions_originating_order_id_fkey";

-- DropForeignKey
ALTER TABLE "risk_decisions" DROP CONSTRAINT "risk_decisions_decision_id_fkey";

-- DropIndex
DROP INDEX "idx_orders_decision_id";

-- DropIndex
DROP INDEX "idx_positions_originating_order_id";

-- DropIndex
DROP INDEX "idx_risk_decisions_decision_id";

-- AlterTable
ALTER TABLE "config_history" DROP CONSTRAINT "config_history_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "config_history_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "decisions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "fill_events" DROP CONSTRAINT "fill_events_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "fill_events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "market_data_candles" ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "ingested_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" DROP CONSTRAINT "orders_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "acknowledged_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "filled_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "position_events" DROP CONSTRAINT "position_events_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "position_events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "positions" DROP CONSTRAINT "positions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "opened_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "closed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "reconciliation_events" DROP CONSTRAINT "reconciliation_events_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "reconciliation_events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "risk_decisions" DROP CONSTRAINT "risk_decisions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "risk_decisions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "system_config" DROP CONSTRAINT "system_config_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "system_events" DROP CONSTRAINT "system_events_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "system_events_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_decisions_decision_id_key" ON "risk_decisions"("decision_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fill_events" ADD CONSTRAINT "fill_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_originating_order_id_fkey" FOREIGN KEY ("originating_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_events" ADD CONSTRAINT "position_events_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_decisions" ADD CONSTRAINT "risk_decisions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_config_history_type_timestamp" RENAME TO "config_history_config_type_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_decisions_final_verdict_created" RENAME TO "decisions_cio_final_verdict_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_decisions_symbol_exchange_created" RENAME TO "decisions_symbol_exchange_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_fill_events_order_sequence" RENAME TO "fill_events_order_id_event_sequence_idx";

-- RenameIndex
ALTER INDEX "idx_fill_events_timestamp" RENAME TO "fill_events_timestamp_idx";

-- RenameIndex
ALTER INDEX "uniq_exchange_fill_id_symbol_timestamp" RENAME TO "fill_events_exchange_fill_id_symbol_timestamp_key";

-- RenameIndex
ALTER INDEX "idx_candles_symbol_exchange_interval_timestamp" RENAME TO "market_data_candles_symbol_exchange_interval_timestamp_idx";

-- RenameIndex
ALTER INDEX "uniq_candle_symbol_exchange_interval_timestamp" RENAME TO "market_data_candles_symbol_exchange_interval_timestamp_key";

-- RenameIndex
ALTER INDEX "idx_orders_status_created_at" RENAME TO "orders_status_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_orders_symbol_exchange_status" RENAME TO "orders_symbol_exchange_status_idx";

-- RenameIndex
ALTER INDEX "uniq_client_order_id_exchange_symbol" RENAME TO "orders_client_order_id_exchange_symbol_key";

-- RenameIndex
ALTER INDEX "idx_position_events_position_timestamp" RENAME TO "position_events_position_id_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_position_events_type_timestamp" RENAME TO "position_events_event_type_timestamp_idx";

-- RenameIndex
ALTER INDEX "uniq_position_event_sequence" RENAME TO "position_events_position_id_event_sequence_key";

-- RenameIndex
ALTER INDEX "idx_positions_status_opened_at" RENAME TO "positions_status_opened_at_idx";

-- RenameIndex
ALTER INDEX "idx_positions_symbol_exchange_status" RENAME TO "positions_symbol_exchange_status_idx";

-- RenameIndex
ALTER INDEX "idx_reconciliation_events_severity_timestamp" RENAME TO "reconciliation_events_severity_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_reconciliation_events_symbol_exchange_timestamp" RENAME TO "reconciliation_events_symbol_exchange_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_reconciliation_events_type_timestamp" RENAME TO "reconciliation_events_event_type_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_risk_decisions_approved_timestamp" RENAME TO "risk_decisions_approved_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_risk_decisions_symbol_exchange_timestamp" RENAME TO "risk_decisions_symbol_exchange_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_system_events_severity_timestamp" RENAME TO "system_events_severity_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_system_events_type_timestamp" RENAME TO "system_events_event_type_timestamp_idx";
