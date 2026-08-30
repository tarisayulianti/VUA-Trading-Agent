import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Sliders,
  Key,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Save,
  Radio,
} from 'lucide-react';
import { RiskGovernanceConfig, SystemStatus, ExchangeId } from '../types/trading';

interface RiskGovernanceViewProps {
  config: RiskGovernanceConfig;
  status: SystemStatus | null;
  credentials: Record<ExchangeId, { hasKey: boolean; testnet: boolean }>;
  onSaveConfig: (updated: Partial<RiskGovernanceConfig>) => Promise<void>;
  onSaveCredentials: (exchange: ExchangeId, key: string, secret: string, testnet: boolean) => Promise<void>;
}

export const RiskGovernanceView: React.FC<RiskGovernanceViewProps> = ({
  config,
  status,
  credentials,
  onSaveConfig,
  onSaveCredentials,
}) => {
  // Local state for configuration sliders
  const [maxRisk, setMaxRisk] = useState(config.maxRiskPerTradePercent);
  const [maxLev, setMaxLev] = useState(config.maxLeverage);
  const [minRr, setMinRr] = useState(config.minRiskRewardRatio);
  const [maxDailyDd, setMaxDailyDd] = useState(config.maxDailyDrawdownPercent);
  const [maxPositions, setMaxPositions] = useState(config.maxOpenPositions);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedNotice, setConfigSavedNotice] = useState(false);

  // Local state for Exchange API keys
  const [activeExchangeTab, setActiveExchangeTab] = useState<ExchangeId>('binance');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiSecretInput, setApiSecretInput] = useState('');
  const [isTestnet, setIsTestnet] = useState(true);
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsSavedNotice, setCredsSavedNotice] = useState(false);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await onSaveConfig({
        maxRiskPerTradePercent: maxRisk,
        maxLeverage: maxLev,
        minRiskRewardRatio: minRr,
        maxDailyDrawdownPercent: maxDailyDd,
        maxOpenPositions: maxPositions,
      });
      setConfigSavedNotice(true);
      setTimeout(() => setConfigSavedNotice(false), 3000);
    } catch (err) {
      console.error('Failed to save risk config:', err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveCredentials = async () => {
    setSavingCreds(true);
    try {
      await onSaveCredentials(activeExchangeTab, apiKeyInput, apiSecretInput, isTestnet);
      setCredsSavedNotice(true);
      setApiKeyInput('');
      setApiSecretInput('');
      setTimeout(() => setCredsSavedNotice(false), 3000);
    } catch (err) {
      console.error('Failed to save API credentials:', err);
    } finally {
      setSavingCreds(false);
    }
  };

  const currentDailyDd = Math.abs(status?.dailyRealizedPnlPercent ?? 0);
  const isCircuitBreakerTripped = status?.circuitBreakerActive;

  return (
    <div id="vua-risk-governance-view" className="space-y-6">
      {/* Top Architecture Invariant Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-900">
                Deterministic Risk Governance Engine
              </h2>
              <p className="text-xs text-slate-500">
                Mathematical Hard Limits • Absolute Veto Power • Zero AI Override
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-slate-500 uppercase font-medium">Engine Status:</span>
            <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase ${
              config.killSwitchEngaged
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : isCircuitBreakerTripped
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {config.killSwitchEngaged ? 'KILL SWITCH ENGAGED' : isCircuitBreakerTripped ? 'CIRCUIT BREAKER HALTED' : 'ALL SYSTEMS NOMINAL'}
            </span>
          </div>
        </div>

        {/* 5 Core Principles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-4 text-xs font-mono">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
            <div className="text-emerald-700 font-bold text-[10px] uppercase">Rule 1</div>
            <div className="text-slate-900 font-semibold mt-0.5">Capital preservation &gt; opportunity</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
            <div className="text-emerald-700 font-bold text-[10px] uppercase">Rule 2</div>
            <div className="text-slate-900 font-semibold mt-0.5">No trade &gt; bad trade</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
            <div className="text-emerald-700 font-bold text-[10px] uppercase">Rule 3</div>
            <div className="text-slate-900 font-semibold mt-0.5">Probability &gt; prediction</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
            <div className="text-emerald-700 font-bold text-[10px] uppercase">Rule 4</div>
            <div className="text-slate-900 font-semibold mt-0.5">Risk engine absolute veto</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 shadow-2xs">
            <div className="text-emerald-700 font-bold text-[10px] uppercase">Rule 5</div>
            <div className="text-slate-900 font-semibold mt-0.5">Validate before scaling</div>
          </div>
        </div>
      </div>

      {/* Grid: Risk Parameters Configurator & Circuit Breakers Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Governance Configurator */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
                Deterministic Parameter Boundaries
              </h3>
            </div>
            {configSavedNotice && (
              <span className="text-[11px] font-mono text-emerald-700 font-bold">
                ✓ Saved & Applied
              </span>
            )}
          </div>

          <div className="space-y-4 text-xs font-mono">
            {/* Max Risk Per Trade */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-700 font-medium">Max Portfolio Risk Per Trade</span>
                <span className="text-emerald-700 font-bold">{maxRisk.toFixed(1)}% of Equity</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={maxRisk}
                onChange={(e) => setMaxRisk(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 border border-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>0.2% (Ultra-defensive)</span>
                <span>Hard Ceiling: 2.0%</span>
              </div>
            </div>

            {/* Max Total Leverage */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-700 font-medium">Max Leverage Ceiling</span>
                <span className="text-indigo-700 font-bold">{maxLev.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.5"
                value={maxLev}
                onChange={(e) => setMaxLev(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 border border-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>1.0x (Spot/No Lev)</span>
                <span>Hard Ceiling: 5.0x</span>
              </div>
            </div>

            {/* Minimum Risk:Reward Ratio */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-700 font-medium">Minimum Risk:Reward Ratio</span>
                <span className="text-amber-700 font-bold">{minRr.toFixed(1)}:1</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="3.5"
                step="0.1"
                value={minRr}
                onChange={(e) => setMinRr(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 border border-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>Min: 1.5:1</span>
                <span>Any trade below this is auto-vetoed</span>
              </div>
            </div>

            {/* Daily Drawdown Circuit Breaker */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-700 font-medium">Daily Drawdown Circuit Breaker Halt</span>
                <span className="text-rose-700 font-bold">-{maxDailyDd.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.5"
                value={maxDailyDd}
                onChange={(e) => setMaxDailyDd(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 border border-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>Halt at -1.0%</span>
                <span>Halt at -5.0%</span>
              </div>
            </div>

            {/* Max Open Positions */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-700 font-medium">Max Concurrent Open Positions</span>
                <span className="text-sky-700 font-bold">{maxPositions} Active</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={maxPositions}
                onChange={(e) => setMaxPositions(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-100 border border-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
              />
            </div>

            <button
              id="vua-save-risk-rules-btn"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold uppercase transition flex items-center justify-center space-x-2 cursor-pointer mt-4 shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{savingConfig ? 'Applying Constraints...' : 'Lock & Apply Risk Rules'}</span>
            </button>
          </div>
        </div>

        {/* Exchange API Integration & Live Verification */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider">
                Exchange API Adapters (Bybit & Binance)
              </h3>
            </div>
            {credsSavedNotice && (
              <span className="text-[11px] font-mono text-emerald-700 font-bold">
                ✓ Keys Verified
              </span>
            )}
          </div>

          {/* Exchange Tab Switch */}
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveExchangeTab('binance')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold uppercase border transition cursor-pointer ${
                activeExchangeTab === 'binance'
                  ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Binance ({credentials.binance.hasKey ? 'Configured' : 'Paper Default'})
            </button>
            <button
              onClick={() => setActiveExchangeTab('bybit')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold uppercase border transition cursor-pointer ${
                activeExchangeTab === 'bybit'
                  ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Bybit ({credentials.bybit.hasKey ? 'Configured' : 'Paper Default'})
            </button>
          </div>

          <div className="space-y-3.5 text-xs font-mono">
            <div>
              <label className="text-slate-600 text-[10px] uppercase font-semibold block mb-1">
                {activeExchangeTab.toUpperCase()} API Key
              </label>
              <input
                type="text"
                placeholder={credentials[activeExchangeTab].hasKey ? '••••••••••••••••••••••••' : 'Enter API Key for live execution'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-slate-900 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none font-mono transition"
              />
            </div>

            <div>
              <label className="text-slate-600 text-[10px] uppercase font-semibold block mb-1">
                {activeExchangeTab.toUpperCase()} Secret Key
              </label>
              <input
                type="password"
                placeholder={credentials[activeExchangeTab].hasKey ? '••••••••••••••••••••••••' : 'Enter Secret Key (stored in backend memory only)'}
                value={apiSecretInput}
                onChange={(e) => setApiSecretInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-slate-900 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none font-mono transition"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-700 font-medium">Testnet Simulation Mode</span>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTestnet}
                  onChange={(e) => setIsTestnet(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded bg-white border-slate-300"
                />
                <span className="text-slate-600 text-[11px] font-medium">{isTestnet ? 'Testnet Enabled' : 'Production Mainnet'}</span>
              </label>
            </div>

            <button
              id="vua-save-exchange-keys-btn"
              onClick={handleSaveCredentials}
              disabled={savingCreds}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold uppercase transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>{savingCreds ? 'Saving Keys...' : `Save ${activeExchangeTab.toUpperCase()} Credentials`}</span>
            </button>

            <div className="text-[10px] text-slate-500 italic leading-relaxed pt-1">
              * Security Guarantee: Keys are never transmitted to client browser state. When absent, the system operates with high-fidelity paper matching and realistic book slippage.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
