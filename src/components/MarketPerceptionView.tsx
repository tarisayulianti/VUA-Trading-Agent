import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  BarChart3,
  Layers,
  TrendingUp,
  TrendingDown,
  Scale,
  Compass,
} from 'lucide-react';
import { MarketPerceptionSnapshot } from '../types/trading';

interface MarketPerceptionViewProps {
  snapshot: MarketPerceptionSnapshot | null;
}

export const MarketPerceptionView: React.FC<MarketPerceptionViewProps> = ({ snapshot }) => {
  if (!snapshot) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 font-mono text-xs shadow-xs">
        Loading real-time market perception data...
      </div>
    );
  }

  const { ticker, orderBook, indicators, regime, recentCandles } = snapshot;

  // Format candles for Recharts
  const chartData = recentCandles.map((c) => {
    const timeStr = new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      time: timeStr,
      price: c.close,
      high: c.high,
      low: c.low,
      volume: c.volume,
      bbUpper: indicators.bbUpper,
      bbLower: indicators.bbLower,
      ema50: indicators.ema50,
    };
  });

  const bids = orderBook.bids.slice(0, 10);
  const asks = orderBook.asks.slice(0, 10);
  const maxBidTotal = bids[bids.length - 1]?.total || 1;
  const maxAskTotal = asks[asks.length - 1]?.total || 1;
  const maxDepth = Math.max(maxBidTotal, maxAskTotal);

  return (
    <div id="vua-market-perception-view" className="space-y-5">
      {/* Top Chart Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200 gap-2">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
              Multi-Timeframe Price & Volatility Perception ({ticker.symbol})
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              15M Timeframe
            </span>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <span className="flex items-center space-x-1 text-sky-700 font-medium">
              <span className="w-2.5 h-0.5 bg-sky-600 inline-block" />
              <span>EMA 50</span>
            </span>
            <span className="flex items-center space-x-1 text-indigo-700 font-medium">
              <span className="w-2.5 h-0.5 bg-indigo-600 inline-block" />
              <span>Bollinger Bands</span>
            </span>
          </div>
        </div>

        {/* Recharts Price Composed Chart */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#94a3b8"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(val) => `$${val}`}
                orientation="right"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                labelStyle={{ color: '#64748b', fontFamily: 'monospace' }}
              />
              <Line type="monotone" dataKey="price" stroke="#059669" strokeWidth={2} dot={false} name="Close Price" />
              <Line type="monotone" dataKey="ema50" stroke="#0284c7" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="EMA 50" />
              <Line type="monotone" dataKey="bbUpper" stroke="#6366f1" strokeWidth={1} strokeDasharray="2 2" dot={false} name="BB Upper" />
              <Line type="monotone" dataKey="bbLower" stroke="#6366f1" strokeWidth={1} strokeDasharray="2 2" dot={false} name="BB Lower" />
              <Bar dataKey="volume" fill="#cbd5e1" opacity={0.5} yAxisId="right" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Indicators Matrix + Order Book Depth Ladder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Technical Indicators Matrix */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
                Technical Sensor Telemetry
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-medium">
              Volatility: {indicators.volatilityPercentile}th Percentile
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">EMA 9 / 21 / 50</span>
              <div className="text-slate-900 font-semibold mt-1">
                ${indicators.ema9.toFixed(1)} / ${indicators.ema21.toFixed(1)} / ${indicators.ema50.toFixed(1)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">200 EMA: ${indicators.ema200.toFixed(1)}</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">RSI (14-Period)</span>
              <div className={`text-base font-bold mt-1 ${
                indicators.rsi14 > 70 ? 'text-rose-600' : indicators.rsi14 < 30 ? 'text-emerald-600' : 'text-slate-900'
              }`}>
                {indicators.rsi14.toFixed(1)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {indicators.rsi14 > 70 ? 'Overbought warning' : indicators.rsi14 < 30 ? 'Oversold warning' : 'Neutral momentum'}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">ATR Volatility (14)</span>
              <div className="text-slate-900 font-semibold mt-1">
                ${indicators.atr14.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {((indicators.atr14 / ticker.price) * 100).toFixed(2)}% avg bar range
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Bollinger Bandwidth</span>
              <div className="text-slate-900 font-semibold mt-1">
                ${(indicators.bbUpper - indicators.bbLower).toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Upper: ${indicators.bbUpper.toFixed(0)} | Lower: ${indicators.bbLower.toFixed(0)}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">MACD Histogram</span>
              <div className={`font-semibold mt-1 ${
                indicators.macdHistogram >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {indicators.macdHistogram.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Signal: {indicators.macdSignal.toFixed(2)}</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Volume Delta (Proxy)</span>
              <div className={`font-semibold mt-1 ${
                indicators.volumeDeltaEstimate >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {indicators.volumeDeltaEstimate >= 0 ? '+' : ''}{indicators.volumeDeltaEstimate.toFixed(1)} vol
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Estimated skew</div>
            </div>
          </div>

          {/* Regime Details Callout */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Regime Directional Bias:</span>
              <span className="font-bold text-slate-900">{regime.trendDirection}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Volatility Compression State:</span>
              <span className="font-bold text-slate-900">{regime.volatilityState}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Liquidity & Cascade Risk:</span>
              <span className={`font-bold ${regime.liquidityQuality === 'SWEEP_RISK' ? 'text-rose-600' : 'text-emerald-600'}`}>
                {regime.liquidityQuality}
              </span>
            </div>
          </div>
        </div>

        {/* Order Book Depth Visualizer */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Scale className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
                Order Book Depth & Liquidity Imbalance
              </h3>
            </div>
            <span className={`text-[11px] font-mono font-bold ${
              orderBook.imbalanceRatio > 1.2 ? 'text-emerald-600' : orderBook.imbalanceRatio < 0.8 ? 'text-rose-600' : 'text-slate-600'
            }`}>
              Skew Ratio: {orderBook.imbalanceRatio.toFixed(2)}x
            </span>
          </div>

          {/* Imbalance visual bar */}
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>Bids (Buyers)</span>
              <span>Asks (Sellers)</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/80">
              <div
                className="bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.min(90, Math.max(10, (orderBook.imbalanceRatio / (orderBook.imbalanceRatio + 1)) * 100))}%` }}
              />
              <div
                className="bg-rose-500 transition-all duration-300"
                style={{ width: `${100 - Math.min(90, Math.max(10, (orderBook.imbalanceRatio / (orderBook.imbalanceRatio + 1)) * 100))}%` }}
              />
            </div>
          </div>

          {/* Dual Depth Ladder */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {/* Bids */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-emerald-700 pb-1 border-b border-slate-200">
                Top Bids (Support)
              </div>
              <div className="space-y-1">
                {bids.slice(0, 8).map((b, i) => (
                  <div key={i} className="relative flex items-center justify-between px-2 py-0.5 text-[11px] rounded">
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-50 rounded"
                      style={{ width: `${Math.min(100, (b.total / maxDepth) * 100)}%` }}
                    />
                    <span className="text-emerald-700 font-bold z-10">${b.price.toFixed(2)}</span>
                    <span className="text-slate-600 z-10 font-medium">{b.amount.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Asks */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-rose-700 pb-1 border-b border-slate-200">
                Top Asks (Resistance)
              </div>
              <div className="space-y-1">
                {asks.slice(0, 8).map((a, i) => (
                  <div key={i} className="relative flex items-center justify-between px-2 py-0.5 text-[11px] rounded">
                    <div
                      className="absolute inset-y-0 left-0 bg-rose-50 rounded"
                      style={{ width: `${Math.min(100, (a.total / maxDepth) * 100)}%` }}
                    />
                    <span className="text-rose-700 font-bold z-10">${a.price.toFixed(2)}</span>
                    <span className="text-slate-600 z-10 font-medium">{a.amount.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
