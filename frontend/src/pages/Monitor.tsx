import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api, type MonitorStats, type LogEntry } from "@/lib/api";
import { Activity, Server, Database, FolderHeart, RefreshCw, Search, Terminal, Play, Pause } from "lucide-react";

export function Monitor() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === "zh-CN";

  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [level, setLevel] = useState<string>("");
  const [limit, setLimit] = useState<number>(100);
  const [keyword, setKeyword] = useState<string>("");
  const [refreshInterval, setRefreshInterval] = useState<number>(5000); // Default 5s
  const [paused, setPaused] = useState<boolean>(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  const fetchStats = async () => {
    try {
      const data = await api.getMonitorStats();
      setStats(data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch monitor stats:", err);
      setError(err?.message || "Failed to fetch stats");
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (paused) return;
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

  // Initial load and periodic stats refresh
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Stats refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // Fetch logs whenever filters change or on periodic interval
  useEffect(() => {
    fetchLogs();
  }, [limit, level, keyword, paused]);

  useEffect(() => {
    if (refreshInterval <= 0 || paused) return;
    const interval = setInterval(fetchLogs, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, limit, level, keyword, paused]);

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Title */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4 border-border/60">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isZh ? "服务监控与日志" : "Service Monitor & Logs"}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {isZh
              ? "实时监控进程资源占用、租户接入情况及系统运行日志。"
              : "Monitor running processes, active tenants, and system runtime logs in real-time."}
          </p>
        </div>
        <button
          onClick={() => {
            fetchStats();
            fetchLogs();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border/80 bg-background hover:bg-muted transition text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {isZh ? "刷新" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Grid of Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Memory Usage */}
        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {isZh ? "内存占用" : "Memory Usage"}
            </span>
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : `${stats?.memory_usage_mb.toFixed(1) || "0.0"} MB`}
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: stats ? `${Math.min((stats.memory_usage_mb / 1024) * 100, 100)}%` : "0%" }}
              />
            </div>
          </div>
        </div>

        {/* Active Tenants */}
        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {isZh ? "有效租户" : "Active Tenants"}
            </span>
            <Activity className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.active_tenants.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isZh ? "已注册并分配密钥的租户" : "Registered tenants with API keys"}
            </p>
          </div>
        </div>

        {/* Total Sessions */}
        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {isZh ? "总会话数" : "Total Sessions"}
            </span>
            <FolderHeart className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.total_sessions || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isZh ? "沙箱对话持久化目录数" : "Number of sandbox session directories"}
            </p>
          </div>
        </div>

        {/* Total Runs */}
        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {isZh ? "执行记录" : "Strategy Runs"}
            </span>
            <Database className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.total_runs || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isZh ? "量化执行与回测历史记录" : "Quantitative strategy & backtest history"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        {/* Logs terminal section */}
        <div className="rounded-lg border bg-card shadow-sm flex flex-col min-h-[500px]">
          {/* Logs Control Bar */}
          <div className="border-b p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/40">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{isZh ? "实时运行日志" : "System Runtime Logs"}</span>
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
                <option value={10000}>10s {isZh ? "刷新" : "Refresh"}</option>
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
          <div className="flex-1 p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-auto h-[400px] rounded-b-lg">
            {logsLoading && logs.length === 0 ? (
              <div className="text-muted-foreground animate-pulse text-center py-10">
                {isZh ? "正在连接并加载日志数据..." : "Connecting and fetching log stream..."}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-10">
                {isZh ? "未检测到符合条件的运行日志" : "No logs found matching criteria"}
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

        {/* Active Tenants List Card */}
        <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {isZh ? "注册租户列表" : "Active Tenants Directory"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isZh ? "当前多租户沙箱中所有已激活的子租户详情。" : "Overview of all active client tenants in this instance."}
            </p>
          </div>

          <div className="flex-1 overflow-auto max-h-[400px]">
            {statsLoading ? (
              <div className="space-y-3 mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-muted/60 animate-pulse rounded-md" />
                ))}
              </div>
            ) : !stats || stats.active_tenants.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">
                {isZh ? "暂无注册的有效子租户" : "No active tenants registered"}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {stats.active_tenants.map((tenant) => (
                  <div key={tenant.tenant_id} className="py-3 flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="font-semibold text-foreground">{tenant.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{tenant.tenant_id}</div>
                    </div>
                    <div className="text-right space-y-1 shrink-0">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                        {isZh ? "已激活" : "Active"}
                      </span>
                      <div className="text-[9px] text-muted-foreground">
                        {tenant.created_at ? tenant.created_at.slice(0, 10) : "-"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
