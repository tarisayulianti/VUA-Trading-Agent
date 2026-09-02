import React, { useState, useEffect, useCallback } from 'react';
import {
  Terminal,
  Activity,
  Shield,
  BookOpen,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react';
import { Header } from './components/Header';
import { AutonomousTerminal } from './components/AutonomousTerminal';
import { MarketPerceptionView } from './components/MarketPerceptionView';
import { RiskGovernanceView } from './components/RiskGovernanceView';
import { EpistemicJournalView } from './components/EpistemicJournalView';
import { ResearchLabView } from './components/ResearchLabView';
import { KillSwitchModal } from './components/KillSwitchModal';
import { TutorialView } from './components/TutorialView';
import {
  SystemStatus,
  MarketPerceptionSnapshot,
  MultiAgentDebate,
  RiskCheckResult,
  Position,
  Order,
  ClosedTrade,
  RiskGovernanceConfig,
  ExchangeId,
  TradeHypothesis,
  PostMortemLearningReport,
  BacktestResult,
} from './types/trading';

type ActiveTab = 'tutorial' | 'terminal' | 'perception' | 'risk' | 'journal' | 'lab';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tutorial');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [snapshot, setSnapshot] = useState<MarketPerceptionSnapshot | null>(null);
  const [debate, setDebate] = useState<MultiAgentDebate | null>(null);
  const [lastRiskCheck, setLastRiskCheck] = useState<RiskCheckResult | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [riskConfig, setRiskConfig] = useState<RiskGovernanceConfig>({
    maxRiskPerTradePercent: 1.0,
    maxLeverage: 3.0,
    minRiskRewardRatio: 2.0,
    maxDailyDrawdownPercent: 3.0,
    maxOpenPositions: 3,
    maxTotalExposureLeveraged: 2.5,
    slippageLimitPercent: 0.15,
    killSwitchEngaged: false,
  });
  const [credentials, setCredentials] = useState<Record<ExchangeId, { hasKey: boolean; testnet: boolean }>>({
    binance: { hasKey: false, testnet: true },
    bybit: { hasKey: false, testnet: true },
  });
  const [postMortem, setPostMortem] = useState<PostMortemLearningReport | null>(null);

  const [selectedExchange, setSelectedExchange] = useState<ExchangeId>('binance');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeliberating, setIsDeliberating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [isUpdatingPostMortem, setIsUpdatingPostMortem] = useState(false);
  const [isKillSwitchModalOpen, setIsKillSwitchModalOpen] = useState(false);
  const [syntheticDataMode, setSyntheticDataMode] = useState(false);

  // Fetch full system state
  const fetchState = useCallback(async () => {
    try {
      const [statusRes, marketRes, positionsRes, ordersRes, journalRes, postMortemRes] = await Promise.all([
        fetch('/api/status'),
        fetch(`/api/market?exchange=${selectedExchange}&symbol=${encodeURIComponent(selectedSymbol)}`),
        fetch('/api/positions'),
        fetch('/api/orders'),
        fetch('/api/journal'),
        fetch('/api/research/post-mortem'),
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        setStatus(sData.status);
        setSyntheticDataMode(Boolean(sData.syntheticDataMode));
        if (sData.lastDeliberation) setDebate(sData.lastDeliberation);
        if (sData.lastRiskCheck) setLastRiskCheck(sData.lastRiskCheck);
        if (sData.riskConfig) setRiskConfig(sData.riskConfig);
        if (sData.credentials) setCredentials(sData.credentials);
      }

      if (marketRes.ok) {
        const mData = await marketRes.json();
        setSnapshot(mData);
      }

      if (positionsRes.ok) {
        const pData = await positionsRes.json();
        setPositions(pData);
      }

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData);
      }

      if (journalRes.ok) {
        const jData = await journalRes.json();
        setClosedTrades(jData.trades || []);
      }

      if (postMortemRes.ok) {
        const pmData = await postMortemRes.json();
        setPostMortem(pmData);
      }
    } catch (err) {
      console.error('Error fetching state:', err);
    }
  }, [selectedExchange, selectedSymbol]);

  // Initial load
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Connect to SSE stream for live updates
  useEffect(() => {
    const sse = new EventSource('/api/stream');

    sse.addEventListener('market_tick', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.positions) setPositions(data.positions);
        if (data.ticker && snapshot) {
          setSnapshot((prev) => (prev ? { ...prev, ticker: data.ticker, indicators: data.indicators, regime: data.regime } : null));
        }
      } catch (err) {
        // parsing error
      }
    });

    sse.addEventListener('agent_debate', (e: MessageEvent) => {
      try {
        const debateData = JSON.parse(e.data);
        setDebate(debateData);
      } catch (err) {
        // parsing error
      }
    });

    sse.addEventListener('risk_check', (e: MessageEvent) => {
      try {
        const riskData = JSON.parse(e.data);
        setLastRiskCheck(riskData);
      } catch (err) {
        // parsing error
      }
    });

    sse.addEventListener('order_executed', (e: MessageEvent) => {
      try {
        const { order, position } = JSON.parse(e.data);
        setOrders((prev) => [order, ...prev]);
        setPositions((prev) => [position, ...prev.filter((p) => p.id !== position.id)]);
      } catch (err) {
        // parsing error
      }
    });

    sse.addEventListener('trade_closed', (e: MessageEvent) => {
      try {
        const closed = JSON.parse(e.data);
        setClosedTrades((prev) => [closed, ...prev]);
        setPositions((prev) => prev.filter((p) => p.id !== closed.id && p.symbol !== closed.symbol));
      } catch (err) {
        // parsing error
      }
    });

    sse.addEventListener('kill_switch_state', (e: MessageEvent) => {
      try {
        const { engaged } = JSON.parse(e.data);
        setRiskConfig((prev) => ({ ...prev, killSwitchEngaged: engaged }));
      } catch (err) {
        // parsing error
      }
    });

    return () => {
      sse.close();
    };
  }, [snapshot]);

  // Periodic polling safety net every 6s
  useEffect(() => {
    const timer = setInterval(() => {
      fetchState();
    }, 6000);
    return () => clearInterval(timer);
  }, [fetchState]);

  // Actions
  const handleSelectExchange = async (exchange: ExchangeId) => {
    setSelectedExchange(exchange);
    await fetch('/api/market/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange, symbol: selectedSymbol }),
    });
    fetchState();
  };

  const handleSelectSymbol = async (symbol: string) => {
    setSelectedSymbol(symbol);
    await fetch('/api/market/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange: selectedExchange, symbol }),
    });
    fetchState();
  };

  const handleToggleAutoTrading = async () => {
    const newState = !status?.autoTradingEnabled;
    await fetch('/api/engine/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoTrading: newState }),
    });
    fetchState();
  };

  const handleTriggerDeliberation = async () => {
    setIsDeliberating(true);
    try {
      const res = await fetch('/api/deliberate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDebate(data.debate);
        if (data.riskCheck) setLastRiskCheck(data.riskCheck);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeliberating(false);
    }
  };

  const handleExecuteHypothesis = async (hypothesis: TradeHypothesis) => {
    setIsExecuting(true);
    try {
      const res = await fetch('/api/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hypothesis }),
      });
      const data = await res.json();
      if (data.riskResult) setLastRiskCheck(data.riskResult);
      if (data.order && data.position) {
        setOrders((prev) => [data.order, ...prev]);
        setPositions((prev) => [data.position, ...prev]);
      }
      fetchState();
    } catch (err) {
      console.error(err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClosePosition = async (positionId: string) => {
    try {
      const res = await fetch('/api/trade/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId, reason: 'MANUAL_CLOSE' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.closedTrade) {
          setClosedTrades((prev) => [data.closedTrade, ...prev]);
        }
        setPositions((prev) => prev.filter((p) => p.id !== positionId));
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKillSwitchAction = async (action: 'ENGAGE' | 'DISENGAGE', closePositions: boolean) => {
    try {
      const res = await fetch('/api/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, closeOpenPositions: closePositions }),
      });
      if (res.ok) {
        const data = await res.json();
        setRiskConfig((prev) => ({ ...prev, killSwitchEngaged: data.killSwitchEngaged }));
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRiskConfig = async (updated: Partial<RiskGovernanceConfig>) => {
    const res = await fetch('/api/risk/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const data = await res.json();
      setRiskConfig(data.config);
    }
  };

  const handleSaveCredentials = async (exchange: ExchangeId, apiKey: string, secret: string, testnet: boolean) => {
    const res = await fetch('/api/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange, apiKey, secret, testnet }),
    });
    if (res.ok) {
      const data = await res.json();
      setCredentials(data.credentials);
    }
  };

  const handleRunBacktest = async (params: any): Promise<BacktestResult> => {
    setIsBacktesting(true);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Backtest failed');
      }
      return await res.json();
    } finally {
      setIsBacktesting(false);
    }
  };

  const handleTriggerPostMortem = async () => {
    setIsUpdatingPostMortem(true);
    try {
      const res = await fetch('/api/research/post-mortem/trigger', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPostMortem(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingPostMortem(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* Institutional Top Header */}
      <Header
        status={status}
        selectedExchange={selectedExchange}
        selectedSymbol={selectedSymbol}
        onSelectExchange={handleSelectExchange}
        onSelectSymbol={handleSelectSymbol}
        onToggleAutoTrading={handleToggleAutoTrading}
        onOpenKillSwitchModal={() => setIsKillSwitchModalOpen(true)}
        onRefresh={async () => {
          setIsRefreshing(true);
          await fetchState();
          setTimeout(() => setIsRefreshing(false), 500);
        }}
        isRefreshing={isRefreshing}
        syntheticDataMode={syntheticDataMode}
      />

      {/* Main Structural Navigation Tabs */}
      <nav id="vua-main-navigation" className="bg-white/95 border-b border-slate-200/90 sticky top-[61px] z-30 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center space-x-1.5 sm:space-x-3 overflow-x-auto py-2.5">
            <button
              id="vua-nav-tutorial"
              onClick={() => setActiveTab('tutorial')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'tutorial'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>User Guide</span>
            </button>

            <button
              id="vua-nav-terminal"
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'terminal'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Autonomous Terminal</span>
            </button>

            <button
              id="vua-nav-perception"
              onClick={() => setActiveTab('perception')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'perception'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Market Perception & Depth</span>
            </button>

            <button
              id="vua-nav-risk"
              onClick={() => setActiveTab('risk')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'risk'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Risk Governance</span>
            </button>

            <button
              id="vua-nav-journal"
              onClick={() => setActiveTab('journal')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'journal'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Epistemic Ledger</span>
            </button>

            <button
              id="vua-nav-lab"
              onClick={() => setActiveTab('lab')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'lab'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Research Lab</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'tutorial' && <TutorialView />}
        
        {activeTab === 'terminal' && (
          <AutonomousTerminal
            snapshot={snapshot}
            positions={positions}
            orders={orders}
            debate={debate}
            lastRiskCheck={lastRiskCheck}
            onExecuteHypothesis={handleExecuteHypothesis}
            onClosePosition={handleClosePosition}
            onTriggerDeliberation={handleTriggerDeliberation}
            isDeliberating={isDeliberating}
            isExecuting={isExecuting}
          />
        )}

        {activeTab === 'perception' && (
          <MarketPerceptionView snapshot={snapshot} />
        )}

        {activeTab === 'risk' && (
          <RiskGovernanceView
            config={riskConfig}
            status={status}
            credentials={credentials}
            onSaveConfig={handleSaveRiskConfig}
            onSaveCredentials={handleSaveCredentials}
          />
        )}

        {activeTab === 'journal' && (
          <EpistemicJournalView trades={closedTrades} status={status} />
        )}

        {activeTab === 'lab' && (
          <ResearchLabView
            selectedExchange={selectedExchange}
            selectedSymbol={selectedSymbol}
            postMortem={postMortem}
            onRunBacktest={handleRunBacktest}
            onTriggerPostMortem={handleTriggerPostMortem}
            isBacktesting={isBacktesting}
            isUpdatingPostMortem={isUpdatingPostMortem}
          />
        )}
      </main>

      {/* Emergency Kill Switch Confirmation Modal */}
      <KillSwitchModal
        isOpen={isKillSwitchModalOpen}
        isKillSwitchEngaged={Boolean(riskConfig.killSwitchEngaged)}
        openPositionsCount={positions.length}
        onClose={() => setIsKillSwitchModalOpen(false)}
        onConfirm={handleKillSwitchAction}
      />
    </div>
  );
}
