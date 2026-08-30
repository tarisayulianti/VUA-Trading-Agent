# Agent Instructions for VUA Autonomous Trading Engine

You are interacting with the VUA Autonomous Crypto Trading System, an institutional-grade algorithmic trading platform written in TypeScript (React Frontend + Node/Express Backend).

## CRITICAL DIRECTIVES
1. **Always consult `SYSTEM_ARCHITECTURE.md`:** Before making any structural, architectural, or significant logic changes, you MUST read `/SYSTEM_ARCHITECTURE.md`. It explains the exact flow between the Data Ingestion, Multi-Agent Brain, Execution Engine, and Research Lab.
2. **Preserve System Boundaries:** The system explicitly uses a "Neural Mode" (Gemini LLM) and a "Quantitative Fallback" engine. Do not merge or conflate these logic paths. 
3. **No Hallucinations:** When generating data, displaying telemetry, or editing indicator logic, you must rely exclusively on mathematically sound financial formulas. Do not invent fake "AI confidence" metrics without rooting them in actual statistical calculations (like Z-scores or probability density functions).
4. **Risk First:** Any code changes related to `executionEngine.ts` or `riskEngine.ts` must prioritize capital preservation. Ensure that Stop Losses (SL) and Circuit Breakers are never bypassed.

By reading this file, you are bound to these institutional standards. Maintain the objective, clinical, and precise tone of a quantitative engineer.
