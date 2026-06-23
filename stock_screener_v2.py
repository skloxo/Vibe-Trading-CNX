#!/usr/bin/env python3
"""
全市场A股选股扫描器 V2（优化版）
使用mootdx的stocks()获取有效股票列表，避免扫描无效代码
"""
import sys, os, time, json, warnings
warnings.filterwarnings('ignore')
import pandas as pd
import numpy as np
from datetime import datetime
from mootdx.quotes import Quotes

OUTPUT_DIR = '/home/skloxo/aho/vibe-trading'
RESULT_FILE = os.path.join(OUTPUT_DIR, 'screener_results.csv')
REPORT_FILE = os.path.join(OUTPUT_DIR, 'screener_report.json')

# 持仓票（排除用）
HELD_CODES = ['601595', '002045', '300395', '000066', '601137']

# ============================================================
# Phase 1: 获取有效A股代码
# ============================================================
def get_valid_a_share_codes(client):
    """从mootdx stocks()获取有效A股代码"""
    print("Phase 1: 获取A股代码列表...")
    
    stock_list = client.stocks()
    print(f"  stocks()返回 {len(stock_list)} 条记录")
    
    # 过滤6位数字代码
    stocks = stock_list[stock_list['code'].str.match(r'^\d{6}$')].copy()
    
    # 按前缀分类
    # 沪市(market=1): 600/601/603/605/688/689
    # 深市(market=0): 000/001/002/003/300/301
    codes = []
    for _, row in stocks.iterrows():
        code = row['code']
        name = row['name']
        
        # 排除指数
        if name in ['上证指数', '深证成指', '创业板指', '科创50', '沪深300', '中证500', '中证1000']:
            continue
        if '指数' in name or 'Ａ股' in name or 'Ｂ股' in name:
            continue
        
        # 判断市场
        if code.startswith(('600', '601', '603', '605', '688', '689')):
            market = 1  # 沪市
        elif code.startswith(('000', '001', '002', '003', '300', '301')):
            market = 0  # 深市
        else:
            continue
        
        # 排除ST/退市
        if 'ST' in name or '退市' in name:
            continue
        
        codes.append((market, code, name))
    
    print(f"  有效A股代码: {len(codes)} 只")
    return codes

# ============================================================
# Phase 2: 批量获取行情数据
# ============================================================
def fetch_stock_data(client, codes, batch_size=80):
    """批量获取股票20日数据"""
    print(f"\nPhase 2: 批量获取 {len(codes)} 只股票数据...")
    
    results = []
    valid_count = 0
    total = len(codes)
    
    for i, (market, code, name) in enumerate(codes):
        if (i + 1) % 100 == 0:
            print(f"  进度: {i+1}/{total}, 已获取 {valid_count} 只有效数据")
        
        try:
            df = client.bars(market=market, symbol=code, offset=25)
            if df is not None and len(df) >= 20:
                last_close = df.iloc[-1]['close']
                if last_close > 0 and not np.isnan(last_close):
                    results.append({
                        'code': code,
                        'market': market,
                        'name': name,
                        'data': df
                    })
                    valid_count += 1
        except:
            pass
        
        # 限流
        if (i + 1) % 50 == 0:
            time.sleep(0.3)
    
    print(f"  共获取 {valid_count} 只有效股票数据")
    return results

