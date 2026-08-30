export type ExchangeId = 'binance' | 'bybit';

export type MarketRegimeType =
  | 'TRENDING_BULL_STRONG'
  | 'TRENDING_BULL_PULLBACK'
  | 'TRENDING_BEAR_STRONG'
  | 'TRENDING_BEAR_RALLY'
  | 'RANGE_CHOP_HIGH_VOL'
  | 'RANGE_COMPRESSION_LOW_VOL'
  | 'LIQUIDITY_HUNT_SWEEP'
  | 'BREAKOUT_EXPANSION';

export interface MarketTicker {
  symbol: string;
  exchange: ExchangeId;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
  fundingRate: number;
  openInterest?: number;
  timestamp: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
}

export interface OrderBook {
  symbol: string;
  exchange: ExchangeId;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  imbalanceRatio: number; // >1 means bid heavy, <1 means ask heavy
  timestamp: number;
}

export interface TechnicalIndicators {
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  volatilityPercentile: number; // 0 - 100
  volumeDeltaEstimate: number;
}

export interface RegimeAssessment {
  regime: MarketRegimeType;
  confidence: number; // 0 - 100
  rationale: string;
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volatilityState: 'EXPANDING' | 'COMPRESSED' | 'NORMAL';
  liquidityQuality: 'HEALTHY' | 'THIN' | 'SWEEP_RISK';
}

export interface MarketPerceptionSnapshot {
  symbol: string;
  exchange: ExchangeId;
  ticker: MarketTicker;
  orderBook: OrderBook;
  indicators: TechnicalIndicators;
  regime: RegimeAssessment;
  recentCandles: Candle[];
  timestamp: number;
}

export interface AgentDebateContribution {
  agentName: string;
  role: string;
  verdict: 'FAVOR_LONG' | 'FAVOR_SHORT' | 'ABSTAIN_NO_TRADE' | 'VETO_HIGH_RISK';
  confidence: number; // 0 - 100
  arguments: string[];
  risksIdentified: string[];
  keyLevelOrCondition?: string;
}

export interface MultiAgentDebate {
  macroAnalyst: AgentDebateContribution;
  technicalStrategist: AgentDebateContribution;
  contrarianSkeptic: AgentDebateContribution;
  riskOfficer: AgentDebateContribution;
  cioSynthesizer: {
    finalVerdict: 'PROPOSE_LONG' | 'PROPOSE_SHORT' | 'NO_TRADE';
    edgeProbability: number; // 0 - 100
    synthesisRationale: string;
    tradeHypothesis?: TradeHypothesis;
  };
  timestamp: number;
  engineMode?: 'NEURAL_GEMINI' | 'QUANTITATIVE_FALLBACK';
}

export interface TradeHypothesis {
  id: string;
  symbol: string;
  exchange: ExchangeId;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLossPrice: number;
  takeProfit1Price: number;
  takeProfit2Price: number;
  takeProfit3Price: number;
  invalidationCondition: string;
  riskRewardRatio: number;
  expectedEdgePercent: number;
  thesisSummary: string;
  maxHoldingHours: number;
}

