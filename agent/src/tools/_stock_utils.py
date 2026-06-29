"""共用工具函数 — 名称获取/格式化/代码校验/市场判断

最细粒度模块，所有Tool复用。
名称查询通过 ~/.vibe-trading-cnx/cache/stock_names.json 磁盘缓存（7天有效期），
首次需手动运行 scripts/build_stock_name_cache.py 建缓存。
"""
from __future__ import annotations
import os
import re
import json
from typing import Optional


# ============================================================
# 内部缓存（模块级单例）
# ============================================================
_name_map: Optional[dict[str, str]] = None  # code -> name
_CACHE_PATH = os.path.expanduser('~/.vibe-trading-cnx/cache/stock_names.json')


def _ensure_name_map() -> dict[str, str]:
    """从磁盘缓存加载全量 A 股代码→名称映射"""
    global _name_map
    if _name_map is not None:
        return _name_map

    if os.path.exists(_CACHE_PATH):
        try:
            with open(_CACHE_PATH, 'r') as f:
                _name_map = json.load(f)
            return _name_map
        except Exception:
            pass

    _name_map = {}
    return _name_map


def _strip_code(code: str) -> str:
    """去掉 SH/SZ/BJ/.SH/.SZ/.BJ 前缀/后缀，返回纯6位数字"""
    c = str(code).strip().upper()
    c = re.sub(r'\.(SH|SZ|BJ)$', '', c)  # 后缀: 600519.SH
    c = re.sub(r'^(SH|SZ|BJ)', '', c)     # 前缀: SH600519
    return c


# ============================================================
# 代码校验
# ============================================================

def validate_code(code: str) -> bool:
    """校验是否是合法 A 股代码（支持 600519 / 600519.SH / SH600519）"""
    if not code or not isinstance(code, str):
        return False
    c = _strip_code(code)
    return bool(re.match(r'^[0369]\d{5}$', c))


def get_market_from_code(code: str) -> str:
    """从代码推断市场 (0=深圳 1=上海 2=未知)"""
    c = _strip_code(code)
    if len(c) == 6 and c.isdigit():
        first = c[0]
        if first == '6':
            return '1'  # 上海
        elif first in ('0', '3'):
            return '0'  # 深圳
    return '2'


def normalize_code(code: str) -> str:
    """规范化代码，去掉前后缀，返回纯6位数字"""
    return _strip_code(code)


# ============================================================
# 名称查询
# ============================================================

def get_stock_name(code: str) -> str:
    """查股票名称（从磁盘缓存查询）"""
    if not code:
        return ''
    c = _strip_code(code)
    name_map = _ensure_name_map()
    return name_map.get(c, '')


def get_stock_names_batch(codes: list[str]) -> dict[str, str]:
    """批量查名称"""
    name_map = _ensure_name_map()
    result = {}
    for c in codes:
        nc = _strip_code(c)
        result[c] = name_map.get(nc, '')
    return result


# ============================================================
# 格式化（强制 名称(代码) 格式）
# ============================================================

def fmt_stock(code: str, name: str = None) -> str:
    """格式化股票显示：名称(代码)

    自动查名：
        fmt_stock("688525") → "佰维存储(688525)"
    手动传名：
        fmt_stock("688525", "佰维存储") → "佰维存储(688525)"
    """
    c = _strip_code(code)
    if not c:
        return str(code)
    n = name or get_stock_name(c)
    if n:
        return f"{n}({c})"
    return c


def fmt_stock_list(codes: list[str]) -> str:
    """格式化一组代码为 名称(代码) 列表"""
    return ', '.join(fmt_stock(c) for c in codes)
