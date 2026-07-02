import { useTranslation } from "react-i18next";

interface PopularStockItem {
  rank: number;
  code: string;
  name: string;
  heatValue: number; // 讨论热度
  sentimentTag: string; // 讨论标签
  change: number;
}

interface PopularStocksProps {
  data?: any[];
}

export function PopularStocks({ data }: PopularStocksProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const defaultPopularList: PopularStockItem[] = [
    { rank: 1, code: "301550", name: "万丰奥威", heatValue: 9980, sentimentTag: "低空龙头/封单猛", change: 10.00 },
    { rank: 2, code: "300750", name: "宁德时代", heatValue: 8850, sentimentTag: "北向大买/出货压力减", change: 20.00 },
    { rank: 3, code: "601138", name: "工业富联", heatValue: 7920, sentimentTag: "AI服务器/算力爆发", change: 10.01 },
    { rank: 4, code: "600519", name: "贵州茅台", heatValue: 7100, sentimentTag: "大单资金护盘/估值修复", change: 10.02 },
    { rank: 5, code: "002594", name: "比亚迪", heatValue: 6420, sentimentTag: "海外销量大涨", change: 7.45 },
  ];

  const sentimentTags: string[] = [
    "游资强力博弈/超短线关注",
    "机构主力控盘/中线稳健",
    "题材板块轮动领头羊",
    "资金护盘力量强劲",
    "成交量异动放大明显"
  ];

  const popularList: PopularStockItem[] = data && data.length > 0 ? data.map((item: any, idx: number) => {
    return {
      rank: idx + 1,
      code: item.code,
      name: item.name,
      heatValue: Math.round(9000 - idx * 700 + Math.abs(item.change) * 100),
      sentimentTag: sentimentTags[idx % sentimentTags.length],
      change: item.change
    };
  }) : defaultPopularList;

  return (
    <div className="p-3.5 flex flex-col gap-2 h-full w-full">
      <div className="flex justify-between items-center border-b border-border/60 pb-1.5">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">🔥 {isEn ? "Popular Stocks" : "社交媒体热门人气股"}</span>
        <span className="text-[9px] text-rose-600 dark:text-[#ff3366] font-bold">XUEQIU ACTIVE</span>
      </div>

      <div className="space-y-2.5 flex-1 overflow-auto">
        {popularList.map((item) => {
          const isUp = item.change >= 0;
          return (
            <div key={item.code} className="flex items-center gap-2 text-xs">
              <span className={`text-[10px] w-4 h-4 rounded-sm flex items-center justify-center font-bold font-mono ${
                item.rank === 1 ? "bg-rose-50 dark:bg-[#ff3366]/20 text-rose-600 dark:text-[#ff3366] border border-rose-200 dark:border-[#ff3366]/40" :
                item.rank === 2 ? "bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30" :
                "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
              }`}>
                {item.rank}
              </span>

              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-slate-900 dark:text-white font-sans font-bold truncate">{item.name}</span>
                  <span className={`font-mono font-bold ${isUp ? "text-rose-600 dark:text-[#ff3366]" : "text-emerald-600 dark:text-[#00ff88]"}`}>
                    {isUp ? "+" : ""}{item.change.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  <span className="truncate max-w-[130px] font-sans">{item.sentimentTag}</span>
                  <span className="font-mono">热度 {item.heatValue}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
