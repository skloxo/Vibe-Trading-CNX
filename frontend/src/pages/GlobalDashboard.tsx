import { useState, useEffect, useRef } from "react";
import { 
  Cpu, Terminal, Settings, Check, Lock, Unlock, Grid
} from "lucide-react";
import RGL, { Responsive } from "react-grid-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Import modular widgets
import { Watchlist } from "@/components/dashboard/Watchlist";
import { LimitUpBoard } from "@/components/dashboard/LimitUpBoard";
import { FundFlows } from "@/components/dashboard/FundFlows";
import { MarketSentiment } from "@/components/dashboard/MarketSentiment";
import { YuziMovement } from "@/components/dashboard/YuziMovement";
import { ConceptRotation } from "@/components/dashboard/ConceptRotation";
import { PopularStocks } from "@/components/dashboard/PopularStocks";
import { LonghuBang } from "@/components/dashboard/LonghuBang";
import { MobileAlerts } from "@/components/dashboard/MobileAlerts";
import { Portfolio } from "@/components/dashboard/Portfolio";
import { KolOpinions } from "@/components/dashboard/KolOpinions";

// Import new premium components
import { EChartsRelationGraph } from "@/components/dashboard/EChartsRelationGraph";
import { ReActTimeline } from "@/components/dashboard/ReActTimeline";
import { AgentChatConsole } from "@/components/dashboard/AgentChatConsole";

const ResponsiveGridLayout = (RGL as any).WidthProvider(Responsive);

interface TerminalLog {
  time: string;
  sender: string;
  type: "info" | "action" | "warning" | "success";
  message: string;
}

