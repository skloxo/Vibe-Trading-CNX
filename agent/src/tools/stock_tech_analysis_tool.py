"""
Stock Technical Analysis Tool

Responsibilities:
- Deep technical analysis for a single stock
- Calculate comprehensive indicators (EMA, MACD, RSI, Bollinger Bands, etc.)
- Identify support/resistance levels
- Generate technical score and trading signals

Uses: market_data layer + mootdx TCP direct
"""

from __future__ import annotations
import json

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from src.agent.tools import BaseTool
from ._stock_utils import fmt_stock, validate_code, normalize_code


class StockTechAnalysisTool(BaseTool):
    """Deep technical analysis for a single A-share stock."""

    name = "stock_tech_analysis"
    description = (
        "Perform deep technical analysis on a single A-share stock. "
        "Calculates EMA, MACD, RSI, Bollinger Bands, volume analysis. "
        "Identifies support/resistance levels and generates trading signals. "
        "Returns comprehensive technical score and actionable insights."
    )
    parameters = {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "Stock code (e.g., '000001', '600519')",
            },
            "period": {
                "type": "string",
                "description": "Analysis period: 'short' (5d), 'medium' (20d), 'long' (60d)",
                "default": "medium",
            },
        },
        "required": ["code"],
    }

    def execute(self, **kwargs: Any) -> str:
        code = kwargs.get("code", "")
        period = kwargs.get("period", "medium")
        
        if not validate_code(code):
            return json.dumps({"error": f"Invalid stock code: {code}", "code": code})
        
        code = normalize_code(code)
        
        try:
            # Fetch historical data
            hist_data = self._fetch_history(code, period)
            
            if hist_data is None or len(hist_data) < 20:
                return json.dumps({"error": f"Insufficient data for {code}", "code": code})
            
            # Calculate technical indicators
            indicators = self._calculate_indicators(hist_data)
            
            # Identify support/resistance
            levels = self._find_support_resistance(hist_data)
            
            # Generate signals
            signals = self._generate_signals(indicators, levels)
            
            # Calculate overall score
            score = self._calculate_score(indicators, signals)
            
            # Get stock name
            stock_name = self._get_stock_name(code)
            
            # Format output
            result = {
                "timestamp": datetime.now().isoformat(),
                "stock": fmt_stock(code, stock_name),
                "code": code,
                "name": stock_name or "unknown",
                "period": period,
                "score": score,
                "indicators": indicators,
                "levels": levels,
                "signals": signals,
                "summary": self._generate_summary(score, signals, indicators),
            }
            
            return json.dumps(result, ensure_ascii=False, default=str)
            
        except Exception as e:
            return json.dumps({"error": f"Technical analysis failed for {code}: {str(e)}", "code": code})
    
    def _fetch_history(self, code: str, period: str) -> Optional[Any]:
        """Fetch historical data from market_data layer."""
        from src.market_data import fetch_market_data_json
        
        # Determine days based on period
        days_map = {"short": 30, "medium": 90, "long": 180}
        days = days_map.get(period, 90)
        
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        data = fetch_market_data_json(
            codes=[code],
            start_date=start_date,
            end_date=end_date,
            source="mootdx",
            interval="1D",
            max_rows=days,
        )
        
        # Parse response - handle both dict and JSON string
        if isinstance(data, str):
            import json as _json_tmp
            data = _json_tmp.loads(data)
        
        if isinstance(data, dict):
            import pandas as pd
            # 直接格式: {"600519": [...]}
            if code in data and isinstance(data[code], list) and data[code]:
                return pd.DataFrame(data[code])
            # 带bars格式: {"bars": {"600519": [...]}}
            if 'bars' in data:
                bars = data['bars']
                if code in bars and bars[code]:
                    return pd.DataFrame(bars[code])
        
        return None
    
    def _calculate_indicators(self, df: Any) -> Dict:
        """Calculate technical indicators with NaN safety."""
        import pandas as pd
        import numpy as np
        
        indicators = {}
        
        try:
            close = df['close'].astype(float)
            # 清理NaN/inf
            close = close.replace([np.inf, -np.inf], np.nan).ffill().bfill()
            
            # EMA
            indicators['ema5'] = float(close.ewm(span=5).mean().iloc[-1])
            indicators['ema10'] = float(close.ewm(span=10).mean().iloc[-1])
            indicators['ema20'] = float(close.ewm(span=20).mean().iloc[-1])
            indicators['ema60'] = float(close.ewm(span=60).mean().iloc[-1]) if len(close) >= 60 else None
            
            # MACD
            ema12 = close.ewm(span=12).mean()
            ema26 = close.ewm(span=26).mean()
            dif = ema12 - ema26
            dea = dif.ewm(span=9).mean()
            macd = (dif - dea) * 2
            
            indicators['macd_dif'] = float(dif.iloc[-1])
            indicators['macd_dea'] = float(dea.iloc[-1])
            indicators['macd_hist'] = float(macd.iloc[-1])
            
            # RSI
            delta = close.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            indicators['rsi'] = float(rsi.iloc[-1])
            
            # Bollinger Bands
            sma20 = close.rolling(window=20).mean()
            std20 = close.rolling(window=20).std()
            indicators['boll_upper'] = float((sma20 + 2 * std20).iloc[-1])
            indicators['boll_mid'] = float(sma20.iloc[-1])
            indicators['boll_lower'] = float((sma20 - 2 * std20).iloc[-1])
            
            # Volume analysis
            volume = df['volume'].astype(float)
            vol_ma5 = volume.rolling(window=5).mean()
            indicators['vol_ratio'] = float(volume.iloc[-1] / vol_ma5.iloc[-1]) if vol_ma5.iloc[-1] > 0 else 1.0
            
            # Current price
            indicators['close'] = float(close.iloc[-1])
            indicators['change_pct'] = float((close.iloc[-1] / close.iloc[-2] - 1) * 100) if len(close) >= 2 else 0.0
            
        except Exception as e:
            indicators['error'] = str(e)
        
        return indicators
    
    def _find_support_resistance(self, df: Any) -> Dict:
        """Find support and resistance levels with NaN safety."""
        import numpy as np
        
        close = df['close'].astype(float).replace([np.inf, -np.inf], np.nan).dropna().values
        
        levels = {
            'support': [],
            'resistance': [],
        }
        
        # Simple pivot point method
        if len(close) >= 5:
            recent_high = float(np.max(close[-20:]))
            recent_low = float(np.min(close[-20:]))
            current = float(close[-1])
            
            # Fibonacci levels
            diff = recent_high - recent_low
            levels['resistance'] = [
                round(recent_high, 2),
                round(recent_low + diff * 0.618, 2),
            ]
            levels['support'] = [
                round(recent_low + diff * 0.382, 2),
                round(recent_low, 2),
            ]
        
        return levels
    
    def _generate_signals(self, indicators: Dict, levels: Dict) -> List[str]:
        """Generate trading signals from indicators with type safety."""
        signals = []
        
        def safe_float(val, default=0.0):
            try:
                if val is None or (isinstance(val, float) and (val != val)):  # NaN check
                    return default
                return float(val)
            except (TypeError, ValueError):
                return default
        
        close = safe_float(indicators.get('close', 0))
        rsi = safe_float(indicators.get('rsi', 50), 50)
        macd_hist = safe_float(indicators.get('macd_hist', 0))
        ema5 = safe_float(indicators.get('ema5', 0))
        ema20 = safe_float(indicators.get('ema20', 0))
        
        # RSI signals
        if rsi < 30:
            signals.append("RSI超卖(<30)，可能反弹")
        elif rsi > 70:
            signals.append("RSI超买(>70)，注意回调风险")
        
        # MACD signals
        if macd_hist > 0:
            signals.append("MACD红柱，多头趋势")
        else:
            signals.append("MACD绿柱，空头趋势")
        
        # EMA crossover
        if ema5 > ema20:
            signals.append("EMA5>EMA20，短期强势")
        else:
            signals.append("EMA5<EMA20，短期弱势")
        
        # Bollinger Band signals
        boll_upper = indicators.get('boll_upper', 0)
        boll_lower = indicators.get('boll_lower', 0)
        if close > boll_upper:
            signals.append("突破布林上轨，可能超买")
        elif close < boll_lower:
            signals.append("跌破布林下轨，可能超卖")
        
        return signals
    
    def _calculate_score(self, indicators: Dict, signals: List[str]) -> int:
        """Calculate technical score (0-100) with type safety."""
        score = 50  # Base score
        
        def safe_float(val, default=0.0):
            try:
                if val is None or (isinstance(val, float) and (val != val)):
                    return default
                return float(val)
            except (TypeError, ValueError):
                return default
        
        rsi = safe_float(indicators.get('rsi', 50), 50)
        macd_hist = safe_float(indicators.get('macd_hist', 0))
        ema5 = safe_float(indicators.get('ema5', 0))
        ema20 = safe_float(indicators.get('ema20', 0))
        vol_ratio = indicators.get('vol_ratio', 1.0)
        
        # RSI score
        if 40 <= rsi <= 60:
            score += 10
        elif rsi < 30:
            score += 5  # Oversold bounce potential
        
        # MACD score
        if macd_hist > 0:
            score += 10
        
        # EMA alignment
        if ema5 > ema20:
            score += 10
        
        # Volume confirmation
        if 1.0 < vol_ratio < 2.0:
            score += 5
        
        # Cap at 0-100
        return max(0, min(100, score))
    
    def _get_stock_name(self, code: str) -> Optional[str]:
        """Get stock name."""
        from ._stock_utils import get_stock_name
        return get_stock_name(code)
    
    def _generate_summary(self, score: int, signals: List[str], indicators: Dict) -> str:
        """Generate human-readable summary."""
        # Score level
        if score >= 80:
            level = "🟢 强势"
        elif score >= 60:
            level = "🟡 偏强"
        elif score >= 40:
            level = "⚪ 中性"
        elif score >= 20:
            level = "🟠 偏弱"
        else:
            level = "🔴 弱势"
        
        # Key metrics
        rsi = indicators.get('rsi', 0)
        macd = indicators.get('macd_hist', 0)
        
        summary = f"{level} | 评分{score} | RSI={rsi:.1f} | MACD={'红' if macd > 0 else '绿'}"
        
        if signals:
            summary += f" | {signals[0]}"
        
        return summary
