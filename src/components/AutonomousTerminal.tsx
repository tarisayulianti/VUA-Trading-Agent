import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Layers,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  Clock,
} from 'lucide-react';
import {
  MarketPerceptionSnapshot,
  MultiAgentDebate,
  Position,
  Order,
  TradeHypothesis,
  RiskCheckResult,
} from '../types/trading';
import { AgentDebateTheater } from './AgentDebateTheater';

interface AutonomousTerminalProps {
  snapshot: MarketPerceptionSnapshot | null;
  positions: Position[];
  orders: Order[];
  debate: MultiAgentDebate | null;
  lastRiskCheck: RiskCheckResult | null;
  onExecuteHypothesis: (hypothesis: TradeHypothesis) => void;
  onClosePosition: (positionId: string) => void;
  onTriggerDeliberation: () => void;
  isDeliberating: boolean;
  isExecuting: boolean;
}

export const AutonomousTerminal: React.FC<AutonomousTerminalProps> = ({
  snapshot,
  positions,
  orders,
  debate,
  lastRiskCheck,
  onExecuteHypothesis,
  onClosePosition,
  onTriggerDeliberation,
  isDeliberating,
  isExecuting,
}) => {
  const ticker = snapshot?.ticker;
  const regime = snapshot?.regime;
  const orderBook = snapshot?.orderBook;
  const indicators = snapshot?.indicators;

  const isUp = (ticker?.change24h ?? 0) >= 0;

  return (
    <div id="vua-autonomous-terminal" className="space-y-5">
      {/* Live Market Perception Hero Bar */}
      {ticker && regime && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Symbol, Price, Change */}
            <div className="flex items-center space-x-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                    {ticker.symbol}
                  </h2>
                  <span className="text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    {ticker.exchange}
                  </span>
                </div>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">
                    ${ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`flex items-center text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    isUp ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {isUp ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                    {ticker.change24h > 0 ? '+' : ''}{ticker.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 text-xs font-mono">
              <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-lg">
                <div className="text-slate-500 text-[10px] uppercase font-semibold">24h High / Low</div>
                <div className="text-slate-900 font-semibold mt-0.5">
                  ${ticker.high24h.toFixed(0)} / ${ticker.low24h.toFixed(0)}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-lg">
                <div className="text-slate-500 text-[10px] uppercase font-semibold">Funding Rate</div>
                <div className={`font-semibold mt-0.5 ${
                  ticker.fundingRate > 0.0002 ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {(ticker.fundingRate * 100).toFixed(4)}%
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-lg">
                <div className="text-slate-500 text-[10px] uppercase font-semibold">Spread / Slippage</div>
                <div className="text-slate-900 font-semibold mt-0.5">
                  ${ticker.spread.toFixed(2)} ({((ticker.spread / ticker.price) * 100).toFixed(3)}%)
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-lg">
                <div className="text-slate-500 text-[10px] uppercase font-semibold">24h Volume</div>
                <div className="text-slate-900 font-semibold mt-0.5">
                  ${(ticker.volume24h * ticker.price / 1e6).toFixed(1)}M
                </div>
              </div>
            </div>
          </div>

          {/* Regime Assessment Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 font-mono text-[11px] uppercase font-medium">Detected Market Regime:</span>
              <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                {regime.regime.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                ({regime.confidence}% confidence)
              </span>
            </div>
            <p className="text-slate-600 text-[11px] font-sans italic sm:text-right max-w-xl">
              "{regime.rationale}"
            </p>
          </div>
        </div>
      )}

      {/* Deterministic Risk Gate Notice if last check was vetoed */}
      {lastRiskCheck && !lastRiskCheck.approved && (
        <div id="vua-risk-veto-banner" className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-xs shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-rose-900 font-mono uppercase">Risk Engine Absolute Veto Enforced</span>
              <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-semibold">
                CAPITAL PRESERVATION &gt; OPPORTUNITY
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              {lastRiskCheck.vetoReason}
            </p>
          </div>
        </div>
      )}

      {/* Multi-Agent Reasoning Brain Deliberation Theater */}
      <AgentDebateTheater
        debate={debate}
        onExecuteHypothesis={onExecuteHypothesis}
        isExecuting={isExecuting}
        onTriggerDeliberation={onTriggerDeliberation}
        isDeliberating={isDeliberating}
      />

      {/* Active Positions & Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Open Positions (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
                Live Active Positions ({positions.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-medium">
              Allocated Margin: ${positions.reduce((acc, p) => acc + p.initialMarginUsd, 0).toFixed(2)}
            </span>
          </div>

          {positions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-mono text-xs">
              No active open positions. Engine adhering to "No trade &gt; bad trade".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 text-[10px] uppercase">
                    <th className="py-2.5 px-2">Pair / Side</th>
                    <th className="py-2.5 px-2">Entry / Mark</th>
                    <th className="py-2.5 px-2">Leverage / Margin</th>
                    <th className="py-2.5 px-2">Stop / TP1</th>
                    <th className="py-2.5 px-2">Unrealized PnL</th>
                    <th className="py-2.5 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {positions.map((pos) => {
                    const isProfit = pos.unrealizedPnlUsd >= 0;
                    return (
                      <tr key={pos.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-2">
                          <div className="font-bold text-slate-900">{pos.symbol}</div>
                          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            pos.side === 'LONG' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="text-slate-900 font-medium">${pos.entryPrice.toFixed(2)}</div>
                          <div className="text-slate-500 text-[10px]">${pos.currentPrice.toFixed(2)}</div>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="text-slate-900 font-medium">{pos.leverage}x</div>
                          <div className="text-slate-500 text-[10px]">${pos.initialMarginUsd.toFixed(2)}</div>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="text-rose-600 text-[11px] font-semibold">${pos.stopLossPrice.toFixed(2)}</div>
                          <div className="text-emerald-600 text-[10px] font-semibold">${pos.takeProfit1Price.toFixed(2)}</div>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className={`font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isProfit ? '+' : ''}${pos.unrealizedPnlUsd.toFixed(2)}
                          </div>
                          <div className={`text-[10px] font-medium ${isProfit ? 'text-emerald-700/80' : 'text-rose-700/80'}`}>
                            ({isProfit ? '+' : ''}{pos.unrealizedPnlPercent.toFixed(2)}%)
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            id={`vua-close-pos-${pos.id}`}
                            onClick={() => onClosePosition(pos.id)}
                            className="px-2.5 py-1 text-[11px] font-mono font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition shadow-2xs"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Orders Log (1 Col) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
                Execution Orders
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-medium">{orders.length} total</span>
          </div>

          {orders.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-mono text-xs">
              No orders executed yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {orders.slice(0, 6).map((ord) => (
                <div key={ord.id} className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-lg text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{ord.symbol}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      ord.side === 'BUY' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
                    }`}>
                      {ord.side} {ord.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[10px]">
                    <span>Fill: ${ord.executedPrice ?? ord.price}</span>
                    <span>Fee: ${ord.feeUsd ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[10px] pt-0.5">
                    <span>Slippage: {ord.slippagePercent?.toFixed(3) ?? '0.010'}%</span>
                    <span>{new Date(ord.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
