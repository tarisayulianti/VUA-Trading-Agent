import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const decision = await prisma.decisions.create({
    data: {
      snapshot_hash: 'persistence-snapshot',
      symbol: 'BTC/USDT',
      exchange: 'BINANCE',
      regime_at_decision: 'BULLISH',
      regime_confidence: 0.9,
      macro_analyst_verdict: 'LONG',
      technical_strategist_verdict: 'LONG',
      contrarian_skeptic_verdict: 'NEUTRAL',
      risk_officer_verdict: 'APPROVED',
      cio_synthesizer_verdict: 'LONG',
      cio_final_verdict: 'PROPOSE_LONG',
      confidence_score: 0.85,
      edge_probability: 0.7,
      synthesis_rationale: 'Persistence sentinel decision',
      engine_mode: 'NEURAL_GEMINI',
    },
  });

  const order = await prisma.orders.create({
    data: {
      client_order_id: `persist-${decision.id}`,
      decision_id: decision.id,
      symbol: 'BTC/USDT',
      exchange: 'BINANCE',
      side: 'BUY',
      order_type: 'MARKET',
      price: 50000,
      quantity: 0.01,
      cost_usd: 500,
      leverage: 1,
      status: 'SUBMITTED',
      filled_quantity: 0,
      total_fee_usd: 0,
      slippage_percent: 0,
    },
  });

  const fillEvent = await prisma.fill_events.create({
    data: {
      order_id: order.id,
      exchange_fill_id: `persist-fill-${order.id}`,
      symbol: 'BTC/USDT',
      exchange: 'BINANCE',
      side: 'BUY',
      fill_quantity: 0.01,
      fill_price: 50000,
      fee_usd: 0.5,
      fee_rate: 0.001,
      event_sequence: 1,
    },
  });

  const riskDecision = await prisma.risk_decisions.create({
    data: {
      decision_id: decision.id,
      symbol: 'BTC/USDT',
      exchange: 'BINANCE',
      approved: true,
      checks_passed_json: {},
      max_allowed_risk_usd: 1000,
      recommended_position_size_usd: 500,
      recommended_leverage: 1,
      estimated_liquidation_price: 25000,
      kelly_fraction: 0.25,
      circuit_breaker_status: 'NORMAL',
    },
  });

  console.log(JSON.stringify({
    decision: { id: decision.id },
    order: { id: order.id, decision_id: order.decision_id },
    fillEvent: { id: fillEvent.id, order_id: fillEvent.order_id },
    riskDecision: { id: riskDecision.id, decision_id: riskDecision.decision_id },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('Failed to create sentinel data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
