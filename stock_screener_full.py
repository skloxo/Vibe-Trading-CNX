#!/usr/bin/env python3
"""
全市场A股选股扫描器
按 market-review-methodology 框架执行：
  大盘 → 题材 → 个股（趋势+位置+量能+评分）

数据源：mootdx（通达信直连）
"""
import sys, os, time, json, warnings
warnings.filterwarnings('ignore')
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from mootdx.quotes import Quotes

OUTPUT_DIR = '/home/skloxo/aho/vibe-trading'
RESULT_FILE = os.path.join(OUTPUT_DIR, 'screener_results.csv')
REPORT_FILE = os.path.join(OUTPUT_DIR, 'screener_report.json')

# ============================================================
# Phase 1: 获取全市场A股代码
# ============================================================
def get_all_a_share_codes():
    """获取全市场A股代码列表"""
    print("Phase 1: 获取全市场A股代码...")
    
    # 从已知的A股代码范围生成候选列表
    # 沪市主板: 600000-609999, 601000-601999, 603000-603999, 605000-605999
    # 沪市科创板: 688000-688999, 689000-689999
    # 深市主板: 000001-000999, 001001-001999
    # 深市中小板: 002001-002999, 003001-003999
    # 创业板: 300001-300999, 301001-301999
    
    codes = []
    
    # 沪市 (market=1)
    for prefix in range(600, 606):
        for suffix in range(0, 1000):
            codes.append((1, f"{prefix}{suffix:03d}"))
    for prefix in range(688, 690):
        for suffix in range(0, 1000):
            codes.append((1, f"{prefix}{suffix:03d}"))
    
    # 深市 (market=0)
    for prefix in range(0, 4):
        for suffix in range(1, 1000):
            codes.append((0, f"{prefix:03d}{suffix:03d}"))
    for prefix in range(2001, 2010):
        for suffix in range(0, 1000):
            codes.append((0, f"{prefix}{suffix:03d}"))
    for prefix in range(300, 302):
        for suffix in range(1, 1000):
            codes.append((0, f"{prefix}{suffix:03d}"))
    
    print(f"  生成候选代码: {len(codes)} 个")
    return codes

# ============================================================
# Phase 2: 批量获取行情数据
# ============================================================
def fetch_stock_data(client, codes, batch_size=80):
    """批量获取股票20日数据"""
    print(f"\nPhase 2: 批量获取 {len(codes)} 只股票数据...")
    
    results = []
    valid_count = 0
    total_batches = (len(codes) + batch_size - 1) // batch_size
    
    for i in range(0, len(codes), batch_size):
        batch = codes[i:i+batch_size]
        batch_num = i // batch_size + 1
        
        if batch_num % 50 == 0:
            print(f"  进度: {batch_num}/{total_batches} 批次, 已获取 {valid_count} 只有效股票")
        
        for market, code in batch:
            try:
                df = client.bars(market=market, symbol=code, offset=20)
                if df is not None and len(df) >= 10:
                    # 基本验证
                    last_close = df.iloc[-1]['close']
                    if last_close > 0 and not np.isnan(last_close):
                        # 提取名称（从stocks列表中查找）
                        name = ''  # 后续补充
                        results.append({
                            'code': code,
                            'market': market,
                            'data': df,
                            'name': name
                        })
                        valid_count += 1
            except Exception as e:
                pass  # 跳过无效代码
        
        # 限流：每批后休息0.2秒
        time.sleep(0.2)
    
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
            
            # 基本信息
            close = df['close'].values
            high = df['high'].values
            low = df['low'].values
            vol = df['vol'].values if 'vol' in df.columns else df['volume'].values
            
            if len(close) < 20:
                continue
            
            current = close[-1]
            prev_close = close[-2] if len(close) > 1 else current
            
            # 今日涨跌幅
            change_pct = (current / prev_close - 1) * 100
            
            # 5日涨跌幅
            change_5d = (current / close[-6] - 1) * 100 if len(close) > 5 else 0
            
            # 20日涨跌幅
            change_20d = (current / close[0] - 1) * 100
            
            # 均线
            ma5 = np.mean(close[-5:])
            ma10 = np.mean(close[-10:])
            ma20 = np.mean(close[-20:])
            
            # 趋势判断：价格在20日均线之上
            above_ma20 = current > ma20
            ma5_above_ma20 = ma5 > ma20
            trend_up = above_ma20 and ma5_above_ma20
            
            # RSI计算（14日）
            deltas = np.diff(close[-15:])
            gains = np.where(deltas > 0, deltas, 0)
            losses = np.where(deltas < 0, -deltas, 0)
            avg_gain = np.mean(gains) if len(gains) > 0 else 0
            avg_loss = np.mean(losses) if len(losses) > 0 else 0
            if avg_loss == 0:
                rsi = 100
            else:
                rs = avg_gain / avg_loss
                rsi = 100 - (100 / (1 + rs))
            
            # 量比（今日成交量 / 5日平均成交量）
            vol_5d_avg = np.mean(vol[-6:-1]) if len(vol) > 5 else np.mean(vol)
            volume_ratio = vol[-1] / vol_5d_avg if vol_5d_avg > 0 else 1.0
            
            # 成交额（近5日平均）
            amount = df['amount'].values if 'amount' in df.columns else np.zeros(len(df))
            amount_5d_avg = np.mean(amount[-5:])
            
            # 股价位置（当前价在近20日的百分位）
            high_20d = np.max(high[-20:])
            low_20d = np.min(low[-20:])
            price_position = (current - low_20d) / (high_20d - low_20d) * 100 if high_20d != low_20d else 50
            
            # 市值估算（用最新收盘价 * 成交量 / 换手率，简化处理）
            # 这里先不计算，后续补充
            
            # 过滤条件
            # 1. ST/退市：通过代码前缀排除已知的，名称后续验证
            # 2. 停牌：成交量为0
            if vol[-1] == 0:
                continue
            
            # 3. 价格异常
            if current < 1 or current > 5000:
                continue
            
            # 4. 涨跌停：排除涨停（无法买入）和跌停（风险太大）
            # A股主板10%，创业板/科创板20%
            is_kcb = code.startswith('688') or code.startswith('689')
            is_cyb = code.startswith('300') or code.startswith('301')
            limit_pct = 20 if (is_kcb or is_cyb) else 10
            if change_pct >= limit_pct * 0.95 or change_pct <= -limit_pct * 0.95:
                continue
            
            results.append({
                'code': f"{code}.{'SH' if market == 1 else 'SZ'}",
                'raw_code': code,
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
                'amount_5d_avg': round(amount_5d_avg / 1e8, 2),  # 亿元
                'price_position': round(price_position, 1),
                'high_20d': round(high_20d, 2),
                'low_20d': round(low_20d, 2),
            })
        except Exception as e:
            pass
    
    print(f"  有效指标: {len(results)} 只股票")
    return pd.DataFrame(results)

