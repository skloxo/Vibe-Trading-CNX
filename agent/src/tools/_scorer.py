"""
Stock Scorer

细粒度评分模块，每个函数负责一个维度的评分。
所有函数返回 0-100 的分数。

使用: 被 market_scan_tool.py 调用
"""

import pandas as pd
import numpy as np
from typing import Dict, Any

from ._indicators import (
    calc_macd, calc_rsi, calc_kdj, calc_bollinger,
    calc_volume_ratio, calc_trend_strength, calc_atr
)


def score_trend(df: pd.DataFrame) -> float:
    """
    趋势维度评分 (0-100)
    
    评分因素:
    - MACD金叉/死叉
    - DIF/DEA方向
    - 趋势强度
    """
    if len(df) < 30:
        return 50
    
    score = 50  # 基础分
    
    # MACD分析
    macd = calc_macd(df['close'])
    dif = macd['dif'].iloc[-1]
    dea = macd['dea'].iloc[-1]
    macd_val = macd['macd'].iloc[-1]
    
    # DIF > DEA (+15)
    if dif > dea:
        score += 15
    else:
        score -= 15
    
    # MACD柱放大 (+10)
    if abs(macd_val) > abs(macd['macd'].iloc[-2]):
        score += 10
    
    # 金叉信号 (+15)
    if macd['golden_cross'].iloc[-1]:
        score += 15
    
    # 趋势强度
    trend = calc_trend_strength(df['close'])
    trend_val = trend.iloc[-1]
    if trend_val > 5:
        score += 10
    elif trend_val < -5:
        score -= 10
    
    return max(0, min(100, score))


def score_momentum(df: pd.DataFrame) -> float:
    """
    动量维度评分 (0-100)
    
    评分因素:
    - RSI位置
    - KDJ状态
    """
    if len(df) < 20:
        return 50
    
    score = 50
    
    # RSI分析
    rsi = calc_rsi(df['close'])
    rsi_val = rsi.iloc[-1]
    
    # RSI 40-60 中性 (+0)
    # RSI 60-80 偏强 (+10)
    # RSI 80+ 超买 (-10)
    # RSI 20-40 偏弱 (-10)
    # RSI <20 超卖 (+10 反转信号)
    if 60 <= rsi_val < 80:
        score += 10
    elif rsi_val >= 80:
        score -= 10
    elif 20 < rsi_val <= 40:
        score -= 10
    elif rsi_val <= 20:
        score += 10  # 超卖反弹
    
    # KDJ分析
    kdj = calc_kdj(df['high'], df['low'], df['close'])
    k_val = kdj['k'].iloc[-1]
    d_val = kdj['d'].iloc[-1]
    j_val = kdj['j'].iloc[-1]
    
    # KDJ金叉 (+10)
    if k_val > d_val and kdj['k'].iloc[-2] <= kdj['d'].iloc[-2]:
        score += 10
    
    # J值超卖反弹 (+10)
    if j_val < 20 and j_val > kdj['j'].iloc[-2]:
        score += 10
    
    return max(0, min(100, score))


def score_volume(df: pd.DataFrame) -> float:
    """
    量能维度评分 (0-100)
    
    评分因素:
    - 量比
    - 量价关系
    """
    if len(df) < 10:
        return 50
    
    score = 50
    
    # 量比分析
    vol_ratio = calc_volume_ratio(df['volume'])
    vr = vol_ratio.iloc[-1]
    
    # 放量 (>1.5) +10
    if vr > 1.5:
        score += 10
    # 缩量 (<0.5) -10
    elif vr < 0.5:
        score -= 10
    
    # 量价配合
    price_change = (df['close'].iloc[-1] / df['close'].iloc[-2] - 1) * 100
    
    # 价涨量增 (+10)
    if price_change > 1 and vr > 1.2:
        score += 10
    # 价跌量缩 (+5 非恐慌)
    elif price_change < -1 and vr < 0.8:
        score += 5
    # 价涨量缩 (-10 量价背离)
    elif price_change > 1 and vr < 0.7:
        score -= 10
    
    return max(0, min(100, score))


def score_position(df: pd.DataFrame) -> float:
    """
    位置维度评分 (0-100)
    
    评分因素:
    - 布林带位置
    - 相对高低位
    """
    if len(df) < 20:
        return 50
    
    score = 50
    
    # 布林带位置
    boll = calc_bollinger(df['close'])
    pos = boll['position'].iloc[-1]
    
    # 中轨附近 (40-60) 中性
    # 上轨附近 (80-100) 偏高风险
    # 下轨附近 (0-20) 偏低机会
    if 40 <= pos <= 60:
        score += 5
    elif pos > 80:
        score -= 10
    elif pos < 20:
        score += 10
    
    return max(0, min(100, score))


def score_stock(df: pd.DataFrame) -> Dict[str, Any]:
    """
    综合评分
    
    Returns:
        dict: {
            'total': 综合分,
            'trend': 趋势分,
            'momentum': 动量分,
            'volume': 量能分,
            'position': 位置分,
            'signal': 操作信号
        }
    """
    trend = score_trend(df)
    momentum = score_momentum(df)
    volume = score_volume(df)
    position = score_position(df)
    
    # 综合分 = 加权平均
    total = trend * 0.4 + momentum * 0.3 + volume * 0.2 + position * 0.1
    
    # 信号判断
    if total >= 80:
        signal = "强烈看多"
    elif total >= 70:
        signal = "看多"
    elif total >= 60:
        signal = "偏多"
    elif total >= 40:
        signal = "中性"
    elif total >= 30:
        signal = "偏空"
    else:
        signal = "看空"
    
    return {
        'total': round(total, 2),
        'trend': round(trend, 2),
        'momentum': round(momentum, 2),
        'volume': round(volume, 2),
        'position': round(position, 2),
        'signal': signal
    }
