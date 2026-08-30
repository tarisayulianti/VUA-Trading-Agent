import {
  TradeHypothesis,
  RiskCheckResult,
  RiskGovernanceConfig,
  Position,
  MarketTicker,
  OrderBook,
} from '../../src/types/trading';

export class DeterministicRiskEngine {
  private config: RiskGovernanceConfig = {
    maxRiskPerTradePercent: 1.0,    // 1% max risk per trade
    maxLeverage: 3.0,                // 3x max leverage
    minRiskRewardRatio: 2.0,        // 2.0 min R:R
    maxDailyDrawdownPercent: 3.0,   // 3% daily DD halt
    maxOpenPositions: 3,            // Max 3 concurrent positions
    maxTotalExposureLeveraged: 2.5, // Max 2.5x total equity exposure
    slippageLimitPercent: 0.15,     // Max 0.15% spread/slippage
    killSwitchEngaged: false,
  };

  getConfig(): RiskGovernanceConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<RiskGovernanceConfig>): RiskGovernanceConfig {
    // Safety caps: cannot override max risk beyond hard limits
    if (updates.maxRiskPerTradePercent !== undefined) {
      this.config.maxRiskPerTradePercent = Math.min(2.0, Math.max(0.2, updates.maxRiskPerTradePercent));
    }
    if (updates.maxLeverage !== undefined) {
      this.config.maxLeverage = Math.min(5.0, Math.max(1.0, updates.maxLeverage));
    }
    if (updates.minRiskRewardRatio !== undefined) {
      this.config.minRiskRewardRatio = Math.max(1.5, updates.minRiskRewardRatio);
    }
    if (updates.maxDailyDrawdownPercent !== undefined) {
      this.config.maxDailyDrawdownPercent = Math.min(5.0, Math.max(1.0, updates.maxDailyDrawdownPercent));
    }
    if (updates.maxOpenPositions !== undefined) {
      this.config.maxOpenPositions = Math.min(5, Math.max(1, updates.maxOpenPositions));
    }
    if (updates.killSwitchEngaged !== undefined) {
      this.config.killSwitchEngaged = updates.killSwitchEngaged;
    }
    return this.getConfig();
  }

  engageKillSwitch(): void {
    this.config.killSwitchEngaged = true;
  }

  disengageKillSwitch(): void {
    this.config.killSwitchEngaged = false;
  }

  /**
   * Deterministically validates trade hypotheses with ABSOLUTE VETO POWER.
   * AI cannot bypass any of these checks.
   */
  evaluateTradeRisk(
    hypothesis: TradeHypothesis,
    currentEquityUsd: number,
    dailyDrawdownPercent: number,
    openPositions: Position[],
    ticker: MarketTicker,
    orderBook: OrderBook
  ): RiskCheckResult {
    const checks: { name: string; passed: boolean; detail: string }[] = [];
    let vetoReason: string | undefined = undefined;

    // 1. Kill Switch Check
    const killSwitchPassed = !this.config.killSwitchEngaged;
    checks.push({
      name: 'Emergency Kill Switch',
      passed: killSwitchPassed,
      detail: killSwitchPassed ? 'Disengaged (Operational)' : 'CRITICAL: Kill switch is actively engaged',
    });
    if (!killSwitchPassed) {
      vetoReason = 'Emergency Kill Switch is engaged. All trading is strictly suspended.';
    }

    // 2. Daily Drawdown Circuit Breaker
    const isCircuitBreakerTripped = dailyDrawdownPercent >= this.config.maxDailyDrawdownPercent;
    const circuitBreakerPassed = !isCircuitBreakerTripped;
    checks.push({
      name: 'Daily Drawdown Circuit Breaker',
      passed: circuitBreakerPassed,
      detail: `Current: ${dailyDrawdownPercent.toFixed(2)}% | Threshold: ${this.config.maxDailyDrawdownPercent.toFixed(2)}%`,
    });
    if (!circuitBreakerPassed && !vetoReason) {
      vetoReason = `Daily drawdown (${dailyDrawdownPercent.toFixed(2)}%) breached risk boundary of ${this.config.maxDailyDrawdownPercent}%. Engine halted.`;
    }

    // 3. Open Positions Capacity Check
    const positionsCapacityPassed = openPositions.length < this.config.maxOpenPositions;
    checks.push({
      name: 'Open Positions Concurrency',
      passed: positionsCapacityPassed,
      detail: `Active: ${openPositions.length} | Limit: ${this.config.maxOpenPositions}`,
    });
    if (!positionsCapacityPassed && !vetoReason) {
      vetoReason = `Maximum concurrent positions (${this.config.maxOpenPositions}) reached. Capital preservation mandates no new positions.`;
    }

    // 4. Duplicate Symbol Check (No correlated stacking on same pair)
    const hasSameSymbol = openPositions.some((p) => p.symbol === hypothesis.symbol);
    const duplicateSymbolPassed = !hasSameSymbol;
    checks.push({
      name: 'Single Asset Exposure Guard',
      passed: duplicateSymbolPassed,
      detail: hasSameSymbol ? `Position already active on ${hypothesis.symbol}` : 'No conflicting open position on symbol',
    });
    if (!duplicateSymbolPassed && !vetoReason) {
      vetoReason = `Active position already exists on ${hypothesis.symbol}. Stacking exposure is forbidden.`;
    }

    // 5. Minimum Risk:Reward Ratio Check
    const rrPassed = hypothesis.riskRewardRatio >= this.config.minRiskRewardRatio;
    checks.push({
      name: 'Minimum Risk:Reward Ratio',
      passed: rrPassed,
      detail: `Proposed R:R: ${hypothesis.riskRewardRatio.toFixed(2)}:1 | Required: ${this.config.minRiskRewardRatio.toFixed(2)}:1`,
    });
    if (!rrPassed && !vetoReason) {
      vetoReason = `Risk-to-Reward ratio (${hypothesis.riskRewardRatio.toFixed(2)}) is lower than mandatory threshold (${this.config.minRiskRewardRatio}). Trade rejected under "No trade > bad trade".`;
    }

    // 6. Stop Loss Validity & Distance Check
    const priceDist = Math.abs(hypothesis.entryPrice - hypothesis.stopLossPrice);
    const stopLossDistancePercent = (priceDist / hypothesis.entryPrice) * 100;
    const isStopValid =
      hypothesis.direction === 'LONG'
        ? hypothesis.stopLossPrice < hypothesis.entryPrice
        : hypothesis.stopLossPrice > hypothesis.entryPrice;
    const isStopWithinBounds = stopLossDistancePercent >= 0.25 && stopLossDistancePercent <= 6.0;
    const stopLossPassed = isStopValid && isStopWithinBounds;

    checks.push({
      name: 'Stop Loss Geometry & Bounds',
      passed: stopLossPassed,
      detail: `Stop Distance: ${stopLossDistancePercent.toFixed(2)}% (Bounds: 0.25% - 6.0%)`,
    });
    if (!stopLossPassed && !vetoReason) {
      vetoReason = `Stop-loss placement (${stopLossDistancePercent.toFixed(2)}%) violates geometric integrity or safety distance.`;
    }

    // 7. Liquidity & Slippage Tolerance
    const spreadPct = (ticker.spread / ticker.price) * 100;
    const slippagePassed = spreadPct <= this.config.slippageLimitPercent;
    checks.push({
      name: 'Market Liquidity & Spread Tolerance',
      passed: slippagePassed,
      detail: `Spread: ${spreadPct.toFixed(3)}% | Limit: ${this.config.slippageLimitPercent.toFixed(3)}%`,
    });
    if (!slippagePassed && !vetoReason) {
      vetoReason = `Exchange spread (${spreadPct.toFixed(3)}%) exceeds acceptable slippage cap (${this.config.slippageLimitPercent}%). Execution rejected.`;
    }

    // 8. Kelly Position Sizing Calculation
    // f* = (p*b - q) / b
    const p = Math.min(0.85, Math.max(0.4, (hypothesis.expectedEdgePercent || 50) / 100));
    const q = 1 - p;
    const b = hypothesis.riskRewardRatio;
    const rawKelly = Math.max(0, (p * b - q) / b);
    // Conservative fractional Kelly (0.25x fractional Kelly)
    const fractionalKelly = Number((rawKelly * 0.25).toFixed(4));

    // Calculate maximum capital risk allowed ($)
    const maxRiskDollars = currentEquityUsd * (this.config.maxRiskPerTradePercent / 100);
    
    // Position sizing: Position Size = Max Dollar Risk / Stop Loss %
    const slDecimal = stopLossDistancePercent / 100;
    let calculatedPositionSizeUsd = slDecimal > 0 ? maxRiskDollars / slDecimal : 0;

    // Cap position size based on max leverage
    const maxLeveragedCap = currentEquityUsd * this.config.maxLeverage;
    const recommendedPositionSizeUsd = Math.min(calculatedPositionSizeUsd, maxLeveragedCap);
    const recommendedLeverage = Math.max(1, Math.min(this.config.maxLeverage, Number((recommendedPositionSizeUsd / currentEquityUsd).toFixed(2))));

    // Estimated liquidation price
    const maintenanceMarginPct = 0.005; // 0.5% crypto futures standard
    let estimatedLiquidationPrice = 0;
    if (hypothesis.direction === 'LONG') {
      estimatedLiquidationPrice = hypothesis.entryPrice * (1 - 1 / recommendedLeverage + maintenanceMarginPct);
    } else {
      estimatedLiquidationPrice = hypothesis.entryPrice * (1 + 1 / recommendedLeverage - maintenanceMarginPct);
    }

    const approved = checks.every((c) => c.passed);

    return {
      approved,
      vetoReason: approved ? undefined : vetoReason,
      maxAllowedRiskUsd: Number(maxRiskDollars.toFixed(2)),
      recommendedPositionSizeUsd: Number(recommendedPositionSizeUsd.toFixed(2)),
      recommendedLeverage,
      estimatedLiquidationPrice: Number(estimatedLiquidationPrice.toFixed(2)),
      kellyFraction: fractionalKelly,
      circuitBreakerStatus: isCircuitBreakerTripped ? 'TRIPPED' : dailyDrawdownPercent >= 2.0 ? 'WARNING' : 'NORMAL',
      checksPassed: checks,
    };
  }
}

export const riskEngine = new DeterministicRiskEngine();
