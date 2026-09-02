import { Router, Request, Response } from 'express';
import {
  ExchangeId,
  MarketPerceptionSnapshot,
  MultiAgentDebate,
  TradeHypothesis,
  RiskCheckResult,
} from '../../src/types/trading';
import { binanceService } from '../services/binance';
import { bybitService } from '../services/bybit';
import { computeAllIndicators } from '../services/indicators';
import { assessMarketRegime } from '../services/regime';
import { conductMultiAgentDebate } from '../services/multiAgentBrain';
import { riskEngine } from '../services/riskEngine';
import { executionEngine } from '../services/executionEngine';
import { memoryLedger } from '../services/memoryLedger';
import { researchLab } from '../services/researchLab';
import { getGeminiCircuitBreakerStatus } from '../services/geminiClient';
import { db } from '../db';

export const apiRouter = Router();

// In-memory runtime state
let selectedExchange: ExchangeId = 'binance';
let selectedSymbol = 'BTC/USDT';
let engineRunning = true;
let autoTradingEnabled = false;
let autonomousCycleSeconds = 12;
let lastAutonomousCycleTime = Date.now();
let lastDeliberation: MultiAgentDebate | null = null;
let lastRiskCheck: RiskCheckResult | null = null;
let sseClients: Response[] = [];

// Helper to fetch live snapshot
async function fetchCurrentPerceptionSnapshot(
  exchange: ExchangeId = selectedExchange,
  symbol: string = selectedSymbol
): Promise<MarketPerceptionSnapshot> {
  const service = exchange === 'bybit' ? bybitService : binanceService;

  const [ticker, orderBook, recentCandles] = await Promise.all([
    service.getTicker(symbol),
    service.getOrderBook(symbol, 20),
    service.getKlines(symbol, '15m', 50),
  ]);

  const indicators = computeAllIndicators(recentCandles, orderBook);
  const regime = assessMarketRegime(recentCandles, indicators, orderBook, ticker.fundingRate);

  return {
    symbol,
    exchange,
    ticker,
    orderBook,
    indicators,
    regime,
    recentCandles,
    timestamp: Date.now(),
  };
}

// Broadcast SSE event to clients
function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch (e) {
      // client disconnected
    }
  });
}

// Background autonomous perception and position tick loop
setInterval(async () => {
  if (!engineRunning) return;

  try {
    const snapshot = await fetchCurrentPerceptionSnapshot();
    
    // Update active positions against latest tick
    const { closedTrades } = executionEngine.updatePositionsWithTick(
      selectedSymbol,
      snapshot.ticker,
      snapshot.regime.regime
    );

    // Update memory ledger if positions closed
    for (const trade of closedTrades) {
      memoryLedger.updateEquityFromClosedTrade(trade);
      broadcastSSE('trade_closed', trade);
    }

    // Broadcast live tick to SSE clients
    broadcastSSE('market_tick', {
      ticker: snapshot.ticker,
      indicators: snapshot.indicators,
      regime: snapshot.regime,
      positions: executionEngine.getPositions(),
      equity: memoryLedger.getEquity(),
    });

    // Check circuit breaker status
    const dailyPnl = memoryLedger.getDailyRealizedPnl(executionEngine.getClosedTrades());
    const isCircuitBreakerActive =
      dailyPnl.dailyPnlPercent <= -riskEngine.getConfig().maxDailyDrawdownPercent;

    // Autonomous cycle check
    const now = Date.now();
    if (
      autoTradingEnabled &&
      !isCircuitBreakerActive &&
      !riskEngine.getConfig().killSwitchEngaged &&
      now - lastAutonomousCycleTime >= autonomousCycleSeconds * 1000
    ) {
      lastAutonomousCycleTime = now;
      console.log(`[AUTONOMOUS CYCLE] Running closed-loop perception & reasoning on ${selectedSymbol}...`);

      // 1. Multi-Agent Reasoning
      const debate = await conductMultiAgentDebate(snapshot);
      lastDeliberation = debate;
      broadcastSSE('agent_debate', debate);

      // 2. Risk Check
      if (debate.cioSynthesizer.finalVerdict !== 'NO_TRADE' && debate.cioSynthesizer.tradeHypothesis) {
        const hypothesis = debate.cioSynthesizer.tradeHypothesis;
        const currentEquity = memoryLedger.getEquity();
        const currentDd = memoryLedger.getCurrentDrawdownPercent();

        const riskResult = riskEngine.evaluateTradeRisk(
          hypothesis,
          currentEquity,
          currentDd,
          executionEngine.getPositions(),
          snapshot.ticker,
          snapshot.orderBook
        );
        lastRiskCheck = riskResult;
        broadcastSSE('risk_check', riskResult);

        // 3. Execution (Only if Risk Engine approves with absolute veto power)
        if (riskResult.approved) {
          const { order, position } = await executionEngine.executeApprovedTrade(
            hypothesis,
            riskResult,
            snapshot.ticker,
            snapshot.regime.regime,
            debate.cioSynthesizer.synthesisRationale
          );
          broadcastSSE('order_executed', { order, position });
          console.log(`[AUTONOMOUS EXECUTION] Position opened: ${position.side} ${position.symbol} @ $${position.entryPrice}`);
        } else {
          console.log(`[RISK VETO] Trade vetoed by Risk Officer: ${riskResult.vetoReason}`);
        }
      }
    }
  } catch (err) {
    console.error('Error in autonomous tick loop:', err);
  }
}, 3000);