# ============================================================
# Phase 4: 评分筛选
# ============================================================
def score_and_filter(df):
    """按框架评分筛选"""
    print(f"\nPhase 4: 评分筛选...")
    
    if len(df) == 0:
        print("  ⚠️ 无有效数据")
        return df
    
    # 基本面排雷
    # 排除ST（通过名称，但这里没有名称，先用代码范围排除已知的）
    # 排除近期暴涨（30日涨幅>30%）
    df = df[df['change_20d'] < 30].copy()
    print(f"  排除30日暴涨后: {len(df)} 只")
    
    # 排除RSI过热（>70）
    df = df[df['rsi'] < 70].copy()
    print(f"  排除RSI过热后: {len(df)} 只")
    
    # 排除今日涨幅过大（>8%）
    df = df[df['change_pct'] < 8].copy()
    print(f"  排除今日涨幅>8%后: {len(df)} 只")
    
    # 排除今日下跌
    df = df[df['change_pct'] > 0].copy()
    print(f"  排除今日下跌后: {len(df)} 只")
    
    # 排除换手率过低（成交量比<0.5）
    df = df[df['volume_ratio'] > 0.5].copy()
    print(f"  排除量比过低后: {len(df)} 只")
    
    # 排除成交额过小（<5000万）
    df = df[df['amount_5d_avg'] > 0.5].copy()
    print(f"  排除成交额过小后: {len(df)} 只")
    
    # 评分
    # 趋势得分 (40%)：MA20之上、MA5>MA20
    df['score_trend'] = 0
    df.loc[df['above_ma20'], 'score_trend'] += 20
    df.loc[df['trend_up'], 'score_trend'] += 20
    
    # 位置得分 (20%)：RSI在30-55区间最佳
    df['score_position'] = 0
    df.loc[(df['rsi'] >= 30) & (df['rsi'] <= 55), 'score_position'] = 20
    df.loc[(df['rsi'] >= 55) & (df['rsi'] < 65), 'score_position'] = 10
    df.loc[(df['rsi'] >= 20) & (df['rsi'] < 30), 'score_position'] = 10
    
    # 量能得分 (20%)：量比1-3最佳
    df['score_volume'] = 0
    df.loc[(df['volume_ratio'] >= 1.0) & (df['volume_ratio'] <= 3.0), 'score_volume'] = 20
    df.loc[(df['volume_ratio'] >= 0.8) & (df['volume_ratio'] < 1.0), 'score_volume'] = 10
    df.loc[(df['volume_ratio'] > 3.0) & (df['volume_ratio'] <= 5.0), 'score_volume'] = 10
    
    # 价格位置得分 (20%)：在20日区间40-70%位置最佳
    df['score_price_pos'] = 0
    df.loc[(df['price_position'] >= 40) & (df['price_position'] <= 70), 'score_price_pos'] = 20
    df.loc[(df['price_position'] >= 30) & (df['price_position'] < 40), 'score_price_pos'] = 10
    df.loc[(df['price_position'] > 70) & (df['price_position'] <= 80), 'score_price_pos'] = 10
    
    # 总分
    df['total_score'] = df['score_trend'] + df['score_position'] + df['score_volume'] + df['score_price_pos']
    
    # 按总分排序
    df = df.sort_values('total_score', ascending=False)
    
    # 输出前100
    top_candidates = df.head(100)
    print(f"\n  === Top 100 候选 ===")
    print(f"  {'代码':>10} {'收盘':>8} {'今日%':>6} {'5日%':>6} {'20日%':>6} {'RSI':>5} {'量比':>5} {'位置%':>5} {'趋势':>4} {'得分':>4}")
    print(f"  {'-'*80}")
    for _, row in top_candidates.head(50).iterrows():
        trend_str = '✓' if row['trend_up'] else '✗'
        print(f"  {row['code']:>10} {row['close']:>8.2f} {row['change_pct']:>6.2f} {row['change_5d']:>6.2f} {row['change_20d']:>6.2f} {row['rsi']:>5.1f} {row['volume_ratio']:>5.2f} {row['price_position']:>5.1f} {trend_str:>4} {row['total_score']:>4}")
    
    return df

