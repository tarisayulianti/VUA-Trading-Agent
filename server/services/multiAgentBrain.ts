import { GoogleGenAI } from '@google/genai';
import {
  MarketPerceptionSnapshot,
  MultiAgentDebate,
  TradeHypothesis,
  AgentDebateContribution,
} from '../../src/types/trading';
import { getGenAI, handleGeminiApiError } from './geminiClient';

/**
 * Executes the multi-agent deliberation process:
 * Macro Analyst -> Technical Strategist -> Contrarian Skeptic -> Risk Officer -> CIO Synthesizer
 */
export async function conductMultiAgentDebate(snapshot: MarketPerceptionSnapshot): Promise<MultiAgentDebate> {
  const ai = getGenAI();

  if (ai) {
    try {
      return await runGeminiMultiAgentDebate(ai, snapshot);
    } catch (err) {
      handleGeminiApiError(err);
    }
  }

  // High-fidelity quantitative deterministic engine
  return runDeterministicMultiAgentDebate(snapshot);
}

async function runGeminiMultiAgentDebate(
  ai: GoogleGenAI,
  snapshot: MarketPerceptionSnapshot
): Promise<MultiAgentDebate> {
  const currentPrice = snapshot.ticker.price;
  const prompt = `You are VUA, an institutional crypto trading intelligence system.
CORE PRINCIPLES:
1. Capital preservation > opportunity
2. No trade > bad trade
3. Probability > prediction
4. Risk engine has absolute veto power
5. Validate before scaling

CURRENT MARKET PERCEPTION:
Symbol: ${snapshot.symbol} on ${snapshot.exchange.toUpperCase()}
Current Price: $${currentPrice}
24h Change: ${snapshot.ticker.change24h.toFixed(2)}% | 24h Volume: $${snapshot.ticker.volume24h.toLocaleString()}
Spread: $${snapshot.ticker.spread.toFixed(4)} | Funding Rate: ${(snapshot.ticker.fundingRate * 100).toFixed(4)}%
Regime: ${snapshot.regime.regime} (${snapshot.regime.confidence}% confidence, ${snapshot.regime.rationale})
Trend Direction: ${snapshot.regime.trendDirection} | Volatility State: ${snapshot.regime.volatilityState}
Order Book Imbalance (Bid/Ask): ${snapshot.orderBook.imbalanceRatio.toFixed(3)}
Technical Indicators:
- EMA 9: $${snapshot.indicators.ema9.toFixed(2)} | EMA 21: $${snapshot.indicators.ema21.toFixed(2)}
- EMA 50: $${snapshot.indicators.ema50.toFixed(2)} | EMA 200: $${snapshot.indicators.ema200.toFixed(2)}
- RSI (14): ${snapshot.indicators.rsi14.toFixed(1)}
- ATR (14): $${snapshot.indicators.atr14.toFixed(2)}
- Bollinger: Upper $${snapshot.indicators.bbUpper.toFixed(2)} | Mid $${snapshot.indicators.bbMiddle.toFixed(2)} | Lower $${snapshot.indicators.bbLower.toFixed(2)}
- MACD Histogram: ${snapshot.indicators.macdHistogram.toFixed(2)}
- Volatility Percentile: ${snapshot.indicators.volatilityPercentile}th

Conduct an adversarial 5-agent deliberation:
1. Macro / Regime Analyst: Assesses funding rate, orderbook depth imbalance, macro trend alignment.
2. Technical / Momentum Strategist: Evaluates moving averages, support/resistance, RSI, ATR.
3. Contrarian / Skeptic (Red Team): "What could go wrong? Is this a trap, liquidity sweep, or false breakout? Why should we NOT trade?"
4. Risk Officer: Checks risk/reward ratio (must be >= 2.0), volatility bounds, Kelly feasibility.
5. CIO / Synthesizer: Makes the final call. If confidence is below 65% or skeptic flags high trap risk, choose "NO_TRADE". If a high-conviction edge exists, propose LONG or SHORT with precise entry, stop loss, and 3 take-profit levels.

Respond ONLY with valid JSON matching this exact structure:
{
  "macroAnalyst": {
    "agentName": "Macro & Regime Analyst",
    "role": "Macro Structural Analysis",
    "verdict": "FAVOR_LONG" | "FAVOR_SHORT" | "ABSTAIN_NO_TRADE" | "VETO_HIGH_RISK",
    "confidence": 75,
    "arguments": ["arg 1", "arg 2"],
    "risksIdentified": ["risk 1"],
    "keyLevelOrCondition": "condition"
  },
  "technicalStrategist": {
    "agentName": "Technical Strategist",
    "role": "Price Action & Momentum",
    "verdict": "FAVOR_LONG" | "FAVOR_SHORT" | "ABSTAIN_NO_TRADE" | "VETO_HIGH_RISK",
    "confidence": 80,
    "arguments": ["arg 1"],
    "risksIdentified": ["risk 1"],
    "keyLevelOrCondition": "condition"
  },
  "contrarianSkeptic": {
    "agentName": "Red Team Contrarian",
    "role": "Adversarial Stress Tester",
    "verdict": "FAVOR_LONG" | "FAVOR_SHORT" | "ABSTAIN_NO_TRADE" | "VETO_HIGH_RISK",
    "confidence": 70,
    "arguments": ["arg 1"],
    "risksIdentified": ["trap risk 1"],
    "keyLevelOrCondition": "condition"
  },
  "riskOfficer": {
    "agentName": "Risk Governance Officer",
    "role": "Capital Preservation & Kelly",
    "verdict": "FAVOR_LONG" | "FAVOR_SHORT" | "ABSTAIN_NO_TRADE" | "VETO_HIGH_RISK",
    "confidence": 85,
    "arguments": ["arg 1"],
    "risksIdentified": ["risk 1"],
    "keyLevelOrCondition": "condition"
  },
  "cioSynthesizer": {
    "finalVerdict": "PROPOSE_LONG" | "PROPOSE_SHORT" | "NO_TRADE",
    "edgeProbability": 72,
    "synthesisRationale": "Comprehensive summary of why trade is approved or rejected",
    "tradeHypothesis": {
      "direction": "LONG" | "SHORT",
      "entryPrice": 67450.00,
      "stopLossPrice": 66800.00,
      "takeProfit1Price": 68500.00,
      "takeProfit2Price": 69300.00,
      "takeProfit3Price": 70500.00,
      "invalidationCondition": "15m candle close beyond stop loss",
      "riskRewardRatio": 2.4,
      "expectedEdgePercent": 3.8,
      "thesisSummary": "One sentence summary of the trade thesis",
      "maxHoldingHours": 12
    }
  }
}
If finalVerdict is "NO_TRADE", omit or set "tradeHypothesis" to null.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.7-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const text = response.text?.trim() || '{}';
  const parsed = JSON.parse(text);

  if (parsed.cioSynthesizer?.tradeHypothesis) {
    parsed.cioSynthesizer.tradeHypothesis.id = `hyp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    parsed.cioSynthesizer.tradeHypothesis.symbol = snapshot.symbol;
    parsed.cioSynthesizer.tradeHypothesis.exchange = snapshot.exchange;
  }

  return {
    ...parsed,
    timestamp: Date.now(),
    engineMode: 'NEURAL_GEMINI' as const,
  };
}

