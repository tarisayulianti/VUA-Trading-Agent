import React, { useState } from 'react';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Award,
  Clock,
  ChevronRight,
  Info,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ClosedTrade, SystemStatus } from '../types/trading';

interface EpistemicJournalViewProps {
  trades: ClosedTrade[];
  status: SystemStatus | null;
}

export const EpistemicJournalView: React.FC<EpistemicJournalViewProps> = ({ trades, status }) => {
  const [selectedTrade, setSelectedTrade] = useState<ClosedTrade | null>(trades[0] || null);

  const initialCapital = status?.initialCapitalUsd ?? 10000;
  let runningEquity = initialCapital;

  // Build equity curve data from sorted historical trades
  const sortedTrades = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  const equityCurveData = [
    { time: 'Start', equity: initialCapital, pnl: 0 },
    ...sortedTrades.map((t, idx) => {
      runningEquity += t.realizedPnlUsd;
      return {
        time: `#${idx + 1}`,
        equity: Number(runningEquity.toFixed(2)),
        pnl: t.realizedPnlUsd,
      };
    }),
  ];

  return (
    <div id="vua-epistemic-journal-view" className="space-y-6">
      {/* Top Performance Analytics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-mono text-slate-500 font-semibold">Total Trades</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {trades.length}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {trades.filter((t) => t.realizedPnlUsd > 0).length} Wins • {trades.filter((t) => t.realizedPnlUsd < 0).length} Losses
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-mono text-slate-500 font-semibold">Win Rate</span>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
            {status?.winRatePercent ?? 0}%
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Statistical Edge</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-mono text-slate-500 font-semibold">Profit Factor</span>
          <div className="text-xl font-bold font-mono text-indigo-600 mt-1">
            {status?.profitFactor ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Gross Gain / Loss</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-mono text-slate-500 font-semibold">Sharpe Ratio</span>
          <div className="text-xl font-bold font-mono text-sky-700 mt-1">
            {status?.sharpeRatio ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Risk-Adjusted Return</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-mono text-slate-500 font-semibold">Max Recorded DD</span>
          <div className="text-xl font-bold font-mono text-rose-600 mt-1">
            {status?.maxRecordedDrawdownPercent ?? 0}%
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Peak-to-Trough</span>
        </div>
      </div>

      {/* Cumulative Equity Growth Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
              Cumulative Epistemic Equity Curve ($USD)
            </h3>
          </div>
          <span className="text-xs font-mono text-emerald-700 font-bold">
            Net Realized: {status?.totalRealizedPnlUsd && status.totalRealizedPnlUsd >= 0 ? '+' : ''}${status?.totalRealizedPnlUsd ?? 0}
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={equityCurveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(val) => `$${val}`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                formatter={(val: any) => [`$${val}`, 'Equity']}
              />
              <Line type="monotone" dataKey="equity" stroke="#059669" strokeWidth={2.5} dot={{ r: 3, fill: '#059669' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trade Log & Selected Trade Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trades Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
                Epistemic Trade Journal ({trades.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-medium">Click row for debate snapshot</span>
          </div>

          {trades.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              No historical trades logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                    <th className="py-2">Symbol</th>
                    <th className="py-2">Side</th>
                    <th className="py-2">Entry &rarr; Exit</th>
                    <th className="py-2">Exit Trigger</th>
                    <th className="py-2">R-Multiple</th>
                    <th className="py-2 text-right">Realized PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trades.map((t) => {
                    const isWin = t.realizedPnlUsd >= 0;
                    const isSelected = selectedTrade?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTrade(t)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-slate-100/80 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 font-bold text-slate-900">
                          {t.symbol}
                          <div className="text-[10px] text-slate-500 font-normal">
                            {new Date(t.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.side === 'LONG' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-700">
                          ${t.entryPrice.toFixed(2)} &rarr; ${t.exitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                            {t.exitReason.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className={`font-bold ${isWin ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {t.rMultiple > 0 ? '+' : ''}{t.rMultiple}R
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-bold">
                          <div className={isWin ? 'text-emerald-700' : 'text-rose-700'}>
                            {isWin ? '+' : ''}${t.realizedPnlUsd.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            ({isWin ? '+' : ''}{t.realizedPnlPercent.toFixed(1)}%)
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Trade Telemetry & Epistemic Breakdown (1 Col) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
            <Info className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
              Epistemic Trade Telemetry
            </h3>
          </div>

          {selectedTrade ? (
            <div className="space-y-3.5 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1.5 shadow-2xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Trade ID:</span>
                  <span className="text-slate-900 font-bold">{selectedTrade.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Regime At Entry:</span>
                  <span className="text-indigo-700 font-bold">{selectedTrade.regimeAtEntry}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Leverage:</span>
                  <span className="text-slate-900 font-semibold">{selectedTrade.leverage}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Initial Margin:</span>
                  <span className="text-slate-900 font-semibold">${selectedTrade.marginUsd.toFixed(2)}</span>
                </div>
              </div>

              {/* MAE / MFE Excursion Metrics */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-2 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-700 block">
                  Excursion Telemetry
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Max Favorable (MFE):</span>
                  <span className="text-emerald-700 font-bold">+${selectedTrade.mfeUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Max Adverse (MAE):</span>
                  <span className="text-rose-700 font-bold">${selectedTrade.maeUsd.toFixed(2)}</span>
                </div>
              </div>

              {/* Agent Rationale Summary */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-700 block">
                  Agent Reasoning & Outcome Record
                </span>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  {selectedTrade.agentDebateSummary}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 font-mono text-xs text-center py-10">
              Select a trade to inspect telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
