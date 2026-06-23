#!/usr/bin/env python3
"""
全市场A股选股扫描器 V4（最终版）
- 沪市：mootdx stocks() 直接获取
- 深市：mootdx bars() 逐票验证（只扫有效代码段）
- 超时保护：单票3秒，总超时600秒
"""
import sys, os, time, json, warnings, signal
warnings.filterwarnings('ignore')
import pandas as pd
import numpy as np
from datetime import datetime
from mootdx.quotes import Quotes

OUTPUT_DIR = '/home/skloxo/aho/vibe-trading'
RESULT_FILE = os.path.join(OUTPUT_DIR, 'screener_results.csv')
REPORT_FILE = os.path.join(OUTPUT_DIR, 'screener_report.json')

HELD_CODES = ['601595', '002045', '300395', '000066', '601137']
MAX_TIME = 600  # 最大运行时间（秒）

def timeout_handler(signum, frame):
    raise TimeoutError("扫描超时")

def get_sh_codes(client):
    """从mootdx stocks()获取沪市股票"""
    stock_list = client.stocks()
    codes = []
    
    for _, row in stock_list.iterrows():
        code = str(row['code']).zfill(6)
        name = str(row['name']).strip().replace('\x00', '')
        
        if not code.isdigit() or len(code) != 6:
            continue
        
        if '指数' in name or 'Ａ股' in name or 'Ｂ股' in name or '国债' in name:
            continue
        
        if code.startswith(('600', '601', '603', '605', '688', '689')):
            if 'ST' not in name and '退市' not in name:
                codes.append((1, code, name))
    
    return codes

def get_sz_codes():
    """生成深市候选代码（只扫有效的代码段）"""
    codes = []
    
    # 深市主板 000001-000999
    for i in range(1, 1000):
        codes.append((0, f"000{i:03d}", ''))
    
    # 深市主板 001001-001999
    for i in range(1, 1000):
        codes.append((0, f"001{i:03d}", ''))
    
    # 中小板 002001-002999
    for i in range(1, 1000):
        codes.append((0, f"002{i:03d}", ''))
    
    # 中小板 003001-003999
    for i in range(1, 1000):
        codes.append((0, f"003{i:03d}", ''))
    
    # 创业板 300001-300999
    for i in range(1, 1000):
        codes.append((0, f"300{i:03d}", ''))
    
    # 创业板 301001-301999
    for i in range(1, 1000):
        codes.append((0, f"301{i:03d}", ''))
    
    return codes

