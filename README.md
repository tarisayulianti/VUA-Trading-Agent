# VUA Autonomous Crypto Trading System

An institutional-grade, multi-agent automated cryptocurrency trading engine and research laboratory. This system combines deterministic quantitative analysis with neural (LLM-based) multi-agent deliberation to execute synthetic (paper) or live trades on major exchanges.

## 🧠 Core Architecture

The backend is built in TypeScript (Node.js/Express) and uses a robust service-oriented architecture:

### 1. Multi-Agent Reasoning Engine (`multiAgentBrain.ts`)
Executes a multi-agent deliberation process before any trade. It utilizes Google's Gemini LLM (Neural Mode) with an automatic fallback to a High-Fidelity Quantitative Deterministic Engine if API quotas are exceeded or permissions are denied.
- **Agents Included**: Macro & Regime Analyst, Technical Strategist, Red Team Contrarian, Risk Governance Officer, CIO Synthesizer.

### 2. Market Data Ingestion (`binance.ts` & `bybit.ts`)
Fetches high-frequency market data (Tickers, Order Books, Klines) using the REST APIs for Binance and Bybit. It integrates an automatic synthetic data fallback mechanism to ensure the engine remains testable even without an active internet connection or in rate-limited environments.

### 3. Execution & Risk Engine (`executionEngine.ts` & `riskEngine.ts`)
- **Execution**: Tracks open positions, active orders, and PnL. Handles simulated execution logic (Slippage, Fees, TP/SL triggers).
- **Risk**: Enforces strict capital preservation rules, including Maximum Daily Drawdown, Kelly-based position sizing constraints, Max Leverage caps, and Circuit Breakers.

### 4. Continuous Meta-Learning (`researchLab.ts`)
A dedicated laboratory for running asynchronous backtests and generating automated Post-Mortem analyses on closed trades. It identifies loss drivers, profitable patterns, and adjusts regime confidence scores over time.

### 5. Technical Indicators (`indicators.ts`)
Built-in math suite containing industry-standard quantitative calculations:
- EMA (Exponential Moving Average)
- RSI (Relative Strength Index)
- ATR (Average True Range)
- Bollinger Bands
- MACD (Moving Average Convergence Divergence)
- VWAP (Volume Weighted Average Price)
- OBV (On-Balance Volume)

## 🖥️ Frontend Dashboard (React + Vite)
A sophisticated React single-page application built with Tailwind CSS, providing institutional-grade telemetry:
- **Autonomous Terminal**: View active positions, daily realized PnL, open equity, and manual override controls.
- **Agent Debate Theater**: Real-time readout of the multi-agent consensus, indicating whether the engine used Neural (Gemini) or Quant Fallback logic.
- **Market Perception**: Visualizes order book imbalances, technical indicators, and current market regimes (e.g., `TRENDING_BULL_STRONG`, `RANGE_COMPRESSION_LOW_VOL`).
- **Research Lab**: Run backtest simulations and view continuous meta-learning post-mortems.
- **Kill Switch Modal**: A hard-stop mechanism to flatten all positions and halt the autonomous loop immediately.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Environment Configuration:
   Create a `.env` file in the root directory (refer to `.env.example`):
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   APP_URL="http://localhost:3000"
   ```

3. Start the application:
   ```bash
   # Development mode with Hot Reloading
   npm run dev

   # Production build
   npm run build
   npm run start
   ```

## 🛡️ Security & Liability Notice
This software is provided for educational and research purposes only. The quantitative strategies and neural assessments do not constitute financial advice. **Use Live Trading mode at your own risk.** Always ensure your exchange API keys are restricted strictly to trading (no withdrawal permissions).