// --- ROUTES ---

// 1. GET /api/status - Complete System Status
apiRouter.get('/status', (req: Request, res: Response) => {
  const openPositions = executionEngine.getPositions();
  const closedTrades = executionEngine.getClosedTrades();
  const dailyPnl = memoryLedger.getDailyRealizedPnl(closedTrades);
  const circuitBreakerActive = dailyPnl.dailyPnlPercent <= -riskEngine.getConfig().maxDailyDrawdownPercent;
  const killSwitchEngaged = riskEngine.getConfig().killSwitchEngaged;

  const status = memoryLedger.computeSystemStatus(
    engineRunning,
    executionEngine.getExecutionMode(),
    selectedExchange,
    selectedSymbol,
    openPositions,
    closedTrades,
    circuitBreakerActive,
    killSwitchEngaged,
    autoTradingEnabled,
    autonomousCycleSeconds,
    lastAutonomousCycleTime
  );

  res.json({
    status,
    lastDeliberation,
    lastRiskCheck,
    riskConfig: riskEngine.getConfig(),
    credentials: executionEngine.getCredentialsStatus(),
    geminiStatus: getGeminiCircuitBreakerStatus(),
    syntheticDataMode: process.env.USE_SYNTHETIC_DATA === 'true',
  });
});

// 2. GET /api/market - Current Perception Snapshot
apiRouter.get('/market', async (req: Request, res: Response) => {
  try {
    const exchange = (req.query.exchange as ExchangeId) || selectedExchange;
    const symbol = (req.query.symbol as string) || selectedSymbol;
    const snapshot = await fetchCurrentPerceptionSnapshot(exchange, symbol);
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch market snapshot' });
  }
});

// 3. POST /api/market/select - Select Exchange or Symbol
apiRouter.post('/market/select', (req: Request, res: Response) => {
  const { exchange, symbol } = req.body;
  if (exchange && (exchange === 'binance' || exchange === 'bybit')) {
    selectedExchange = exchange;
  }
  if (symbol && typeof symbol === 'string') {
    selectedSymbol = symbol;
  }
  res.json({ success: true, selectedExchange, selectedSymbol });
});

// 4. POST /api/deliberate - Run Multi-Agent Deliberation
apiRouter.post('/deliberate', async (req: Request, res: Response) => {
  try {
    const snapshot = await fetchCurrentPerceptionSnapshot();
    const debate = await conductMultiAgentDebate(snapshot);
    lastDeliberation = debate;

    let riskResult: RiskCheckResult | null = null;
    if (debate.cioSynthesizer.tradeHypothesis) {
      riskResult = riskEngine.evaluateTradeRisk(
        debate.cioSynthesizer.tradeHypothesis,
        memoryLedger.getEquity(),
        memoryLedger.getCurrentDrawdownPercent(),
        executionEngine.getPositions(),
        snapshot.ticker,
        snapshot.orderBook
      );
      lastRiskCheck = riskResult;
    }

    res.json({ debate, riskCheck: riskResult });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Deliberation failed' });
  }
});

