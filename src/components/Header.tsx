import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Play,
  Square,
  Activity,
  AlertTriangle,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { SystemStatus, ExchangeId } from '../types/trading';

interface HeaderProps {
  status: SystemStatus | null;
  selectedExchange: ExchangeId;
  selectedSymbol: string;
  onSelectExchange: (exchange: ExchangeId) => void;
  onSelectSymbol: (symbol: string) => void;
  onToggleAutoTrading: () => void;
  onOpenKillSwitchModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  syntheticDataMode?: boolean;
}

const AVAILABLE_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];

export const Header: React.FC<HeaderProps> = ({
  status,
  selectedExchange,
  selectedSymbol,
  onSelectExchange,
  onSelectSymbol,
  onToggleAutoTrading,
  onOpenKillSwitchModal,
  onRefresh,
  isRefreshing,
  syntheticDataMode,
}) => {
  const isKillSwitchEngaged = status?.killSwitchEngaged;
  const isCircuitBreakerActive = status?.circuitBreakerActive;
  const autoTradingEnabled = status?.autoTradingEnabled;
  const equity = status?.equityUsd ?? 10000;
  const dailyPnl = status?.dailyRealizedPnlUsd ?? 0;
  const dailyPnlPct = status?.dailyRealizedPnlPercent ?? 0;
  const drawdown = status?.currentDrawdownPercent ?? 0;

  return (
    <header id="vua-main-header" className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-40 shadow-xs">
      {/* Top Warning Banner if Kill Switch or Circuit Breaker Active */}
      {isKillSwitchEngaged && (
        <div id="vua-kill-switch-banner" className="bg-rose-600 px-4 py-2 flex items-center justify-between text-xs font-semibold tracking-wide text-white shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span>EMERGENCY KILL SWITCH ENGAGED — All automated execution is strictly suspended.</span>
          </div>
          <button
            id="vua-header-disengage-btn"
            onClick={onOpenKillSwitchModal}
            className="underline hover:text-rose-100 uppercase text-[11px] font-mono font-bold cursor-pointer"
          >
            Manage Safety Lock
          </button>
        </div>
      )}

      {isCircuitBreakerActive && !isKillSwitchEngaged && (
        <div id="vua-circuit-breaker-banner" className="bg-amber-600 px-4 py-2 flex items-center space-x-2 text-xs font-semibold text-white shadow-xs">
          <AlertTriangle className="w-4 h-4" />
          <span>DAILY DRAWDOWN CIRCUIT BREAKER TRIPPED — Portfolio loss exceeds daily limit. New orders vetoed.</span>
        </div>
      )}

      {syntheticDataMode && (
        <div id="vua-synthetic-mode-banner" className="bg-violet-600 px-4 py-2 flex items-center space-x-2 text-xs font-semibold text-white shadow-xs">
          <AlertTriangle className="w-4 h-4" />
          <span>SYNTHETIC DATA MODE — Market data is NOT live exchange data. All prices, order book, and candles are simulated for non-production use only.</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Logo and Core Identity */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base font-bold tracking-tight text-slate-900 font-mono">VUA INTELLIGENCE</h1>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                    v2.4
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                    status?.executionMode === 'LIVE' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {status?.executionMode === 'LIVE' ? 'LIVE EXCHANGE' : 'PAPER SIM'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Autonomous Crypto Trading • Closed-Loop Cognitive Architecture</p>
              </div>
            </div>

            {/* Exchange and Symbol Selectors */}
            <div className="hidden sm:flex items-center space-x-2 border-l border-slate-200 pl-4">
              <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 shadow-2xs">
                <button
                  id="vua-select-binance"
                  onClick={() => onSelectExchange('binance')}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer ${
                    selectedExchange === 'binance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Binance
                </button>
                <button
                  id="vua-select-bybit"
                  onClick={() => onSelectExchange('bybit')}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer ${
                    selectedExchange === 'bybit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bybit
                </button>
              </div>

              <select
                id="vua-symbol-selector"
                value={selectedSymbol}
                onChange={(e) => onSelectSymbol(e.target.value)}
                className="bg-white text-slate-900 text-xs font-mono font-semibold rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
              >
                {AVAILABLE_SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metric Badges & Kill Switch */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 justify-between lg:justify-end">
            {/* Live Equity */}
            <div className="text-right">
              <div className="text-[10px] uppercase font-mono text-slate-500 font-medium">Portfolio Equity</div>
              <div className="text-base font-bold font-mono text-slate-900">
                ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Daily PnL */}
            <div className="text-right">
              <div className="text-[10px] uppercase font-mono text-slate-500 font-medium">24h Realized PnL</div>
              <div className={`text-xs font-mono font-semibold flex items-center justify-end space-x-1 ${
                dailyPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                <span>{dailyPnl >= 0 ? '+' : ''}${dailyPnl.toFixed(2)}</span>
                <span className="text-[10px] opacity-90">({dailyPnlPct >= 0 ? '+' : ''}{dailyPnlPct.toFixed(2)}%)</span>
              </div>
            </div>

            {/* Drawdown */}
            <div className="text-right">
              <div className="text-[10px] uppercase font-mono text-slate-500 font-medium">Drawdown</div>
              <div className={`text-xs font-mono font-semibold ${
                drawdown > 2.0 ? 'text-rose-600' : drawdown > 1.0 ? 'text-amber-700' : 'text-slate-700'
              }`}>
                {drawdown.toFixed(2)}%
              </div>
            </div>

            {/* Auto-trading Toggle */}
            <button
              id="vua-autotrade-toggle-btn"
              onClick={onToggleAutoTrading}
              disabled={isKillSwitchEngaged}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer shadow-xs ${
                autoTradingEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              } ${isKillSwitchEngaged ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {autoTradingEnabled ? (
                <>
                  <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span>AUTOPILOT ON</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>AUTOPILOT OFF</span>
                </>
              )}
            </button>

            {/* Refresh Button */}
            <button
              id="vua-refresh-btn"
              onClick={onRefresh}
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition cursor-pointer shadow-xs hover:bg-slate-50"
              title="Refresh Data Snapshot"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-slate-900' : ''}`} />
            </button>

            {/* Emergency Kill Switch Button */}
            <button
              id="vua-kill-switch-btn"
              onClick={onOpenKillSwitchModal}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all shadow-xs cursor-pointer ${
                isKillSwitchEngaged
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{isKillSwitchEngaged ? 'RESET SAFETY LOCK' : 'KILL SWITCH'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