# ============================================================
# Phase 3: 计算技术指标
# ============================================================
def compute_indicators(stock_data):
    """计算每只股票的技术指标"""
    print(f"\nPhase 3: 计算技术指标...")
    
    results = []
    
    for item in stock_data:
        try:
            df = item['data']
            code = item['code']
            market = item['market']
            name = item['name']
            
            close = df['close'].values
            high = df['high'].values
            low = df['low'].values
            vol = df['vol'].values if 'vol' in df.columns else df['volume'].values
            amount = df['amount'].values if 'amount' in df.columns else np.zeros(len(df))
            
            if len(close) < 20:
                continue
            
            current = close[-1]
            prev_close = close[-2]
            
            # 涨跌幅
            change_pct = (current / prev_close - 1) * 100
            change_5d = (current / close[-6] - 1) * 100 if len(close) > 5 else 0
            change_20d = (current / close[0] - 1) * 100
            
            # 均线
            ma5 = np.mean(close[-5:])
            ma10 = np.mean(close[-10:])
            ma20 = np.mean(close[-20:])
            
            # 趋势
            above_ma20 = current > ma20
            ma5_above_ma20 = ma5 > ma20
            trend_up = above_ma20 and ma5_above_ma20
            
            # RSI(14)
            deltas = np.diff(close[-15:])
            gains = np.where(deltas > 0, deltas, 0)
            losses = np.where(deltas < 0, -deltas, 0)
            avg_gain = np.mean(gains)
            avg_loss = np.mean(losses)
            rsi = 100 - (100 / (1 + avg_gain / avg_loss)) if avg_loss > 0 else 100
            
            # 量比
            vol_5d_avg = np.mean(vol[-6:-1]) if len(vol) > 5 else np.mean(vol)
            volume_ratio = vol[-1] / vol_5d_avg if vol_5d_avg > 0 else 1.0
            
            # 成交额（亿元）
            amount_5d_avg = np.mean(amount[-5:]) / 1e8
            
            # 价格位置（20日百分位）
            high_20d = np.max(high[-20:])
            low_20d = np.min(low[-20:])
            price_position = (current - low_20d) / (high_20d - low_20d) * 100 if high_20d != low_20d else 50
            
            # 过滤
            is_kcb = code.startswith('688') or code.startswith('689')
            is_cyb = code.startswith('300') or code.startswith('301')
            limit_pct = 20 if (is_kcb or is_cyb) else 10
            
            # 排除涨跌停
            if change_pct >= limit_pct * 0.95 or change_pct <= -limit_pct * 0.95:
                continue
            
            # 排除停牌
            if vol[-1] == 0:
                continue
            
            # 排除价格异常
            if current < 2 or current > 3000:
                continue
            
            # 排除成交额过小
            if amount_5d_avg < 0.3:
                continue
            
            results.append({
                'code': f"{code}.{'SH' if market == 1 else 'SZ'}",
                'raw_code': code,
                'name': name,
                'market': market,
                'close': round(current, 2),
                'change_pct': round(change_pct, 2),
                'change_5d': round(change_5d, 2),
                'change_20d': round(change_20d, 2),
                'ma5': round(ma5, 2),
                'ma10': round(ma10, 2),
                'ma20': round(ma20, 2),
                'above_ma20': above_ma20,
                'trend_up': trend_up,
                'rsi': round(rsi, 1),
                'volume_ratio': round(volume_ratio, 2),
                'amount_5d_avg': round(amount_5d_avg, 2),
                'price_position': round(price_position, 1),
                'high_20d': round(high_20d, 2),
                'low_20d': round(low_20d, 2),
                'is_kcb': is_kcb,
                'is_cyb': is_cyb,
            })
        except:
            pass
    
    print(f"  有效指标: {len(results)} 只股票")
    return pd.DataFrame(results)

# ============================================================
# Phase 4: 评分筛选
# ============================================================
def score_and_filter(df):
    """按框架评分筛选"""
    print(f"\nPhase 4: 评分筛选...")
    
    initial_count = len(df)
    
    # 排除持仓票
    df = df[~df['raw_code'].isin(HELD_CODES)].copy()
    print(f"  排除持仓票后: {len(df)} 只")
    
    # 排除ST/退市（名称已排除，再确认）
    df = df[~df['name'].str.contains('ST|退市', na=False)].copy()
    
    # 排除30日涨幅>30%
    df = df[df['change_20d'] < 30].copy()
    print(f"  排除30日暴涨后: {len(df)} 只")
    
    # 排除RSI过热（>70）
    df = df[df['rsi'] < 70].copy()
    print(f"  排除RSI过热后: {len(df)} 只")
    
    # 排除RSI过冷（<20）
    df = df[df['rsi'] > 20].copy()
    
    # 排除今日涨幅过大（>8%）
    df = df[df['change_pct'] < 8].copy()
    print(f"  排除今日涨幅>8%后: {len(df)} 只")
    
    # 排除今日下跌
    df = df[df['change_pct'] > -2].copy()
    
    # 排除量比过低
    df = df[df['volume_ratio'] > 0.5].copy()
    print(f"  排除量比过低后: {len(df)} 只")
    
    # 评分体系
    df['score_trend'] = 0
    df.loc[df['above_ma20'], 'score_trend'] += 20
    df.loc[df['trend_up'], 'score_trend'] += 20
    
    df['score_position'] = 0
    df.loc[(df['rsi'] >= 30) & (df['rsi'] <= 55), 'score_position'] = 20
    df.loc[(df['rsi'] >= 55) & (df['rsi'] < 65), 'score_position'] = 10
    df.loc[(df['rsi'] >= 20) & (df['rsi'] < 30), 'score_position'] = 10
    
    df['score_volume'] = 0
    df.loc[(df['volume_ratio'] >= 1.0) & (df['volume_ratio'] <= 3.0), 'score_volume'] = 20
    df.loc[(df['volume_ratio'] >= 0.8) & (df['volume_ratio'] < 1.0), 'score_volume'] = 10
    df.loc[(df['volume_ratio'] > 3.0) & (df['volume_ratio'] <= 5.0), 'score_volume'] = 10
    
    df['score_price_pos'] = 0
    df.loc[(df['price_position'] >= 40) & (df['price_position'] <= 70), 'score_price_pos'] = 20
    df.loc[(df['price_position'] >= 30) & (df['price_position'] < 40), 'score_price_pos'] = 10
    df.loc[(df['price_position'] > 70) & (df['price_position'] <= 80), 'score_price_pos'] = 10
    
    df['total_score'] = df['score_trend'] + df['score_position'] + df['score_volume'] + df['score_price_pos']
    
    # 按总分排序
    df = df.sort_values('total_score', ascending=False)
    
    return df

