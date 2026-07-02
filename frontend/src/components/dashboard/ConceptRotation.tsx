import { useTranslation } from "react-i18next";

interface ConceptItem {
  name: string;
  leadStock: string;
  leadStockCode: string;
  heat: number; // 0-100
  sentiment: "bull" | "bear" | "neutral";
  change: number;
}

interface ConceptRotationProps {
  data?: any[];
}

export function ConceptRotation({ data }: ConceptRotationProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const defaultConcepts: ConceptItem[] = [
    { name: "低空经济", leadStock: "万丰奥威", leadStockCode: "301550", heat: 98, sentiment: "bull", change: 5.62 },
    { name: "华为智驾", leadStock: "赛力斯", leadStockCode: "601127", heat: 92, sentiment: "bull", change: 3.18 },
    { name: "AI算力", leadStock: "工业富联", leadStockCode: "601138", heat: 88, sentiment: "bull", change: 4.10 },
    { name: "生物医药", leadStock: "恒瑞医药", leadStockCode: "600276", heat: 45, sentiment: "bear", change: -1.85 },
    { name: "中特估", leadStock: "工商银行", leadStockCode: "601398", heat: 60, sentiment: "neutral", change: 0.23 }
  ];

  const conceptLeaderMap: Record<string, { stock: string, code: string }> = {
    "低空经济": { stock: "万丰奥威", code: "301550" },
    "AI算力": { stock: "工业富联", code: "601138" },
    "华为概念": { stock: "赛力斯", code: "601127" },
    "半导体": { stock: "中芯国际", code: "688981" },
    "生物医药": { stock: "恒瑞医药", code: "600276" },
    "中特估": { stock: "工商银行", code: "601398" }
  };

  const concepts: ConceptItem[] = data && data.length > 0 ? data.map((item: any) => {
    const leader = conceptLeaderMap[item.name] || { stock: "龙头股", code: "------" };
    const change = item.change || 0;
    const heat = Math.min(100, Math.max(10, Math.round(50 + change * 8)));
    const sentiment = change > 1.5 ? "bull" : change < -1.5 ? "bear" : "neutral";
    return {
      name: item.name,
      leadStock: leader.stock,
      leadStockCode: leader.code,
      heat,
      sentiment,
      change
    };
  }) : defaultConcepts;

  return (
    <div className="p-3.5 flex flex-col gap-2 h-full w-full">
      <div className="flex justify-between items-center border-b border-border/60 pb-1.5">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">📡 {isEn ? "Concept Rotation" : "题材板块热度轮动"}</span>
        <span className="text-[9px] text-rose-600 dark:text-[#ff3366] font-bold">24H HEAT</span>
      </div>

      <div className="space-y-3 flex-1 overflow-auto">
        {concepts.map((concept, idx) => {
          const isUp = concept.change >= 0;
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-900 dark:text-white font-bold">{concept.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  领涨: <span className="text-slate-700 dark:text-slate-300 font-sans">{concept.leadStock}</span> ({concept.leadStockCode})
                </span>
                <span className={`font-bold font-mono ${isUp ? "text-rose-600 dark:text-[#ff3366]" : "text-emerald-600 dark:text-[#00ff88]"}`}>
                  {isUp ? "+" : ""}{concept.change.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 dark:bg-[#1e1e2f] h-1 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${isUp ? "bg-rose-600 dark:bg-[#ff3366]" : "bg-emerald-600 dark:bg-[#00ff88]"}`}
                    style={{ width: `${concept.heat}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono w-6 text-right">热 {concept.heat}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