# ============================================================
# Phase 5: 获取股票名称
# ============================================================
def get_stock_names(client, df):
    """补充股票名称"""
    print(f"\nPhase 5: 补充股票名称...")
    
    names = {}
    stock_list = client.stocks()
    
    # 建立代码到名称的映射
    for _, row in stock_list.iterrows():
        code = str(row['code']).zfill(6)
        names[code] = row['name']
    
    df['name'] = df['raw_code'].map(names).fillna('')
    
    # 排除ST/退市
    st_mask = df['name'].str.contains('ST|退市', na=False)
    print(f"  排除ST/退市: {st_mask.sum()} 只")
    df = df[~st_mask]
    
    return df

# ============================================================
# Phase 6: 保存结果
# ============================================================
def save_results(df):
    """保存筛选结果"""
    print(f"\nPhase 6: 保存结果...")
    
    # 保存CSV
    output_cols = ['code', 'name', 'close', 'change_pct', 'change_5d', 'change_20d',
                   'ma5', 'ma10', 'ma20', 'above_ma20', 'trend_up', 'rsi', 
                   'volume_ratio', 'amount_5d_avg', 'price_position', 
                   'high_20d', 'low_20d', 'total_score',
                   'score_trend', 'score_position', 'score_volume', 'score_price_pos']
    
    df[output_cols].to_csv(RESULT_FILE, index=False, encoding='utf-8-sig')
    print(f"  结果已保存: {RESULT_FILE}")
    
    # 保存摘要JSON
    summary = {
        'scan_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_scanned': len(df),
        'avg_score': round(df['total_score'].mean(), 1),
        'top30': df.head(30)[['code', 'name', 'close', 'change_pct', 'rsi', 'volume_ratio', 'total_score']].to_dict('records')
    }
    
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"  摘要已保存: {REPORT_FILE}")

# ============================================================
# Main
# ============================================================
if __name__ == '__main__':
    start_time = time.time()
    
    print("=" * 60)
    print("A股全市场选股扫描器")
    print(f"扫描时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # 初始化客户端
    client = Quotes.factory(market='std')
    
    # 获取候选代码
    codes = get_all_a_share_codes()
    
    # 批量获取数据
    stock_data = fetch_stock_data(client, codes)
    
    # 计算指标
    df = compute_indicators(stock_data)
    
    # 获取名称并排雷
    df = get_stock_names(client, df)
    
    # 评分筛选
    df = score_and_filter(df)
    
    # 保存结果
    save_results(df)
    
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"扫描完成! 耗时: {elapsed:.1f}秒")
    print(f"结果文件: {RESULT_FILE}")
    print(f"{'='*60}")
