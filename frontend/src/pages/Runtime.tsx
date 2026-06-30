import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { getApiAuthKey, setApiAuthKey } from "@/lib/apiAuth";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Loader2,
  OctagonX,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Wifi,
  WifiOff,
  KeyRound,
  Plus,
  Save,
  Copy,
  Check,
} from "lucide-react";
import { api, type LiveBrokerStatus, type LiveMandateLimits, type LiveStatus, type UserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-sm font-medium";
const hintClass = "text-xs text-muted-foreground";

const RUNTIME_POLL_INTERVAL_MS = 15_000;
const RUNTIME_CLOCK_INTERVAL_MS = 1_000;

export function Runtime() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeRequestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const requestSeqRef = useRef(0);
  const mountedRef = useRef(false);
  const tRef = useRef(t);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [localApiKey, setLocalApiKeyState] = useState(() => getApiAuthKey());
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerNickname, setRegisterNickname] = useState("");
  const [registeredResult, setRegisteredResult] = useState<{ key: string; name: string; tenant_id: string } | null>(null);
  const [isRegisterCopied, setIsRegisterCopied] = useState(false);
  const [registering, setRegistering] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const p = await api.getSettingsProfile();
      setProfile(p);
    } catch (err) {
      console.warn("Failed to load user profile", err);
    }
  }, []);

  const handleRegisterTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerNickname.trim()) return;
    setRegistering(true);
    try {
      const result = await api.registerTenant({ name: registerNickname.trim() });
      setRegisteredResult(result);
      toast.success("注册成功！请复制并妥善保存您的密钥。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "注册失败");
    } finally {
      setRegistering(false);
    }
  };

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const loadStatus = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    activeRequestRef.current?.controller.abort();
    const controller = new AbortController();
    activeRequestRef.current = { id: requestId, controller };

    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const next = await api.getLiveStatus(controller.signal);
      if (!mountedRef.current || !isCurrentStatusRequest(activeRequestRef.current, requestId, controller)) return;
      setStatus(next);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!mountedRef.current || !isCurrentStatusRequest(activeRequestRef.current, requestId, controller)) return;
      console.warn("Failed to load runtime status", err);
      setStatus(null);
      setError(err instanceof Error ? err.message : tRef.current("runtime.statusUnavailable"));
    } finally {
      if (!mountedRef.current || !isCurrentStatusRequest(activeRequestRef.current, requestId, controller)) return;
      activeRequestRef.current = null;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadStatus("initial");
    loadProfile();
    const pollTimer = window.setInterval(() => loadStatus("refresh"), RUNTIME_POLL_INTERVAL_MS);
    const clockTimer = window.setInterval(() => setNowMs(Date.now()), RUNTIME_CLOCK_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      requestSeqRef.current += 1;
      activeRequestRef.current?.controller.abort();
      activeRequestRef.current = null;
      window.clearInterval(pollTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadStatus, loadProfile]);



  const identityStatusCard = (
    <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
              <KeyRound className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold">租户身份卡片</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {profile?.role === "admin" && profile?.is_local
              ? "您当前处于本地管理员租户空间 (默认)。"
              : `当前登录身份：${profile?.name || "未知租户"} (ID: ${profile?.tenant_id || "未知"})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {profile?.tenant_id && (
            <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
              租户ID: {profile.tenant_id}
            </span>
          )}
          {profile?.name && (
            <span className="text-xs bg-muted text-muted-foreground border px-2.5 py-1 rounded-full font-medium">
              昵称: {profile.name}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setRegisterNickname("");
              setRegisteredResult(null);
              setIsRegisterModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 text-xs font-medium transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            注册新租户
          </button>
        </div>
      </div>

      <form onSubmit={(e) => {
        e.preventDefault();
        if (!localApiKey.trim()) return;
        setApiAuthKey(localApiKey.trim());
        toast.success("正在验证新密钥...");
        window.location.reload();
      }} className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            更换租户身份 (输入租户密钥)
          </label>
          <input
            type="password"
            value={localApiKey}
            onChange={(event) => setLocalApiKeyState(event.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="请输入您的租户密钥来切换/验证身份"
          />
        </div>
        <div className="flex gap-2 self-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            保存并登录
          </button>
          {getApiAuthKey() && (
            <button
              type="button"
              onClick={() => {
                setApiAuthKey("");
                toast.success("已清除密钥，恢复默认管理员租户。");
                window.location.reload();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent px-4 py-2 text-sm font-medium transition cursor-pointer"
            >
              清除登录密钥
            </button>
          )}
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              {t("runtime.monitorBadge")}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t("runtime.title")}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {t("runtime.subtitlePre")} <span className="font-mono">/live/status</span>
                {t("runtime.subtitlePost")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadStatus("refresh")}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t("runtime.refresh")}
          </button>
        </section>

        {/* Render Identity Status Card */}
        {identityStatusCard}

        {loading ? (
          <div className="grid gap-3 md:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-md border bg-muted/40" />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <section className="rounded-md border border-amber-500/30 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              {t("runtime.unavailableTitle")}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">{t("runtime.unavailableHint")}</p>
          </section>
        ) : null}

        {!loading && !error && status ? (
          <>


            {status.brokers.length === 0 ? (
              <section className="rounded-md border border-dashed p-8 text-center">
                <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
                <h2 className="mt-3 font-medium">{t("runtime.noProfilesTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("runtime.noProfilesBody")}</p>
              </section>
            ) : (
              <section className="grid gap-4">
                {status.brokers.map((broker) => (
                  <BrokerRuntimeCard key={broker.auth.broker} broker={broker} globalHalted={status.global_halted} t={t} nowMs={nowMs} />
                ))}
              </section>
            )}
          </>
        ) : null}
      </div>

      {/* Tenant Registration Modal */}
      {isRegisterModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {registeredResult ? "注册成功" : "自助注册新租户"}
            </h3>

            {registeredResult ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  恭喜您注册成功！您的专有密钥已生成。该密钥<strong>仅在此展示一次</strong>，请立即复制并妥善保存：
                </p>
                <div className="flex gap-2 items-center rounded-md border bg-muted/40 p-3 font-mono text-sm break-all select-all text-emerald-500">
                  <span className="flex-1">{registeredResult.key}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(registeredResult.key);
                      setIsRegisterCopied(true);
                      setTimeout(() => setIsRegisterCopied(false), 2000);
                    }}
                    className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition shrink-0"
                    title="复制到剪贴板"
                  >
                    {isRegisterCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                
                <div className="rounded bg-muted/50 p-2.5 text-xs space-y-1">
                  <div><span className="text-muted-foreground">租户昵称:</span> <strong className="text-foreground">{registeredResult.name}</strong></div>
                  <div><span className="text-muted-foreground">租户 ID:</span> <strong className="text-foreground">{registeredResult.tenant_id}</strong></div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsRegisterModalOpen(false);
                      setRegisteredResult(null);
                    }}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent px-4 py-2 text-sm font-medium transition cursor-pointer"
                  >
                    关闭
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setApiAuthKey(registeredResult.key);
                      setIsRegisterModalOpen(false);
                      setRegisteredResult(null);
                      window.location.reload();
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 px-4 py-2 text-sm font-medium transition cursor-pointer"
                  >
                    一键复制并自动登录
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterTenant} className="space-y-4">
                <label className="grid gap-1.5">
                  <span className={labelClass}>个性化昵称</span>
                  <input
                    type="text"
                    required
                    value={registerNickname}
                    onChange={(e) => setRegisterNickname(e.target.value)}
                    className={fieldClass}
                    placeholder="请输入您的租户标识昵称"
                  />
                  <span className={hintClass}>限制 2-20 个字符，不能包含特殊字符。</span>
                </label>

                <div className="flex items-center justify-end gap-3 border-t pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsRegisterModalOpen(false)}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent px-4 py-2 text-sm font-medium transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={registering}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-70 transition cursor-pointer"
                  >
                    {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {registering ? "注册中..." : "立即注册"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function isCurrentStatusRequest(
  activeRequest: { id: number; controller: AbortController } | null,
  requestId: number,
  controller: AbortController,
): boolean {
  return activeRequest?.id === requestId && activeRequest.controller === controller;
}

function BrokerRuntimeCard({
  broker,
  globalHalted,
  t,
  nowMs,
}: {
  broker: LiveBrokerStatus;
  globalHalted: boolean;
  t: TFunction;
  nowMs: number;
}) {
  const brokerKey = broker.auth.broker;
  const runnerAlive = broker.runner?.alive ?? false;
  const halted = globalHalted || broker.halted;
  const mandate = broker.mandate ?? null;
  const risk = deriveRiskState(broker, globalHalted, t);
  const mandateCountdown = formatCountdown(mandate?.expires_at, t, nowMs);

  return (
    <article className="rounded-md border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold capitalize">{brokerKey}</h2>
            <StatusPill
              label={broker.auth.oauth_token_present ? t("runtime.authPresent") : t("runtime.authMissing")}
              tone={broker.auth.oauth_token_present ? "success" : "neutral"}
            />
            <StatusPill
              label={runnerAlive ? t("runtime.runnerAlive") : t("runtime.runnerStopped")}
              tone={runnerAlive ? "success" : "neutral"}
            />
            {halted ? <StatusPill label={t("runtime.haltedPill")} tone="danger" /> : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {broker.auth.is_live_broker ? t("runtime.recognizedProfile") : t("runtime.unknownProfile")} · {t("runtime.lastTick")}{" "}
            {formatLastTick(broker.runner?.last_tick, broker.runner?.last_tick_age_seconds, t, nowMs)}
          </p>
        </div>
        <StatusPill label={risk.label} tone={risk.tone} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <RuntimePanel title={t("runtime.authorization")} icon={broker.auth.oauth_token_present ? Wifi : WifiOff}>
          <KeyValue label={t("runtime.oauthToken")} value={broker.auth.oauth_token_present ? t("runtime.present") : t("runtime.missing")} />
          <KeyValue label={t("runtime.profileType")} value={broker.auth.is_live_broker ? t("runtime.recognized") : t("runtime.unknown")} />
        </RuntimePanel>

        <RuntimePanel title={t("runtime.mandate")} icon={mandate ? ShieldCheck : ShieldOff}>
          {mandate ? (
            <>
              <KeyValue label={t("runtime.account")} value={mandate.account_ref || t("runtime.unrecorded")} />
              <KeyValue label={t("runtime.expiry")} value={mandate.expired ? t("runtime.expired") : mandateCountdown} />
              <KeyValue label={t("runtime.limits")} value={summarizeLimits(mandate.limits, t)} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("runtime.noMandate")}</p>
          )}
        </RuntimePanel>

        <RuntimePanel title={t("runtime.riskStateTitle")} icon={risk.icon}>
          <p className="text-sm text-muted-foreground">{risk.description}</p>
        </RuntimePanel>
      </div>
    </article>
  );
}

function RuntimePanel({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-muted/20 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value || "-"}</div>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "success" | "danger" | "warning" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        tone === "success" && "bg-success/10 text-success",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}


function deriveRiskState(broker: LiveBrokerStatus, globalHalted: boolean, t: TFunction): {
  label: string;
  tone: "success" | "danger" | "warning" | "neutral";
  icon: typeof Activity;
  description: string;
} {
  if (globalHalted || broker.halted) {
    return {
      label: t("runtime.riskHalted"),
      tone: "danger",
      icon: OctagonX,
      description: t("runtime.riskHaltedDesc"),
    };
  }
  if (broker.runner?.alive && broker.mandate && !broker.mandate.expired) {
    return {
      label: t("runtime.riskActive"),
      tone: "success",
      icon: Activity,
      description: t("runtime.riskActiveDesc"),
    };
  }
  if (broker.auth.oauth_token_present && broker.mandate && !broker.mandate.expired) {
    return {
      label: t("runtime.riskIdle"),
      tone: "warning",
      icon: Clock3,
      description: t("runtime.riskIdleDesc"),
    };
  }
  return {
    label: t("runtime.riskDormant"),
    tone: "neutral",
    icon: ShieldOff,
    description: t("runtime.riskDormantDesc"),
  };
}

function summarizeLimits(limits: LiveMandateLimits | undefined, t: TFunction): string {
  if (!limits) return t("runtime.limitsUnavailable");
  const parts: string[] = [];
  if (typeof limits.max_order_notional_usd === "number") parts.push(`${formatUsd(limits.max_order_notional_usd)}${t("runtime.perOrder")}`);
  if (typeof limits.max_total_exposure_usd === "number") parts.push(`${formatUsd(limits.max_total_exposure_usd)} ${t("runtime.exposure")}`);
  if (typeof limits.max_trades_per_day === "number") parts.push(`${limits.max_trades_per_day}${t("runtime.perDay")}`);
  if (typeof limits.max_leverage === "number") parts.push(`${limits.max_leverage}${t("runtime.leverageSuffix")}`);
  if (limits.allowed_instruments?.length) parts.push(limits.allowed_instruments.join(", "));
  return parts.join(" · ") || t("runtime.limitsUnavailable");
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatCountdown(iso: string | undefined, t: TFunction, nowMs: number): string {
  if (!iso) return t("runtime.unknown");
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return t("runtime.unknown");
  const deltaSec = Math.round((target - nowMs) / 1000);
  if (deltaSec <= 0) return t("runtime.expired");
  const days = Math.floor(deltaSec / 86_400);
  const hours = Math.floor((deltaSec % 86_400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  if (deltaSec < 60) return `${deltaSec}s`;
  return `${Math.floor(deltaSec / 60)}m`;
}

function formatLastTick(
  value: string | number | null | undefined,
  ageSeconds: number | null | undefined,
  t: TFunction,
  nowMs: number,
): string {
  if (typeof ageSeconds === "number" && Number.isFinite(ageSeconds)) {
    if (ageSeconds < 60) return `${Math.round(ageSeconds)}s ${t("runtime.ago")}`;
    if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)}m ${t("runtime.ago")}`;
    return `${Math.floor(ageSeconds / 3600)}h ${t("runtime.ago")}`;
  }
  if (value == null || value === "") return t("runtime.never");
  const timestamp = typeof value === "number" ? normalizeEpochMs(value) : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return t("runtime.unknown");
  const deltaSec = Math.round((nowMs - timestamp) / 1000);
  if (deltaSec < 60) return `${Math.max(0, deltaSec)}s ${t("runtime.ago")}`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ${t("runtime.ago")}`;
  return `${Math.floor(deltaSec / 3600)}h ${t("runtime.ago")}`;
}

function normalizeEpochMs(value: number): number {
  if (value >= 1_000_000_000_000) return value;
  if (value >= 946_684_800 && value <= 4_102_444_800) return value * 1000;
  return Number.NaN;
}
