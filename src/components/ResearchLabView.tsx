import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  RotateCw,
  Award,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Sliders,
  Sparkles,
  BarChart,
} from 'lucide-react';
import {
  BacktestResult,
  PostMortemLearningReport,
  ExchangeId,
  MarketRegimeType,
} from '../types/trading';

interface ResearchLabViewProps {
  selectedExchange: ExchangeId;
  selectedSymbol: string;
  postMortem: PostMortemLearningReport | null;
  onRunBacktest: (params: {
    symbol: string;
    exchange: ExchangeId;
    timeframe: string;
    candleCount: number;
    initialCapital: number;
    riskPerTrade: number;
  }) => Promise<BacktestResult>;
  onTriggerPostMortem: () => Promise<void>;
  isBacktesting: boolean;
  isUpdatingPostMortem: boolean;
}

export const ResearchLabView: React.FC<ResearchLabViewProps> = ({
  selectedExchange,
  selectedSymbol,
  postMortem,
  onRunBacktest,
  onTriggerPostMortem,
  isBacktesting,
  isUpdatingPostMortem,
}) => {
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [timeframe, setTimeframe] = useState('15m');
  const [candleCount, setCandleCount] = useState(150);
  const [riskPerTrade, setRiskPerTrade] = useState(1.0);

  const handleStartBacktest = async () => {
    try {
      const res = await onRunBacktest({
        symbol: selectedSymbol,
        exchange: selectedExchange,
        timeframe,
        candleCount,
        initialCapital: 10000,
        riskPerTrade: riskPerTrade / 100,
      });
      setBacktestResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  // Check "Validate before scaling" criteria
  const isScaleValidated =
    backtestResult &&
    backtestResult.totalTrades >= 10 &&
    backtestResult.sharpeRatio >= 1.2 &&
    backtestResult.maxDrawdownPercent <= 8.0 &&
    backtestResult.profitFactor >= 1.5;

  return (
    <div id="vua-research-lab-view" className="space-y-6">
      {/* Research Lab Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-900">
              VUA Research Lab & Controlled Self-Improvement
            </h2>
            <p className="text-xs text-slate-500">
              Historical Backtesting • "Validate Before Scaling" • Meta-Learning Post-Mortem
            </p>
          </div>
        </div>

        <button
          id="vua-trigger-meta-learning-btn"
          onClick={onTriggerPostMortem}
          disabled={isUpdatingPostMortem}
          className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-mono font-bold uppercase transition flex items-center space-x-2 cursor-pointer self-start sm:self-auto shadow-2xs"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isUpdatingPostMortem ? 'animate-spin' : ''}`} />
          <span>{isUpdatingPostMortem ? 'Synthesizing...' : 'Run Meta-Learning Loop'}</span>
        </button>
      </div>

      {/* Backtest Config & Execution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Backtest Configuration Form (1 Col) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
              Simulation Parameters
            </h3>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Target Symbol / Exchange</span>
              <div className="bg-slate-50 p-2 rounded border border-slate-200 font-bold text-slate-900">
                {selectedSymbol} on {selectedExchange.toUpperCase()}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Candlestick Resolution</span>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono focus:ring-1 focus:ring-slate-400 focus:outline-none"
              >
                <option value="5m">5 Minutes (Intraday Scalp)</option>
                <option value="15m">15 Minutes (Standard VUA)</option>
                <option value="1h">1 Hour (Swing Regime)</option>
              </select>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Sample Depth ({candleCount} Bars)</span>
              <input
                type="range"
                min="50"
                max="300"
                step="25"
                value={candleCount}
                onChange={(e) => setCandleCount(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
              />
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Risk Per Trade ({riskPerTrade.toFixed(1)}%)</span>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={riskPerTrade}
                onChange={(e) => setRiskPerTrade(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <button
              id="vua-run-backtest-btn"
              onClick={handleStartBacktest}
              disabled={isBacktesting}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold uppercase transition flex items-center justify-center space-x-2 cursor-pointer mt-3 shadow-xs"
            >
              <Play className={`w-3.5 h-3.5 ${isBacktesting ? 'animate-spin' : ''}`} />
              <span>{isBacktesting ? 'Simulating Bar-by-Bar...' : 'Run Historical Backtest'}</span>
            </button>
          </div>
        </div>

        {/* Backtest Results & Validation Criteria (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <BarChart className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
                Backtest Outcomes & "Validate Before Scaling" Audit
              </h3>
            </div>
            {backtestResult && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                isScaleValidated
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {isScaleValidated ? 'VALIDATED TO SCALE' : 'INSUFFICIENT SAMPLE / EDGE'}
              </span>
            )}
          </div>

          {backtestResult ? (
            <div className="space-y-4">
              {/* Outcome Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Return</span>
                  <div className={`text-lg font-bold mt-0.5 ${
                    backtestResult.totalReturnPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {backtestResult.totalReturnPercent >= 0 ? '+' : ''}{backtestResult.totalReturnPercent}%
                  </div>
                  <span className="text-[10px] text-slate-500">Final: ${backtestResult.finalEquity.toFixed(2)}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Win Rate</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {backtestResult.winRate}%
                  </div>
                  <span className="text-[10px] text-slate-500">{backtestResult.totalTrades} Executed Trades</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Profit Factor</span>
                  <div className="text-lg font-bold text-indigo-600 mt-0.5">
                    {backtestResult.profitFactor}
                  </div>
                  <span className="text-[10px] text-slate-500">Gross Gain / Loss</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Max Drawdown</span>
                  <div className="text-lg font-bold text-rose-600 mt-0.5">
                    {backtestResult.maxDrawdownPercent}%
                  </div>
                  <span className="text-[10px] text-slate-500">Sharpe: {backtestResult.sharpeRatio}</span>
                </div>
              </div>

              {/* Regime-by-Regime Performance Breakdown */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-500 block">
                  Regime Sensitivity Performance Matrix
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {backtestResult.regimeBreakdown.map((rb, i) => (
                    <div key={i} className="bg-slate-50 p-2.5 rounded border border-slate-200/70 flex items-center justify-between shadow-2xs">
                      <div>
                        <div className="font-bold text-slate-900">{rb.regime.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] text-slate-500">{rb.trades} trades • Win Rate: {rb.winRate}%</div>
                      </div>
                      <div className={`font-bold ${rb.pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {rb.pnl >= 0 ? '+' : ''}${rb.pnl}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-1">
              <p>No backtest executed yet.</p>
              <p className="text-[11px] text-slate-400">Click "Run Historical Backtest" to test against exchange candle bars.</p>
            </div>
          )}
        </div>
      </div>

      {/* Meta-Learning & Post-Mortem Intelligence Engine */}
      {postMortem && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
                Autonomous Meta-Learning Post-Mortem
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500 font-medium">
              Analyzed Sample: {postMortem.analyzedTradesCount} Closed Outcomes
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            {/* Profitable Patterns */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 space-y-2">
              <span className="text-emerald-800 font-bold uppercase text-[10px] block">
                Validated Profitable Edges
              </span>
              <ul className="space-y-1.5 text-slate-700 list-disc list-inside text-[11px]">
                {postMortem.profitablePatterns.map((p, i) => (
                  <li key={i} className="leading-relaxed">{p}</li>
                ))}
              </ul>
            </div>

            {/* Loss Drivers */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3.5 space-y-2">
              <span className="text-rose-800 font-bold uppercase text-[10px] block">
                Failure & Loss Drivers
              </span>
              <ul className="space-y-1.5 text-slate-700 list-disc list-inside text-[11px]">
                {postMortem.lossDrivers.map((l, i) => (
                  <li key={i} className="leading-relaxed">{l}</li>
                ))}
              </ul>
            </div>

            {/* Self-Improvement Rules */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3.5 space-y-2">
              <span className="text-indigo-800 font-bold uppercase text-[10px] block">
                Adaptive Heuristic Guardrails
              </span>
              <ul className="space-y-1.5 text-slate-700 list-disc list-inside text-[11px]">
                {postMortem.recommendedRules.map((r, i) => (
                  <li key={i} className="leading-relaxed">{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
