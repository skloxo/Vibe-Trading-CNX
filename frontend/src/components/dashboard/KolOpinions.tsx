import { useTranslation } from "react-i18next";

interface KolItem {
  author: string;
  stockName: string;
  code: string;
  sentiment: "bull" | "bear" | "neutral";
  followers: string;
  content: string;
  timestamp: string;
}

interface KolOpinionsProps {
  data?: KolItem[];
}

export function KolOpinions({ data }: KolOpinionsProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const fallbackOpinions: KolItem[] = [
    { 
      author: "量化复盘大师", 
      stockName: "万丰奥威", 
      code: "301550", 
      sentiment: "bull", 
      followers: "450k", 
      content: "低空航空进入2.0主升浪，今日万丰强势封死，底部筹码牢固，短期还有15-20%空间。", 
      timestamp: "14:15" 
    },
    { 
      author: "价值研报哥", 
      stockName: "宁德时代", 
      code: "300750", 
      sentiment: "bull", 
      followers: "120k", 
      content: "锂电池中报业绩超预期，出货量保持30%增长，上游碳酸锂下跌利好净利润，估值见底。", 
      timestamp: "13:58" 
    },
    { 
      author: "短线打板王", 
      stockName: "工商银行", 
      code: "601398", 
      sentiment: "bear", 
      followers: "280k", 
      content: "大金融板块护盘任务基本完成，资金有明显的从小盘向高弹性题材转移趋势，短期离场回避。", 
      timestamp: "13:42" 
    }
  ];

  const opinions = data && data.length > 0 ? data : fallbackOpinions;

  return (
    <div className="border border-border/80 bg-card/90 backdrop-blur-md p-4.5 flex flex-col gap-3 h-full rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/5">
      <div className="flex justify-between items-center border-b border-border/60 pb-2">
        <span className="text-[11px] font-black tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          👥 {isEn ? "KOL Sentiments" : "热门大V盘中观点与情绪"}
        </span>
        <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 border border-rose-500/20 rounded-sm">
          SENTIMENT: BULLISH
        </span>
      </div>

      <div className="space-y-3 flex-1 overflow-auto">
        {opinions.map((item, idx) => {
          const isBull = item.sentiment === "bull";
          const isBear = item.sentiment === "bear";
          return (
            <div key={idx} className="text-xs border-b border-border/20 py-2.5 px-1 hover:bg-muted/40 transition-all duration-300 hover:translate-x-1.5 rounded-md last:border-0 last:pb-0">
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-black text-[13px]">{item.author}</span>
                  <span className="text-[9px] text-muted-foreground bg-muted/65 px-1.5 py-0.2 rounded-sm font-medium">粉丝 {item.followers}</span>
                </div>
                <span className={`text-[9px] px-2 py-0.5 font-black font-mono rounded ${
                  isBull ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                  isBear ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                  "bg-muted text-muted-foreground border border-border"
                }`}>
                  {isBull ? "看多" : isBear ? "看空" : "中性"}
                </span>
              </div>
              <p className="text-[11px] text-foreground/80 leading-relaxed font-sans">{item.content}</p>
              
              <div className="flex justify-between items-center text-[9px] text-muted-foreground/70 mt-2 font-mono">
                <span>相关: <span className="text-foreground/90 font-bold font-sans">{item.stockName}</span> ({item.code})</span>
                <span>{item.timestamp}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
