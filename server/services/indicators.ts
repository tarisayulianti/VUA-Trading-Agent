import { Candle, TechnicalIndicators, OrderBook, OrderBookLevel } from '../../src/types/trading';

/**
 * Computes Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  
  // Initial simple average for the first 'period' elements
  let sum = 0;
  const initialPeriod = Math.min(period, prices.length);
  for (let i = 0; i < initialPeriod; i++) {
    sum += prices[i];
  }
  let currentEma = sum / initialPeriod;
  ema.push(currentEma);

  for (let i = initialPeriod; i < prices.length; i++) {
    currentEma = prices[i] * k + currentEma * (1 - k);
    ema.push(currentEma);
  }

  return ema;
}

/**
 * Computes Relative Strength Index (RSI) 14
 */
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Computes Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return candles[0] ? candles[0].high - candles[0].low : 10;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) {
    const sum = trueRanges.reduce((acc, val) => acc + val, 0);
    return sum / trueRanges.length;
  }

  // Wilder's smoothing
  let atr = trueRanges.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

/**
 * Computes Bollinger Bands
 */
export function calculateBollingerBands(closes: number[], period = 20, multiplier = 2): { upper: number; middle: number; lower: number } {
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 0;
    return { upper: last * 1.02, middle: last, lower: last * 0.98 };
  }

  const slice = closes.slice(closes.length - period);
  const middle = slice.reduce((acc, val) => acc + val, 0) / period;

  const variance = slice.reduce((acc, val) => acc + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: middle + stdDev * multiplier,
    middle,
    lower: middle - stdDev * multiplier,
  };
}

/**
 * Computes MACD (12, 26, 9)
 */
export function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const ema12List = calculateEMA(closes, 12);
  const ema26List = calculateEMA(closes, 26);

  const macdLine: number[] = [];
  const offset12 = closes.length - ema12List.length;
  const offset26 = closes.length - ema26List.length;

  for (let i = 0; i < closes.length; i++) {
    const e12 = i >= offset12 ? ema12List[i - offset12] : closes[i];
    const e26 = i >= offset26 ? ema26List[i - offset26] : closes[i];
    macdLine.push(e12 - e26);
  }

  const signalLine = calculateEMA(macdLine.slice(26), 9);
  const lastMacd = macdLine[macdLine.length - 1] || 0;
  const lastSignal = signalLine[signalLine.length - 1] || 0;

  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal,
  };
}

/**
 * Estimate Volatility Percentile based on historical ATRs
 */
export function calculateVolatilityPercentile(candles: Candle[]): number {
  if (candles.length < 30) return 50;

  const ranges: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const rangePct = (candles[i].high - candles[i].low) / candles[i].close;
    ranges.push(rangePct);
  }

  const currentRange = ranges[ranges.length - 1];
  const sorted = [...ranges].sort((a, b) => a - b);
  const rank = sorted.findIndex((r) => r >= currentRange);

  return Math.min(100, Math.max(0, Math.round((rank / sorted.length) * 100)));
}

/**
 * Estimate Volume Delta from high, low, close and volume
 */
export function estimateVolumeDelta(candles: Candle[]): number {
  if (candles.length === 0) return 0;
  let netDelta = 0;
  const recent = candles.slice(-10);

  for (const c of recent) {
    const totalRange = c.high - c.low;
    if (totalRange > 0) {
      const buyRatio = (c.close - c.low) / totalRange;
      const buyVol = c.volume * buyRatio;
      const sellVol = c.volume * (1 - buyRatio);
      netDelta += buyVol - sellVol;
    }
  }
  return netDelta;
}

/**
 * Full indicator aggregation for candles and order book
 */
export function computeAllIndicators(candles: Candle[], orderBook?: OrderBook): TechnicalIndicators {
  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1] || 0;

  const ema9Arr = calculateEMA(closes, 9);
  const ema21Arr = calculateEMA(closes, 21);
  const ema50Arr = calculateEMA(closes, 50);
  const ema200Arr = calculateEMA(closes, 200);

  const ema9 = ema9Arr[ema9Arr.length - 1] || lastClose;
  const ema21 = ema21Arr[ema21Arr.length - 1] || lastClose;
  const ema50 = ema50Arr[ema50Arr.length - 1] || lastClose;
  const ema200 = ema200Arr[ema200Arr.length - 1] || lastClose;

  const rsi14 = calculateRSI(closes, 14);
  const atr14 = calculateATR(candles, 14);
  const bb = calculateBollingerBands(closes, 20, 2);
  const macdData = calculateMACD(closes);
  const volPct = calculateVolatilityPercentile(candles);
  const volDelta = estimateVolumeDelta(candles);

  return {
    ema9,
    ema21,
    ema50,
    ema200,
    rsi14,
    atr14,
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    macd: macdData.macd,
    macdSignal: macdData.signal,
    macdHistogram: macdData.histogram,
    volatilityPercentile: volPct,
    volumeDeltaEstimate: volDelta,
  };
}
