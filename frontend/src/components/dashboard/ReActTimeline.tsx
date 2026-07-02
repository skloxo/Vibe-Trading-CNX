import { useEffect, useState } from "react";
import { Cpu, Terminal, Eye, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import { useTranslation } from "react-i18next";

interface TimelineStep {
  id: number | string;
  type: "THOUGHT" | "ACTION" | "OBSERVATION" | "DECISION";
  content: string;
  status: "running" | "success" | "pending" | "error";
  timestamp?: string;
}

const DEFAULT_STEPS: TimelineStep[] = [
  {
    id: 1,
    type: "THOUGHT",
    content: "目前板块资金集中度异常升高，低空航空龙头万丰奥威连板突破。需校验锂电池上游碳酸锂期货价格走势对其采购成本的边际改善情况。",
    status: "success",
  },
  {
    id: 2,
    type: "ACTION",
    content: "调用 API 网关检索 Zep 图谱检索工具: `InsightForge.query_graph(\"lithium carbonate futures\")` 进行关联映射。",
    status: "success",
  },
  {
    id: 3,
    type: "OBSERVATION",
    content: "返回关联强度 -0.85 (强负相关)。碳酸锂主力合约下跌4.5%，证实万丰奥威等电池产业链下游企业成本红利空间增大。",
    status: "success",
  },
  {
    id: 4,
    type: "DECISION",
    content: "成本压力减轻 + 资金高频流入 -> 调高万丰奥威与宁德时代今日突破概率至 85%，发布看多选股评级。",
    status: "running",
  },
];

export function ReActTimeline() {
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    const parseLogLine = (logEntry: any) => {
      let type: TimelineStep["type"] = "THOUGHT";
      let content = "";
      
      if (logEntry.action === "thought") {
        type = "THOUGHT";
        content = logEntry.details?.thought || "";
      } else if (logEntry.action === "tool_call") {
        type = "ACTION";
        const argsStr = JSON.stringify(logEntry.details?.tool_args || {});
        content = `调用工具: \`${logEntry.details?.tool_name}\` 参数: ${argsStr}`;
      } else if (logEntry.action === "observation") {
        type = "OBSERVATION";
        content = `监测结果: ${logEntry.details?.observation || ""}`;
      } else if (logEntry.action === "decision") {
        type = "DECISION";
        content = logEntry.details?.text || "";
      }

      return {
        id: logEntry.elapsed_seconds || Date.now(),
        type,
        content,
        status: logEntry.action === "decision" ? "success" : "success" as any,
        timestamp: logEntry.timestamp ? new Date(logEntry.timestamp).toLocaleTimeString() : undefined
      };
    };

    const startSSE = () => {
      try {
        eventSource = new EventSource(api.getDashboardReactLogsStreamUrl());
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const newStep = parseLogLine(data);
            setSteps((prev) => {
              // Deduplicate steps by content
              if (prev.some((s) => s.content === newStep.content)) return prev;
              const updated = prev.map((s) => s.status === "running" ? { ...s, status: "success" as const } : s);
              return [...updated, newStep];
            });
          } catch (e) {
            console.error("Failed to parse SSE line:", e);
          }
        };

        eventSource.onerror = (err) => {
          console.warn("EventSource SSE error, falling back to JSON polling:", err);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          startPolling();
        };
      } catch (err) {
        console.warn("Failed to instantiate EventSource, falling back to JSON polling:", err);
        startPolling();
      }
    };

    const startPolling = () => {
      if (pollInterval) return; // Prevent multiple intervals
      const poll = async () => {
        try {
          const res = await api.getDashboardReactLogs();
          if (res && res.length > 0) {
            const formatted = res.map((log: any, idx: number) => {
              const step = parseLogLine(log);
              step.id = idx + 1;
              return step;
            });
            // Mark the last step as running if it's not a decision yet
            if (formatted.length > 0) {
              const last = formatted[formatted.length - 1];
              if (last.type !== "DECISION") {
                last.status = "running";
              }
            }
            setSteps(formatted);
          }
        } catch (err) {
          console.error("Polling ReACT logs failed:", err);
        }
      };
      poll();
      pollInterval = setInterval(poll, 3000);
    };

    startSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  const displaySteps = steps.length > 0 ? steps : DEFAULT_STEPS;

  const getBadgeStyles = (type: TimelineStep["type"], status: TimelineStep["status"]) => {
    let base = "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ";
    if (status === "running") {
      base += "animate-pulse ";
    }
    
    switch (type) {
      case "THOUGHT":
        return base + "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-[#ff3366] border border-rose-300 dark:border-rose-900/50";
      case "ACTION":
        return base + "bg-cyan-100 text-cyan-600 dark:bg-cyan-950/40 dark:text-[#00e5ff] border border-cyan-300 dark:border-cyan-900/50";
      case "OBSERVATION":
        return base + "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-[#00ff88] border border-emerald-300 dark:border-emerald-900/50";
      case "DECISION":
        return base + "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-[#e5a93c] border border-amber-300 dark:border-amber-900/50";
    }
  };

  const getIndicatorStyles = (status: TimelineStep["status"]) => {
    switch (status) {
      case "running":
        return "bg-rose-600 dark:bg-[#ff3366] ring-4 ring-rose-500/30 animate-pulse";
      case "success":
        return "bg-emerald-500 dark:bg-[#00ff88]";
      case "error":
        return "bg-red-500 dark:bg-red-600";
      default:
        return "bg-slate-300 dark:bg-slate-700";
    }
  };

  const getIcon = (type: TimelineStep["type"]) => {
    const size = "h-3 w-3";
    switch (type) {
      case "THOUGHT":
        return <Cpu className={size} />;
      case "ACTION":
        return <Terminal className={size} />;
      case "OBSERVATION":
        return <Eye className={size} />;
      case "DECISION":
        return <AlertCircle className={size} />;
    }
  };

  return (
    <div className="p-3.5 flex flex-col gap-2 h-full w-full shrink-0">
      <span className="text-[11px] font-black tracking-wider text-muted-foreground uppercase flex items-center gap-1.5 border-b border-border/60 pb-1.5 shrink-0">
        <Cpu className="h-3.5 w-3.5 text-rose-600 dark:text-[#ff3366]" />
        AI {isEn ? "ReACT Decision Timeline" : "研报 ReACT 思考时间轴"}
      </span>
      
      <div className="text-[10px] space-y-4 relative pl-5 border-l border-slate-200 dark:border-[#222233]/80 py-1.5 ml-2">
        {displaySteps.map((step, idx) => (
          <div key={step.id} className="relative flex flex-col gap-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
            {/* Timeline node dot */}
            <span className={`absolute -left-[26px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-[#10101a] flex items-center justify-center text-[7px] text-white font-extrabold ${getIndicatorStyles(step.status)}`}>
              {idx + 1}
            </span>
            
            <div className="flex items-center gap-2">
              <span className="text-slate-405 dark:text-slate-500">{getIcon(step.type)}</span>
              <span className={getBadgeStyles(step.type, step.status)}>{step.type}</span>
              {step.timestamp && (
                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-mono ml-auto">
                  {step.timestamp}
                </span>
              )}
            </div>
            
            <p className={`font-mono leading-relaxed p-1.5 rounded text-slate-650 dark:text-slate-400 ${
              step.type === "DECISION" 
                ? "bg-amber-500/5 border border-amber-500/20 text-rose-600 dark:text-[#ff3366] font-bold" 
                : "bg-slate-500/5"
            }`}>
              {step.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
