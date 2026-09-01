import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type TestResult =
  | { ok: true; label: string }
  | { ok: false; label: string; error: unknown };

async function run() {
  const results: TestResult[] = [];

  function assert(ok: boolean, label: string, error?: unknown) {
    results.push(ok ? { ok: true, label } : { ok: false, label, error });
  }

  function safeJson(value: unknown) {
    return JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? Number(val) : val), 2);
  }

  async function cleanup() {
    try {
      await prisma.position_events.deleteMany();
    } catch {}
    try {
      await prisma.positions.deleteMany();
    } catch {}
    try {
      await prisma.fill_events.deleteMany();
    } catch {}
    try {
      await prisma.orders.deleteMany();
    } catch {}
    try {
      await prisma.risk_decisions.deleteMany();
    } catch {}
    try {
      await prisma.decisions.deleteMany();
    } catch {}
    try {
      await prisma.system_config.deleteMany();
    } catch {}
  }

  try {
    await cleanup();

    // Phase 3 - Basic CRUD
    const decision = await prisma.decisions.create({
      data: {
        snapshot_hash: 'snapshot-1',
        symbol: 'BTC/USDT',
        exchange: 'BINANCE',
        regime_at_decision: 'BULLISH',
        regime_confidence: 0.95,
        macro_analyst_verdict: 'LONG',
        technical_strategist_verdict: 'LONG',
        contrarian_skeptic_verdict: 'NEUTRAL',
        risk_officer_verdict: 'APPROVED',
        cio_synthesizer_verdict: 'LONG',
        cio_final_verdict: 'PROPOSE_LONG',
        confidence_score: 0.88,
        edge_probability: 0.72,
        synthesis_rationale: 'Test rationale',
        engine_mode: 'NEURAL_GEMINI',
      },
    });
    assert(typeof decision.id === 'string', 'create decision', !decision.id ? new Error('missing id') : undefined);

    const order = await prisma.orders.create({
      data: {
        client_order_id: `test-${decision.id}`,
        exchange_order_id: 'exchange-1',
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
    assert(order.id != null, 'create order', order.id == null ? new Error('missing id') : undefined);

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
    assert(riskDecision.id != null, 'create risk_decision', riskDecision.id == null ? new Error('missing id') : undefined);

    const fillEvent = await prisma.fill_events.create({
      data: {
        order_id: order.id,
        exchange_fill_id: 'fill-1',
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
    assert(fillEvent.id != null, 'create fill_event', fillEvent.id == null ? new Error('missing id') : undefined);

    const position = await prisma.positions.create({
      data: {
        originating_order_id: order.id,
        symbol: 'BTC/USDT',
        exchange: 'BINANCE',
        side: 'LONG',
        entry_price: 50000,
        quantity: 0.01,
        initial_quantity: 0.01,
        leverage: 1,
        initial_margin_usd: 500,
        stop_loss_price: 45000,
        take_profit_1_price: 55000,
        take_profit_2_price: 60000,
        take_profit_3_price: 65000,
        liquidation_price: 25000,
        status: 'OPEN',
      },
    });
    assert(position.id != null, 'create position', position.id == null ? new Error('missing id') : undefined);

    const positionEvent = await prisma.position_events.create({
      data: {
        position_id: position.id,
        event_type: 'OPENED',
        price: 50000,
        quantity: 0.01,
        unrealized_pnl_usd: 0,
        event_sequence: 1,
      },
    });
    assert(positionEvent.id != null, 'create position_event', positionEvent.id == null ? new Error('missing id') : undefined);

    // Phase 4 - Relation verification
    const decisionWithRelations = await prisma.decisions.findUnique({
      where: { id: decision.id },
      include: {
        orders: true,
        risk_decision: true,
      },
    });
    assert(!!decisionWithRelations?.orders?.length, 'decision has orders', decisionWithRelations);
    assert(!!decisionWithRelations?.risk_decision, 'decision has risk_decision', decisionWithRelations);

    const orderWithRelations = await prisma.orders.findUnique({
      where: { id: order.id },
      include: {
        fill_events: true,
        positions: true,
      },
    });
    assert(!!orderWithRelations?.fill_events?.length, 'order has fill_events', orderWithRelations);
    assert(!!orderWithRelations?.positions?.length, 'order has positions', orderWithRelations);

    const positionWithEvents = await prisma.positions.findUnique({
      where: { id: position.id },
      include: {
        position_events: true,
      },
    });
    assert(!!positionWithEvents?.position_events?.length, 'position has position_events', positionWithEvents);

    // Phase 5 - UNIQUE constraint test
    try {
      await prisma.risk_decisions.create({
        data: {
          decision_id: decision.id,
          symbol: 'BTC/USDT',
          exchange: 'BINANCE',
          approved: false,
          checks_passed_json: {},
          max_allowed_risk_usd: 1000,
          recommended_position_size_usd: 500,
          recommended_leverage: 1,
          estimated_liquidation_price: 25000,
          kelly_fraction: 0.25,
          circuit_breaker_status: 'NORMAL',
        },
      });
      assert(false, 'unique constraint enforcement', new Error('UNIQUE constraint did not reject duplicate'));
    } catch {
      assert(true, 'unique constraint enforcement');
    }

    const duplicateCheck = await prisma.risk_decisions.count({
      where: { decision_id: decision.id },
    });
    assert(duplicateCheck === 1, 'no duplicate risk_decision after unique rejection', { count: duplicateCheck });

    // Phase 6 - FK negative tests
    const invalidUuid = '00000000-0000-0000-0000-000000000000';
    
    try {
      await prisma.orders.create({
        data: {
          client_order_id: 'invalid-decision-order',
          decision_id: invalidUuid,
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
      assert(false, 'fk rejection: order -> nonexistent decision', new Error('FK not enforced'));
    } catch {
      assert(true, 'fk rejection: order -> nonexistent decision');
    }

    try {
      await prisma.fill_events.create({
        data: {
          order_id: invalidUuid,
          exchange_fill_id: 'invalid-fill',
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
      assert(false, 'fk rejection: fill_event -> nonexistent order', new Error('FK not enforced'));
    } catch {
      assert(true, 'fk rejection: fill_event -> nonexistent order');
    }

    try {
      await prisma.positions.create({
        data: {
          originating_order_id: invalidUuid,
          symbol: 'BTC/USDT',
          exchange: 'BINANCE',
          side: 'LONG',
          entry_price: 50000,
          quantity: 0.01,
          initial_quantity: 0.01,
          leverage: 1,
          initial_margin_usd: 500,
          stop_loss_price: 45000,
          take_profit_1_price: 55000,
          take_profit_2_price: 60000,
          take_profit_3_price: 65000,
          liquidation_price: 25000,
          status: 'OPEN',
        },
      });
      assert(false, 'fk rejection: position -> nonexistent order', new Error('FK not enforced'));
    } catch {
      assert(true, 'fk rejection: position -> nonexistent order');
    }

    try {
      await prisma.position_events.create({
        data: {
          position_id: invalidUuid,
          event_type: 'OPENED',
          price: 50000,
          quantity: 0.01,
          unrealized_pnl_usd: 0,
          event_sequence: 1,
        },
      });
      assert(false, 'fk rejection: position_event -> nonexistent position', new Error('FK not enforced'));
    } catch {
      assert(true, 'fk rejection: position_event -> nonexistent position');
    }

    try {
      await prisma.risk_decisions.create({
        data: {
          decision_id: invalidUuid,
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
      assert(false, 'fk rejection: risk_decision -> nonexistent decision', new Error('FK not enforced'));
    } catch {
      assert(true, 'fk rejection: risk_decision -> nonexistent decision');
    }

    // Phase 7 - Transaction commit
    const txDecision = await prisma.$transaction(async (tx) => {
      const d = await tx.decisions.create({
        data: {
          snapshot_hash: 'snapshot-tx',
          symbol: 'ETH/USDT',
          exchange: 'BINANCE',
          regime_at_decision: 'NEUTRAL',
          regime_confidence: 0.7,
          macro_analyst_verdict: 'NEUTRAL',
          technical_strategist_verdict: 'NEUTRAL',
          contrarian_skeptic_verdict: 'NEUTRAL',
          risk_officer_verdict: 'APPROVED',
          cio_synthesizer_verdict: 'NEUTRAL',
          cio_final_verdict: 'NO_TRADE',
          confidence_score: 0.6,
          edge_probability: 0.5,
          synthesis_rationale: 'tx commit test',
          engine_mode: 'NEURAL_GEMINI',
        },
      });
      const o = await tx.orders.create({
        data: {
          client_order_id: `tx-${d.id}`,
          decision_id: d.id,
          symbol: 'ETH/USDT',
          exchange: 'BINANCE',
          side: 'SELL',
          order_type: 'MARKET',
          price: 3000,
          quantity: 1,
          cost_usd: 3000,
          leverage: 1,
          status: 'SUBMITTED',
          filled_quantity: 0,
          total_fee_usd: 0,
          slippage_percent: 0,
        },
      });
      const f = await tx.fill_events.create({
        data: {
          order_id: o.id,
          exchange_fill_id: `tx-fill-${o.id}`,
          symbol: 'ETH/USDT',
          exchange: 'BINANCE',
          side: 'SELL',
          fill_quantity: 1,
          fill_price: 3000,
          fee_usd: 0.3,
          fee_rate: 0.001,
          event_sequence: 1,
        },
      });
      const p = await tx.positions.create({
        data: {
          originating_order_id: o.id,
          symbol: 'ETH/USDT',
          exchange: 'BINANCE',
          side: 'SHORT',
          entry_price: 3000,
          quantity: 1,
          initial_quantity: 1,
          leverage: 1,
          initial_margin_usd: 3000,
          stop_loss_price: 3300,
          take_profit_1_price: 2700,
          take_profit_2_price: 2400,
          take_profit_3_price: 2100,
          liquidation_price: 6000,
          status: 'OPEN',
        },
      });
      const pe = await tx.position_events.create({
        data: {
          position_id: p.id,
          event_type: 'OPENED',
          price: 3000,
          quantity: 1,
          unrealized_pnl_usd: 0,
          event_sequence: 1,
        },
      });
      return { decisionId: d.id, orderId: o.id, fillId: f.id, positionId: p.id, positionEventId: pe.id };
    });

    const txDecisionRecord = await prisma.decisions.findUnique({
      where: { id: txDecision.decisionId },
      include: { orders: { include: { fill_events: true, positions: { include: { position_events: true } } } } },
    });
    assert(!!txDecisionRecord?.orders?.[0], 'transaction commit: decision and order exist', txDecisionRecord);
    assert(txDecisionRecord?.orders?.[0]?.fill_events?.length === 1, 'transaction commit: fill_event exists', txDecisionRecord);
    assert(txDecisionRecord?.orders?.[0]?.positions?.[0]?.position_events?.length === 1, 'transaction commit: position_event exists', txDecisionRecord);

    // Phase 8 - Transaction rollback
    let rollbackDecisionId: string | undefined;
    try {
      await prisma.$transaction(async (tx) => {
        const d = await tx.decisions.create({
          data: {
            snapshot_hash: 'snapshot-rollback',
            symbol: 'SOL/USDT',
            exchange: 'BINANCE',
            regime_at_decision: 'BEARISH',
            regime_confidence: 0.8,
            macro_analyst_verdict: 'SHORT',
            technical_strategist_verdict: 'SHORT',
            contrarian_skeptic_verdict: 'NEUTRAL',
            risk_officer_verdict: 'APPROVED',
            cio_synthesizer_verdict: 'SHORT',
            cio_final_verdict: 'PROPOSE_SHORT',
            confidence_score: 0.75,
            edge_probability: 0.6,
            synthesis_rationale: 'rollback test',
            engine_mode: 'NEURAL_GEMINI',
          },
        });
        rollbackDecisionId = d.id;
        await tx.orders.create({
          data: {
            client_order_id: `rollback-${d.id}`,
            decision_id: d.id,
            symbol: 'SOL/USDT',
            exchange: 'BINANCE',
            side: 'SELL',
            order_type: 'MARKET',
            price: 150,
            quantity: 10,
            cost_usd: 1500,
            leverage: 1,
            status: 'SUBMITTED',
            filled_quantity: 0,
            total_fee_usd: 0,
            slippage_percent: 0,
          },
        });
        await prisma.decisions.findFirstOrThrow({ where: { id: '00000000-0000-0000-0000-000000000000' } });
      });
    } catch {
      assert(true, 'transaction rollback failure caught');
    }

    if (rollbackDecisionId) {
      const rollbackRecord = await prisma.decisions.findUnique({ where: { id: rollbackDecisionId } });
      assert(!rollbackRecord, 'transaction rollback: decision removed', rollbackRecord ? new Error('decision still exists') : undefined);
    }

    // Cleanup any leftover rollback records if they were not rolled back
    if (rollbackDecisionId) {
      try {
        await prisma.orders.deleteMany({ where: { client_order_id: { startsWith: 'rollback-' } } });
        await prisma.decisions.deleteMany({ where: { id: rollbackDecisionId } });
      } catch {}
    }

    // Phase 9 - Cleanup
    await cleanup();
    await prisma.$queryRaw`TRUNCATE TABLE fill_events, orders, position_events, positions, risk_decisions, decisions, reconciliation_events, system_events, market_data_candles, config_history RESTART IDENTITY`;

    console.log(safeJson({ results }));
  } catch (error) {
    console.error('CRUD validation failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
