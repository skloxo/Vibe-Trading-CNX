import { useTranslation } from "react-i18next";

interface WatchItem {
  code: string;
  name: string;
  price: number;
  change: number;
  sparkline: number[];
}

interface WatchlistProps {
  data?: WatchItem[];
}

export function Watchlist({ data }: WatchlistProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  
  const defaultWatchList: WatchItem[] = [
    { code: "300750", name: "宁德时代", price: 218.40, change: 2.00, sparkline: [20, 22, 19, 23, 27, 35, 42] },
    { code: "600519", name: "贵州茅台", price: 1650.00, change: 1.02, sparkline: [10, 8, 12, 14, 15, 18, 22] },
    { code: "002594", name: "比亚迪", price: 256.80, change: 7.45, sparkline: [15, 12, 18, 16, 20, 24, 25] },
    { code: "301550", name: "万丰奥威", price: 16.28, change: 10.00, sparkline: [5, 10, 8, 15, 22, 35, 48] },
    { code: "601398", name: "工商银行", price: 5.62, change: -1.23, sparkline: [12, 15, 14, 13, 11, 10, 8] }
  ];

  const watchList = data && data.length > 0 ? data : defaultWatchList;

  return (
    <div className="border border-slate-200 dark:border-[#222233] bg-white dark:bg-[#10101a]/80 p-3 flex flex-col gap-2 h-full rounded shadow-sm dark:shadow-none">
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#222233] pb-1.5">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          ⭐ {isEn ? "Watchlist" : "用户自选股列表"}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">COUNT: {watchList.length}</span>
      </div>

      <div className="space-y-2 flex-1 overflow-auto">
        <div className="grid grid-cols-12 text-[9px] font-bold text-slate-400 dark:text-slate-500 px-1 py-0.5 border-b border-slate-100 dark:border-[#1c1c2b]">
          <span className="col-span-3">代码</span>
          <span className="col-span-3">名称</span>
          <span className="col-span-3 text-center">趋势</span>
          <span className="col-span-3 text-right">涨跌幅</span>
        </div>

        {watchList.map((item) => {
          const isUp = item.change >= 0;
          return (
            <div key={item.code} className="grid grid-cols-12 text-xs items-center px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-[#1a1a2e] rounded transition-colors">
              <span className="col-span-3 text-slate-500 dark:text-slate-400 font-bold font-mono">{item.code}</span>
              <span className="col-span-3 text-slate-900 dark:text-white truncate font-sans">{item.name}</span>
              
              <div className="col-span-3 h-5 px-1 flex items-center">
                <svg viewBox="0 0 100 30" className="w-full h-full">
                  <polyline
                     fill="none"
                     stroke={isUp ? "#ff3366" : "#00ff88"}
                     strokeWidth="2"
                     points={item.sparkline.map((val, idx) => `${idx * 16},${30 - (val / 50) * 28}`).join(" ")}
                     className={isUp ? "stroke-rose-600 dark:stroke-[#ff3366]" : "stroke-emerald-600 dark:stroke-[#00ff88]"}
                  />
                </svg>
              </div>

              <span className={`col-span-3 text-right font-bold font-mono tabular-nums ${
                isUp ? "text-rose-600 dark:text-[#ff3366]" : "text-emerald-600 dark:text-[#00ff88]"
              }`}>
                {isUp ? "+" : ""}{item.change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
