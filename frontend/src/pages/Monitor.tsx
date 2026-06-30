import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { api, type MonitorStats, type QuoteGatewayStatus, type TenantKey, type SystemVersionInfo } from "@/lib/api";
import { Activity, Server, Database, FolderHeart, RefreshCw, Wifi, KeyRound, Power, Trash2, ArrowUpCircle, Loader2, Copy, Check, Save, Plus } from "lucide-react";

export function Monitor() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === "zh-CN";

  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quote status states
  const [quoteStatus, setQuoteStatus] = useState<QuoteGatewayStatus | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Tenant API Keys states
  const [tenantKeys, setTenantKeys] = useState<TenantKey[]>([]);
  const [tenantKeysLoading, setTenantKeysLoading] = useState(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [tenantSaving, setTenantSaving] = useState(false);
  const [generatedKey, setGeneratedKey] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // System version & one-click upgrade states
  const [versionInfo, setVersionInfo] = useState<SystemVersionInfo | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeCountdown, setUpgradeCountdown] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const fetchQuoteStatus = async (showLoading = false, showToast = false) => {
    if (showLoading) setQuoteLoading(true);
    try {
      const data = await api.getQuoteGatewayStatus();
      setQuoteStatus(data);
      if (showToast) {
        toast.success(isZh ? "行情网关状态刷新成功" : "Quote gateway status refreshed successfully");
      }
    } catch (err) {
      console.error("Failed to fetch quote gateway status:", err);
      if (showToast) {
        toast.error(isZh ? "刷新行情网关状态失败" : "Failed to refresh quote gateway status");
      }
    } finally {
      if (showLoading) setQuoteLoading(false);
    }
  };

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

  const fetchTenantKeys = async () => {
    try {
      setTenantKeysLoading(true);
      const keys = await api.getTenantKeys();
      setTenantKeys(keys);
    } catch (err) {
      console.error("Failed to load tenant keys:", err);
    } finally {
      setTenantKeysLoading(false);
    }
  };

  const fetchVersionInfo = async (showToast = false) => {
    try {
      setVersionLoading(true);
      const info = await api.getSystemVersion();
      setVersionInfo(info);
      if (showToast) {
        if (info.has_update) {
          toast.info(isZh ? `发现新版本: ${info.latest_version}，请点击升级` : `New version available: ${info.latest_version}`);
        } else {
          toast.success(isZh ? "已是最新版本" : "System is already up to date");
        }
      }
    } catch (err) {
      console.error("Failed to load version info:", err);
      if (showToast) {
        toast.error(isZh ? "检查版本更新失败，请重试" : "Failed to check system version");
      }
    } finally {
      setVersionLoading(false);
    }
  };

  // Initial load and periodic stats/quote refresh
  useEffect(() => {
    fetchStats();
    fetchQuoteStatus(true, false);
    fetchTenantKeys();
    fetchVersionInfo(false);

    const interval = setInterval(() => {
      fetchStats();
      fetchQuoteStatus(false, false);
    }, 10000); // Stats and Quote Gateway refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for upgrade modal
  useEffect(() => {
    if (!showUpgradeModal) return;
    setUpgradeCountdown(30);
    const interval = setInterval(() => {
      setUpgradeCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showUpgradeModal]);

  const handleTriggerUpgrade = async () => {
    if (upgrading) return;
    setUpgrading(true);
    try {
      await api.triggerSystemUpdate();
      setShowUpgradeModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "升级触发失败";
      toast.error(msg);
    } finally {
      setUpgrading(false);
    }
  };

  const handleCreateTenantKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setTenantSaving(true);
    try {
      const result = await api.createTenantKey({ name: newKeyName.trim() });
      setGeneratedKey(result.key);
      setTenantKeys([...tenantKeys, result]);
      setNewKeyName("");
      toast.success("密钥生成成功");
      fetchStats(); // Refresh active tenants count
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成密钥失败");
    } finally {
      setTenantSaving(false);
    }
  };

  const handleToggleTenantKey = async (tid: string, currentActive: boolean) => {
    try {
      const updated = await api.updateTenantKey(tid, { is_active: !currentActive });
      setTenantKeys(tenantKeys.map(k => k.tenant_id === tid ? updated : k));
      toast.success("密钥状态已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改密钥状态失败");
    }
  };

  const handleDeleteTenantKey = async (tid: string) => {
    if (!window.confirm("确认删除此密钥？删除后该租户的 API 访问权限与隔离工作区将被立即彻底清除，无法撤销！")) {
      return;
    }
    try {
      await api.deleteTenantKey(tid);
      setTenantKeys(tenantKeys.filter(k => k.tenant_id !== tid));
      toast.success("密钥已成功删除");
      fetchStats(); // Refresh stats
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除密钥失败");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Title */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4 border-border/60">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isZh ? "服务配置与性能监控" : "Service Configuration & Monitor"}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {isZh
              ? "实时监控进程资源占用、租户接入密钥管控及系统升级维护。"
              : "Monitor running processes, manage tenant access credentials, and handle system updates in real-time."}
          </p>
        </div>
        <button
          onClick={async () => {
            await Promise.all([
              fetchStats(),
              fetchQuoteStatus(true, false),
              fetchTenantKeys(),
              fetchVersionInfo(false)
            ]);
            toast.success(isZh ? "监控看板数据已全部更新" : "All monitor dashboard stats updated");
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border/80 bg-background hover:bg-muted transition text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {isZh ? "刷新全部" : "Refresh All"}
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

      {/* Main Content Layout */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        {/* Left Column: Tenant API Keys Management */}
        <div className="rounded-lg border bg-card p-5 shadow-sm flex flex-col justify-between min-h-[450px]">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4.5 w-4.5 text-primary" />
                  <h2 className="text-base font-semibold">{isZh ? "租户密钥与工作区管理" : "Tenant Keys & Workspaces"}</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isZh
                    ? "生成新密钥时系统会自动创建其对应的物理隔离沙箱工作空间。"
                    : "Workspaces are physically isolated under each tenant ID automatically."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGeneratedKey("");
                  setNewKeyName("");
                  setIsTenantModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 px-3 py-1.5 text-xs font-medium transition cursor-pointer self-start sm:self-center shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                {isZh ? "生成新租户密钥" : "Generate Tenant Key"}
              </button>
            </div>

            <div className="overflow-auto max-h-[420px]">
              <table className="w-full border-collapse text-left text-xs text-muted-foreground">
                <thead>
                  <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <th className="px-3 py-2.5">{isZh ? "租户备注名称" : "Tenant Nickname"}</th>
                    <th className="px-3 py-2.5">Tenant ID</th>
                    <th className="px-3 py-2.5">{isZh ? "系统密钥" : "API Key"}</th>
                    <th className="px-3 py-2.5">{isZh ? "状态" : "Status"}</th>
                    <th className="px-3 py-2.5 text-right">{isZh ? "操作" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenantKeysLoading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          {isZh ? "正在加载租户密钥列表..." : "Loading tenant keys..."}
                        </div>
                      </td>
                    </tr>
                  ) : tenantKeys.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        {isZh
                          ? "暂无已注册租户。点击右上角“生成新租户密钥”开始接入。"
                          : "No active tenants registered. Generate key above to start."}
                      </td>
                    </tr>
                  ) : (
                    tenantKeys.map((key) => (
                      <tr key={key.tenant_id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-3 py-3 font-medium text-foreground">{key.name}</td>
                        <td className="px-3 py-3 font-mono text-[10px]">{key.tenant_id}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(key.key);
                              toast.success(isZh ? "密钥已成功复制到剪贴板" : "API key copied to clipboard");
                            }}
                            className="inline-flex items-center gap-1 rounded bg-muted/60 hover:bg-muted text-foreground px-2 py-1 text-[10px] font-medium transition cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            {isZh ? "复制密钥" : "Copy Key"}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                            key.is_active !== false
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "bg-red-500/10 text-red-500 border-red-500/20"
                          }`}>
                            {key.is_active !== false ? (isZh ? "启用" : "Active") : (isZh ? "禁用" : "Disabled")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleTenantKey(key.tenant_id, key.is_active !== false)}
                              className={`rounded p-1 transition ${
                                key.is_active !== false
                                  ? "text-yellow-500 hover:bg-yellow-500/10"
                                  : "text-green-500 hover:bg-green-500/10"
                              }`}
                              title={key.is_active !== false ? (isZh ? "禁用该密钥" : "Disable") : (isZh ? "启用该密钥" : "Enable")}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTenantKey(key.tenant_id)}
                              className="text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded p-1 transition"
                              title={isZh ? "删除租户" : "Delete"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Realtime Quote Gateway & System Version Cards */}
        <div className="space-y-6 flex flex-col justify-between">
          {/* 1. Realtime Quote Gateway Card */}
          {quoteStatus && (
            <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Wifi className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">{isZh ? "实时行情网关状态" : "Realtime Quote Gateway"}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isZh ? "通达信 TCP 行情连接池与延迟监控" : "TDX TCP connection pool and latency"}
                    </p>
                  </div>
                </div>
                <button
                  id="quote-gateway-refresh-btn"
                  type="button"
                  onClick={() => fetchQuoteStatus(true, true)}
                  disabled={quoteLoading}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${quoteLoading ? "animate-spin" : ""}`} />
                  {isZh ? "刷新状态" : "Refresh"}
                </button>
              </div>

              <div className="grid gap-4 grid-cols-3">
                <div className="rounded-md border bg-muted/10 p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground">{isZh ? "网关状态" : "Status"}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`h-2 w-2 rounded-full ${
                      quoteStatus.status === "connected"
                        ? "bg-success"
                        : quoteStatus.status === "degraded"
                        ? "bg-warning animate-pulse"
                        : "bg-destructive"
                    }`} />
                    <span className="text-xs font-semibold">
                      {quoteStatus.status === "connected"
                        ? (isZh ? "连接正常 (TCP)" : "Online (TCP)")
                        : quoteStatus.status === "degraded"
                        ? (isZh ? "已降级 (Tencent HTTP)" : "Degraded (HTTP)")
                        : (isZh ? "未连接" : "Offline")}
                    </span>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/10 p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground">{isZh ? "活动连接数" : "Active Conns"}</span>
                  <span className="text-sm font-bold mt-1 font-mono">
                    {quoteStatus.active_connections} <span className="text-[10px] font-normal text-muted-foreground">/ 3</span>
                  </span>
                </div>

                <div className="rounded-md border bg-muted/10 p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground">{isZh ? "平均测速延迟" : "Avg Latency"}</span>
                  <span className="text-sm font-bold mt-1 font-mono">
                    {quoteStatus.status === "degraded" ? "--" : `${quoteStatus.latency_ms} ms`}
                  </span>
                </div>
              </div>

              {quoteStatus.pool && quoteStatus.pool.length > 0 && (
                <div className="rounded-md border bg-muted/5 p-3 space-y-2">
                  <div className="text-[10px] font-medium text-muted-foreground">
                    {isZh ? "活动行情服务器列表：" : "Active Quote Servers:"}
                  </div>
                  <div className="divide-y divide-border/40 max-h-[120px] overflow-auto">
                    {quoteStatus.pool.map((srv, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 text-xs">
                        <span className="font-mono text-[10px] text-muted-foreground">{srv.ip}:{srv.port}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          <span className="font-mono font-medium text-[10px]">{srv.latency_ms} ms</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. System Version Management Card */}
          {versionInfo && (
            <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">{isZh ? "系统版本管理" : "System Version"}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isZh ? "一键查看并平滑升级系统代码" : "Inspect and upgrade system codebase"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchVersionInfo(true)}
                  disabled={versionLoading}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${versionLoading ? "animate-spin" : ""}`} />
                  {isZh ? "检查更新" : "Check Update"}
                </button>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="rounded-md border bg-muted/10 p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground">{isZh ? "当前版本" : "Current Version"}</span>
                  <span className="text-xs font-bold mt-1 font-mono">{versionInfo.current_version}</span>
                </div>

                <div className="rounded-md border bg-muted/10 p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground">{isZh ? "最新版本" : "Latest Version"}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-bold font-mono">{versionInfo.latest_version}</span>
                    {versionInfo.has_update ? (
                      <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400 animate-pulse">
                        UPDATE
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                        LATEST
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {versionInfo.has_update && (
                <button
                  type="button"
                  onClick={handleTriggerUpgrade}
                  disabled={upgrading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 transition disabled:opacity-70 cursor-pointer"
                >
                  {upgrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />}
                  {upgrading ? (isZh ? "正在触发升级…" : "Upgrading...") : (isZh ? `立即升级到 ${versionInfo.latest_version}` : `Upgrade to ${versionInfo.latest_version}`)}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. Tenant Key Generation Modal */}
      {isTenantModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {generatedKey ? "密钥生成成功" : "生成新租户密钥"}
            </h3>
            
            {generatedKey ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  新租户的 API 密钥已生成。该密钥<strong>仅在此展示一次</strong>，请立即复制并妥善保存您的密钥：
                </p>
                <div className="flex gap-2 items-center rounded-md border bg-muted/40 p-3 font-mono text-sm break-all select-all text-emerald-500">
                  <span className="flex-1">{generatedKey}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition shrink-0"
                    title="复制到剪贴板"
                  >
                    {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-end pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTenantModalOpen(false);
                      setGeneratedKey("");
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 px-4 py-2 text-sm font-medium transition cursor-pointer"
                  >
                    已复制并关闭
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateTenantKey} className="space-y-4">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium">租户备注名称 (例如：量化团队A)</span>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="请输入方便识别的租户名称"
                  />
                </label>

                <div className="flex items-center justify-end gap-3 border-t pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsTenantModalOpen(false)}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent px-4 py-2 text-sm font-medium transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={tenantSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-70 transition cursor-pointer"
                  >
                    {tenantSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {tenantSaving ? "生成中..." : "生成密钥"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 2. Upgrade Countdown Modal */}
      {showUpgradeModal && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-lg">
          <div className="relative flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-xl text-center max-w-sm w-full mx-4">
            <div className="relative flex items-center justify-center" style={{ height: "128px", width: "128px" }}>
              <svg className="absolute h-28 w-28 -rotate-90 animate-spin-slow" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="44" fill="none" stroke="rgba(251,191,36,0.7)" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${(upgradeCountdown / 30) * 276.5} 276.5`}
                  style={{ transition: "stroke-dasharray 1s linear" }}
                />
              </svg>
              <span className="text-4xl font-bold text-white tabular-nums">{upgradeCountdown}</span>
            </div>

            <div style={{ marginTop: "16px" }}>
              <h3 className="text-xl font-semibold text-white mb-2">系统升级中…</h3>
              <p className="text-sm text-white/70 leading-relaxed">
                后台正在拉取最新代码并重启服务<br />
                页面将在 <span className="font-bold text-amber-400">{upgradeCountdown}</span> 秒后自动刷新
              </p>
            </div>

            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              服务重启中，请稍候…
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              立即刷新页面
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
