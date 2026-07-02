import { useTranslation } from "react-i18next";

interface PositionItem {
  code: string;
  name: string;
  shares: number;
  cost: number;
  price: number;
  profit: number; // 累计盈亏（万）
  profitRate: number;
}

interface PortfolioProps {
  data?: PositionItem[];
  netAsset?: number;
}

export function Portfolio({ data, netAsset }: PortfolioProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const fallbackPositions: PositionItem[] = [
    { code: "300750", name: "宁德时代", shares: 8000, cost: 185.20, price: 218.40, profit: 26.56, profitRate: 17.92 },
    { code: "301550", name: "万丰奥威", shares: 45000, cost: 12.40, price: 16.28, profit: 17.46, profitRate: 31.29 },
    { code: "601398", name: "工商银行", shares: 150000, cost: 5.69, price: 5.62, profit: -1.05, profitRate: -1.23 }
  ];

  const positions = data && data.length > 0 ? data : fallbackPositions;
  const displayNetAsset = netAsset !== undefined ? `${netAsset.toFixed(2)}M` : "4.82M";

  return (
    <div className="border border-border/80 bg-card/90 backdrop-blur-md p-4.5 flex flex-col gap-3 h-full rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/5">
      <div className="flex justify-between items-center border-b border-border/60 pb-2">
        <span className="text-[11px] font-black tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          💼 {isEn ? "Portfolio Positions" : "我的证券持仓明细"}
        </span>
        <span className="text-[10px] text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 border border-rose-500/20 rounded-sm font-bold uppercase tracking-wider">
          净资产: {displayNetAsset}
        </span>
      </div>

      <div className="space-y-1.5 flex-1 overflow-auto">
        <div className="grid grid-cols-12 text-[10px] font-black text-muted-foreground/80 px-2 py-1 border-b border-border/40 uppercase tracking-widest">
          <span className="col-span-3">名称</span>
          <span className="col-span-3 text-right">持仓/成本</span>
          <span className="col-span-3 text-right">现价</span>
          <span className="col-span-3 text-right">浮动盈亏</span>
        </div>

        {positions.map((pos) => {
          const isUp = pos.profit >= 0;
          return (
            <div key={pos.code} className="grid grid-cols-12 text-xs items-center px-2 py-2 hover:bg-muted/40 transition-all duration-300 rounded-md border-b border-border/20 last:border-b-0">
              <div className="col-span-3 flex flex-col gap-0.5">
                <span className="text-foreground font-black text-[13px] truncate">{pos.name}</span>
                <span className="text-[9px] text-muted-foreground font-mono bg-muted/60 px-1 py-0.2 rounded-sm w-fit">{pos.code}</span>
              </div>

              <div className="col-span-3 flex flex-col items-end gap-0.5">
                <span className="text-foreground/90 font-mono font-bold tabular-nums text-[12px]">{pos.shares}</span>
                <span className="text-[9px] text-muted-foreground font-mono tabular-nums">{pos.cost.toFixed(2)}</span>
              </div>

              <span className="col-span-3 text-right text-foreground font-black font-mono tabular-nums text-[13px]">
                {pos.price.toFixed(2)}
              </span>

              <div className="col-span-3 flex flex-col items-end gap-0.5">
                <span className={`font-black font-mono tabular-nums text-[13px] ${isUp ? "text-rose-500" : "text-emerald-500"}`}>
                  {isUp ? "+" : ""}{pos.profit.toFixed(2)}万
                </span>
                <span className={`text-[9px] font-black font-mono tabular-nums ${isUp ? "text-rose-500" : "text-emerald-500"}`}>
                  {isUp ? "+" : ""}{pos.profitRate.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