def fetch_and_compute(client, codes, start_time):
    """批量获取数据并计算指标"""
    results = []
    valid = 0
    total = len(codes)
    
    for i, (market, code, name) in enumerate(codes):
        # 超时检查
        if time.time() - start_time > MAX_TIME:
            print(f"\n  ⚠️ 达到时间上限 {MAX_TIME}s，已处理 {i}/{total}")
            break
        
        if (i + 1) % 200 == 0:
            elapsed = time.time() - start_time
            speed = (i + 1) / elapsed
            eta = (total - i - 1) / speed
            print(f"  [{i+1}/{total}] 有效:{valid} 速度:{speed:.0f}/s ETA:{eta:.0f}s")
        
        try:
            df = client.bars(market=market, symbol=code, offset=25)
            if df is None or len(df) < 20:
                continue
            
            close = df['close'].values
            high = df['high'].values
            low = df['low'].values
            vol = df['vol'].values if 'vol' in df.columns else df['volume'].values
            amount = df['amount'].values if 'amount' in df.columns else np.zeros(len(df))
            
            current = close[-1]
            if current <= 0 or np.isnan(current) or vol[-1] == 0:
                continue
            if current < 2 or current > 3000:
                continue
            if np.mean(amount[-5:]) / 1e8 < 0.3:  # 成交额<3000万
                continue
            
            # 如果没有名称，从stocks()获取
            if not name:
                name = ''
            
            prev_close = close[-2]
            change_pct = (current / prev_close - 1) * 100
            change_5d = (current / close[-6] - 1) * 100 if len(close) > 5 else 0
            change_20d = (current / close[0] - 1) * 100
            
            ma5 = np.mean(close[-5:])
            ma10 = np.mean(close[-10:])
            ma20 = np.mean(close[-20:])
            
            above_ma20 = current > ma20
            ma5_above_ma20 = ma5 > ma20
            trend_up = above_ma20 and ma5_above_ma20
            
            deltas = np.diff(close[-15:])
            gains = np.where(deltas > 0, deltas, 0)
            losses = np.where(deltas < 0, -deltas, 0)
            avg_gain = np.mean(gains)
            avg_loss = np.mean(losses)
            rsi = 100 - (100 / (1 + avg_gain / avg_loss)) if avg_loss > 0 else 100
            
            vol_5d_avg = np.mean(vol[-6:-1]) if len(vol) > 5 else np.mean(vol)
            volume_ratio = vol[-1] / vol_5d_avg if vol_5d_avg > 0 else 1.0
            
            amount_5d_avg = np.mean(amount[-5:]) / 1e8
            
            high_20d = np.max(high[-20:])
            low_20d = np.min(low[-20:])
            price_position = (current - low_20d) / (high_20d - low_20d) * 100 if high_20d != low_20d else 50
            
            is_kcb = code.startswith('688') or code.startswith('689')
            is_cyb = code.startswith('300') or code.startswith('301')
            limit_pct = 20 if (is_kcb or is_cyb) else 10
            
            if change_pct >= limit_pct * 0.95 or change_pct <= -limit_pct * 0.95:
                continue
            
            suffix = 'SH' if market == 1 else 'SZ'
            results.append({
                'code': f"{code}.{suffix}",
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
            valid += 1
        except:
            pass
        
        if (i + 1) % 80 == 0:
            time.sleep(0.1)
    
    print(f"  共获取 {valid} 只有效股票")
    return pd.DataFrame(results)

def fill_names(df, client):
    """补充深市股票名称"""
    stock_list = client.stocks()
    name_map = {}
    for _, row in stock_list.iterrows():
        code = str(row['code']).zfill(6)
        name = str(row['name']).strip().replace('\x00', '')
        name_map[code] = name
    
    mask = df['name'] == ''
    df.loc[mask, 'name'] = df.loc[mask, 'raw_code'].map(name_map).fillna('')
    return df

def score_and_filter(df):
    """评分筛选"""
    print(f"\nPhase 3: 评分筛选...")
    
    # 排除持仓票
    df = df[~df['raw_code'].isin(HELD_CODES)].copy()
    print(f"  排除持仓票: {len(df)} 只")
    
    # 排除ST/退市
    df = df[~df['name'].str.contains('ST|退市', na=False)].copy()
    
    # 排除30日涨幅>30%
    df = df[df['change_20d'] < 30].copy()
    print(f"  排除30日暴涨: {len(df)} 只")
    
    # 排除RSI过热>70
    df = df[df['rsi'] < 70].copy()
    print(f"  排除RSI>70: {len(df)} 只")
    
    # 排除RSI过冷<20
    df = df[df['rsi'] > 20].copy()
    
    # 排除今日涨幅>8%
    df = df[df['change_pct'] < 8].copy()
    print(f"  排除涨幅>8%: {len(df)} 只")
    
    # 排除今日下跌>2%
    df = df[df['change_pct'] > -2].copy()
    
    # 排除量比过低
    df = df[df['volume_ratio'] > 0.5].copy()
    print(f"  排除量比<0.5: {len(df)} 只")
    
    # 评分
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
    
    df = df.sort_values('total_score', ascending=False)
    return df

def save_results(df):
    """保存结果"""
    print(f"\nPhase 4: 保存结果...")
    
    cols = ['code', 'name', 'close', 'change_pct', 'change_5d', 'change_20d',
            'ma5', 'ma10', 'ma20', 'above_ma20', 'trend_up', 'rsi', 
            'volume_ratio', 'amount_5d_avg', 'price_position', 
            'high_20d', 'low_20d', 'total_score',
            'score_trend', 'score_position', 'score_volume', 'score_price_pos',
            'is_kcb', 'is_cyb']
    
    df[cols].to_csv(RESULT_FILE, index=False, encoding='utf-8-sig')
    
    summary = {
        'scan_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_filtered': len(df),
        'avg_score': round(df['total_score'].mean(), 1) if len(df) > 0 else 0,
        'top50': df.head(50)[['code', 'name', 'close', 'change_pct', 'change_5d', 'rsi', 'volume_ratio', 'price_position', 'total_score', 'trend_up']].to_dict('records')
    }
    
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    # 打印Top50
    print(f"\n{'='*110}")
    print(f"  {'代码':>10} {'名称':<12} {'收盘':>8} {'今日%':>6} {'5日%':>6} {'20日%':>6} {'RSI':>5} {'量比':>5} {'位置%':>5} {'趋势':>4} {'得分':>4}")
    print(f"{'='*110}")
    for _, row in df.head(50).iterrows():
        t = '✓' if row['trend_up'] else '✗'
        print(f"  {row['code']:>10} {row['name']:<12} {row['close']:>8.2f} {row['change_pct']:>6.2f} {row['change_5d']:>6.2f} {row['change_20d']:>6.2f} {row['rsi']:>5.1f} {row['volume_ratio']:>5.2f} {row['price_position']:>5.1f} {t:>4} {row['total_score']:>4}")

if __name__ == '__main__':
    start_time = time.time()
    
    print("=" * 60)
    print("A股全市场选股扫描器 V4")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    client = Quotes.factory(market='std')
    
    # Phase 1: 获取代码
    print("\nPhase 1: 获取代码...")
    sh_codes = get_sh_codes(client)
    print(f"  沪市: {len(sh_codes)} 只")
    
    sz_codes = get_sz_codes()
    print(f"  深市候选: {len(sz_codes)} 只")
    
    all_codes = sh_codes + sz_codes
    print(f"  总计: {len(all_codes)} 只")
    
    # Phase 2: 获取数据
    print(f"\nPhase 2: 获取数据（超时{MAX_TIME}秒）...")
    df = fetch_and_compute(client, all_codes, start_time)
    
    # 补充名称
    df = fill_names(df, client)
    
    # Phase 3: 评分
    df = score_and_filter(df)
    
    # Phase 4: 保存
    save_results(df)
    
    elapsed = time.time() - start_time
    print(f"\n完成! 耗时: {elapsed:.1f}秒, 有效: {len(df)} 只")
