import React from 'react';
import { 
  BookOpen, 
  Play, 
  Settings, 
  ShieldAlert, 
  Activity,
  History,
  Info
} from 'lucide-react';

export function TutorialView() {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex items-center space-x-3 mb-6">
          <BookOpen className="w-6 h-6 text-slate-800" />
          <h1 className="text-xl font-bold font-mono uppercase tracking-tight text-slate-900">
            User Operations Tutorial
          </h1>
        </div>

        <div className="prose prose-slate max-w-none text-slate-700 space-y-6">
          <p className="text-[15px] leading-relaxed">
            Welcome to the <strong>VUA Autonomous Crypto Trading System</strong> dashboard. This guide will walk you through how to operate the terminal, monitor active trades, and manage your risk settings.
          </p>

          <hr className="border-slate-200" />

          {/* Quick Start Guide */}
          <div>
            <h2 className="text-lg font-bold font-mono uppercase text-slate-900 flex items-center space-x-2 mb-4">
              <Play className="w-5 h-5 text-indigo-500" />
              <span>1. How to Start Trading</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="font-mono font-semibold text-slate-800 text-sm mb-2">Step 1: Select Your Mode</div>
                <div className="text-sm text-slate-600 leading-relaxed">
                  In the <strong>Autonomous Terminal</strong> tab, choose between <strong>Paper Trading</strong> (simulated capital) or <strong>Live Execution</strong> (real capital). If you select Live, ensure your Exchange API Keys are configured in the settings.
                  <InfoTooltip content={
                    <>
                      <strong className="text-white block mb-1">Spot vs Futures Execution:</strong>
                      <span className="block mb-1">• <strong>Spot:</strong> Buying/selling the actual underlying asset (e.g., BTC).</span>
                      <span className="block">• <strong>Futures:</strong> Trading Linear perpetual contracts with Leverage and margin. The engine automatically handles maintenance margin and liquidation risk calculations.</span>
                    </>
                  } />
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="font-mono font-semibold text-slate-800 text-sm mb-2">Step 2: Engage the Engine</div>
                <div className="text-sm text-slate-600 leading-relaxed">
                  Click the large green <strong>Engage Autonomous Loop</strong> button. The system will begin analyzing the market every 12 seconds, utilizing the multi-agent AI to decide whether to go Long, Short, or Hold.
                  <InfoTooltip content={
                    <>
                      <strong className="text-white block mb-1">The Multi-Agent Brain:</strong>
                      <span className="block">A committee of 5 specialized agents (Macro, Technical, Contrarian, Risk, CIO). The CIO synthesizes their signals and enforces strict capital preservation rules before allowing any trades to pass to the Execution Engine.</span>
                    </>
                  } />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Navigating the Tabs */}
          <div>
            <h2 className="text-lg font-bold font-mono uppercase text-slate-900 flex items-center space-x-2 mb-4">
              <Activity className="w-5 h-5 text-emerald-500" />
              <span>2. Dashboard Navigation</span>
            </h2>
            <ul className="space-y-4">
              <li className="flex items-start">
                <span className="font-mono text-sm font-bold w-48 shrink-0">Autonomous Terminal:</span>
                <span className="text-sm">This is your main control room. Here you can start/stop the engine, monitor your active positions, view your daily PnL, and manually close trades if needed.</span>
              </li>
              <li className="flex items-start">
                <span className="font-mono text-sm font-bold w-48 shrink-0">Market Perception:</span>
                <span className="text-sm">View real-time market data. This tab shows the exact indicators (like RSI, VWAP, Orderbook Imbalance) that the AI agents are looking at right now.</span>
              </li>
              <li className="flex items-start">
                <span className="font-mono text-sm font-bold w-48 shrink-0">Risk Governance:</span>
                <span className="text-sm"><strong>(Crucial Step)</strong> Set your safety boundaries here. You must define your Max Leverage, Max Daily Drawdown, and Risk-per-trade. The AI will refuse to execute trades that violate these rules.</span>
              </li>
              <li className="flex items-start">
                <span className="font-mono text-sm font-bold w-48 shrink-0">Epistemic Ledger:</span>
                <span className="text-sm">Review your trade history. Every closed trade is logged here along with the exact "Agent Debate" transcript that approved the trade.</span>
              </li>
            </ul>
          </div>

          <hr className="border-slate-200" />

          {/* Emergency Guide */}
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-5">
            <h2 className="text-sm font-bold font-mono uppercase text-rose-800 flex items-center space-x-2 mb-2">
              <ShieldAlert className="w-4 h-4" />
              <span>3. Emergency Kill Switch</span>
            </h2>
            <p className="text-sm text-rose-700 leading-relaxed">
              If the market experiences extreme, unpredictable volatility (like a flash crash), look for the red <strong>KILL SWITCH</strong> button located in the top-right corner of the application. 
              Clicking this will instantly halt all autonomous trading, cancel pending orders, and issue aggressive MARKET orders to close all your open positions to protect your remaining capital.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTooltip({ content }: { content: React.ReactNode }) {
  return (
    <div className="group relative inline-flex items-center justify-center ml-1.5 cursor-help align-middle">
      <Info className="w-4 h-4 text-slate-400 hover:text-indigo-500 transition-colors" />
      <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible absolute z-50 w-72 p-3 bottom-full left-1/2 -translate-x-1/2 mb-2 text-xs font-sans text-slate-300 bg-slate-900 rounded-lg shadow-xl border border-slate-700 transition-all duration-200 pointer-events-none leading-relaxed text-left">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2.5 h-2.5 bg-slate-900 border-b border-r border-slate-700 transform rotate-45"></div>
      </div>
    </div>
  );
}
