import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, CheckCircle } from "lucide-react";

interface AlertItem {
  time: string;
  stockName: string;
  code: string;
  type: "breakout" | "volume" | "warning";
  message: string;
}

interface MobileAlertsProps {
  data?: AlertItem[];
}

export function MobileAlerts({ data }: MobileAlertsProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const fallbackAlerts: AlertItem[] = [
    { time: "14:28:12", stockName: "万丰奥威", code: "301550", type: "breakout", message: "突破 5 日高点压力位 16.10 元" },
    { time: "14:27:04", stockName: "宁德时代", code: "300750", type: "volume", message: "盘中出现机构大单主买成交 1.5 亿" },
    { time: "14:25:30", stockName: "大盘情绪", code: "INDEX", type: "warning", message: "情绪温度冲高回落至 82%，防范炸板风险" },
    { time: "14:22:15", stockName: "工业富联", code: "601138", type: "breakout", message: "封板率突破 90%，买单挂盘超 12 万手" }
  ];

  const alerts = data && data.length > 0 ? data : fallbackAlerts;

  return (
    <div className="border border-border/80 bg-card/90 backdrop-blur-md p-4.5 flex flex-col gap-3 h-full rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/5">
      <div className="flex justify-between items-center border-b border-border/60 pb-2">
        <span className="text-[11px] font-black tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
          🚨 {isEn ? "High-Freq Alerts" : "盘中高频移动监控预警"}
        </span>
      </div>

      <div className="space-y-2 flex-1 overflow-auto">
        {alerts.map((alert, idx) => {
          return (
            <div key={idx} className="flex gap-2.5 text-xs border-b border-border/30 py-2 px-1 hover:bg-muted/40 transition-all duration-300 hover:translate-x-1.5 rounded-md last:border-0 last:pb-0">
              <div className="mt-0.5 shrink-0">
                {alert.type === "breakout" ? (
                  <CheckCircle className="h-4 w-4 text-rose-500 animate-pulse" />
                ) : alert.type === "volume" ? (
                  <Info className="h-4 w-4 text-[#00e5ff]" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>

              <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                  <span className="font-bold">{alert.stockName} ({alert.code})</span>
                  <span>{alert.time}</span>
                </div>
                <p className="text-foreground/90 font-medium text-[11px] leading-relaxed truncate font-sans">{alert.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
