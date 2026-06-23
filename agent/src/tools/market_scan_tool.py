"""
Market Scan Tool v2.1 - 全市场扫描+评分+筛选

核心优化：
- quotes() 批量预筛（快，无需历史数据）
- bars() 串行分析（mootdx不支持并发）
- 按成交量排序，只分析 top-N

使用: 被 Agent 调用，配合 stock_risk/tech_analysis 进行深研
"""

from typing import Optional, List, Dict, Any
import pandas as pd
import json
import logging
import time

logger = logging.getLogger(__name__)

_scorer = None
_strategy = None

def _lazy_import():
    global _scorer, _strategy
    if _scorer is None:
        from src.tools._scorer import score_stock
        _scorer = score_stock
    if _strategy is None:
        from src.tools._strategy import (
            filter_mid_trend, filter_leader_swing,
            filter_oversold_rebound, filter_volume_breakout
        )
        _strategy = {
            'mid_trend': filter_mid_trend,
            'leader_swing': filter_leader_swing,
            'oversold_rebound': filter_oversold_rebound,
            'volume_breakout': filter_volume_breakout
        }


class MarketScanTool:
    """全市场扫描工具"""

    def __init__(self):
        self.name = "market_scan"
        self.description = "扫描A股全市场，计算技术评分，按策略筛选候选股"
        self.version = "2.1.0"
        self._client = None
        self._stock_list_cache = None

    @property
    def client(self):
        if self._client is None:
            from mootdx.quotes import Quotes
            self._client = Quotes.factory(market='std')
        return self._client

    def execute(self, scan_type: str = "oversold", threshold: float = 30,
                limit: int = 20, **kwargs) -> str:
        try:
            result = self._run(scan_type=scan_type, threshold=threshold, limit=limit, **kwargs)
            return json.dumps(result, ensure_ascii=False, default=str)
        except Exception as e:
            logger.error(f"市场扫描失败: {e}", exc_info=True)
            return json.dumps({"error": str(e), "data": [], "count": 0}, ensure_ascii=False)

    def _get_stock_list(self) -> List[Dict]:
        """获取A股列表（mootdx stocks，带缓存）"""
        if self._stock_list_cache is not None:
            return self._stock_list_cache

        t0 = time.time()
        try:
            sh = self.client.stocks(market=1)
            sz = self.client.stocks(market=0)

            result = []
            for df, suffix in [(sh, '.SH'), (sz, '.SZ')]:
                if df is not None and not df.empty:
                    for _, row in df.iterrows():
                        code = str(row['code']).zfill(6)
                        if (suffix == '.SH' and code.startswith(('60', '68'))) or \
                           (suffix == '.SZ' and code.startswith(('00', '30'))):
                            result.append({
                                'code': code,
                                'name': str(row.get('name', '')),
                            })

            self._stock_list_cache = result
            logger.info(f"股票列表: {len(result)}只, {time.time()-t0:.1f}s")
            return result
        except Exception as e:
            logger.error(f"获取股票列表失败: {e}")
            return []

    def _batch_quotes(self, codes: List[str], limit: int = 2000) -> List[Dict]:
        """
        批量获取实时行情，按成交量降序返回 top-limit 只。

        返回: [{'code': '000001', 'name': '', 'price': 10.5, 'change_pct': 1.2, 'vol': 123456}, ...]
        """
        batch_size = 80
        all_quotes = []

        for i in range(0, len(codes), batch_size):
            batch = codes[i:i+batch_size]
            try:
                df = self.client.quotes(symbol=batch)
                if df is not None and not df.empty:
                    for _, row in df.iterrows():
                        code = str(row.get('code', ''))
                        price = row.get('price', 0)
                        last_close = row.get('last_close', 0)
                        vol = row.get('vol', 0)

                        if not code or not price or not vol or vol <= 0:
                            continue

                        change_pct = 0.0
                        if last_close and last_close > 0:
                            change_pct = (price - last_close) / last_close * 100

                        all_quotes.append({
                            'code': code,
                            'price': float(price),
                            'change_pct': round(change_pct, 2),
                            'vol': int(vol),
                            'last_close': float(last_close) if last_close else 0,
                        })
            except Exception as e:
                logger.debug(f"quotes批次{i//batch_size}失败: {e}")
                continue

        # 按成交量降序，取 top-limit
        all_quotes.sort(key=lambda x: x['vol'], reverse=True)
        return all_quotes[:limit]

    def _analyze_serial(self, candidates: List[Dict], strategy_filter) -> List[Dict]:
        """串行分析（mootdx bars 不支持并发）"""
        from src.tools._scorer import score_stock
        results = []
        for item in candidates:
            code = item['code']
            try:
                bars = self.client.bars(symbol=code, frequency=9, offset=60)
                if bars is None or len(bars) < 30:
                    continue

                if not strategy_filter(bars):
                    continue

                scores = score_stock(bars)
                if scores['total'] < 50:
                    continue

                results.append({
                    'code': code,
                    'name': item.get('name', ''),
                    'display': f"{item.get('name', '')}({code})",
                    'price': item['price'],
                    'change_pct': item['change_pct'],
                    'total_score': scores['total'],
                    'trend_score': scores['trend'],
                    'momentum_score': scores['momentum'],
                    'volume_score': scores['volume'],
                    'position_score': scores['position'],
                    'signal': scores['signal']
                })
            except Exception as e:
                logger.debug(f"分析{code}失败: {e}")
                continue

        return results

    def _run(self, scan_type: str = "oversold", threshold: float = 30,
             limit: int = 20, **kwargs) -> Dict[str, Any]:
        """执行市场扫描"""
        _lazy_import()

        t_start = time.time()
        logger.info(f"开始扫描: type={scan_type}, threshold={threshold}, limit={limit}")

        # 1. 获取股票列表
        stock_list = self._get_stock_list()
        if not stock_list:
            return {"error": "获取股票代码失败", "data": [], "count": 0}

        code_name = {s['code']: s['name'] for s in stock_list}
        logger.info(f"股票列表: {len(stock_list)}只 ({time.time()-t_start:.1f}s)")

        # 2. 批量 quotes 预筛 top-volume（2000只）
        all_codes = [s['code'] for s in stock_list]
        candidates = self._batch_quotes(all_codes, limit=2000)
        logger.info(f"预筛: {len(candidates)}只活跃 ({time.time()-t_start:.1f}s)")

        # 3. 回填名称
        for c in candidates:
            c['name'] = code_name.get(c['code'], '')

        # 4. 选择策略
        strategy_map = {
            'oversold': _strategy.get('oversold_rebound'),
            'overbought': _strategy.get('mid_trend'),
            'golden_cross': _strategy.get('mid_trend'),
            'volume_breakout': _strategy.get('volume_breakout'),
        }
        strategy_filter = strategy_map.get(scan_type, _strategy.get('mid_trend'))

        # 5. 串行分析 top-200（bars 不支持并发）
        analyzed = self._analyze_serial(candidates[:200], strategy_filter)
        logger.info(f"分析完成: {len(analyzed)}只通过 ({time.time()-t_start:.1f}s)")

        # 6. 阈值过滤
        results = []
        for r in analyzed:
            if scan_type == 'oversold':
                if r.get('position_score', 100) <= threshold:
                    results.append(r)
            elif scan_type == 'golden_cross':
                if r.get('trend_score', 0) >= threshold:
                    results.append(r)
            else:
                results.append(r)

        # 7. 排序 + 截断
        results.sort(key=lambda x: x['total_score'], reverse=True)
        results = results[:limit]

        elapsed = time.time() - t_start
        logger.info(f"扫描完成: {len(results)}只通过, 耗时{elapsed:.1f}s")

        # 空结果友好提示
        hint = None
        if len(results) == 0:
            hint = (
                f"本次扫描 {len(candidates)} 只A股、精筛 {len(analyzed)} 只，"
                f"未找到符合条件的股票。"
                f"建议：(1) 降低 threshold（当前={threshold}）；"
                f"(2) 换用其他 scan_type（如 bottom_fishing/top_momentum）；"
                f"(3) 今日市场可能普涨/普跌，不适合该策略。"
            )

        return {
            "success": True,
            "scan_type": scan_type,
            "scanned": len(candidates),
            "analyzed": len(analyzed),
            "qualified": len(results),
            "elapsed_sec": round(elapsed, 1),
            "data": results,
            "count": len(results),
            "hint": hint
        }
