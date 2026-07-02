import { useTranslation } from "react-i18next";

interface SectorFlow {
  name: string;
  flow: number; // 资金流（亿）
  change: number;
  sparkline: number[];
}

interface FundFlowsProps {
  data?: SectorFlow[];
}

export function FundFlows({ data }: FundFlowsProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const defaultSectors: SectorFlow[] = [
    { name: "低空经济", flow: 38.4, change: 4.82, sparkline: [10, 15, 8, 20, 25, 45, 60] },
    { name: "AI算力", flow: 29.1, change: 3.15, sparkline: [12, 10, 18, 14, 22, 30, 42] },
    { name: "华为星闪", flow: 15.6, change: 2.78, sparkline: [5, 12, 9, 15, 20, 18, 28] },
    { name: "医药生物", flow: -18.2, change: -2.10, sparkline: [30, 25, 28, 18, 12, 15, 10] },
    { name: "证券金融", flow: 8.5, change: 0.42, sparkline: [15, 12, 16, 14, 18, 15, 19] },
  ];

  const sectors = data && data.length > 0 ? data : defaultSectors;

  return (
    <div className="p-3.5 flex flex-col gap-2 h-full w-full">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-border/60 pb-1.5">📊 {isEn ? "Sector Fund Flows" : "热门板块资金净流入"}</span>
      <div className="space-y-2.5 flex-1 overflow-auto">
        {sectors.map((sec) => {
          const isUp = sec.flow >= 0;
          return (
            <div key={sec.name} className="flex justify-between items-center text-xs">
              <div className="flex flex-col">
                <span className="text-slate-900 dark:text-white font-sans font-bold">{sec.name}</span>
                <span className={`text-[10px] ${isUp ? "text-rose-600 dark:text-[#ff3366]" : "text-emerald-600 dark:text-[#00ff88]"}`}>
                  {isUp ? "流入" : "流出"} {Math.abs(sec.flow).toFixed(1)} 亿
                </span>
              </div>

              {/* Styled Mock SVG Sparkline */}
              <div className="w-16 h-6 flex items-center">
                <svg viewBox="0 0 100 30" className="w-full h-full">
                  <polyline
                    fill="none"
                    stroke={isUp ? "#ff3366" : "#00ff88"}
                    strokeWidth="2.5"
                    points={sec.sparkline.map((val, idx) => `${idx * 16},${30 - (val / 60) * 28}`).join(" ")}
                    className={isUp ? "stroke-rose-600 dark:stroke-[#ff3366]" : "stroke-emerald-600 dark:stroke-[#00ff88]"}
                  />
                </svg>
              </div>

              <span className={`font-bold ${isUp ? "text-rose-600 dark:text-[#ff3366]" : "text-emerald-600 dark:text-[#00ff88]"}`}>
                {isUp ? "+" : ""}{sec.change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
