import { Candle, MarketTicker, OrderBook, OrderBookLevel } from '../../src/types/trading';
import { db } from '../db';

/**
 * Bybit v5 Market REST API Client
 */
export class BybitService {
  private baseUrl = 'https://api.bybit.com';

  private normalizeSymbol(symbol: string): string {
    return symbol.replace('/', '').toUpperCase();
  }

  async getTicker(symbol: string): Promise<MarketTicker> {
    const rawSymbol = this.normalizeSymbol(symbol);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${this.baseUrl}/v5/market/tickers?category=linear&symbol=${rawSymbol}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Bybit ticker error: ${res.statusText}`);
      const json: any = await res.json();
      const item = json.result?.list?.[0];

      if (!item) {
        throw new Error('No Bybit ticker returned');
      }

      const price = parseFloat(item.lastPrice);
      const bid = parseFloat(item.bid1Price) || price * 0.9999;
      const ask = parseFloat(item.ask1Price) || price * 1.0001;
      const high24h = parseFloat(item.highPrice24h);
      const low24h = parseFloat(item.lowPrice24h);
      const volume24h = parseFloat(item.volume24h);
      const change24h = parseFloat(item.price24hPcnt) * 100;
      const fundingRate = parseFloat(item.fundingRate) || 0.0001;
      const openInterest = parseFloat(item.openInterest) || undefined;

      return {
        symbol,
        exchange: 'bybit',
        price,
        bid,
        ask,
        spread: ask - bid,
        high24h,
        low24h,
        volume24h,
        change24h,
        fundingRate,
        openInterest,
        timestamp: Date.now(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (process.env.USE_SYNTHETIC_DATA === 'true') {
        return {
          symbol,
          exchange: 'bybit',
          price: 65000,
          bid: 64990,
          ask: 65010,
          spread: 20,
          high24h: 66200,
          low24h: 63800,
          volume24h: 24500,
          change24h: 1.45,
          fundingRate: 0.0001,
          openInterest: undefined,
          timestamp: Date.now(),
        };
      }
      try {
        await db.system_events.create({
          data: {
            event_type: 'DATA_QUALITY_ERROR',
            description: `Bybit getTicker failed for ${symbol}: ${message}`,
            severity: 'ERROR',
            metadata_json: {
              source: 'bybit',
              method: 'getTicker',
              symbol,
              error: message,
            },
          },
        });
      } catch (logErr) {
        console.error('Failed to log DATA_QUALITY_ERROR for Bybit getTicker:', logErr);
      }
      throw new Error(`Bybit getTicker failed for ${symbol}: ${message}`);
    }
  }

  async getOrderBook(symbol: string, limit = 25): Promise<OrderBook> {
    const rawSymbol = this.normalizeSymbol(symbol);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${this.baseUrl}/v5/market/orderbook?category=linear&symbol=${rawSymbol}&limit=${limit}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Bybit orderbook error: ${res.statusText}`);
      const json: any = await res.json();
      const data = json.result;

      let bidTotal = 0;
      const bids: OrderBookLevel[] = (data.b || []).map((b: string[]) => {
        const amount = parseFloat(b[1]);
        bidTotal += amount;
        return {
          price: parseFloat(b[0]),
          amount,
          total: bidTotal,
        };
      });

      let askTotal = 0;
      const asks: OrderBookLevel[] = (data.a || []).map((a: string[]) => {
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
        exchange: 'bybit',
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
          exchange: 'bybit',
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
            description: `Bybit getOrderBook failed for ${symbol}: ${message}`,
            severity: 'ERROR',
            metadata_json: {
              source: 'bybit',
              method: 'getOrderBook',
              symbol,
              limit,
              error: message,
            },
          },
        });
      } catch (logErr) {
        console.error('Failed to log DATA_QUALITY_ERROR for Bybit getOrderBook:', logErr);
      }
      throw new Error(`Bybit getOrderBook failed for ${symbol}: ${message}`);
    }
  }

  async getKlines(symbol: string, interval = '15', limit = 60): Promise<Candle[]> {
    const rawSymbol = this.normalizeSymbol(symbol);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${this.baseUrl}/v5/market/kline?category=linear&symbol=${rawSymbol}&interval=${interval}&limit=${limit}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Bybit klines error: ${res.statusText}`);
      const json: any = await res.json();
      const list: any[] = json.result?.list || [];

      // Bybit returns newest first, so we reverse it to chronological order
      return list.reverse().map((k) => ({
        timestamp: parseInt(k[0], 10),
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
            description: `Bybit getKlines failed for ${symbol}: ${message}`,
            severity: 'ERROR',
            metadata_json: {
              source: 'bybit',
              method: 'getKlines',
              symbol,
              interval,
              limit,
              error: message,
            },
          },
        });
      } catch (logErr) {
        console.error('Failed to log DATA_QUALITY_ERROR for Bybit getKlines:', logErr);
      }
      throw new Error(`Bybit getKlines failed for ${symbol}: ${message}`);
    }
  }
}

export const bybitService = new BybitService();