// 5. POST /api/trade/execute - Execute Trade Hypothesis
apiRouter.post('/trade/execute', async (req: Request, res: Response) => {
  try {
    const { hypothesis } = req.body as { hypothesis: TradeHypothesis };
    if (!hypothesis) {
      return res.status(400).json({ error: 'Trade hypothesis is required' });
    }

    const snapshot = await fetchCurrentPerceptionSnapshot(hypothesis.exchange, hypothesis.symbol);
    const riskResult = riskEngine.evaluateTradeRisk(
      hypothesis,
      memoryLedger.getEquity(),
      memoryLedger.getCurrentDrawdownPercent(),
      executionEngine.getPositions(),
      snapshot.ticker,
      snapshot.orderBook
    );
    lastRiskCheck = riskResult;

    if (!riskResult.approved) {
      return res.status(400).json({
        success: false,
        vetoed: true,
        reason: riskResult.vetoReason,
        riskResult,
      });
    }

    const { order, position } = await executionEngine.executeApprovedTrade(
      hypothesis,
      riskResult,
      snapshot.ticker,
      snapshot.regime.regime,
      hypothesis.thesisSummary
    );

    res.json({
      success: true,
      vetoed: false,
      order,
      position,
      riskResult,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Execution failed' });
  }
});

// 6. POST /api/trade/close - Close active position
apiRouter.post('/trade/close', async (req: Request, res: Response) => {
  const { positionId, reason } = req.body;
  if (!positionId) return res.status(400).json({ error: 'positionId is required' });

  const pos = executionEngine.getPositions().find((p) => p.id === positionId);
  if (!pos) return res.status(404).json({ error: 'Position not found' });

  const snapshot = await fetchCurrentPerceptionSnapshot(pos.exchange, pos.symbol);
  const closed = executionEngine.closePosition(
    positionId,
    snapshot.ticker.price,
    reason || 'MANUAL_CLOSE',
    snapshot.regime.regime
  );

  if (closed) {
    memoryLedger.updateEquityFromClosedTrade(closed);
  }

  res.json({ success: true, closedTrade: closed });
});

// 7. POST /api/kill-switch - Emergency Kill Switch
apiRouter.post('/kill-switch', async (req: Request, res: Response) => {
  const { action, closeOpenPositions } = req.body;

  if (action === 'ENGAGE') {
    riskEngine.engageKillSwitch();
    autoTradingEnabled = false;

    let closedCount = 0;
    if (closeOpenPositions) {
      const positions = executionEngine.getPositions();
      for (const pos of positions) {
        const snap = await fetchCurrentPerceptionSnapshot(pos.exchange, pos.symbol);
        const closed = executionEngine.closePosition(
          pos.id,
          snap.ticker.price,
          'KILL_SWITCH',
          snap.regime.regime
        );
        if (closed) {
          memoryLedger.updateEquityFromClosedTrade(closed);
          closedCount++;
        }
      }
    }

    broadcastSSE('kill_switch_state', { engaged: true });
    return res.json({
      success: true,
      killSwitchEngaged: true,
      closedPositionsCount: closedCount,
      message: 'EMERGENCY KILL SWITCH ENGAGED. Autonomous trading halted and risk bounds locked.',
    });
  } else {
    riskEngine.disengageKillSwitch();
    broadcastSSE('kill_switch_state', { engaged: false });
    return res.json({
      success: true,
      killSwitchEngaged: false,
      message: 'Emergency Kill Switch disengaged. Engine restored to normal risk governance.',
    });
  }
});

// 8. POST /api/engine/toggle - Toggle Engine or Auto-trading
apiRouter.post('/engine/toggle', (req: Request, res: Response) => {
  const { engine, autoTrading, executionMode, resetCapital } = req.body;

  if (engine !== undefined) engineRunning = Boolean(engine);
  if (autoTrading !== undefined) autoTradingEnabled = Boolean(autoTrading);
  if (executionMode && (executionMode === 'PAPER' || executionMode === 'LIVE')) {
    executionEngine.setExecutionMode(executionMode);
  }
  if (resetCapital && typeof resetCapital === 'number') {
    memoryLedger.setInitialCapital(resetCapital);
  }

  res.json({
    engineRunning,
    autoTradingEnabled,
    executionMode: executionEngine.getExecutionMode(),
    equity: memoryLedger.getEquity(),
  });
});

// 9. Risk Config endpoints
apiRouter.get('/risk/config', (req: Request, res: Response) => {
  res.json(riskEngine.getConfig());
});

apiRouter.post('/risk/config', (req: Request, res: Response) => {
  const updated = riskEngine.updateConfig(req.body);
  res.json({ success: true, config: updated });
});

// 10. Positions & Orders
apiRouter.get('/positions', (req: Request, res: Response) => {
  res.json(executionEngine.getPositions());
});

apiRouter.get('/orders', (req: Request, res: Response) => {
  res.json(executionEngine.getOrders());
});

// 11. Journal & Epistemic History
apiRouter.get('/journal', (req: Request, res: Response) => {
  res.json({
    trades: executionEngine.getClosedTrades(),
    initialCapital: memoryLedger.getInitialCapital(),
    currentEquity: memoryLedger.getEquity(),
    drawdown: memoryLedger.getCurrentDrawdownPercent(),
  });
});

// 12. Research Lab: Backtesting
apiRouter.post('/backtest', async (req: Request, res: Response) => {
  try {
    const result = await researchLab.runBacktest({
      symbol: req.body.symbol || selectedSymbol,
      exchange: req.body.exchange || selectedExchange,
      timeframe: req.body.timeframe || '15m',
      candleCount: req.body.candleCount || 100,
      initialCapital: req.body.initialCapital || 10000,
      riskPerTrade: req.body.riskPerTrade || 0.01,
      minConfidence: req.body.minConfidence || 65,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Backtest failed' });
  }
});

// 13. Research Lab: Self-Improvement & Meta-Learning Post-Mortem
apiRouter.get('/research/post-mortem', (req: Request, res: Response) => {
  res.json(researchLab.getLatestPostMortem());
});

apiRouter.post('/research/post-mortem/trigger', async (req: Request, res: Response) => {
  try {
    const report = await researchLab.generatePostMortem(executionEngine.getClosedTrades());
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Post-mortem trigger failed' });
  }
});

// 14. Credentials Manager
apiRouter.post('/credentials', (req: Request, res: Response) => {
  const { exchange, apiKey, secret, testnet } = req.body;
  if (exchange && (exchange === 'binance' || exchange === 'bybit')) {
    executionEngine.setCredentials(exchange, apiKey || '', secret || '', testnet ?? true);
    return res.json({ success: true, credentials: executionEngine.getCredentialsStatus() });
  }
  res.status(400).json({ error: 'Invalid exchange' });
});

// 15. Server-Sent Events (SSE) Stream
apiRouter.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sseClients.push(res);

  // Send initial connection ACK
  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// 16. Data Quality Events
apiRouter.get('/data-quality', async (req: Request, res: Response) => {
  try {
    const events = await db.system_events.findMany({
      where: {
        event_type: 'DATA_QUALITY_ERROR',
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 100,
    });

    const now = Date.now();
    const items = events.map((event) => {
      const metadata = (event.metadata_json as Record<string, unknown> | null) ?? {};
      const ts = new Date(event.timestamp).getTime();
      return {
        id: event.id,
        eventType: event.event_type,
        description: event.description,
        severity: event.severity,
        source: typeof metadata.source === 'string' ? metadata.source : null,
        method: typeof metadata.method === 'string' ? metadata.method : null,
        symbol: typeof metadata.symbol === 'string' ? metadata.symbol : null,
        error: typeof metadata.error === 'string' ? metadata.error : null,
        timestamp: event.timestamp.toISOString(),
        ageMs: now - ts,
      };
    });

    res.json({ items });
  } catch (err: any) {
    console.error('Failed to load data-quality events:', err);
    res.status(500).json({ error: 'Failed to load data-quality events' });
  }
});
