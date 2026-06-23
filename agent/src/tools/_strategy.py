"""
Strategy Filters

细粒度策略筛选模块，每个函数实现一个独立的策略。
所有函数输入DataFrame + 参数，输出bool。

使用: 被 market_scan_tool.py 调用
"""

import pandas as pd
import numpy as np
from typing import Dict, Any

from ._indicators import (
    calc_macd, calc_rsi, calc_bollinger,
    calc_volume_ratio, calc_ema, calc_sma
)


def filter_mid_trend(df: pd.DataFrame, params: Dict[str, Any] = None) -> bool:
    """
    中线趋势策略
    
    条件:
    - RSI 在 40-65 之间
    - MACD 金叉或即将金叉
    - 价格在布林带中轨以上
    - 成交量放大
    """
    if params is None:
        params = {}
    
    rsi_min = params.get('rsi_min', 40)
    rsi_max = params.get('rsi_max', 65)
    
    if len(df) < 30:
        return False
    
    # RSI
    rsi = calc_rsi(df['close'])
    rsi_val = rsi.iloc[-1]
    if not (rsi_min <= rsi_val <= rsi_max):
        return False
    
    # MACD
    macd = calc_macd(df['close'])
    dif = macd['dif'].iloc[-1]
    dea = macd['dea'].iloc[-1]
    # 金叉或即将金叉(DIF接近DEA)
    if dif < dea and abs(dif - dea) / abs(dea) > 0.01:
        return False
    
    # 布林带
    boll = calc_bollinger(df['close'])
    pos = boll['position'].iloc[-1]
    if pos < 40:  # 低于中轨
        return False
    
    # 成交量
    vol_ratio = calc_volume_ratio(df['volume'])
    if vol_ratio.iloc[-1] < 0.8:  # 缩量
        return False
    
    return True


def filter_leader_swing(df: pd.DataFrame, params: Dict[str, Any] = None) -> bool:
    """
    强势股波段策略
    
    条件:
    - RSI 在 50-75 之间（强势但不超买）
    - MACD 柱放大
    - 价格在布林带上半部分
    - 成交量明显放大
    """
    if params is None:
        params = {}
    
    rsi_min = params.get('rsi_min', 50)
    rsi_max = params.get('rsi_max', 75)
    
    if len(df) < 30:
        return False
    
    # RSI
    rsi = calc_rsi(df['close'])
    rsi_val = rsi.iloc[-1]
    if not (rsi_min <= rsi_val <= rsi_max):
        return False
    
    # MACD柱放大
    macd = calc_macd(df['close'])
    macd_val = macd['macd'].iloc[-1]
    macd_prev = macd['macd'].iloc[-2]
    if abs(macd_val) < abs(macd_prev):  # 柱子缩小
        return False
    
    # 布林带上半部
    boll = calc_bollinger(df['close'])
    pos = boll['position'].iloc[-1]
    if pos < 50:  # 低于中轨
        return False
    
    # 成交量放大
    vol_ratio = calc_volume_ratio(df['volume'])
    if vol_ratio.iloc[-1] < 1.2:  # 量比不足1.2
        return False
    
    return True


def filter_oversold_rebound(df: pd.DataFrame, params: Dict[str, Any] = None) -> bool:
    """
    超跌反弹策略
    
    条件:
    - RSI < 30 (超卖)
    - RSI 开始回升
    - 价格触及布林带下轨
    """
    if params is None:
        params = {}
    
    rsi_max = params.get('rsi_max', 30)
    
    if len(df) < 20:
        return False
    
    # RSI
    rsi = calc_rsi(df['close'])
    rsi_val = rsi.iloc[-1]
    rsi_prev = rsi.iloc[-2]
    
    # 超卖且开始回升
    if rsi_val >= rsi_max or rsi_val <= rsi_prev:
        return False
    
    # 布林带下轨
    boll = calc_bollinger(df['close'])
    pos = boll['position'].iloc[-1]
    if pos > 30:  # 不够低
        return False
    
    return True


def filter_volume_breakout(df: pd.DataFrame, params: Dict[str, Any] = None) -> bool:
    """
    放量突破策略
    
    条件:
    - 成交量 > 2倍平均
    - 价格突破近期高点
    - RSI 不超买
    """
    if params is None:
        params = {}
    
    vol_min = params.get('vol_min', 2.0)
    
    if len(df) < 20:
        return False
    
    # 成交量
    vol_ratio = calc_volume_ratio(df['volume'])
    if vol_ratio.iloc[-1] < vol_min:
        return False
    
    # 突破近期高点
    recent_high = df['high'].iloc[-21:-1].max()
    if df['close'].iloc[-1] <= recent_high:
        return False
    
    # RSI不超买
    rsi = calc_rsi(df['close'])
    if rsi.iloc[-1] > 80:
        return False
    
    return True
