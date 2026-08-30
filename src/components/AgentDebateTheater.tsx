import React from 'react';
import {
  Globe,
  TrendingUp,
  AlertOctagon,
  Shield,
  Award,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { MultiAgentDebate, AgentDebateContribution, TradeHypothesis } from '../types/trading';

interface AgentDebateTheaterProps {
  debate: MultiAgentDebate | null;
  onExecuteHypothesis: (hypothesis: TradeHypothesis) => void;
  isExecuting: boolean;
  onTriggerDeliberation: () => void;
  isDeliberating: boolean;
}

export const AgentDebateTheater: React.FC<AgentDebateTheaterProps> = ({
  debate,
  onExecuteHypothesis,
  isExecuting,
  onTriggerDeliberation,
  isDeliberating,
}) => {
  if (!debate) {
    return (
      <div id="vua-agent-debate-empty" className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 font-mono uppercase">Multi-Agent Deliberation Ready</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Execute an adversarial 5-agent deliberation: Macro Analyst, Technical Strategist, Red Team Skeptic, Risk Officer, and CIO Synthesizer.
        </p>
        <button
          id="vua-trigger-debate-btn-empty"
          onClick={onTriggerDeliberation}
          disabled={isDeliberating}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-semibold uppercase transition flex items-center space-x-2 mx-auto cursor-pointer shadow-xs"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isDeliberating ? 'animate-spin' : ''}`} />
          <span>{isDeliberating ? 'Synthesizing Market Intelligence...' : 'Convene Deliberation Brain'}</span>
        </button>
      </div>
    );
  }

  const { macroAnalyst, technicalStrategist, contrarianSkeptic, riskOfficer, cioSynthesizer } = debate;

  const renderVerdictBadge = (verdict: AgentDebateContribution['verdict']) => {
    switch (verdict) {
      case 'FAVOR_LONG':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">FAVOR LONG</span>;
      case 'FAVOR_SHORT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">FAVOR SHORT</span>;
      case 'VETO_HIGH_RISK':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">VETO (HIGH RISK)</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">ABSTAIN (NO TRADE)</span>;
    }
  };

  return (
    <div id="vua-agent-debate-theater" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-4 p-4 sm:p-5">
      {/* Theater Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200 gap-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-sm font-bold font-mono uppercase tracking-wide text-slate-900">
            Multi-Agent Reasoning Brain
          </h2>
          <span className="text-[11px] font-mono text-slate-500 font-medium">
            ({new Date(debate.timestamp).toLocaleTimeString()})
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            {debate.engineMode === 'NEURAL_GEMINI' ? 'Gemini Neural' : 'Institutional Quant Brain'}
          </span>
        </div>
        <button
          id="vua-retrigger-deliberation-btn"
          onClick={onTriggerDeliberation}
          disabled={isDeliberating}
          className="flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-mono font-medium transition cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${isDeliberating ? 'animate-spin' : ''}`} />
          <span>{isDeliberating ? 'Deliberating...' : 'Re-Evaluate Hypothesis'}</span>
        </button>
      </div>

      {/* 4 Specialized Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Macro Analyst */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-mono font-bold text-slate-900">Macro Analyst</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">{macroAnalyst.confidence}% conf</span>
            </div>
            <div>{renderVerdictBadge(macroAnalyst.verdict)}</div>
            <ul className="text-[11px] text-slate-700 space-y-1 list-disc list-inside">
              {macroAnalyst.arguments.slice(0, 2).map((arg, i) => (
                <li key={i} className="leading-snug">{arg}</li>
              ))}
            </ul>
          </div>
          {macroAnalyst.keyLevelOrCondition && (
            <div className="text-[10px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200">
              {macroAnalyst.keyLevelOrCondition}
            </div>
          )}
        </div>

        {/* 2. Technical Strategist */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-mono font-bold text-slate-900">Technical Strategist</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">{technicalStrategist.confidence}% conf</span>
            </div>
            <div>{renderVerdictBadge(technicalStrategist.verdict)}</div>
            <ul className="text-[11px] text-slate-700 space-y-1 list-disc list-inside">
              {technicalStrategist.arguments.slice(0, 2).map((arg, i) => (
                <li key={i} className="leading-snug">{arg}</li>
              ))}
            </ul>
          </div>
          {technicalStrategist.keyLevelOrCondition && (
            <div className="text-[10px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200">
              {technicalStrategist.keyLevelOrCondition}
            </div>
          )}
        </div>

        {/* 3. Contrarian Skeptic (Red Team) */}
        <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span className="text-xs font-mono font-bold text-rose-950">Red Team Skeptic</span>
              </div>
              <span className="text-[10px] font-mono text-rose-700 font-semibold">{contrarianSkeptic.confidence}% conf</span>
            </div>
            <div>{renderVerdictBadge(contrarianSkeptic.verdict)}</div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono text-rose-700 font-semibold">Traps Identified:</span>
              <ul className="text-[11px] text-slate-700 space-y-1 list-disc list-inside">
                {contrarianSkeptic.risksIdentified.length > 0 ? (
                  contrarianSkeptic.risksIdentified.slice(0, 2).map((risk, i) => (
                    <li key={i} className="text-rose-900/90 leading-snug">{risk}</li>
                  ))
                ) : (
                  <li className="text-slate-500">No traps detected.</li>
                )}
              </ul>
            </div>
          </div>
          {contrarianSkeptic.keyLevelOrCondition && (
            <div className="text-[10px] font-mono text-rose-800 bg-white p-2 rounded border border-rose-200">
              {contrarianSkeptic.keyLevelOrCondition}
            </div>
          )}
        </div>

        {/* 4. Risk Officer */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-mono font-bold text-slate-900">Risk Officer</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">{riskOfficer.confidence}% conf</span>
            </div>
            <div>{renderVerdictBadge(riskOfficer.verdict)}</div>
            <ul className="text-[11px] text-slate-700 space-y-1 list-disc list-inside">
              {riskOfficer.arguments.slice(0, 2).map((arg, i) => (
                <li key={i} className="leading-snug">{arg}</li>
              ))}
            </ul>
          </div>
          {riskOfficer.keyLevelOrCondition && (
            <div className="text-[10px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200">
              {riskOfficer.keyLevelOrCondition}
            </div>
          )}
        </div>
      </div>

      {/* 5. CIO Synthesizer Banner & Decision */}
      <div className={`rounded-xl p-4 border transition-all shadow-xs ${
        cioSynthesizer.finalVerdict === 'PROPOSE_LONG'
          ? 'bg-emerald-50/80 border-emerald-300'
          : cioSynthesizer.finalVerdict === 'PROPOSE_SHORT'
          ? 'bg-rose-50/80 border-rose-300'
          : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center space-x-2">
              <Award className={`w-5 h-5 ${
                cioSynthesizer.finalVerdict === 'PROPOSE_LONG'
                  ? 'text-emerald-600'
                  : cioSynthesizer.finalVerdict === 'PROPOSE_SHORT'
                  ? 'text-rose-600'
                  : 'text-slate-600'
              }`} />
              <h3 className="text-sm font-bold font-mono uppercase text-slate-900">
                Chief Investment Officer Synthesis
              </h3>
              <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                cioSynthesizer.finalVerdict === 'PROPOSE_LONG'
                  ? 'bg-emerald-600 text-white'
                  : cioSynthesizer.finalVerdict === 'PROPOSE_SHORT'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-200 text-slate-800'
              }`}>
                {cioSynthesizer.finalVerdict.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-slate-500 font-medium">
                • Edge Conviction: <strong className="text-slate-900">{cioSynthesizer.edgeProbability}%</strong>
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {cioSynthesizer.synthesisRationale}
            </p>
          </div>

          {/* Trade Hypothesis Action (if proposed) */}
          {cioSynthesizer.tradeHypothesis && (
            <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
              <div className="text-right text-xs font-mono hidden sm:block">
                <div className="text-slate-500 font-medium">R:R Ratio</div>
                <div className="text-emerald-600 font-bold">{cioSynthesizer.tradeHypothesis.riskRewardRatio}:1</div>
              </div>
              <button
                id="vua-execute-hypothesis-btn"
                onClick={() => onExecuteHypothesis(cioSynthesizer.tradeHypothesis!)}
                disabled={isExecuting}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition flex items-center space-x-2 cursor-pointer shadow-xs ${
                  cioSynthesizer.tradeHypothesis.direction === 'LONG'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                <span>{isExecuting ? 'Validating Risk...' : `Execute ${cioSynthesizer.tradeHypothesis.direction}`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Detailed Hypothesis Targets Ladder */}
        {cioSynthesizer.tradeHypothesis && (
          <div className="mt-3.5 pt-3 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[10px] font-medium">Entry Price</div>
              <div className="text-slate-900 font-bold">${cioSynthesizer.tradeHypothesis.entryPrice}</div>
            </div>
            <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200 shadow-2xs">
              <div className="text-rose-700 text-[10px] font-semibold">Stop Loss</div>
              <div className="text-rose-800 font-bold">${cioSynthesizer.tradeHypothesis.stopLossPrice}</div>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
              <div className="text-emerald-700 text-[10px] font-semibold">Take Profit 1 (50%)</div>
              <div className="text-emerald-800 font-bold">${cioSynthesizer.tradeHypothesis.takeProfit1Price}</div>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
              <div className="text-emerald-700 text-[10px] font-semibold">Take Profit 2 (30%)</div>
              <div className="text-emerald-800 font-bold">${cioSynthesizer.tradeHypothesis.takeProfit2Price}</div>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
              <div className="text-emerald-700 text-[10px] font-semibold">Take Profit 3 (20%)</div>
              <div className="text-emerald-800 font-bold">${cioSynthesizer.tradeHypothesis.takeProfit3Price}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