export interface RiskCheckResult {
  approved: boolean;
  vetoReason?: string;
  maxAllowedRiskUsd: number;
  recommendedPositionSizeUsd: number;
  recommendedLeverage: number;
  estimatedLiquidationPrice: number;
  kellyFraction: number;
  circuitBreakerStatus: 'NORMAL' | 'WARNING' | 'TRIPPED';
  checksPassed: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

export interface Order {
  id: string;
  hypothesisId?: string;
  symbol: string;
  exchange: ExchangeId;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  price: number;
  quantity: number;
  costUsd: number;
  leverage: number;
  status: 'PENDING' | 'OPEN' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  createdAt: number;
  filledAt?: number;
  executedPrice?: number;
  feeUsd?: number;
  slippagePercent?: number;
}

export interface Position {
  id: string;
  hypothesisId: string;
  symbol: string;
  exchange: ExchangeId;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  initialMarginUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPercent: number;
  liquidationPrice: number;
  stopLossPrice: number;
  takeProfit1Price: number;
  takeProfit2Price: number;
  takeProfit3Price: number;
  trailingStopPrice?: number;
  createdAt: number;
  updatedAt: number;
  maxFavorableExcursionUsd: number; // MFE
  maxAdverseExcursionUsd: number;   // MAE
}

export interface ClosedTrade {
  id: string;
  hypothesisId: string;
  symbol: string;
  exchange: ExchangeId;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  leverage: number;
  marginUsd: number;
  realizedPnlUsd: number;
  realizedPnlPercent: number;
  rMultiple: number; // Realized PnL / Initial Risk
  entryTime: number;
  exitTime: number;
  exitReason: 'STOP_LOSS' | 'TAKE_PROFIT_1' | 'TAKE_PROFIT_2' | 'TAKE_PROFIT_3' | 'CIRCUIT_BREAKER' | 'KILL_SWITCH' | 'MANUAL_CLOSE';
  regimeAtEntry: MarketRegimeType;
  hypothesisSummary: string;
  mfeUsd: number;
  maeUsd: number;
  agentDebateSummary: string;
}

export interface RiskGovernanceConfig {
  maxRiskPerTradePercent: number; // e.g. 1.0% (max 2%)
  maxLeverage: number;            // e.g. 3x
  minRiskRewardRatio: number;     // e.g. 2.0
  maxDailyDrawdownPercent: number;// e.g. 3.0% (halt at 5%)
  maxOpenPositions: number;       // e.g. 3
  maxTotalExposureLeveraged: number; // e.g. 300%
  slippageLimitPercent: number;   // e.g. 0.15%
  killSwitchEngaged: boolean;
}

export interface SystemStatus {
  engineRunning: boolean;
  executionMode: 'PAPER' | 'LIVE';
  selectedExchange: ExchangeId;
  selectedSymbol: string;
  equityUsd: number;
  initialCapitalUsd: number;
  availableCashUsd: number;
  allocatedMarginUsd: number;
  dailyRealizedPnlUsd: number;
  dailyRealizedPnlPercent: number;
  totalRealizedPnlUsd: number;
  unrealizedPnlUsd: number;
  currentDrawdownPercent: number;
  maxRecordedDrawdownPercent: number;
  openPositionsCount: number;
  totalTradesCount: number;
  winningTradesCount: number;
  winRatePercent: number;
  profitFactor: number;
  sharpeRatio: number;
  circuitBreakerActive: boolean;
  killSwitchEngaged: boolean;
  lastAutonomousCycleTime: number;
  autonomousCycleSeconds: number;
  autoTradingEnabled: boolean;
}

export interface BacktestRequest {
  symbol: string;
  exchange: ExchangeId;
  timeframe: string;
  candleCount: number;
  initialCapital: number;
  riskPerTrade: number;
  minConfidence: number;
}

export interface BacktestResult {
  symbol: string;
  exchange: ExchangeId;
  totalCandles: number;
  initialCapital: number;
  finalEquity: number;
  totalReturnPercent: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  expectancyRMultiple: number;
  sharpeRatio: number;
  trades: {
    entryIndex: number;
    exitIndex: number;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    pnlPercent: number;
    exitReason: string;
    regime: MarketRegimeType;
  }[];
  regimeBreakdown: {
    regime: MarketRegimeType;
    trades: number;
    winRate: number;
    pnl: number;
  }[];
}

export interface PostMortemLearningReport {
  analyzedTradesCount: number;
  profitablePatterns: string[];
  lossDrivers: string[];
  recommendedRules: string[];
  regimeAdjustmentScore: Record<MarketRegimeType, number>; // -1 to +1 multiplier
  updatedAt: number;
}
