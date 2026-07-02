import { useTranslation } from "react-i18next";

interface StockItem {
  code: string;
  name: string;
  price: number;
  change: number;
  boardCount: number;
  status?: "limit_up" | "limit_down" | "normal";
}

interface LimitUpBoardProps {
  data?: any[];
}

export function LimitUpBoard({ data }: LimitUpBoardProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  
  const defaultStockList: StockItem[] = [
    { code: "300750", name: "宁德时代", price: 218.40, change: 20.00, boardCount: 2 },
    { code: "600519", name: "贵州茅台", price: 1650.00, change: 10.02, boardCount: 1 },
    { code: "301550", name: "万丰奥威", price: 16.28, change: 10.00, boardCount: 3 },
    { code: "601138", name: "工业富联", price: 24.75, change: 10.01, boardCount: 1 },
    { code: "000063", name: "中兴通讯", price: 29.81, change: 10.00, boardCount: 1 },
  ];

  const stockList: StockItem[] = data && data.length > 0 ? data.map((item: any) => ({
    code: item.code,
    name: item.name,
    price: item.price,
    change: item.change,
    boardCount: item.count || 1
  })) : defaultStockList;

  return (
    <div className="border border-slate-200 dark:border-[#222233] bg-white dark:bg-[#10101a]/80 flex flex-col h-full overflow-hidden rounded shadow-sm dark:shadow-none">
      <div className="border-b border-slate-200 dark:border-[#222233] px-3 py-2 flex justify-between items-center bg-slate-50 dark:bg-[#12121e]">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          🔥 {isEn ? "Limit-Up Board" : "涨停板追踪"}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 dark:bg-[#ff3366]/10 text-rose-600 dark:text-[#ff3366] font-bold border border-rose-200 dark:border-transparent rounded">T+1</span>
      </div>
      <div className="flex-1 overflow-auto p-1.5 space-y-1">
        <div className="grid grid-cols-12 text-[9px] font-bold text-slate-400 dark:text-slate-500 px-2 py-1 border-b border-slate-100 dark:border-[#1f1f2e]">
          <span className="col-span-3">代码</span>
          <span className="col-span-3">简称</span>
          <span className="col-span-3 text-right">现价</span>
          <span className="col-span-3 text-right">涨幅</span>
        </div>
        {stockList.map((stock) => (
          <div 
            key={stock.code} 
            className="grid grid-cols-12 text-xs items-center px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-[#1a1a2e] transition-colors rounded"
          >
            <span className="col-span-3 text-slate-500 dark:text-slate-400 font-bold">{stock.code}</span>
            <span className="col-span-3 text-slate-900 dark:text-white truncate font-sans">{stock.name}</span>
            <span className="col-span-3 text-right text-slate-600 dark:text-slate-300 font-bold tabular-nums">
              {stock.price.toFixed(2)}
            </span>
            <span className="col-span-3 text-right font-bold text-rose-600 dark:text-[#ff3366] tabular-nums flex items-center justify-end gap-0.5">
              <span className="text-[8px] px-1 py-0.2 bg-rose-50 dark:bg-[#ff3366]/20 border border-rose-200 dark:border-[#ff3366]/30 text-rose-600 dark:text-[#ff3366] rounded font-mono mr-1">
                {stock.boardCount}B
              </span>
              +{stock.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
