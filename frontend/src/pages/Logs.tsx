import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api, type LogEntry, type UserProfile } from "@/lib/api";
import { RefreshCw, Search, Terminal, Play, Pause, AlertTriangle, ShieldAlert } from "lucide-react";

export function Logs() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === "zh-CN";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Filter States
  const [level, setLevel] = useState<string>("WARNING"); // 默认只展示警告以上
  const [limit, setLimit] = useState<number>(100);
  const [keyword, setKeyword] = useState<string>("");
  const [refreshInterval, setRefreshInterval] = useState<number>(5000); // 默认5s
  const [paused, setPaused] = useState<boolean>(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    api.getSettingsProfile()
      .then((p) => {
        if (alive) {
          setProfile(p);
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (alive) setAuthLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const fetchLogs = async () => {
    if (paused || authLoading || !profile?.is_local) return;
    try {
      setLogsLoading(true);
      const data = await api.getMonitorLogs({ limit, level, keyword });
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch logs whenever filters change or on periodic interval
  useEffect(() => {
    if (!authLoading && profile?.is_local) {
      fetchLogs();
    }
  }, [limit, level, keyword, paused, authLoading, profile]);

  useEffect(() => {
    if (refreshInterval <= 0 || paused || authLoading || !profile?.is_local) return;
    const interval = setInterval(fetchLogs, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, limit, level, keyword, paused, authLoading, profile]);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const getLogLevelClass = (lvl: string) => {
    switch (lvl.toUpperCase()) {
      case "ERROR":
      case "CRITICAL":
        return "text-red-400 font-semibold";
      case "WARNING":
        return "text-yellow-400 font-semibold";
      case "INFO":
        return "text-green-400";
      case "DEBUG":
        return "text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground animate-pulse">
        {isZh ? "正在验证访问权限..." : "Verifying access permissions..."}
      </div>
    );
  }

  // 阻断非本地访问
  if (!profile?.is_local) {
    return (
      <div className="mx-auto max-w-md w-full p-8 mt-20 text-center space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 shadow-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            {isZh ? "访问受限" : "Access Denied"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isZh 
              ? "系统实时运行日志属于高敏感度调试信息，仅限本地环回或内网调试环境访问。"
              : "System runtime logs contain highly sensitive debug info. Access is restricted to local/internal debug mode only."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Title */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4 border-border/60">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isZh ? "系统运行日志" : "System Runtime Logs"}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {isZh
              ? "实时检索和诊断量化工作站后台进程输出的诊断与错误日志。"
              : "Search and diagnose quantitative trading station backend logs in real-time."}
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border/80 bg-background hover:bg-muted transition text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {isZh ? "刷新" : "Refresh"}
        </button>
      </div>

      {/* Logs terminal section */}
      <div className="rounded-lg border bg-card shadow-sm flex flex-col min-h-[600px]">
        {/* Logs Control Bar */}
        <div className="border-b p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/40">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{isZh ? "实时运行日志终端" : "Live Log Terminal"}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Keyword Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={isZh ? "搜索日志内容..." : "Search logs..."}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-8 pr-2 py-1 text-xs rounded-md border border-border/80 bg-background outline-none w-36 focus:w-48 transition-all"
              />
            </div>

            {/* Log Level Select */}
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="px-2 py-1 text-xs rounded-md border border-border/80 bg-background outline-none"
            >
              <option value="">{isZh ? "所有日志级别" : "All Levels"}</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>

            {/* Log Limit Select */}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded-md border border-border/80 bg-background outline-none"
            >
              <option value={50}>50 {isZh ? "条" : "logs"}</option>
              <option value={100}>100 {isZh ? "条" : "logs"}</option>
              <option value={200}>200 {isZh ? "条" : "logs"}</option>
              <option value={500}>500 {isZh ? "条" : "logs"}</option>
            </select>

            {/* Refresh Interval */}
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded-md border border-border/80 bg-background outline-none"
              disabled={paused}
            >
              <option value={2000}>2s {isZh ? "刷新" : "Refresh"}</option>
              <option value={5000}>5s {isZh ? "刷新" : "Refresh"}</option>
              <option value={10000}>10s {isZh ? "Refresh" : "Refresh"}</option>
              <option value={0}>{isZh ? "手动刷新" : "Manual"}</option>
            </select>

            {/* Pause Toggle */}
            <button
              onClick={() => setPaused(!paused)}
              className={`p-1.5 rounded-md border text-xs font-medium transition ${
                paused
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-background border-border/85 hover:bg-muted text-foreground"
              }`}
              title={paused ? (isZh ? "继续加载" : "Resume") : (isZh ? "暂停加载" : "Pause")}
            >
              {paused ? <Play className="h-3.5 w-3.5 text-green-500" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Console Log Area */}
        <div className="flex-1 p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-auto h-[500px] rounded-b-lg">
          {logsLoading && logs.length === 0 ? (
            <div className="text-muted-foreground animate-pulse text-center py-10">
              {isZh ? "正在连接并加载日志数据..." : "Connecting and fetching log stream..."}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-muted-foreground text-center py-10 flex flex-col items-center gap-2 justify-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500/70" />
              <span>{isZh ? "未检测到符合条件的运行日志" : "No logs found matching criteria"}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="leading-relaxed hover:bg-slate-900 px-1 rounded">
                  <span className="text-slate-500 mr-2">[{log.timestamp.slice(11, 19)}]</span>
                  <span className="text-slate-400 mr-2 font-semibold">[{log.logger.split(".").pop()}]</span>
                  <span className={`mr-2 ${getLogLevelClass(log.level)}`}>[{log.level}]</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
