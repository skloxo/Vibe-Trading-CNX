"""
Portfolio Monitor Tool

Responsibilities:
- Monitor current holdings
- Track price changes and alerts
- Detect anomalies (large moves, volume spikes)

Uses: market_data layer for real-time data
"""

from __future__ import annotations
import json

from typing import Any, Dict, List, Optional
from datetime import datetime

from src.agent.tools import BaseTool
from ._stock_utils import fmt_stock, validate_code, normalize_code


class PortfolioMonitorTool(BaseTool):
    """Monitor portfolio holdings with anomaly detection."""

    name = "portfolio_monitor"
    description = (
        "Monitor current stock holdings with real-time price tracking. "
        "Detect anomalies: large price moves, volume spikes, support/resistance breaks. "
        "Returns portfolio status with alerts and recommendations."
    )
    parameters = {
        "type": "object",
        "properties": {
            "holdings": {
                "type": "array",
                "description": "List of stock codes to monitor",
                "items": {"type": "string"},
            },
            "alert_threshold": {
                "type": "number",
                "description": "Price change % threshold for alerts",
                "default": 3.0,
            },
        },
        "required": ["holdings"],
    }

    def _parse_holdings(self, holdings: Any) -> List[str]:
        """Parse holdings from various input formats.
        
        Supports:
        - List of strings: ['600519', '000001']
        - JSON string: '["600519", "000001"]'
        - Comma-separated string: '600519,000001'
        - Single string: '600519'
        """
        if isinstance(holdings, list):
            return [str(h).strip() for h in holdings if h]
        
        if isinstance(holdings, str):
            holdings = holdings.strip()
            # Try JSON parse
            if holdings.startswith('['):
                try:
                    parsed = json.loads(holdings)
                    if isinstance(parsed, list):
                        return [str(h).strip() for h in parsed if h]
                except json.JSONDecodeError:
                    pass
            # Comma-separated or single
            return [h.strip() for h in holdings.split(',') if h.strip()]
        
        return []

    def execute(self, **kwargs: Any) -> str:
        holdings_raw = kwargs.get("holdings", [])
        holdings = self._parse_holdings(holdings_raw)
        alert_threshold = kwargs.get("alert_threshold", 3.0)
        
        if not holdings:
            return json.dumps({"error": "No holdings provided to monitor", "holdings": []})
        
        try:
            # Monitor each holding
            portfolio_status = []
            alerts = []
            
            for code in holdings:
                if not validate_code(code):
                    continue
                
                code = normalize_code(code)
                status = self._check_stock_status(code, alert_threshold)
                portfolio_status.append(status)
                
                if status.get('alerts'):
                    alerts.extend(status['alerts'])
            
            # Calculate portfolio summary
            summary = self._calculate_portfolio_summary(portfolio_status)
            
            # Format output
            result = {
                "timestamp": datetime.now().isoformat(),
                "holdings_count": len(portfolio_status),
                "portfolio": portfolio_status,
                "alerts": alerts,
                "summary": summary,
            }
            
            return json.dumps(result, ensure_ascii=False, default=str)
            
        except Exception as e:
            return json.dumps({"error": f"Portfolio monitoring failed: {str(e)}", "portfolio": [], "alerts": []})
    
    def _check_stock_status(self, code: str, alert_threshold: float) -> Dict:
        """Check individual stock status."""
        from src.market_data import fetch_market_data_json
        from datetime import timedelta
        
        stock_name = self._get_stock_name(code)
        
        # Fetch recent data
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')
        
        data = fetch_market_data_json(
            codes=[code],
            start_date=start_date,
            end_date=end_date,
            source="mootdx",
            interval="1D",
            max_rows=5,
        )
        
        # Parse data
        status = {
            "stock": fmt_stock(code, stock_name),
            "code": code,
            "name": stock_name or "unknown",
            "last_price": None,
            "change_pct": None,
            "volume_ratio": None,
            "alerts": [],
        }
        
        # Parse response - handle both dict and JSON string
        if isinstance(data, str):
            import json as _json_tmp
            data = _json_tmp.loads(data)
        
        bars = []
        if isinstance(data, dict):
            # 直接格式: {"600519": [...]}
            if code in data and isinstance(data[code], list):
                bars = data[code]
            # 带bars格式: {"bars": {"600519": [...]}}
            elif 'bars' in data:
                bars = data['bars'].get(code, [])
        
        if bars and len(bars) >= 2:
                latest = bars[-1]
                prev = bars[-2]
                
                close = float(latest.get('close', 0))
                prev_close = float(prev.get('close', 0))
                volume = float(latest.get('volume', 0))
                prev_volume = float(prev.get('volume', 0))
                
                status['last_price'] = close
                status['change_pct'] = round((close / prev_close - 1) * 100, 2) if prev_close > 0 else 0
                status['volume_ratio'] = round(volume / prev_volume, 2) if prev_volume > 0 else 1.0
                
                # Check alerts
                if abs(status['change_pct']) >= alert_threshold:
                    direction = "↑" if status['change_pct'] > 0 else "↓"
                    status['alerts'].append({
                        "type": "price_move",
                        "stock": fmt_stock(code, stock_name),
                        "message": f"价格{direction}{abs(status['change_pct']):.1f}%",
                        "severity": "high" if abs(status['change_pct']) >= 5 else "medium",
                    })
                
                if status['volume_ratio'] >= 2.0:
                    status['alerts'].append({
                        "type": "volume_spike",
                        "stock": fmt_stock(code, stock_name),
                        "message": f"成交量放大{status['volume_ratio']:.1f}倍",
                        "severity": "medium",
                    })
        
        return status
    
    def _get_stock_name(self, code: str) -> Optional[str]:
        """Get stock name."""
        from ._stock_utils import get_stock_name
        return get_stock_name(code)
    
    def _calculate_portfolio_summary(self, portfolio_status: List[Dict]) -> Dict:
        """Calculate portfolio-level summary."""
        if not portfolio_status:
            return {"message": "无持仓数据"}
        
        # Count alerts
        total_alerts = sum(len(s.get('alerts', [])) for s in portfolio_status)
        
        # Average change
        changes = [s['change_pct'] for s in portfolio_status if s.get('change_pct') is not None]
        avg_change = round(sum(changes) / len(changes), 2) if changes else 0
        
        # Up/down counts
        up_count = sum(1 for c in changes if c > 0)
        down_count = sum(1 for c in changes if c < 0)
        
        return {
            "total_stocks": len(portfolio_status),
            "total_alerts": total_alerts,
            "avg_change_pct": avg_change,
            "up_count": up_count,
            "down_count": down_count,
            "status": "🟢 平稳" if total_alerts == 0 else f"⚠️ {total_alerts}个预警",
        }
