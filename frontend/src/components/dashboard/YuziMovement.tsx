import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface YuziItem {
  name: string;
  stockName: string;
  stockCode: string;
  action: "buy" | "sell";
  amount: number; // 亿
  type: string; // 游资流派
}

interface YuziMovementProps {
  data?: YuziItem[];
}

export function YuziMovement({ data }: YuziMovementProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const fallbackList: YuziItem[] = [
    { name: "宁波解放路", stockName: "万丰奥威", stockCode: "301550", action: "buy", amount: 1.25, type: "一线游资" },
    { name: "呼家楼", stockName: "宁德时代", stockCode: "300750", action: "buy", amount: 2.80, type: "顶级席位" },
    { name: "小鳄鱼", stockName: "工业富联", stockCode: "601138", action: "buy", amount: 0.95, type: "新生代游资" },
    { name: "温州帮", stockName: "中兴通讯", stockCode: "000063", action: "sell", amount: -0.68, type: "庄股游资" },
    { name: "上海分公司", stockName: "比亚迪", stockCode: "002594", action: "buy", amount: 1.40, type: "量化大本营" }
  ];

  const yuziList = data && data.length > 0 ? data : fallbackList;

  return (
    <div className="border border-border/80 bg-card/90 backdrop-blur-md p-4.5 flex flex-col gap-3 h-full rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/5">
      <div className="flex justify-between items-center border-b border-border/60 pb-2">
        <span className="text-[11px] font-black tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          🕵️ {isEn ? "Yuzi Movement" : "游资盘中大单动向"}
        </span>
        <span className="text-[8px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded-sm font-mono border border-rose-500/20 uppercase tracking-widest animate-pulse">
          Live Feed
        </span>
      </div>

      <div className="space-y-1.5 flex-1 overflow-auto">
        {yuziList.map((item, idx) => {
          const isBuy = item.action === "buy";
          return (
            <div 
              key={idx} 
              className="flex justify-between items-center text-xs border-b border-border/40 py-2 px-1 hover:bg-muted/40 transition-all duration-300 hover:translate-x-1.5 rounded-md last:border-b-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-black text-[13px]">{item.name}</span>
                <span className="text-[9px] text-muted-foreground font-mono font-medium">{item.type}</span>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <span className="text-foreground/90 font-medium text-[12px]">{item.stockName}</span>
                <span className="text-[9px] text-muted-foreground font-mono bg-muted/60 px-1 py-0.2 rounded-sm">{item.stockCode}</span>
              </div>

              <div className="text-right flex items-center gap-1.5">
                <div className="flex flex-col items-end">
                  <span className={`font-black font-mono text-[13px] tracking-tight ${isBuy ? "text-rose-500" : "text-emerald-500"}`}>
                    {isBuy ? "＋" : "－"}{Math.abs(item.amount).toFixed(2)}亿
                  </span>
                </div>
                {isBuy ? (
                  <ArrowUpRight className="h-4 w-4 text-rose-500 animate-bounce" style={{ animationDuration: "3s" }} />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-emerald-500 animate-bounce" style={{ animationDuration: "3s" }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
