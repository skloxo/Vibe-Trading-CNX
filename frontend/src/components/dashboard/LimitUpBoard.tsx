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
    <div className="flex flex-col h-full w-full">
      <div className="border-b border-border/60 px-3.5 py-2 flex justify-between items-center bg-transparent shrink-0">
        <span className="text-[11px] font-black tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
          🔥 {isEn ? "Limit-Up Board" : "涨停板追踪"}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded-sm font-mono border border-rose-500/20 uppercase tracking-widest">T+1</span>
      </div>
      <div className="flex-1 overflow-auto p-3.5 space-y-1">
        {/* 表头 */}
        <div className="grid grid-cols-12 text-[9px] font-bold text-slate-400 dark:text-slate-500 px-2 py-1 border-b border-slate-100 dark:border-[#1f1f2e]">
          <span className="col-span-5">{isEn ? "Name / Code" : "名称 / 代码"}</span>
          <span className="col-span-2 text-center">{isEn ? "Board" : "连板"}</span>
          <span className="col-span-3 text-right">{isEn ? "Price" : "现价"}</span>
          <span className="col-span-2 text-right">{isEn ? "Chg%" : "涨幅"}</span>
        </div>

        {stockList.map((stock) => (
          <div
            key={stock.code}
            className="grid grid-cols-12 text-xs items-center px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-[#1a1a2e] transition-colors rounded"
          >
            {/* 名称 + 代码合并列 */}
            <div className="col-span-5 flex flex-col gap-0.5 min-w-0">
              <span className="text-slate-900 dark:text-white font-bold truncate text-[11px] leading-tight">{stock.name}</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{stock.code}</span>
            </div>

            {/* 连板数徽章 */}
            <div className="col-span-2 flex justify-center">
              {stock.boardCount >= 2 ? (
                <span className="text-[9px] px-1.5 py-0.5 bg-rose-50 dark:bg-[#ff3366]/20 border border-rose-200 dark:border-[#ff3366]/40 text-rose-600 dark:text-[#ff3366] rounded font-mono font-black leading-none">
                  {stock.boardCount}连
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 bg-slate-50 dark:bg-[#1e1e2f] border border-slate-200 dark:border-[#2a2a3e] text-slate-500 dark:text-slate-400 rounded font-mono leading-none">
                  首板
                </span>
              )}
            </div>

            {/* 现价 */}
            <span className="col-span-3 text-right text-slate-600 dark:text-slate-300 font-bold tabular-nums">
              {stock.price.toFixed(2)}
            </span>

            {/* 涨幅 */}
            <span className="col-span-2 text-right font-bold text-rose-600 dark:text-[#ff3366] tabular-nums text-[11px]">
              +{stock.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
