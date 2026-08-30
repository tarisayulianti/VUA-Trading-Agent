import { Candle, TechnicalIndicators, OrderBook, RegimeAssessment, MarketRegimeType } from '../../src/types/trading';

/**
 * Deterministic, quantitative market regime classification
 */
export function assessMarketRegime(
  candles: Candle[],
  indicators: TechnicalIndicators,
  orderBook: OrderBook,
  fundingRate: number
): RegimeAssessment {
  const currentPrice = candles[candles.length - 1]?.close || 0;
  const { ema9, ema21, ema50, ema200, rsi14, volatilityPercentile, bbUpper, bbLower, bbMiddle } = indicators;

  // 1. Moving Average Structure
  const isEmaBullAligned = ema9 > ema21 && ema21 > ema50 && currentPrice > ema50;
  const isEmaBearAligned = ema9 < ema21 && ema21 < ema50 && currentPrice < ema50;
  const isAbove200 = currentPrice > ema200;
  const isBelow200 = currentPrice < ema200;

  // 2. Volatility and Bandwidth
  const bbWidth = (bbUpper - bbLower) / (bbMiddle || 1);
  const isSqueeze = volatilityPercentile < 25 && bbWidth < 0.025;
  const isExpansion = volatilityPercentile > 80;

  // 3. Liquidity Sweep Detection (long wick rejection outside Bollinger Bands)
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  let isLiquiditySweep = false;
  if (lastCandle) {
    const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
    const body = Math.abs(lastCandle.close - lastCandle.open);
    const hasLongUpperRejection = upperWick > body * 2.5 && lastCandle.high >= bbUpper;
    const hasLongLowerRejection = lowerWick > body * 2.5 && lastCandle.low <= bbLower;
    if (hasLongUpperRejection || hasLongLowerRejection) {
      isLiquiditySweep = true;
    }
  }

  // 4. Order book and Funding skew
  const orderBookSkew = orderBook.imbalanceRatio; // > 1 bids dominant, < 1 asks dominant

  let regime: MarketRegimeType = 'RANGE_CHOP_HIGH_VOL';
  let confidence = 70;
  let rationale = '';
  let trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let volatilityState: 'EXPANDING' | 'COMPRESSED' | 'NORMAL' = 'NORMAL';
  let liquidityQuality: 'HEALTHY' | 'THIN' | 'SWEEP_RISK' = 'HEALTHY';

  if (isLiquiditySweep) {
    regime = 'LIQUIDITY_HUNT_SWEEP';
    confidence = 82;
    liquidityQuality = 'SWEEP_RISK';
    trendDirection = lastCandle && lastCandle.close > lastCandle.open ? 'BULLISH' : 'BEARISH';
    rationale = 'Significant wick rejection outside 2.0-stddev band detected. High probability of retail stop-loss cascade or liquidity sweep.';
  } else if (isSqueeze) {
    regime = 'RANGE_COMPRESSION_LOW_VOL';
    confidence = 78;
    volatilityState = 'COMPRESSED';
    trendDirection = 'NEUTRAL';
    rationale = `Volatility percentile is ${volatilityPercentile}th with compressed Bollinger width (${(bbWidth * 100).toFixed(2)}%). Energy buildup prior to expansion.`;
  } else if (isExpansion && (currentPrice > bbUpper || currentPrice < bbLower)) {
    regime = 'BREAKOUT_EXPANSION';
    confidence = 85;
    volatilityState = 'EXPANDING';
    trendDirection = currentPrice > bbUpper ? 'BULLISH' : 'BEARISH';
    rationale = `High volatility breakout beyond Bollinger boundary with ${volatilityPercentile}th percentile volatility surge.`;
  } else if (isEmaBullAligned && isAbove200) {
    if (rsi14 > 50 && rsi14 < 70) {
      regime = 'TRENDING_BULL_STRONG';
      confidence = 88;
      trendDirection = 'BULLISH';
      rationale = 'Full bullish EMA stack (9 > 21 > 50 > 200), healthy RSI momentum without extreme exhaustion.';
    } else if (rsi14 <= 50 && currentPrice >= ema50) {
      regime = 'TRENDING_BULL_PULLBACK';
      confidence = 80;
      trendDirection = 'BULLISH';
      rationale = 'Bullish macro trend holding above 50/200 EMA, currently in corrective pullback / value discount.';
    } else {
      regime = 'TRENDING_BULL_STRONG';
      confidence = 75;
      trendDirection = 'BULLISH';
      rationale = 'Bullish trend intact, caution on elevated momentum indicators.';
    }
  } else if (isEmaBearAligned && isBelow200) {
    if (rsi14 < 50 && rsi14 > 30) {
      regime = 'TRENDING_BEAR_STRONG';
      confidence = 88;
      trendDirection = 'BEARISH';
      rationale = 'Full bearish EMA stack (9 < 21 < 50 < 200), persistent negative drift without oversold bounce.';
    } else if (rsi14 >= 50 && currentPrice <= ema50) {
      regime = 'TRENDING_BEAR_RALLY';
      confidence = 80;
      trendDirection = 'BEARISH';
      rationale = 'Bearish macro trend, currently experiencing counter-trend relief rally into 50 EMA resistance.';
    } else {
      regime = 'TRENDING_BEAR_STRONG';
      confidence = 75;
      trendDirection = 'BEARISH';
      rationale = 'Bearish momentum dominant across multiple moving average bands.';
    }
  } else {
    // Mean reverting chop
    if (volatilityPercentile > 55) {
      regime = 'RANGE_CHOP_HIGH_VOL';
      confidence = 74;
      volatilityState = 'EXPANDING';
      trendDirection = 'NEUTRAL';
      rationale = 'Lack of moving average consensus; high oscillation around mean with elevated noise.';
    } else {
      regime = 'RANGE_COMPRESSION_LOW_VOL';
      confidence = 70;
      volatilityState = 'COMPRESSED';
      trendDirection = 'NEUTRAL';
      rationale = 'Low volatility sideways consolidation; range-bound mean reversion conditions.';
    }
  }

  // Adjust liquidity quality based on order book depth imbalance
  if (orderBookSkew < 0.4 || orderBookSkew > 2.5) {
    liquidityQuality = 'THIN';
    rationale += ` Order book shows pronounced skew (ratio: ${orderBookSkew.toFixed(2)}).`;
  }

  return {
    regime,
    confidence,
    rationale,
    trendDirection,
    volatilityState,
    liquidityQuality,
  };
}
