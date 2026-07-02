import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MarketSentimentProps {
  score?: number;
  description?: string;
}

export function MarketSentiment({ score = 82, description = "GREED (极度贪婪)" }: MarketSentimentProps) {
  const displayScore = score;
  const isUp = displayScore >= 50;
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  return (
    <div className="p-3.5 flex flex-col gap-2 relative overflow-hidden h-full w-full">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff3366]/5 rounded-full blur-xl pointer-events-none" />
      <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
        <span>{isEn ? "A-Share Sentiment Gauge" : "A股大盘情绪温度"}</span>
        <Activity className={`h-3.5 w-3.5 ${isUp ? "text-rose-600 dark:text-[#ff3366]" : "text-emerald-605 dark:text-[#00ff88]"}`} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-extrabold tracking-tighter ${isUp ? "text-rose-600 dark:text-[#ff3366]" : "text-emerald-605 dark:text-[#00ff88]"}`}>
          {displayScore}
        </span>
        <span className={`text-xs font-bold font-sans ${isUp ? "text-rose-600 dark:text-[#ff3366]" : "text-emerald-650 dark:text-[#00ff88]"}`}>
          {description}
        </span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-[#1e1e2f] h-1.5 rounded-full overflow-hidden">
        <div className={`h-full ${isUp ? "bg-rose-600 dark:bg-[#ff3366]" : "bg-emerald-600 dark:bg-[#00ff88]"}`} style={{ width: `${displayScore}%` }} />
      </div>
      <div className="flex justify-between text-[8px] text-slate-400 dark:text-slate-655">
        <span>0 (恐慌)</span>
        <span>50 (中性)</span>
        <span>100 (狂热)</span>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1a1a2e] grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-slate-400 dark:text-slate-500 block">今日首板率</span>
          <span className="text-slate-900 dark:text-white font-bold font-mono">74.2%</span>
        </div>
        <div>
          <span className="text-slate-400 dark:text-slate-500 block">炸板率</span>
          <span className="text-emerald-600 dark:text-[#00ff88] font-bold font-mono">18.5%</span>
        </div>
      </div>
    </div>
  );
}