/**
 * Deterministic quantitative reasoning brain
 */
function runDeterministicMultiAgentDebate(snapshot: MarketPerceptionSnapshot): MultiAgentDebate {
  const currentPrice = snapshot.ticker.price;
  const { ema9, ema21, ema50, ema200, rsi14, atr14, bbUpper, bbLower } = snapshot.indicators;
  const regime = snapshot.regime;
  const imbalance = snapshot.orderBook.imbalanceRatio;
  const funding = snapshot.ticker.fundingRate;

  // 1. Macro Analyst Assessment
  let macroVerdict: 'FAVOR_LONG' | 'FAVOR_SHORT' | 'ABSTAIN_NO_TRADE' | 'VETO_HIGH_RISK' = 'ABSTAIN_NO_TRADE';
  let macroConfidence = 65;
  const macroArgs: string[] = [];
  const macroRisks: string[] = [];

  if (regime.regime === 'TRENDING_BULL_STRONG' || regime.regime === 'TRENDING_BULL_PULLBACK') {
    if (funding < 0.0003) {
      macroVerdict = 'FAVOR_LONG';
      macroConfidence = 78;
      macroArgs.push(`Bullish market regime confirmed (${regime.regime}). Healthy funding rate at ${(funding * 100).toFixed(4)}%.`);
    } else {
      macroVerdict = 'ABSTAIN_NO_TRADE';
      macroRisks.push(`Overheated funding rate (${(funding * 100).toFixed(4)}%), risk of long squeeze.`);
    }
  } else if (regime.regime === 'TRENDING_BEAR_STRONG' || regime.regime === 'TRENDING_BEAR_RALLY') {
    macroVerdict = 'FAVOR_SHORT';
    macroConfidence = 76;
    macroArgs.push(`Bearish structural regime (${regime.regime}) with persistent downward momentum.`);
  } else if (regime.regime === 'LIQUIDITY_HUNT_SWEEP') {
    macroVerdict = 'VETO_HIGH_RISK';
    macroConfidence = 85;
    macroRisks.push('Active liquidity sweep detected outside key bounds; stop cascades in progress.');
  } else {
    macroVerdict = 'ABSTAIN_NO_TRADE';
    macroArgs.push('Choppy range without directional macroeconomic consensus.');
  }

  // 2. Technical Strategist Assessment
  let techVerdict: 'FAVOR_LONG' | 'FAVOR_SHORT' | 'ABSTAIN_NO_TRADE' | 'VETO_HIGH_RISK' = 'ABSTAIN_NO_TRADE';
  let techConfidence = 65;
  const techArgs: string[] = [];
  const techRisks: string[] = [];

  const isBullishEma = currentPrice > ema50 && ema9 > ema21;
  const isBearishEma = currentPrice < ema50 && ema9 < ema21;

  if (isBullishEma && rsi14 > 45 && rsi14 < 68) {
    techVerdict = 'FAVOR_LONG';
    techConfidence = 82;
    techArgs.push(`Price holding above 50 EMA ($${ema50.toFixed(2)}) with EMA 9/21 cross confirmed.`);
    techArgs.push(`RSI at ${rsi14.toFixed(1)} shows supportive upside momentum with head-room.`);
  } else if (isBearishEma && rsi14 < 55 && rsi14 > 32) {
    techVerdict = 'FAVOR_SHORT';
    techConfidence = 80;
    techArgs.push(`Price capped below 50 EMA ($${ema50.toFixed(2)}) with bearish 9/21 continuation.`);
    techArgs.push(`RSI at ${rsi14.toFixed(1)} confirms sustained downward pressure.`);
  } else {
    techVerdict = 'ABSTAIN_NO_TRADE';
    techRisks.push(`Conflicted technical signals (RSI: ${rsi14.toFixed(1)}, ATR: $${atr14.toFixed(2)}).`);
  }

  // 3. Contrarian Skeptic (Red Team)
  let skepticVerdict: 'FAVOR_LONG' | 'FAVOR_SHORT' | 'ABSTAIN_NO_TRADE' | 'VETO_HIGH_RISK' = 'ABSTAIN_NO_TRADE';
  let skepticConfidence = 75;
  const skepticArgs: string[] = [];
  const skepticRisks: string[] = [];

  if (rsi14 > 72) {
    skepticVerdict = 'VETO_HIGH_RISK';
    skepticRisks.push(`Extreme overbought RSI (${rsi14.toFixed(1)}). Chasing breakout here invites retail trap.`);
  } else if (rsi14 < 28) {
    skepticVerdict = 'VETO_HIGH_RISK';
    skepticRisks.push(`Extreme oversold RSI (${rsi14.toFixed(1)}). Shorting support exposes to vicious relief squeeze.`);
  } else if (imbalance > 3.0 || imbalance < 0.33) {
    skepticRisks.push(`Severe order book skew (${imbalance.toFixed(2)}). Spoofed walls or sudden liquidity evaporation risk.`);
    skepticVerdict = 'ABSTAIN_NO_TRADE';
  } else {
    skepticArgs.push('Order book liquidity appears organic; no glaring spoof cascades detected.');
  }

  // 4. Risk Officer
  let riskVerdict: 'FAVOR_LONG' | 'FAVOR_SHORT' | 'ABSTAIN_NO_TRADE' | 'VETO_HIGH_RISK' = 'ABSTAIN_NO_TRADE';
  let riskConfidence = 85;
  const riskArgs: string[] = [];
  const riskRisks: string[] = [];

  const spreadPct = (snapshot.ticker.spread / currentPrice) * 100;
  if (spreadPct > 0.08) {
    riskVerdict = 'VETO_HIGH_RISK';
    riskRisks.push(`Exchange spread is wide (${spreadPct.toFixed(3)}%), exceeding slippage threshold.`);
  } else if (skepticVerdict === 'VETO_HIGH_RISK' || macroVerdict === 'VETO_HIGH_RISK') {
    riskVerdict = 'VETO_HIGH_RISK';
    riskRisks.push('Risk Officer affirms Red Team Veto: Capital preservation overrides speculative gain.');
  } else if (macroVerdict === techVerdict && macroVerdict !== 'ABSTAIN_NO_TRADE') {
    riskVerdict = macroVerdict;
    riskArgs.push('Favorable confluence between Macro Regime and Technical Momentum.');
  } else {
    riskVerdict = 'ABSTAIN_NO_TRADE';
    riskArgs.push('Confluence score inadequate to warrant active portfolio capital deployment.');
  }

  // 5. CIO Synthesizer
  let finalVerdict: 'PROPOSE_LONG' | 'PROPOSE_SHORT' | 'NO_TRADE' = 'NO_TRADE';
  let edgeProbability = 50;
  let synthesisRationale = 'No high-probability statistical edge identified. Abiding by "No trade > bad trade".';
  let tradeHypothesis: TradeHypothesis | undefined = undefined;

  const canLong = macroVerdict === 'FAVOR_LONG' && techVerdict === 'FAVOR_LONG' && skepticVerdict !== 'VETO_HIGH_RISK' && riskVerdict !== 'VETO_HIGH_RISK';
  const canShort = macroVerdict === 'FAVOR_SHORT' && techVerdict === 'FAVOR_SHORT' && skepticVerdict !== 'VETO_HIGH_RISK' && riskVerdict !== 'VETO_HIGH_RISK';

  if (canLong) {
    finalVerdict = 'PROPOSE_LONG';
    edgeProbability = 74;
    const sl = Math.max(0.01, currentPrice - atr14 * 1.8);
    const risk = currentPrice - sl;
    const tp1 = currentPrice + risk * 1.5;
    const tp2 = currentPrice + risk * 2.5;
    const tp3 = currentPrice + risk * 4.0;
    const rr = Number(((tp2 - currentPrice) / risk).toFixed(2));

    synthesisRationale = `Synthesizer approves LONG: Strong regime alignment (${regime.regime}), RSI ${rsi14.toFixed(1)}, and verified R:R of ${rr}:1.`;
    tradeHypothesis = {
      id: `hyp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      symbol: snapshot.symbol,
      exchange: snapshot.exchange,
      direction: 'LONG',
      entryPrice: Number(currentPrice.toFixed(2)),
      stopLossPrice: Number(sl.toFixed(2)),
      takeProfit1Price: Number(tp1.toFixed(2)),
      takeProfit2Price: Number(tp2.toFixed(2)),
      takeProfit3Price: Number(tp3.toFixed(2)),
      invalidationCondition: `15m close below stop loss at $${sl.toFixed(2)} or failure to reclaim 21 EMA.`,
      riskRewardRatio: rr,
      expectedEdgePercent: Number(((tp2 / currentPrice - 1) * 100).toFixed(2)),
      thesisSummary: `Bullish continuation trade on ${snapshot.symbol} with structural 50-EMA support.`,
      maxHoldingHours: 18,
    };
  } else if (canShort) {
    finalVerdict = 'PROPOSE_SHORT';
    edgeProbability = 72;
    const sl = currentPrice + atr14 * 1.8;
    const risk = sl - currentPrice;
    const tp1 = Math.max(0.01, currentPrice - risk * 1.5);
    const tp2 = Math.max(0.01, currentPrice - risk * 2.5);
    const tp3 = Math.max(0.01, currentPrice - risk * 4.0);
    const rr = Number(((currentPrice - tp2) / risk).toFixed(2));

    synthesisRationale = `Synthesizer approves SHORT: Bearish breakdown regime (${regime.regime}), momentum exhaustion, and R:R of ${rr}:1.`;
    tradeHypothesis = {
      id: `hyp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      symbol: snapshot.symbol,
      exchange: snapshot.exchange,
      direction: 'SHORT',
      entryPrice: Number(currentPrice.toFixed(2)),
      stopLossPrice: Number(sl.toFixed(2)),
      takeProfit1Price: Number(tp1.toFixed(2)),
      takeProfit2Price: Number(tp2.toFixed(2)),
      takeProfit3Price: Number(tp3.toFixed(2)),
      invalidationCondition: `15m close above stop loss at $${sl.toFixed(2)} or reclaim of 50 EMA.`,
      riskRewardRatio: rr,
      expectedEdgePercent: Number(((1 - tp2 / currentPrice) * 100).toFixed(2)),
      thesisSummary: `Bearish momentum breakdown trade on ${snapshot.symbol} targeting liquidity pool below.`,
      maxHoldingHours: 18,
    };
  }

  return {
    macroAnalyst: {
      agentName: 'Macro & Regime Analyst',
      role: 'Macro Structural Alignment',
      verdict: macroVerdict,
      confidence: macroConfidence,
      arguments: macroArgs.length > 0 ? macroArgs : ['Macro metrics within acceptable baseline.'],
      risksIdentified: macroRisks,
      keyLevelOrCondition: `Regime: ${regime.regime}`,
    },
    technicalStrategist: {
      agentName: 'Technical Strategist',
      role: 'Price Action & Momentum',
      verdict: techVerdict,
      confidence: techConfidence,
      arguments: techArgs.length > 0 ? techArgs : ['Technical indicators neutral.'],
      risksIdentified: techRisks,
      keyLevelOrCondition: `50 EMA: $${ema50.toFixed(2)} | RSI: ${rsi14.toFixed(1)}`,
    },
    contrarianSkeptic: {
      agentName: 'Red Team Contrarian',
      role: 'Adversarial Trap Hunter',
      verdict: skepticVerdict,
      confidence: skepticConfidence,
      arguments: skepticArgs.length > 0 ? skepticArgs : ['No obvious retail traps detected.'],
      risksIdentified: skepticRisks,
      keyLevelOrCondition: `Orderbook imbalance: ${imbalance.toFixed(2)}`,
    },
    riskOfficer: {
      agentName: 'Risk Governance Officer',
      role: 'Capital Preservation & Math',
      verdict: riskVerdict,
      confidence: riskConfidence,
      arguments: riskArgs.length > 0 ? riskArgs : ['Risk parameters within bounds.'],
      risksIdentified: riskRisks,
      keyLevelOrCondition: `Max Spread: 0.08% | Actual: ${spreadPct.toFixed(3)}%`,
    },
    cioSynthesizer: {
      finalVerdict,
      edgeProbability,
      synthesisRationale,
      tradeHypothesis,
    },
    timestamp: Date.now(),
    engineMode: 'QUANTITATIVE_FALLBACK' as const,
  };
}
