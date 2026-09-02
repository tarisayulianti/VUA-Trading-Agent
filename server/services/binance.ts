import { Candle, MarketTicker, OrderBook, OrderBookLevel } from '../../src/types/trading';
import { db } from '../db';

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
      if (process.env.USE_SYNTHETIC_DATA === 'true') {
        return {
          symbol,
          exchange: 'binance',
          price: 65000,
          bid: 64990,
          ask: 65010,
          spread: 20,
          high24h: 66200,
          low24h: 63800,
          volume24h: 24500,
          change24h: 1.45,
          fundingRate: 0.0001,
          timestamp: Date.now(),
        };
      }
      try {
        await db.system_events.create({
          data: {
            event_type: 'DATA_QUALITY_ERROR',
            description: `Binance getTicker failed for ${symbol}: ${message}`,
            severity: 'ERROR',
            metadata_json: {
              source: 'binance',
              method: 'getTicker',
              symbol,
              error: message,
            },
          },
        });
      } catch (logErr) {
        console.error('Failed to log DATA_QUALITY_ERROR for Binance getTicker:', logErr);
      }
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
      if (process.env.USE_SYNTHETIC_DATA === 'true') {
        return {
          symbol,
          exchange: 'binance',
          bids: [
            { price: 64990, amount: 1.2, total: 1.2 },
            { price: 64980, amount: 0.8, total: 2.0 },
          ],
          asks: [
            { price: 65010, amount: 1.1, total: 1.1 },
            { price: 65020, amount: 0.9, total: 2.0 },
          ],
          imbalanceRatio: 1,
          timestamp: Date.now(),
        };
      }
      try {
        await db.system_events.create({
          data: {
            event_type: 'DATA_QUALITY_ERROR',
            description: `Binance getOrderBook failed for ${symbol}: ${message}`,
            severity: 'ERROR',
            metadata_json: {
              source: 'binance',
              method: 'getOrderBook',
              symbol,
              error: message,
            },
          },
        });
      } catch (logErr) {
        console.error('Failed to log DATA_QUALITY_ERROR for Binance getOrderBook:', logErr);
      }
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
      if (process.env.USE_SYNTHETIC_DATA === 'true') {
        return Array.from({ length: 60 }, (_, i) => ({
          timestamp: Date.now() - (60 - i) * 900000,
          open: 65000,
          high: 65200,
          low: 64800,
          close: 65100,
          volume: 1000,
        }));
      }
      try {
        await db.system_events.create({
          data: {
            event_type: 'DATA_QUALITY_ERROR',
            description: `Binance getKlines failed for ${symbol}: ${message}`,
            severity: 'ERROR',
            metadata_json: {
              source: 'binance',
              method: 'getKlines',
              symbol,
              interval,
              limit,
              error: message,
            },
          },
        });
      } catch (logErr) {
        console.error('Failed to log DATA_QUALITY_ERROR for Binance getKlines:', logErr);
      }
      throw new Error(`Binance getKlines failed for ${symbol}: ${message}`);
    }
  }
}

export const binanceService = new BinanceService();