const DEFAULT_LAYOUTS = {
  lg: [
    { i: "watchlist", x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: "limitUp", x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: "yuzi", x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: "popular", x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    
    { i: "sentiment", x: 0, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    { i: "fundFlows", x: 3, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    { i: "concepts", x: 6, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    { i: "longhu", x: 9, y: 4, w: 3, h: 3, minW: 2, minH: 2 },

    { i: "d3Graph", x: 0, y: 7, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "agentConsole", x: 6, y: 7, w: 6, h: 5, minW: 4, minH: 4 },

    { i: "lattice", x: 0, y: 12, w: 6, h: 4, minW: 3, minH: 3 },
    { i: "kol", x: 6, y: 12, w: 6, h: 4, minW: 3, minH: 3 },

    { i: "alerts", x: 0, y: 16, w: 3, h: 4, minW: 2, minH: 3 },
    { i: "portfolio", x: 3, y: 16, w: 3, h: 4, minW: 2, minH: 3 },
    { i: "logsTerminal", x: 0, y: 20, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "reactTimeline", x: 6, y: 16, w: 6, h: 9, minW: 4, minH: 4 },
  ]
};

export function GlobalDashboard() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [simProgress, setSimProgress] = useState(78);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // View Mode: Global vs Personal
  const [viewMode, setViewMode] = useState<"global" | "personal">("global");

  // Tenant-based layout customization
  const [currentTenant, setCurrentTenant] = useState<string>("tenant_c");
  const [showConfig, setShowConfig] = useState(false);
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);

  // Load layouts from localStorage if available
  const [layouts, setLayouts] = useState(() => {
    const saved = localStorage.getItem("vibe-dashboard-layout");
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUTS;
  });

  // Map of tenant roles to allowed widgets
  const TENANT_WIDGETS: Record<string, string[]> = {
    tenant_a: ["watchlist", "sentiment", "concepts", "popular", "kol", "logsTerminal", "reactTimeline"],
    tenant_b: ["watchlist", "limitUp", "fundFlows", "sentiment", "d3Graph", "lattice", "logsTerminal", "reactTimeline"],
    tenant_c: [
      "watchlist", "limitUp", "fundFlows", "sentiment", "d3Graph", "lattice",
      "yuzi", "concepts", "popular", "longhu", "logsTerminal", "reactTimeline",
      "agentConsole", "kol", "alerts", "portfolio"
    ],
  };

  const isWidgetAllowed = (id: string) => {
    const allowed = TENANT_WIDGETS[currentTenant] || [];
    return allowed.includes(id);
  };

  const [enabledWidgets, setEnabledWidgets] = useState<Record<string, boolean>>({
    watchlist: true,
    limitUp: true,
    fundFlows: true,
    sentiment: true,
    d3Graph: true,
    lattice: true,
    yuzi: true,
    concepts: true,
    popular: true,
    longhu: true,
    logsTerminal: true,
    reactTimeline: true,
    agentConsole: true,
    kol: true,
    alerts: true,
    portfolio: true,
  });

  const handleLayoutChange = (_currentLayout: any, allLayouts: any) => {
    if (!isLayoutLocked) {
      setLayouts(allLayouts);
      localStorage.setItem("vibe-dashboard-layout", JSON.stringify(allLayouts));
    }
  };

  // Clock Update effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("zh-CN", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Mock logs population effect
  useEffect(() => {
    const mockLogs: TerminalLog[] = [
      { time: "09:30:05", sender: "System", type: "info", message: "A股集合竞价结束，上证指数开盘 3,025.14 (+0.12%)，创业板指 (+0.35%)。" },
      { time: "09:31:12", sender: "FundTracker", type: "info", message: "主力资金净流入超 5000 万板块：低空经济、半导体概念。" },
      { time: "09:35:40", sender: "SentimentAnalyst", type: "action", message: "多空博弈系数升至 1.89，短线情绪处于活跃偏强区间。" },
      { time: "09:38:15", sender: "SwarmConductor", type: "warning", message: "游资·游侠与北向资金在宁德时代有分歧，呈现买一卖一博弈态势。" },
      { time: "09:42:02", sender: "System", type: "success", message: "万丰奥威连板突破，涨停概率升高至 88%，封单量 12.8 万手。" },
    ];
    setLogs(mockLogs);

    if (!isPlaying) return;

    const interval = setInterval(() => {
      const senders = ["SentimentAnalyst", "FundTracker", "SwarmConductor", "System"];
      const messages = [
        "低空经济指数大涨 4.2%，概念股大面积飘红，领涨龙头万丰奥威已封板。",
        "AI算力芯片板块今日净流入达 1.25 亿元，工业富联呈现拉升行情。",
        "碳酸锂期货主力合约下跌 4.5%，相关下游储能企业成本迎来改善预期。",
        "北向资金净流入额已超 15.6 亿元，重点扫货宁德时代、比亚迪。"
      ];
      const types: TerminalLog["type"][] = ["info", "action", "warning", "success"];
      const randomIdx = Math.floor(Math.random() * messages.length);
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString("zh-CN", { hour12: false });
      
      setLogs((prev) => [
        ...prev.slice(-25), // Keep last 30 logs
        {
          time: timeStr,
          sender: senders[Math.floor(Math.random() * senders.length)],
          type: types[Math.floor(Math.random() * types.length)],
          message: messages[randomIdx]
        }
      ]);

      setSimProgress((prev) => {
        const next = prev + 1;
        return next > 100 ? 0 : next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col min-h-screen bg-[#07070c] text-slate-200 overflow-x-hidden font-sans">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-center px-4 py-3 bg-[#0d0d15] border-b border-slate-200 dark:border-[#1a1a2e] gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-7.5 w-7.5 items-center justify-center bg-rose-600/10 border border-rose-500/20 text-rose-500 rounded">
            <Cpu className="h-4.5 w-4.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider uppercase">OASIS QUANT STATION</h1>
            <p className="text-[9px] text-slate-400 font-mono tracking-widest">REAL-TIME MULTI-AGENT BOARDS</p>
          </div>
        </div>

        {/* View and layout controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 dark:bg-[#12121e] border border-slate-200 dark:border-[#222233] p-0.5 rounded flex gap-1 text-[10px]">
            <button
              onClick={() => setViewMode("global")}
              className={`px-3 py-1 rounded transition-colors ${
                viewMode === "global" 
                  ? "bg-rose-600 dark:bg-[#ff3366] text-white font-bold" 
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              全局共享大屏
            </button>
            <button
              onClick={() => setViewMode("personal")}
              className={`px-3 py-1 rounded transition-colors ${
                viewMode === "personal" 
                  ? "bg-rose-600 dark:bg-[#ff3366] text-white font-bold" 
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              租户独立看板
            </button>
          </div>

          {/* Simulation Play/Pause Toggle */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-bold border transition-colors ${
              isPlaying
                ? "bg-rose-600/10 border-rose-500/30 text-rose-500 hover:bg-rose-650/20"
                : "bg-slate-100 dark:bg-[#12121e] border-slate-200 dark:border-[#222233] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a1a2e]"
            }`}
          >
            {isPlaying ? "⏸️ 仿真运行中" : "▶️ 仿真已暂停"}
          </button>

          {/* Simulation Progress bar */}
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span>仿真进度:</span>
            <div className="w-16 bg-slate-200 dark:bg-[#1f1f2e] h-1.5 rounded overflow-hidden">
              <div className="bg-[#00e5ff] h-full transition-all duration-300" style={{ width: `${simProgress}%` }} />
            </div>
            <span>{simProgress}%</span>
          </div>

          {/* Grid Layout Lock/Unlock Toggle */}
          <button
            onClick={() => setIsLayoutLocked(!isLayoutLocked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold border transition-colors ${
              isLayoutLocked
                ? "bg-slate-100 dark:bg-[#12121e] border-slate-200 dark:border-[#222233] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a1a2e]"
                : "bg-amber-600/10 border-amber-500/30 text-amber-500 hover:bg-amber-650/20"
            }`}
          >
            {isLayoutLocked ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                布局锁定
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5" />
                解锁编辑
              </>
            )}
          </button>

          {/* Role select */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono">租户角色:</span>
            <select
              value={currentTenant}
              onChange={(e) => setCurrentTenant(e.target.value)}
              className="text-[10px] bg-slate-100 dark:bg-[#12121e] border border-slate-200 dark:border-[#222233] rounded px-2.5 py-1 text-slate-700 dark:text-slate-350 focus:outline-none"
            >
              <option value="tenant_a">租户A (仅题材监控)</option>
              <option value="tenant_b">租户B (量化交易面板)</option>
              <option value="tenant_c">租户C (超级管理员)</option>
            </select>
          </div>

          {/* Layout config toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 bg-slate-100 dark:bg-[#12121e] border border-slate-200 dark:border-[#222233] rounded text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Time display */}
          <div className="text-xs font-mono bg-slate-100 dark:bg-[#12121e] px-3 py-1 rounded border border-slate-200 dark:border-[#222233] text-slate-650 dark:text-slate-400">
            ⏰ {currentTime || "--:--:--"}
          </div>
        </div>
      </header>

      {/* COMPONENT TOGGLES CONFIG POPUP */}
      {showConfig && (
        <div className="mx-4 mt-3 bg-[#0d0d15] border border-slate-200 dark:border-[#222233] p-3 text-xs rounded shadow-lg animate-in fade-in duration-250 z-50">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#222233] pb-2 mb-3">
            <span className="font-black text-rose-600 dark:text-[#ff3366] tracking-wider">🛠️ 仪表盘组件状态配置</span>
            <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {Object.keys(enabledWidgets).map((id) => {
              const allowed = isWidgetAllowed(id);
              return (
                <button
                  key={id}
                  disabled={!allowed}
                  onClick={() => setEnabledWidgets(prev => ({ ...prev, [id]: !prev[id] }))}
                  className={`flex items-center justify-between p-2.5 rounded border transition-colors ${
                    !allowed 
                      ? "opacity-35 cursor-not-allowed border-slate-200 bg-slate-50 dark:border-slate-855 dark:bg-slate-900 text-slate-400 dark:text-slate-650" 
                      : enabledWidgets[id]
                      ? "border-rose-500/40 bg-rose-600/10 text-rose-500 dark:text-[#ff3366] font-bold"
                      : "border-slate-200 bg-white dark:border-[#222233] dark:bg-[#12121e] hover:border-slate-400 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <span className="capitalize">{id === "d3Graph" ? "ECharts图谱" : id}</span>
                  {enabledWidgets[id] && allowed && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DASHBOARD CONTENT GRID */}
      <div className="flex-1 p-4 overflow-y-auto">
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={75}
          isDraggable={!isLayoutLocked}
          isResizable={!isLayoutLocked}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          margin={[16, 16]}
        >
          {/* Watchlist widget */}
          {enabledWidgets.watchlist && isWidgetAllowed("watchlist") && (
            <div key="watchlist" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <Watchlist />
            </div>
          )}

          {/* LimitUpBoard widget */}
          {enabledWidgets.limitUp && isWidgetAllowed("limitUp") && (
            <div key="limitUp" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <LimitUpBoard />
            </div>
          )}

          {/* YuziMovement widget */}
          {enabledWidgets.yuzi && isWidgetAllowed("yuzi") && (
            <div key="yuzi" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <YuziMovement />
            </div>
          )}

          {/* PopularStocks widget */}
          {enabledWidgets.popular && isWidgetAllowed("popular") && (
            <div key="popular" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <PopularStocks />
            </div>
          )}

          {/* MarketSentiment widget */}
          {enabledWidgets.sentiment && isWidgetAllowed("sentiment") && (
            <div key="sentiment" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <MarketSentiment />
            </div>
          )}

          {/* FundFlows widget */}
          {enabledWidgets.fundFlows && isWidgetAllowed("fundFlows") && (
            <div key="fundFlows" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <FundFlows />
            </div>
          )}

          {/* ConceptRotation widget */}
          {enabledWidgets.concepts && isWidgetAllowed("concepts") && (
            <div key="concepts" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <ConceptRotation />
            </div>
          )}

          {/* LonghuBang widget */}
          {enabledWidgets.longhu && isWidgetAllowed("longhu") && (
            <div key="longhu" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <LonghuBang />
            </div>
          )}

          {/* ECharts Relation Graph widget */}
          {enabledWidgets.d3Graph && isWidgetAllowed("d3Graph") && (
            <div key="d3Graph" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none flex flex-col p-3">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center shrink-0 mb-1"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#222233] pb-1.5 mb-1.5 shrink-0">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-rose-600 dark:text-[#ff3366]" />
                  ECharts 关系拓扑图谱 · 产业链关联网络 (FORCE GRAPH)
                </span>
                <span className="text-[8px] bg-emerald-50 dark:bg-[#00ff88]/10 text-emerald-650 dark:text-[#00ff88] border border-emerald-300 dark:border-[#00ff88]/30 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                  Live Stream
                </span>
              </div>
              <div className="flex-1 min-h-0 relative">
                <EChartsRelationGraph onSelectNode={setActiveNode} activeNode={activeNode} />
                {activeNode && (
                  <div className="absolute bottom-3 left-3 right-3 bg-white/95 dark:bg-[#0d0d15]/95 border border-slate-250 dark:border-[#333344] p-3 text-xs flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200 text-slate-800 dark:text-slate-350 shadow-lg rounded">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#222233] pb-1">
                      <span className="font-bold text-rose-600 dark:text-[#ff3366] text-sm">
                        {activeNode === "low-alt" ? "题材: 低空经济" :
                         activeNode === "ai-count" ? "题材: AI算力" :
                         activeNode === "wanfeng" ? "个股: 万丰奥威 (301550)" :
                         activeNode === "ningde" ? "个股: 宁德时代 (300750)" :
                         activeNode === "byd" ? "个股: 比亚迪 (002594)" :
                         activeNode === "fulan" ? "个股: 工业富联 (601138)" :
                         activeNode === "yuzi" ? "智能体: 游资·游侠" : "智能体: 北向资金"}
                      </span>
                      <button onClick={() => setActiveNode(null)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-650 dark:text-slate-400">
                      <div>关联强度: <span className="text-slate-900 dark:text-white font-bold">HIGH (0.89)</span></div>
                      <div>大单追踪: <span className="text-rose-600 dark:text-[#ff3366] font-bold">主买流入+1.2亿</span></div>
                      <div>热点强度: <span className="text-amber-600 dark:text-[#e5a93c] font-bold">98 (极强)</span></div>
                      <div>博弈倾向: <span className="text-[#00abc0] dark:text-[#00e5ff] font-bold">持续做多</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agent Chat Console widget */}
          {enabledWidgets.agentConsole && isWidgetAllowed("agentConsole") && (
            <div key="agentConsole" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <AgentChatConsole />
            </div>
          )}

          {/* Probability Lattice widget */}
          {enabledWidgets.lattice && isWidgetAllowed("lattice") && (
            <div key="lattice" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none p-3 flex flex-col gap-2">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">📈 概率格子 · 涨停突破概率分布 (PROBABILITY LATTICE)</span>
              <div className="flex-1 flex flex-col gap-2 bg-slate-50 dark:bg-[#09090f] p-4 rounded relative border border-slate-100 dark:border-[#1f1f2e] min-h-[120px]">
                <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[8px] text-slate-500 font-bold">
                  <span className="inline-block w-2 h-2 bg-rose-600 dark:bg-[#ff3366] rounded-full" /> 涨停成功
                  <span className="inline-block w-2 h-2 bg-emerald-600 dark:bg-[#00ff88] rounded-full" /> 炸板回落
                </div>

                <div className="flex flex-col items-center gap-2 py-2 border-b border-slate-200 dark:border-[#222233]/40">
                  <div className="flex gap-6 text-slate-500 dark:text-slate-650 text-[10px]">
                    <span>1 阶</span><span>2 阶</span><span>3 阶</span><span>4 阶</span><span>5 阶</span>
                  </div>
                  <div className="flex gap-4">
                    {[...Array(9)].map((_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                    ))}
                  </div>
                  <div className="flex gap-4 px-2">
                    {[...Array(8)].map((_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                    ))}
                  </div>
                  <div className="flex gap-4">
                    {[...Array(9)].map((_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                    ))}
                  </div>
                </div>

                <div className="h-20 flex items-end gap-1.5 pt-2">
                  {[12, 18, 35, 65, 88, 75, 50, 30, 15, 8].map((h, i) => {
                    const isHigh = h > 40;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className={`w-full transition-all duration-500 ${isHigh ? "bg-rose-600 dark:bg-[#ff3366]" : "bg-emerald-600 dark:bg-[#00ff88]"}`}
                          style={{ height: `${h}%`, minHeight: "2px" }}
                        />
                        <span className="text-[7px] text-slate-500 dark:text-slate-600 font-bold">{i * 10}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* KolOpinions widget */}
          {enabledWidgets.kol && isWidgetAllowed("kol") && (
            <div key="kol" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <KolOpinions />
            </div>
          )}

          {/* MobileAlerts widget */}
          {enabledWidgets.alerts && isWidgetAllowed("alerts") && (
            <div key="alerts" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <MobileAlerts />
            </div>
          )}

          {/* Portfolio widget */}
          {enabledWidgets.portfolio && isWidgetAllowed("portfolio") && (
            <div key="portfolio" className="bg-[#10101a]/80 border border-slate-200 dark:border-[#222233] rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <Portfolio />
            </div>
          )}

          {/* Simulation logs terminal widget */}
          {enabledWidgets.logsTerminal && isWidgetAllowed("logsTerminal") && (
            <div key="logsTerminal" className="bg-[#06060c] border border-slate-200 dark:border-[#222233] rounded overflow-hidden flex flex-col shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center shrink-0"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <div className="border-b border-[#222233] px-3 py-2 flex justify-between items-center bg-[#12121e] shrink-0">
                <span className="text-xs font-bold text-slate-350 dark:text-slate-300 flex items-center gap-1.5 font-mono">
                  <Terminal className="h-3.5 w-3.5 text-rose-600 dark:text-[#ff3366]" />
                  OASIS 实时仿真终端 (MONITOR)
                </span>
                <span className="text-[8px] bg-rose-50 dark:bg-[#ff3366]/20 border border-rose-250 dark:border-[#ff3366]/30 text-rose-650 dark:text-[#ff3366] px-1 py-0.2 font-bold animate-pulse">
                  SIMULATING
                </span>
              </div>
              
              <div 
                ref={logsContainerRef}
                className="flex-1 bg-[#06060c] p-2.5 overflow-y-auto text-[10px] font-mono leading-relaxed space-y-2 border-b border-[#222233]"
              >
                {logs.map((log, idx) => {
                  let color = "text-slate-400";
                  if (log.type === "action") color = "text-[#00e5ff]";
                  if (log.type === "success") color = "text-[#ff3366]";
                  if (log.type === "warning") color = "text-amber-500";
                  return (
                    <div key={idx} className="border-l-2 border-[#1f1f2e] pl-1.5">
                      <div className="flex justify-between text-[8px] text-slate-650 mb-0.5">
                        <span>[{log.time}] {log.sender}</span>
                      </div>
                      <p className={`${color} break-all font-mono`}>{log.message}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 text-[9px] text-slate-450 bg-[#12121e] p-2 text-center border-t border-[#1a1a2e] shrink-0">
                <div>节点: <span className="text-white font-bold">341</span></div>
                <div>关系链: <span className="text-white font-bold">1,766</span></div>
                <div>智能体: <span className="text-[#00e5ff] font-bold">55</span></div>
              </div>
            </div>
          )}

          {/* ReACT Thinking Timeline Panel */}
          {enabledWidgets.reactTimeline && isWidgetAllowed("reactTimeline") && (
            <div key="reactTimeline" className="bg-[#10101a]/80 rounded overflow-hidden shadow-sm dark:shadow-none">
              {!isLayoutLocked && <div className="drag-handle h-4 bg-slate-200 dark:bg-[#1a1a2e] cursor-move flex items-center justify-center"><Grid className="h-3 w-3 text-slate-400" /></div>}
              <ReActTimeline />
            </div>
          )}

        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
