# System Architecture & VUA Crypto Trading Guide

## Core Purpose
The VUA Autonomous Crypto Trading System is an institutional-grade, multi-agent automated cryptocurrency trading engine. It combines high-frequency deterministic quantitative analysis with advanced Neural (LLM-based) multi-agent deliberation.

## System Topology & Workflow Pipeline

The engine operates on a strictly cyclical architecture, executing the following pipeline on every `setInterval` tick (default 12 seconds in autonomous mode).

### 1. Data Ingestion (Polling/Streaming)
- **Files**: `server/services/binance.ts` & `server/services/bybit.ts`
- **Function**: Polls REST endpoints (`/api/v3/ticker/24hr`, `/api/v3/depth`) for Tickers, Order Books, and Klines. 
|- **Resilience**: If the API is rate-limited or internet is disconnected, the error is caught and re-thrown as a failed fetch. The production path does not generate synthetic market data; failures must be surfaced explicitly.

### 2. Market Perception & Indicators
- **Files**: `server/services/indicators.ts` & `server/services/regime.ts`
- **Function**: Takes raw price/volume data and computes institutional indicators (EMA, RSI, ATR, VWAP, Bollinger Bands, Orderbook Imbalance). 
- **Regime Detection**: Condenses these indicators into a unified `MarketRegimeType` (e.g., `TRENDING_BULL_STRONG`, `RANGE_COMPRESSION_LOW_VOL`).

### 3. Multi-Agent Deliberation (The Brain)
- **Files**: `server/services/multiAgentBrain.ts` & `server/services/geminiClient.ts`
- **Function**: The engine passes the `MarketPerceptionSnapshot` into a deliberative committee of agents:
  - **Macro Analyst**: Assesses overall market regime.
  - **Technical Strategist**: Focuses purely on momentum and oscillators.
  - **Red Team Contrarian**: Looks for orderbook traps, spoofing, and funding rate anomalies.
  - **Risk Officer**: Evaluates volatility, slippage, and spread.
  - **CIO Synthesizer**: Makes the final `LONG`, `SHORT`, or `NO_TRADE` call.
- **Circuit Breaker Routing**: If the Gemini LLM API returns `403` or `429`, the `geminiClient.ts` intercepts this and seamlessly routes the deliberation to the `Deterministic Quantitative Engine`—a hardcoded statistical fallback so the bot never halts trading due to AI endpoint outages.

### 4. Execution & Risk Engine
- **Files**: `server/services/executionEngine.ts` & `server/services/riskEngine.ts`
- **Function**: 
  - Validates the CIO's signal against absolute risk boundaries (`maxLeverage`, `maxDailyDrawdown`, `killSwitchEngaged`).
  - Calculates position size using a modified Kelly Criterion.
  - Places the trade (Paper mode tracks locally, Live mode dispatches to Exchange).
  - Actively manages open positions (trailing stops, take profits).

### 5. Meta-Learning (Research Lab)
- **Files**: `server/services/researchLab.ts`
- **Function**: Continuously analyzes closed trades (`Epistemic Ledger`). Generates `PostMortemLearningReport`s to identify loss drivers and profitable patterns. It adjusts the confidence weighting of the `regime` logic based on past performance.

## Frontend Interaction (React)
- **File**: `src/App.tsx`
- **Function**: The frontend connects to the backend via polling (`/api/status`) and an EventSource Server-Sent-Events stream (`/api/stream`) for ultra-low-latency UI updates without overwhelming the browser.

## How to Find Information
- **Want to adjust risk parameters?** Look at `server/services/riskEngine.ts` or the UI state in `App.tsx`.
- **Want to add a new indicator?** Add the math to `server/services/indicators.ts` and ensure it's mapped in the `MarketPerceptionSnapshot` inside `src/types/trading.ts`.
- **Want to upgrade to WebSockets?** You will need to replace the `setInterval` logic in `binance.ts` and `bybit.ts` with an asynchronous `ws` stream listener, and emit updates directly to the execution engine.

## The Kill Switch
In the event of severe market dysfunction or an algorithmic feedback loop, the frontend `KillSwitchModal.tsx` hits the `/api/engine/kill-switch` endpoint. This immediately sets `killSwitchEngaged: true` in the `riskEngine.ts`, rejects any pending CIO trades, and aggressively market-closes all open positions tracked by the `executionEngine.ts`.
