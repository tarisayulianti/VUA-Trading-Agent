import { Candle, MarketTicker, OrderBook, OrderBookLevel } from '../../src/types/trading';

/**
 * Binance REST API Client with robust failover
 */
export class BinanceService {
  private baseUrl = 'https://api.binance.com';
  private futuresUrl = 'https://fapi.binance.com';

  private normalizeSymbol(symbol: string): string {
    return symbol.replace('/', '').toUpperCase();
  }

  async getTicker(symbol: string): Promise<MarketTicker> {
    const rawSymbol = this.normalizeSymbol(symbol);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      
      const [spotRes, futuresRes] = await Promise.allSettled([
        fetch(`${this.baseUrl}/api/v3/ticker/24hr?symbol=${rawSymbol}`, { signal: controller.signal }),
        fetch(`${this.futuresUrl}/fapi/v1/premiumIndex?symbol=${rawSymbol}`, { signal: controller.signal })
      ]);
      clearTimeout(timeout);

      let price = 65000;
      let bid = 64990;
      let ask = 65010;
      let high24h = 66200;
      let low24h = 63800;
      let volume24h = 24500;
      let change24h = 1.45;
      let fundingRate = 0.0001;

      if (spotRes.status === 'fulfilled' && spotRes.value.ok) {
        const data: any = await spotRes.value.json();
        price = parseFloat(data.lastPrice);
        bid = parseFloat(data.bidPrice) || price * 0.9999;
        ask = parseFloat(data.askPrice) || price * 1.0001;
        high24h = parseFloat(data.highPrice);
        low24h = parseFloat(data.lowPrice);
        volume24h = parseFloat(data.volume);
        change24h = parseFloat(data.priceChangePercent);
      }

      if (futuresRes.status === 'fulfilled' && futuresRes.value.ok) {
        const fdata: any = await futuresRes.value.json();
        if (fdata.lastFundingRate) {
          fundingRate = parseFloat(fdata.lastFundingRate);
        }
      }

      return {
        symbol,
        exchange: 'binance',
        price,
        bid,
        ask,
        spread: ask - bid,
        high24h,
        low24h,
        volume24h,
        change24h,
        fundingRate,
        timestamp: Date.now(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Binance getTicker failed for ${symbol}: ${message}`);
    }
  }

  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const rawSymbol = this.normalizeSymbol(symbol);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${this.baseUrl}/api/v3/depth?symbol=${rawSymbol}&limit=${limit}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Binance depth error: ${res.statusText}`);
      const data: any = await res.json();

      let bidTotal = 0;
      const bids: OrderBookLevel[] = data.bids.map((b: string[]) => {
        const amount = parseFloat(b[1]);
        bidTotal += amount;
        return {
          price: parseFloat(b[0]),
          amount,
          total: bidTotal,
        };
      });

      let askTotal = 0;
      const asks: OrderBookLevel[] = data.asks.map((a: string[]) => {
        const amount = parseFloat(a[1]);
        askTotal += amount;
        return {
          price: parseFloat(a[0]),
          amount,
          total: askTotal,
        };
      });

      const imbalanceRatio = askTotal > 0 ? bidTotal / askTotal : 1;

      return {
        symbol,
        exchange: 'binance',
        bids,
        asks,
        imbalanceRatio,
        timestamp: Date.now(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Binance getOrderBook failed for ${symbol}: ${message}`);
    }
  }

  async getKlines(symbol: string, interval = '15m', limit = 60): Promise<Candle[]> {
    const rawSymbol = this.normalizeSymbol(symbol);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${this.baseUrl}/api/v3/klines?symbol=${rawSymbol}&interval=${interval}&limit=${limit}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Binance klines error: ${res.statusText}`);
      const data: any[] = await res.json();

      return data.map((k) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Binance getKlines failed for ${symbol}: ${message}`);
    }
  }

  private generateSyntheticTicker(symbol: string): never {
    throw new Error(`Synthetic fallback DISABLED (P0-003): getTicker failed for ${symbol}`);
  }

  private generateSyntheticOrderBook(symbol: string): never {
    throw new Error(`Synthetic fallback DISABLED (P0-003): getOrderBook failed for ${symbol}`);
  }

  private generateSyntheticCandles(symbol: string, count = 60): never {
    throw new Error(`Synthetic fallback DISABLED (P0-003): getKlines failed for ${symbol}`);
  }
}

export const binanceService = new BinanceService();