# ============================================================
# Phase 5: 输出结果
# ============================================================
def save_results(df):
    """保存筛选结果"""
    print(f"\nPhase 5: 保存结果...")
    
    output_cols = ['code', 'name', 'close', 'change_pct', 'change_5d', 'change_20d',
                   'ma5', 'ma10', 'ma20', 'above_ma20', 'trend_up', 'rsi', 
                   'volume_ratio', 'amount_5d_avg', 'price_position', 
                   'high_20d', 'low_20d', 'total_score',
                   'score_trend', 'score_position', 'score_volume', 'score_price_pos',
                   'is_kcb', 'is_cyb']
    
    df[output_cols].to_csv(RESULT_FILE, index=False, encoding='utf-8-sig')
    print(f"  结果已保存: {RESULT_FILE}")
    
    # 摘要
    summary = {
        'scan_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_filtered': len(df),
        'avg_score': round(df['total_score'].mean(), 1) if len(df) > 0 else 0,
        'score_distribution': df['total_score'].value_counts().sort_index(ascending=False).head(10).to_dict() if len(df) > 0 else {},
        'top50': df.head(50)[['code', 'name', 'close', 'change_pct', 'change_5d', 'rsi', 'volume_ratio', 'price_position', 'total_score', 'trend_up']].to_dict('records')
    }
    
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"  摘要已保存: {REPORT_FILE}")
    
    # 打印Top30
    print(f"\n{'='*100}")
    print(f"{'代码':>10} {'名称':<10} {'收盘':>8} {'今日%':>6} {'5日%':>6} {'20日%':>6} {'RSI':>5} {'量比':>5} {'位置%':>5} {'趋势':>4} {'得分':>4}")
    print(f"{'='*100}")
    for _, row in df.head(30).iterrows():
        trend_str = '✓' if row['trend_up'] else '✗'
        print(f"{row['code']:>10} {row['name']:<10} {row['close']:>8.2f} {row['change_pct']:>6.2f} {row['change_5d']:>6.2f} {row['change_20d']:>6.2f} {row['rsi']:>5.1f} {row['volume_ratio']:>5.2f} {row['price_position']:>5.1f} {trend_str:>4} {row['total_score']:>4}")

# ============================================================
# Main
# ============================================================
if __name__ == '__main__':
    start_time = time.time()
    
    print("=" * 60)
    print("A股全市场选股扫描器 V2（优化版）")
    print(f"扫描时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    client = Quotes.factory(market='std')
    
    # Phase 1: 获取代码
    codes = get_valid_a_share_codes(client)
    
    # Phase 2: 获取数据
    stock_data = fetch_stock_data(client, codes)
    
    # Phase 3: 计算指标
    df = compute_indicators(stock_data)
    
    # Phase 4: 评分筛选
    df = score_and_filter(df)
    
    # Phase 5: 保存结果
    save_results(df)
    
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"扫描完成! 耗时: {elapsed:.1f}秒")
    print(f"结果文件: {RESULT_FILE}")
    print(f"{'='*60}")
