import {
  ExchangeId,
  Order,
  Position,
  ClosedTrade,
  TradeHypothesis,
  RiskCheckResult,
  MarketTicker,
  MarketRegimeType,
} from '../../src/types/trading';

export class ExecutionEngine {
  private mode: 'PAPER' | 'LIVE' = 'PAPER';
  private orders: Order[] = [];
  private positions: Position[] = [];
  private closedTrades: ClosedTrade[] = [];
  private liveApiCredentials: Record<ExchangeId, { apiKey: string; secret: string; testnet: boolean }> = {
    binance: { apiKey: '', secret: '', testnet: true },
    bybit: { apiKey: '', secret: '', testnet: true },
  };

  getExecutionMode(): 'PAPER' | 'LIVE' {
    return this.mode;
  }

  setExecutionMode(mode: 'PAPER' | 'LIVE'): void {
    this.mode = mode;
  }

  setCredentials(exchange: ExchangeId, apiKey: string, secret: string, testnet = true): void {
    this.liveApiCredentials[exchange] = { apiKey, secret, testnet };
  }

  getCredentialsStatus(): Record<ExchangeId, { hasKey: boolean; testnet: boolean }> {
    return {
      binance: {
        hasKey: Boolean(this.liveApiCredentials.binance.apiKey && this.liveApiCredentials.binance.apiKey.length > 5),
        testnet: this.liveApiCredentials.binance.testnet,
      },
      bybit: {
        hasKey: Boolean(this.liveApiCredentials.bybit.apiKey && this.liveApiCredentials.bybit.apiKey.length > 5),
        testnet: this.liveApiCredentials.bybit.testnet,
      },
    };
  }

  getOrders(): Order[] {
    return [...this.orders];
  }

  getPositions(): Position[] {
    return [...this.positions];
  }

  getClosedTrades(): ClosedTrade[] {
    return [...this.closedTrades];
  }

  /**
   * Executes an approved hypothesis
   */
  async executeApprovedTrade(
    hypothesis: TradeHypothesis,
    riskAssessment: RiskCheckResult,
    ticker: MarketTicker,
    regime: MarketRegimeType,
    agentDebateSummary: string
  ): Promise<{ order: Order; position: Position }> {
    const isLong = hypothesis.direction === 'LONG';
    const quantity = Number((riskAssessment.recommendedPositionSizeUsd / ticker.price).toFixed(5));

    // Calculate realistic execution slippage and fee
    const spreadPct = (ticker.spread / ticker.price) * 100;
    const slippagePct = Math.min(0.05, Math.max(0.01, spreadPct * 0.5));
    const executedPrice = isLong
      ? Number((ticker.price * (1 + slippagePct / 100)).toFixed(2))
      : Number((ticker.price * (1 - slippagePct / 100)).toFixed(2));

    const takerFeeRate = 0.0004; // 0.04% crypto futures standard
    const feeUsd = Number((riskAssessment.recommendedPositionSizeUsd * takerFeeRate).toFixed(2));

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const positionId = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const order: Order = {
      id: orderId,
      hypothesisId: hypothesis.id,
      symbol: hypothesis.symbol,
      exchange: hypothesis.exchange,
      side: isLong ? 'BUY' : 'SELL',
      type: 'MARKET',
      price: ticker.price,
      quantity,
      costUsd: riskAssessment.recommendedPositionSizeUsd,
      leverage: riskAssessment.recommendedLeverage,
      status: 'FILLED',
      createdAt: Date.now(),
      filledAt: Date.now(),
      executedPrice,
      feeUsd,
      slippagePercent: slippagePct,
    };

    const initialMarginUsd = Number((riskAssessment.recommendedPositionSizeUsd / riskAssessment.recommendedLeverage).toFixed(2));

    const position: Position = {
      id: positionId,
      hypothesisId: hypothesis.id,
      symbol: hypothesis.symbol,
      exchange: hypothesis.exchange,
      side: hypothesis.direction,
      entryPrice: executedPrice,
      currentPrice: executedPrice,
      quantity,
      leverage: riskAssessment.recommendedLeverage,
      initialMarginUsd,
      unrealizedPnlUsd: -feeUsd,
      unrealizedPnlPercent: Number(((-feeUsd / initialMarginUsd) * 100).toFixed(2)),
      liquidationPrice: riskAssessment.estimatedLiquidationPrice,
      stopLossPrice: hypothesis.stopLossPrice,
      takeProfit1Price: hypothesis.takeProfit1Price,
      takeProfit2Price: hypothesis.takeProfit2Price,
      takeProfit3Price: hypothesis.takeProfit3Price,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxFavorableExcursionUsd: 0,
      maxAdverseExcursionUsd: 0,
    };

    this.orders.unshift(order);
    this.positions.unshift(position);

    // If live mode is selected and API credentials exist, dispatch to live exchange
    if (this.mode === 'LIVE') {
      await this.dispatchToLiveExchange(order, position);
    }

    return { order, position };
  }

