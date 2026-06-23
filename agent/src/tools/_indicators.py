"""
Technical Indicators Calculator

细粒度技术指标计算模块，每个函数只计算一个指标。
所有函数都是纯函数，输入Series，输出Series。

使用: 被 _scorer.py 和各 Tool 调用
"""

from typing import Optional
import pandas as pd
import numpy as np


def calc_ema(series: pd.Series, period: int) -> pd.Series:
    """计算指数移动平均线"""
    return series.ewm(span=period, adjust=False).mean()


def calc_sma(series: pd.Series, period: int) -> pd.Series:
    """计算简单移动平均线"""
    return series.rolling(window=period).mean()


def calc_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    """
    计算MACD指标
    
    Returns:
        dict: {
            'dif': DIF线,
            'dea': DEA线, 
            'macd': MACD柱,
            'golden_cross': 金叉信号(bool),
            'death_cross': 死叉信号(bool)
        }
    """
    ema_fast = calc_ema(close, fast)
    ema_slow = calc_ema(close, slow)
    dif = ema_fast - ema_slow
    dea = calc_ema(dif, signal)
    macd = (dif - dea) * 2
    
    # 金叉/死叉判断
    golden_cross = (dif > dea) & (dif.shift(1) <= dea.shift(1))
    death_cross = (dif < dea) & (dif.shift(1) >= dea.shift(1))
    
    return {
        'dif': dif,
        'dea': dea,
        'macd': macd,
        'golden_cross': golden_cross,
        'death_cross': death_cross
    }


def calc_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """计算RSI指标"""
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calc_kdj(high: pd.Series, low: pd.Series, close: pd.Series, 
             n: int = 9, m1: int = 3, m2: int = 3) -> dict:
    """
    计算KDJ指标
    
    Returns:
        dict: {'k': K值, 'd': D值, 'j': J值}
    """
    lowest_low = low.rolling(window=n).min()
    highest_high = high.rolling(window=n).max()
    
    rsv = (close - lowest_low) / (highest_high - lowest_low) * 100
    
    k = rsv.ewm(com=m1-1, adjust=False).mean()
    d = k.ewm(com=m2-1, adjust=False).mean()
    j = 3 * k - 2 * d
    
    return {'k': k, 'd': d, 'j': j}


def calc_bollinger(close: pd.Series, period: int = 20, std_dev: float = 2.0) -> dict:
    """
    计算布林带
    
    Returns:
        dict: {
            'upper': 上轨,
            'middle': 中轨,
            'lower': 下轨,
            'bandwidth': 带宽百分比,
            'position': 价格在带中的位置(0-100)
        }
    """
    middle = calc_sma(close, period)
    std = close.rolling(window=period).std()
    upper = middle + std_dev * std
    lower = middle - std_dev * std
    
    # 带宽 = (上轨-下轨)/中轨 * 100
    bandwidth = (upper - lower) / middle * 100
    
    # 价格位置 = (价格-下轨)/(上轨-下轨) * 100
    position = (close - lower) / (upper - lower) * 100
    
    return {
        'upper': upper,
        'middle': middle,
        'lower': lower,
        'bandwidth': bandwidth,
        'position': position
    }


def calc_volume_ratio(volume: pd.Series, period: int = 5) -> pd.Series:
    """计算量比（今日成交量 / 过去N日平均成交量）"""
    avg_volume = volume.rolling(window=period).mean()
    return volume / avg_volume


def calc_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """计算平均真实波幅（ATR）"""
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    return atr


def calc_trend_strength(close: pd.Series, period: int = 20) -> pd.Series:
    """
    计算趋势强度指标
    
    使用线性回归斜率衡量趋势强度。
    返回值: -100 到 100，正值上升趋势，负值下降趋势
    """
    def slope(series):
        if len(series) < 2:
            return 0
        x = np.arange(len(series))
        try:
            slope = np.polyfit(x, series, 1)[0]
            return slope / series.mean() * 100  # 标准化
        except:
            return 0
    
    return close.rolling(window=period).apply(slope, raw=True)


def calc_support_resistance(high: pd.Series, low: pd.Series, close: pd.Series, 
                            lookback: int = 20) -> dict:
    """
    计算支撑位和阻力位
    
    Returns:
        dict: {
            'resistance': 最近的阻力位,
            'support': 最近的支撑位,
            'pivot': 枢轴点
        }
    """
    recent_high = high.tail(lookback).max()
    recent_low = low.tail(lookback).min()
    current_close = close.iloc[-1]
    
    # 简单枢轴点
    pivot = (recent_high + recent_low + current_close) / 3
    
    # 支撑位
    s1 = 2 * pivot - recent_high
    s2 = pivot - (recent_high - recent_low)
    
    # 阻力位
    r1 = 2 * pivot - recent_low
    r2 = pivot + (recent_high - recent_low)
    
    return {
        'resistance': r1,
        'support': s1,
        'pivot': pivot,
        'resistance2': r2,
        'support2': s2
    }
