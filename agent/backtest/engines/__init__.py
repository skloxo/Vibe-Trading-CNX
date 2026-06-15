"""Backtest engines.

Engines (v1):
  - BaseEngine: ABC for bar-by-bar execution with market rules
  - ChinaAEngine: A-share (T+1, no short, price limits)

Futures:
  - FuturesBaseEngine: intermediate layer adding contract-multiplier logic
  - ChinaFuturesEngine: China commodity/financial futures (CFFEX/SHFE/DCE/ZCE/INE)

Inheritance:
  BaseEngine
  ├── ChinaAEngine
  └── FuturesBaseEngine
      └── ChinaFuturesEngine
"""