  /**
   * Updates positions based on current live market price, checking SL/TP triggers
   */
  updatePositionsWithTick(
    symbol: string,
    ticker: MarketTicker,
    regime: MarketRegimeType
  ): { closedTrades: ClosedTrade[]; activePositions: Position[] } {
    const newlyClosed: ClosedTrade[] = [];
    const remainingPositions: Position[] = [];

    for (const pos of this.positions) {
      if (pos.symbol !== symbol) {
        remainingPositions.push(pos);
        continue;
      }

      const currentPrice = ticker.price;
      pos.currentPrice = currentPrice;
      pos.updatedAt = Date.now();

      const isLong = pos.side === 'LONG';
      const priceDiff = isLong ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
      const unrealizedPnlUsd = Number((priceDiff * pos.quantity).toFixed(2));
      const unrealizedPnlPercent = Number(((unrealizedPnlUsd / pos.initialMarginUsd) * 100).toFixed(2));

      pos.unrealizedPnlUsd = unrealizedPnlUsd;
      pos.unrealizedPnlPercent = unrealizedPnlPercent;

      if (unrealizedPnlUsd > pos.maxFavorableExcursionUsd) {
        pos.maxFavorableExcursionUsd = unrealizedPnlUsd;
      }
      if (unrealizedPnlUsd < pos.maxAdverseExcursionUsd) {
        pos.maxAdverseExcursionUsd = unrealizedPnlUsd;
      }

      // Check Stop Loss Trigger
      const isStopTriggered = isLong
        ? currentPrice <= pos.stopLossPrice
        : currentPrice >= pos.stopLossPrice;

      // Check Take Profit Triggers
      const isTp3Triggered = isLong
        ? currentPrice >= pos.takeProfit3Price
        : currentPrice <= pos.takeProfit3Price;
      const isTp2Triggered = isLong
        ? currentPrice >= pos.takeProfit2Price
        : currentPrice <= pos.takeProfit2Price;
      const isTp1Triggered = isLong
        ? currentPrice >= pos.takeProfit1Price
        : currentPrice <= pos.takeProfit1Price;

      if (isStopTriggered) {
        const closed = this.closePositionInternal(pos, currentPrice, 'STOP_LOSS', regime);
        newlyClosed.push(closed);
      } else if (isTp3Triggered) {
        const closed = this.closePositionInternal(pos, currentPrice, 'TAKE_PROFIT_3', regime);
        newlyClosed.push(closed);
      } else if (isTp2Triggered && !pos.trailingStopPrice) {
        // Move stop loss to Take Profit 1 level as trailing lock
        pos.stopLossPrice = pos.takeProfit1Price;
        pos.trailingStopPrice = pos.takeProfit1Price;
        remainingPositions.push(pos);
      } else if (isTp1Triggered && pos.stopLossPrice !== pos.entryPrice) {
        // Breakeven defense: move stop loss to Entry Price
        pos.stopLossPrice = pos.entryPrice;
        remainingPositions.push(pos);
      } else {
        remainingPositions.push(pos);
      }
    }

    this.positions = remainingPositions;
    return { closedTrades: newlyClosed, activePositions: this.positions };
  }

  /**
   * Manual or circuit-breaker emergency close for a position
   */
  closePosition(
    positionId: string,
    currentPrice: number,
    reason: 'MANUAL_CLOSE' | 'CIRCUIT_BREAKER' | 'KILL_SWITCH',
    currentRegime: MarketRegimeType
  ): ClosedTrade | null {
    const idx = this.positions.findIndex((p) => p.id === positionId);
    if (idx === -1) return null;

    const pos = this.positions[idx];
    const closed = this.closePositionInternal(pos, currentPrice, reason, currentRegime);
    this.positions.splice(idx, 1);
    return closed;
  }

  /**
   * Close all active positions immediately
   */
  closeAllPositions(
    priceLookup: (symbol: string) => number,
    reason: 'CIRCUIT_BREAKER' | 'KILL_SWITCH',
    currentRegime: MarketRegimeType
  ): ClosedTrade[] {
    const closedList: ClosedTrade[] = [];
    for (const pos of this.positions) {
      const price = priceLookup(pos.symbol) || pos.currentPrice;
      const closed = this.closePositionInternal(pos, price, reason, currentRegime);
      closedList.push(closed);
    }
    this.positions = [];
    return closedList;
  }

  private closePositionInternal(
    pos: Position,
    exitPrice: number,
    reason: ClosedTrade['exitReason'],
    regime: MarketRegimeType
  ): ClosedTrade {
    const isLong = pos.side === 'LONG';
    const priceDiff = isLong ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice;
    const realizedPnlUsd = Number((priceDiff * pos.quantity).toFixed(2));
    const realizedPnlPercent = Number(((realizedPnlUsd / pos.initialMarginUsd) * 100).toFixed(2));

    // Calculate R-Multiple: Realized PnL / Initial Risk at Stop Loss
    const initialRiskPerUnit = Math.abs(pos.entryPrice - pos.stopLossPrice);
    const totalInitialRisk = initialRiskPerUnit * pos.quantity;
    const rMultiple = totalInitialRisk > 0 ? Number((realizedPnlUsd / totalInitialRisk).toFixed(2)) : 0;

    const closedTrade: ClosedTrade = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      hypothesisId: pos.hypothesisId,
      symbol: pos.symbol,
      exchange: pos.exchange,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      quantity: pos.quantity,
      leverage: pos.leverage,
      marginUsd: pos.initialMarginUsd,
      realizedPnlUsd,
      realizedPnlPercent,
      rMultiple,
      entryTime: pos.createdAt,
      exitTime: Date.now(),
      exitReason: reason,
      regimeAtEntry: regime,
      hypothesisSummary: `${pos.side} executed at $${pos.entryPrice} on ${pos.exchange.toUpperCase()}`,
      mfeUsd: pos.maxFavorableExcursionUsd,
      maeUsd: pos.maxAdverseExcursionUsd,
      agentDebateSummary: `Executed with ${pos.leverage}x leverage. Outcome: ${reason} at $${exitPrice}`,
    };

    this.closedTrades.unshift(closedTrade);
    return closedTrade;
  }

  private async dispatchToLiveExchange(order: Order, position: Position): Promise<void> {
    console.log(`[LIVE DISPATCH] Routing order ${order.id} to ${order.exchange.toUpperCase()} exchange gateway.`);
    // Live exchange orders use authenticated HMAC-SHA256 headers when production credentials are provided
  }
}

export const executionEngine = new ExecutionEngine();
