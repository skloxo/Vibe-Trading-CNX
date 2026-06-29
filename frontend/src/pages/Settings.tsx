import i18n from "@/i18n";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpCircle, Database, KeyRound, Loader2, MessageSquare, RefreshCw, RotateCcw, Save, Server, SlidersHorizontal, Plus, Trash2, Edit, Power, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { api, isAuthRequiredError, type DataSourceSettings, type FeatureFlagsResponse, type LLMProviderOption, type LLMSettings, type FeishuChannel, type UserProfile, type TenantKey, type SystemVersionInfo } from "@/lib/api";
import { getApiAuthKey, setApiAuthKey } from "@/lib/apiAuth";
import { createPortal } from "react-dom";
import { AuthBarrier } from "@/components/layout/AuthBarrier";interface LLMFormState {
  provider: string;
  model_name: string;
  base_url: string;
  temperature: number;
  timeout_seconds: number;
  max_retries: number;
  reasoning_effort: string;
}

const fieldClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-sm font-medium";
const hintClass = "text-xs text-muted-foreground";

function toForm(settings: LLMSettings): LLMFormState {
  return {
    provider: settings.provider,
    model_name: settings.model_name,
    base_url: settings.base_url,
    temperature: settings.temperature,
    timeout_seconds: settings.timeout_seconds,
    max_retries: settings.max_retries,
    reasoning_effort: settings.reasoning_effort || "",
  };
}

export function Settings() {
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [dataSettings, setDataSettings] = useState<DataSourceSettings | null>(null);
  const [form, setForm] = useState<LLMFormState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [localApiKey, setLocalApiKeyState] = useState(() => getApiAuthKey());
  const [clearApiKey, setClearApiKey] = useState(false);
  const [tushareToken, setTushareToken] = useState("");
  const [clearTushareToken, setClearTushareToken] = useState(false);
  const [iwencaiKey, setIwencaiKey] = useState("");
  const [clearIwencaiKey, setClearIwencaiKey] = useState(false);
  const [fredApiKey, setFredApiKey] = useState("");
  const [clearFredApiKey, setClearFredApiKey] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagsResponse | null>(null);
  
  // Feishu platforms settings states
  const [feishuChannels, setFeishuChannels] = useState<FeishuChannel[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<FeishuChannel | null>(null);

  // Form states for the modal
  const [chanName, setChanName] = useState("");
  const [chanEnabled, setChanEnabled] = useState(true);
  const [chanAppId, setChanAppId] = useState("");
  const [chanAppSecret, setChanAppSecret] = useState("");
  const [chanAllowedUsers, setChanAllowedUsers] = useState("");
  const [chanAllowAllUsers, setChanAllowAllUsers] = useState(false);
  const [feishuSaving, setFeishuSaving] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dataSaving, setDataSaving] = useState(false);
  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null);

  // Tenant API Keys states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [tenantKeys, setTenantKeys] = useState<TenantKey[]>([]);
  const [tenantKeysLoading, setTenantKeysLoading] = useState(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [tenantSaving, setTenantSaving] = useState(false);
  const [generatedKey, setGeneratedKey] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [llmMode, setLlmMode] = useState<"default" | "custom">("default");
  const [dataMode, setDataMode] = useState<"default" | "custom">("default");
  const [activeSubTab, setActiveSubTab] = useState<"project" | "user">("project");
  const [globalLLM, setGlobalLLM] = useState<LLMSettings | null>(null);
  const [globalData, setGlobalData] = useState<DataSourceSettings | null>(null);
  const [tenantLLM, setTenantLLM] = useState<LLMSettings | null>(null);
  const [tenantData, setTenantData] = useState<DataSourceSettings | null>(null);

  // Tenant self-registration modal states
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerNickname, setRegisterNickname] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registeredResult, setRegisteredResult] = useState<{ key: string; name: string; tenant_id: string } | null>(null);
  const [isRegisterCopied, setIsRegisterCopied] = useState(false);

  // System version & one-click upgrade states
  const [versionInfo, setVersionInfo] = useState<SystemVersionInfo | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeCountdown, setUpgradeCountdown] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getLLMSettings(),
      api.getDataSourceSettings(),
      api.getLLMSettings({ headers: { "X-Vibe-Scope": "global" } }),
      api.getDataSourceSettings({ headers: { "X-Vibe-Scope": "global" } }),
      api.getFeatureFlags({ headers: { "X-Vibe-Scope": "global" } }),
      api.getFeishuChannels(),
      api.getSettingsProfile()
    ])
      .then(async ([llmData, dataSourceData, globalLlmData, globalDataSourceData, flagsData, feishuData, profileData]) => {
        if (!alive) return;
        setTenantLLM(llmData);
        setTenantData(dataSourceData);
        setGlobalLLM(globalLlmData);
        setGlobalData(globalDataSourceData);
        setFeatureFlags(flagsData);
        setFeishuChannels(feishuData);
        setProfile(profileData);
        setSettingsLoadError(null);

        const currentTab = profileData.is_local ? "project" : "user";
        setActiveSubTab(currentTab);

        if (currentTab === "project") {
          setSettings(globalLlmData);
          setForm(toForm(globalLlmData));
          setDataSettings(globalDataSourceData);
          setLlmMode("default");
          setDataMode("default");
        } else {
          setSettings(llmData);
          setForm(toForm(llmData));
          setDataSettings(dataSourceData);
          setLlmMode(llmData.is_custom ? "custom" : "default");
          setDataMode(dataSourceData.is_custom ? "custom" : "default");
        }

        if (profileData.role === "admin" || profileData.is_local) {
          try {
            setTenantKeysLoading(true);
            const keys = await api.getTenantKeys();
            if (alive) setTenantKeys(keys);
          } catch (e) {
            console.error("Failed to load tenant keys:", e);
          } finally {
            if (alive) setTenantKeysLoading(false);
          }
        }
      })
      .catch((error) => {
        if (isAuthRequiredError(error)) {
          setAuthFailed(true);
        } else {
          const message = error instanceof Error ? error.message : "Unknown error";
          setSettingsLoadError(message);
          toast.error(i18n.t("settings.loadLlmSettingsFailed", { message }));
          toast.error(i18n.t("settings.loadDataSourceSettingsFailed", { message }));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  // Fetch system version info (admin/local only)
  useEffect(() => {
    let alive = true;
    setVersionLoading(true);
    api.getSystemVersion()
      .then((info) => { if (alive) setVersionInfo(info); })
      .catch(() => { /* non-admin users simply won't see this card */ })
      .finally(() => { if (alive) setVersionLoading(false); });
    return () => { alive = false; };
  }, []);

  // Countdown timer for upgrade modal
  useEffect(() => {
    if (!showUpgradeModal) return;
    setUpgradeCountdown(30);
    const interval = setInterval(() => {
      setUpgradeCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-reload after countdown reaches 0
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showUpgradeModal]);

  async function handleTriggerUpgrade() {
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
  }

  const handleTabChange = (tab: "project" | "user") => {
    setActiveSubTab(tab);
    if (tab === "project" && globalLLM && globalData) {
      setSettings(globalLLM);
      setForm(toForm(globalLLM));
      setDataSettings(globalData);
      setLlmMode("default");
      setDataMode("default");
    } else if (tab === "user" && tenantLLM && tenantData) {
      setSettings(tenantLLM);
      setForm(toForm(tenantLLM));
      setDataSettings(tenantData);
      setLlmMode(tenantLLM.is_custom ? "custom" : "default");
      setDataMode(tenantData.is_custom ? "custom" : "default");
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
      toast.success(i18n.t("settings.keyCreatedSuccess") || "密钥生成成功");
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
      toast.success(i18n.t("settings.keyUpdatedSuccess") || "密钥状态已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改密钥状态失败");
    }
  };

  const handleDeleteTenantKey = async (tid: string) => {
    if (!window.confirm(i18n.t("settings.deleteKeyConfirm") || "确认删除此密钥？删除后该租户的 API 访问权限将被立即收回。")) {
      return;
    }
    try {
      await api.deleteTenantKey(tid);
      setTenantKeys(tenantKeys.filter(k => k.tenant_id !== tid));
      toast.success(i18n.t("settings.keyDeletedSuccess") || "密钥已成功删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除密钥失败");
    }
  };

  const providers = settings?.providers ?? [];
  const selectedProvider = useMemo<LLMProviderOption | undefined>(
    () => providers.find((provider) => provider.name === form?.provider),
    [form?.provider, providers],
  );

  const applyProviderDefaults = (provider = selectedProvider) => {
    if (!provider || !form) return;
    setForm({
      ...form,
      model_name: provider.default_model,
      base_url: provider.default_base_url,
    });
  };

  const onProviderChange = (name: string) => {
    const provider = providers.find((item) => item.name === name);
    if (!provider || !form) return;
    setForm({
      ...form,
      provider: provider.name,
      model_name: provider.default_model,
      base_url: provider.default_base_url,
    });
    setApiKey("");
    setClearApiKey(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const isDefault = activeSubTab === "user" && llmMode === "default";
      const options = activeSubTab === "project" ? { headers: { "X-Vibe-Scope": "global" } } : undefined;
      const updated = await api.updateLLMSettings({
        provider: isDefault ? "openai" : form.provider,
        model_name: isDefault ? "placeholder" : form.model_name,
        base_url: isDefault ? "" : form.base_url,
        api_key: isDefault ? "" : apiKey.trim() || undefined,
        clear_api_key: isDefault ? true : clearApiKey,
        temperature: isDefault ? 0.0 : form.temperature,
        timeout_seconds: isDefault ? 120 : form.timeout_seconds,
        max_retries: isDefault ? 2 : form.max_retries,
        reasoning_effort: isDefault ? "" : form.reasoning_effort || undefined,
        use_default: isDefault,
      }, options);
      setSettings(updated);
      setForm(toForm(updated));
      setApiKey("");
      setClearApiKey(false);
      if (activeSubTab === "project") {
        setGlobalLLM(updated);
      } else {
        setTenantLLM(updated);
      }
      toast.success(i18n.t("settings.llmSettingsSaved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(i18n.t("settings.saveLlmSettingsFailed", { message }));
    } finally {
      setSaving(false);
    }
  };

  const submitDataSources = async (event: FormEvent) => {
    event.preventDefault();
    setDataSaving(true);
    try {
      const isDefault = activeSubTab === "user" && dataMode === "default";
      const options = activeSubTab === "project" ? { headers: { "X-Vibe-Scope": "global" } } : undefined;
      const updated = await api.updateDataSourceSettings({
        tushare_token: isDefault ? "" : tushareToken.trim() || undefined,
        clear_tushare_token: isDefault ? true : clearTushareToken,
        iwencai_key: isDefault ? "" : iwencaiKey.trim() || undefined,
        clear_iwencai_key: isDefault ? true : clearIwencaiKey,
        fred_api_key: isDefault ? "" : fredApiKey.trim() || undefined,
        clear_fred_api_key: isDefault ? true : clearFredApiKey,
        use_default: isDefault,
      }, options);
      setDataSettings(updated);
      setTushareToken("");
      setClearTushareToken(false);
      setIwencaiKey("");
      setClearIwencaiKey(false);
      setFredApiKey("");
      setClearFredApiKey(false);
      if (activeSubTab === "project") {
        setGlobalData(updated);
      } else {
        setTenantData(updated);
      }
      toast.success(i18n.t("settings.dataSourceSettingsSaved"));
    } catch (error) {
      toast.error(i18n.t("settings.saveDataSourceSettingsFailed", { message: error instanceof Error ? error.message : "Unknown error" }));
    } finally {
      setDataSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingChannel(null);
    setChanName("");
    setChanEnabled(true);
    setChanAppId("");
    setChanAppSecret("");
    setChanAllowedUsers("");
    setChanAllowAllUsers(false);
    setIsModalOpen(true);
  };

  const openEditModal = (channel: FeishuChannel) => {
    setEditingChannel(channel);
    setChanName(channel.name);
    setChanEnabled(channel.enabled);
    setChanAppId(channel.app_id);
    setChanAppSecret("");
    setChanAllowedUsers(channel.allowed_users);
    setChanAllowAllUsers(channel.allow_all_users);
    setIsModalOpen(true);
  };

  const submitFeishuChannel = async (event: FormEvent) => {
    event.preventDefault();
    setFeishuSaving(true);
    try {
      if (editingChannel) {
        const updated = await api.updateFeishuChannel(editingChannel.id, {
          name: chanName.trim(),
          app_id: chanAppId.trim(),
          app_secret: chanAppSecret.trim() || undefined,
          allowed_users: chanAllowedUsers.trim(),
          allow_all_users: chanAllowAllUsers,
          enabled: chanEnabled,
        });
        setFeishuChannels(feishuChannels.map((c) => (c.id === updated.id ? updated : c)));
        toast.success(i18n.t("settings.channelSaved") || "Feishu channel saved");
      } else {
        const created = await api.createFeishuChannel({
          name: chanName.trim(),
          app_id: chanAppId.trim(),
          app_secret: chanAppSecret.trim(),
          allowed_users: chanAllowedUsers.trim(),
          allow_all_users: chanAllowAllUsers,
          enabled: chanEnabled,
        });
        setFeishuChannels([...feishuChannels, created]);
        toast.success(i18n.t("settings.channelSaved") || "Feishu channel created");
      }
      setIsModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(i18n.t("settings.channelSaveFailed", { message }) || "Failed to save channel");
    } finally {
      setFeishuSaving(false);
    }
  };

  const toggleChannelEnabled = async (channel: FeishuChannel) => {
    try {
      const updated = await api.updateFeishuChannel(channel.id, {
        name: channel.name,
        app_id: channel.app_id,
        app_secret: undefined,
        allowed_users: channel.allowed_users,
        allow_all_users: channel.allow_all_users,
        enabled: !channel.enabled,
      });
      setFeishuChannels(feishuChannels.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(i18n.t("settings.channelSaved") || "Feishu channel updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(i18n.t("settings.channelSaveFailed", { message }) || "Failed to toggle channel");
    }
  };

  const deleteChannel = async (id: string) => {
    if (!window.confirm(i18n.t("settings.deleteConfirm") || "Are you sure you want to delete this channel?")) {
      return;
    }
    try {
      await api.deleteFeishuChannel(id);
      setFeishuChannels(feishuChannels.filter((c) => c.id !== id));
      toast.success(i18n.t("settings.channelDeleted") || "Feishu channel deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(i18n.t("settings.channelDeleteFailed", { message }) || "Failed to delete channel");
    }
  };

  const handleRegisterTenant = async (e: FormEvent) => {
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
            <Plus className="h-3 w-3" />
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
                toast.success("已注销当前身份，恢复为本地访问");
                window.location.reload();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border hover:bg-destructive/10 hover:text-destructive px-4 py-2 text-sm font-medium transition cursor-pointer"
            >
              <Power className="h-4 w-4" />
              退出登录
            </button>
          )}
        </div>
      </form>
    </div>
  );

  if (authFailed) {
    return (
      <div className="mx-auto max-w-md w-full p-6 space-y-6">
        <AuthBarrier
          onLogin={(key) => {
            setApiAuthKey(key);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  if (loading || !form || !settings || !dataSettings) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{i18n.t("settings.title")}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{i18n.t("settings.subtitle")}</p>
        </div>
        <div className="flex min-h-32 items-center justify-center rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          {settingsLoadError ? (
            <div className="text-center">
              <div className="font-medium text-foreground">{i18n.t("settings.unavailable")}</div>
              <div className="mt-1">{settingsLoadError}</div>
            </div>
          ) : (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {i18n.t("settings.loading")}
            </>
          )}
        </div>
      </div>
    );
  }

  const keyStatus = settings.api_key_configured
    ? i18n.t("settings.configured")
    : settings.api_key_required
      ? i18n.t("settings.keepCurrentKey")
      : selectedProvider?.auth_type === "oauth" && selectedProvider.login_command
        ? i18n.t("settings.providerUsesOauth", { command: selectedProvider.login_command })
        : i18n.t("settings.noApiKeyRequired");
  const apiKeyDisabled = !selectedProvider?.api_key_required || clearApiKey;
  const tushareStatus = dataSettings.tushare_token_configured
    ? i18n.t("settings.configured")
    : i18n.t("settings.keepCurrentToken");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4 border-border/60">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{i18n.t("settings.title")}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{i18n.t("settings.subtitle")}</p>
        </div>
        
        {/* Render Tab Sub-Navigation if is_local is true */}
        {profile?.is_local && (
          <div className="flex bg-muted p-1 rounded-lg border border-border/80 self-start md:self-center">
            <button
              onClick={() => handleTabChange("project")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                activeSubTab === "project"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              项目设置 (系统管理员)
            </button>
            <button
              onClick={() => handleTabChange("user")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                activeSubTab === "user"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              用户设置
            </button>
          </div>
        )}
      </div>

      {/* activeSubTab === "project": Admin View */}
      {activeSubTab === "project" ? (
        <div className="space-y-6">
          {/* Tenant Keys Card */}
          <section className="rounded-lg border bg-card p-5 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">租户密钥管理 (Tenant API Keys)</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  创建和管理租户的 API 访问密钥。每次生成新密钥都会自动为该租户创建隔离的工作空间。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGeneratedKey("");
                  setNewKeyName("");
                  setIsTenantModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 px-4 py-2 text-sm font-medium transition cursor-pointer self-start sm:self-center shadow-sm"
              >
                <Plus className="h-4 w-4" />
                生成新租户密钥
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-muted-foreground">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <th className="px-4 py-3">租户备注名称</th>
                    <th className="px-4 py-3">Tenant ID</th>
                    <th className="px-4 py-3">系统密钥</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenantKeysLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          正在加载租户密钥列表...
                        </div>
                      </td>
                    </tr>
                  ) : tenantKeys.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        暂无已注册租户。点击右上角“生成新租户密钥”或由用户在前台自助注册。
                      </td>
                    </tr>
                  ) : (
                    tenantKeys.map((key) => (
                      <tr key={key.tenant_id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-foreground">{key.name}</td>
                        <td className="px-4 py-3.5 font-mono text-xs">{key.tenant_id}</td>
                        <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                          {key.key ? (
                            <span className="text-emerald-500 font-semibold">{key.key}</span>
                          ) : (
                            <span>vibe_t_••••••••</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                            key.is_active !== false
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "bg-red-500/10 text-red-500 border-red-500/20"
                          }`}>
                            {key.is_active !== false ? "启用" : "禁用"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleTenantKey(key.tenant_id, key.is_active !== false)}
                              className={`rounded-md p-1.5 transition ${
                                key.is_active !== false
                                  ? "text-yellow-500 hover:bg-yellow-500/10"
                                  : "text-green-500 hover:bg-green-500/10"
                              }`}
                              title={key.is_active !== false ? "禁用该密钥" : "启用该密钥"}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTenantKey(key.tenant_id)}
                              className="text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-md p-1.5 transition"
                              title="删除租户"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Global LLM and Data Settings */}
          <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <section className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">项目全局 LLM 连接设置</h2>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className={labelClass}>{i18n.t("settings.provider")}</span>
                  <select
                    value={form.provider}
                    onChange={(event) => onProviderChange(event.target.value)}
                    className={fieldClass}
                  >
                    {providers.map((provider) => (
                      <option key={provider.name} value={provider.name}>{provider.label}</option>
                    ))}
                  </select>
                  <span className={hintClass}>{"Changing providers updates the recommended model and endpoint."}</span>
                </label>

                <label className="grid gap-2">
                  <span className={labelClass}>{i18n.t("settings.model")}</span>
                  <div className="flex gap-2">
                    <input
                      value={form.model_name}
                      onChange={(event) => setForm({ ...form, model_name: event.target.value })}
                      className={fieldClass}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => applyProviderDefaults()}
                      className="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
                      title={i18n.t("settings.useProviderDefaults")}
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span className="hidden sm:inline">{i18n.t("settings.useProviderDefaults")}</span>
                    </button>
                  </div>
                  <span className={hintClass}>{i18n.t("settings.modelIdHint")}</span>
                </label>

                <label className="grid gap-2">
                  <span className={labelClass}>{i18n.t("settings.baseUrl")}</span>
                  <input
                    value={form.base_url}
                    onChange={(event) => setForm({ ...form, base_url: event.target.value })}
                    className={fieldClass}
                    placeholder={selectedProvider?.default_base_url}
                    disabled={selectedProvider?.auth_type === "oauth"}
                  />
                </label>

                <label className="grid gap-2">
                  <span className={labelClass}>
                    {selectedProvider?.auth_type === "oauth" ? "OAuth" : "API key"}
                  </span>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      className={`${fieldClass} pl-9`}
                      placeholder={keyStatus}
                      autoComplete="current-password"
                      disabled={apiKeyDisabled}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={hintClass}>{keyStatus}</span>
                    {selectedProvider?.api_key_required ? (
                      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearApiKey}
                          onChange={(event) => {
                            setClearApiKey(event.target.checked);
                            if (event.target.checked) setApiKey("");
                          }}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        {i18n.t("settings.clearApiKey")}
                      </label>
                    ) : null}
                  </div>
                </label>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-5 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="mb-5 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">全局大模型参数生成设置</h2>
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-2">
                    <span className={labelClass}>{i18n.t("settings.temperature")}</span>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={form.temperature}
                      onChange={(event) => setForm({ ...form, temperature: Number(event.target.value) })}
                      className={fieldClass}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className={labelClass}>{i18n.t("settings.timeoutSeconds")}</span>
                    <input
                      type="number"
                      min={1}
                      max={3600}
                      step={1}
                      value={form.timeout_seconds}
                      onChange={(event) => setForm({ ...form, timeout_seconds: Number(event.target.value) })}
                      className={fieldClass}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className={labelClass}>{i18n.t("settings.maxRetries")}</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={1}
                      value={form.max_retries}
                      onChange={(event) => setForm({ ...form, max_retries: Number(event.target.value) })}
                      className={fieldClass}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className={labelClass}>{i18n.t("settings.reasoningEffort")}</span>
                    <select
                      value={form.reasoning_effort}
                      onChange={(event) => setForm({ ...form, reasoning_effort: event.target.value })}
                      className={fieldClass}
                    >
                      <option value="">{i18n.t("settings.off")}</option>
                      <option value="low">{i18n.t("settings.reasoningEffortLow")}</option>
                      <option value="medium">{i18n.t("settings.reasoningEffortMedium")}</option>
                      <option value="high">{i18n.t("settings.reasoningEffortHigh")}</option>
                      <option value="max">{i18n.t("settings.reasoningEffortMax")}</option>
                    </select>
                    <span className={hintClass}>{i18n.t("settings.reasoningEffortDesc")}</span>
                  </label>

                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{i18n.t("settings.saved")}: </span>
                    <span className="break-all font-mono">{settings.env_path}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-70 cursor-pointer shadow-sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? i18n.t("settings.saving") : i18n.t("settings.save")}
              </button>
            </section>
          </form>

          {/* Global Data Source Settings */}
          <form onSubmit={submitDataSources} className="rounded-lg border bg-card p-5 shadow-sm space-y-6">
            <div className="mb-2 space-y-1">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">项目全局数据源默认设置</h2>
              </div>
              <p className="text-sm text-muted-foreground">{i18n.t("settings.dataSourceSettingsDesc")}</p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className={labelClass}>{i18n.t("settings.tushareToken")}</span>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={tushareToken}
                      onChange={(event) => setTushareToken(event.target.value)}
                      className={`${fieldClass} pl-9`}
                      placeholder={tushareStatus}
                      autoComplete="current-password"
                      disabled={clearTushareToken}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={hintClass}>{i18n.t("settings.tushareDesc")}</span>
                    <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearTushareToken}
                        onChange={(event) => {
                          setClearTushareToken(event.target.checked);
                          if (event.target.checked) setTushareToken("");
                        }}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {i18n.t("settings.clearTushareToken")}
                    </label>
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className={labelClass}>{i18n.t("settings.iwencaiApiKey")}</span>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={iwencaiKey}
                      onChange={(event) => setIwencaiKey(event.target.value)}
                      className={`${fieldClass} pl-9`}
                      placeholder={dataSettings.iwencai_key_configured ? i18n.t("settings.configured") : i18n.t("settings.keepCurrentKey")}
                      autoComplete="current-password"
                      disabled={clearIwencaiKey}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={hintClass}>{i18n.t("settings.iwencaiDesc")}</span>
                    <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearIwencaiKey}
                        onChange={(event) => {
                          setClearIwencaiKey(event.target.checked);
                          if (event.target.checked) setIwencaiKey("");
                        }}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {i18n.t("settings.clearSavedKey")}
                    </label>
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className={labelClass}>{i18n.t("settings.fredApiKey")}</span>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={fredApiKey}
                      onChange={(event) => setFredApiKey(event.target.value)}
                      className={`${fieldClass} pl-9`}
                      placeholder={dataSettings.fred_api_key_configured ? i18n.t("settings.configured") : i18n.t("settings.keepCurrentKey")}
                      autoComplete="current-password"
                      disabled={clearFredApiKey}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={hintClass}>{i18n.t("settings.fredDesc")}</span>
                    <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearFredApiKey}
                        onChange={(event) => {
                          setClearFredApiKey(event.target.checked);
                          if (event.target.checked) setFredApiKey("");
                        }}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {i18n.t("settings.clearSavedKey")}
                    </label>
                  </div>
                </label>

                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{i18n.t("settings.saved")}: </span>
                  <span className="break-all font-mono">{dataSettings.env_path}</span>
                </div>

                <button
                  type="submit"
                  disabled={dataSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-70 cursor-pointer shadow-sm"
                >
                  {dataSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {dataSaving ? i18n.t("settings.saving") : i18n.t("settings.saveDataSourceSettings")}
                </button>
              </div>

              <div className="rounded-md border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{i18n.t("settings.baostock")}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${dataSettings.baostock_supported ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {dataSettings.baostock_supported ? i18n.t("settings.loaderAvailable") : i18n.t("settings.noProjectLoader")}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground font-sans">
                  <p>{dataSettings.baostock_message}</p>
                  <p>
                    {dataSettings.baostock_installed
                      ? i18n.t("settings.pythonPackageInstalled")
                      : i18n.t("settings.pythonPackageNotInstalled")}
                  </p>
                </div>
              </div>
            </div>
          </form>

          {/* Feature Flags Card (Read-only status badges) */}
          {featureFlags && (
            <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
              <div className="mb-5 space-y-1">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">{i18n.t("settings.featureFlags")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{i18n.t("settings.featureFlagsDesc")} (系统级只读状态)</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-md border bg-muted/20 px-4 py-3 opacity-90">
                  <span className="text-sm font-medium">{i18n.t("settings.shellTools")}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    featureFlags.shell_tools_enabled
                      ? "bg-green-500/10 text-green-500"
                      : "bg-gray-500/10 text-gray-500"
                  }`}>
                    {featureFlags.shell_tools_enabled ? "已启用" : "未启用"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/20 px-4 py-3 opacity-90">
                  <span className="text-sm font-medium">{i18n.t("settings.scheduler")}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    featureFlags.scheduler_enabled
                      ? "bg-green-500/10 text-green-500"
                      : "bg-gray-500/10 text-gray-500"
                  }`}>
                    {featureFlags.scheduler_enabled ? "已启用" : "未启用"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/20 px-4 py-3 opacity-90">
                  <span className="text-sm font-medium">{i18n.t("settings.sessionRuntime")}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    featureFlags.session_runtime_enabled
                      ? "bg-green-500/10 text-green-500"
                      : "bg-gray-500/10 text-gray-500"
                  }`}>
                    {featureFlags.session_runtime_enabled ? "已启用" : "未启用"}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                {i18n.t("settings.flagsReadFrom", {
                  env1: "VIBE_TRADING_ENABLE_SHELL_TOOLS",
                  env2: "VIBE_TRADING_ENABLE_SCHEDULER",
                  env3: "ENABLE_SESSION_RUNTIME",
                  env_path: featureFlags.env_path
                })}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* activeSubTab === "user": Tenant Settings View */
        <div className="space-y-6">
          {/* Identity Status Card */}
          {identityStatusCard}

          {/* Feishu Bot Channels Settings Card */}
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">{i18n.t("settings.feishuTitle")}</h2>
                </div>
                <p className="text-xs text-muted-foreground">{i18n.t("settings.feishuDesc")}</p>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-medium transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                {i18n.t("settings.addChannel")}
              </button>
            </div>

            {feishuChannels.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                {i18n.t("settings.noChannels")}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {feishuChannels.map((channel) => (
                  <div key={channel.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{channel.name}</span>
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${
                          channel.enabled
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}>
                          {channel.enabled ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                        <span>App ID: {channel.app_id}</span>
                        <span>•</span>
                        <span>Secret: {channel.app_secret_configured ? "••••••••" : "Not Configured"}</span>
                        {channel.allowed_users && (
                          <>
                            <span>•</span>
                            <span>OpenIDs: {channel.allowed_users}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleChannelEnabled(channel)}
                        className={`rounded-md p-1.5 transition ${
                          channel.enabled
                            ? "text-green-500 hover:bg-green-500/10"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        title={i18n.t("settings.feishuEnabled")}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(channel)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition"
                        title={i18n.t("settings.editChannel")}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChannel(channel.id)}
                        className="text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-md p-1.5 transition"
                        title={i18n.t("settings.deleteChannel")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tenant LLM Settings */}
          {/* Tenant LLM settings has a connection and generation settings form which is toggled by Custom vs Default */}
          <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] border bg-card/30 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 col-span-full border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">{i18n.t("settings.llmSettings")}</h2>
                </div>
                <p className="text-xs text-muted-foreground">{i18n.t("settings.llmSettingsDesc")}</p>
              </div>
              <div className="flex items-center gap-2 bg-muted/65 p-1 rounded-lg border border-border/80">
                <button
                  type="button"
                  onClick={() => setLlmMode("default")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    llmMode === "default"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  默认 (项目配置)
                </button>
                <button
                  type="button"
                  onClick={() => setLlmMode("custom")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    llmMode === "custom"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  自定义 (覆盖配置)
                </button>
              </div>
            </div>

            {llmMode === "default" ? (
              <div className="rounded-lg border bg-muted/20 p-8 text-center space-y-4 col-span-full">
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-full w-fit mx-auto">
                  <Server className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">已启用“默认项目配置”</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    当前大模型配置已设置为继承系统管理员配置的全局默认参数。如果您想要独立自定义，请点击上方“自定义 (覆盖配置)”按钮。
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-70 cursor-pointer shadow-sm"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  确认保存，使用项目默认 LLM
                </button>
              </div>
            ) : (
              <>
                <section className="rounded-lg border bg-card p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold">{i18n.t("settings.connection")}</h2>
                  </div>

                  <div className="grid gap-4">
                    <label className="grid gap-2">
                      <span className={labelClass}>{i18n.t("settings.provider")}</span>
                      <select
                        value={form.provider}
                        onChange={(event) => onProviderChange(event.target.value)}
                        className={fieldClass}
                      >
                        {providers.map((provider) => (
                          <option key={provider.name} value={provider.name}>{provider.label}</option>
                        ))}
                      </select>
                      <span className={hintClass}>{"Changing providers updates the recommended model and endpoint."}</span>
                    </label>

                    <label className="grid gap-2">
                      <span className={labelClass}>{i18n.t("settings.model")}</span>
                      <div className="flex gap-2">
                        <input
                          value={form.model_name}
                          onChange={(event) => setForm({ ...form, model_name: event.target.value })}
                          className={fieldClass}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => applyProviderDefaults()}
                          className="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
                          title={i18n.t("settings.useProviderDefaults")}
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="hidden sm:inline">{i18n.t("settings.useProviderDefaults")}</span>
                        </button>
                      </div>
                      <span className={hintClass}>{i18n.t("settings.modelIdHint")}</span>
                    </label>

                    <label className="grid gap-2">
                      <span className={labelClass}>{i18n.t("settings.baseUrl")}</span>
                      <input
                        value={form.base_url}
                        onChange={(event) => setForm({ ...form, base_url: event.target.value })}
                        className={fieldClass}
                        placeholder={selectedProvider?.default_base_url}
                        disabled={selectedProvider?.auth_type === "oauth"}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className={labelClass}>
                        {selectedProvider?.auth_type === "oauth" ? "OAuth" : "API key"}
                      </span>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(event) => setApiKey(event.target.value)}
                          className={`${fieldClass} pl-9`}
                          placeholder={keyStatus}
                          autoComplete="current-password"
                          disabled={apiKeyDisabled}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className={hintClass}>{keyStatus}</span>
                        {selectedProvider?.api_key_required ? (
                          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={clearApiKey}
                              onChange={(event) => {
                                setClearApiKey(event.target.checked);
                                if (event.target.checked) setApiKey("");
                              }}
                              className="h-3.5 w-3.5 accent-primary"
                            />
                            {i18n.t("settings.clearApiKey")}
                          </label>
                        ) : null}
                      </div>
                    </label>
                  </div>
                </section>

                <section className="rounded-lg border bg-card p-5 shadow-sm flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="mb-5 flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      <h2 className="text-base font-semibold">{i18n.t("settings.generation")}</h2>
                    </div>

                    <div className="grid gap-4">
                      <label className="grid gap-2">
                        <span className={labelClass}>{i18n.t("settings.temperature")}</span>
                        <input
                          type="number"
                          min={0}
                          max={2}
                          step={0.1}
                          value={form.temperature}
                          onChange={(event) => setForm({ ...form, temperature: Number(event.target.value) })}
                          className={fieldClass}
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className={labelClass}>{i18n.t("settings.timeoutSeconds")}</span>
                        <input
                          type="number"
                          min={1}
                          max={3600}
                          step={1}
                          value={form.timeout_seconds}
                          onChange={(event) => setForm({ ...form, timeout_seconds: Number(event.target.value) })}
                          className={fieldClass}
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className={labelClass}>{i18n.t("settings.maxRetries")}</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={1}
                          value={form.max_retries}
                          onChange={(event) => setForm({ ...form, max_retries: Number(event.target.value) })}
                          className={fieldClass}
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className={labelClass}>{i18n.t("settings.reasoningEffort")}</span>
                        <select
                          value={form.reasoning_effort}
                          onChange={(event) => setForm({ ...form, reasoning_effort: event.target.value })}
                          className={fieldClass}
                        >
                          <option value="">{i18n.t("settings.off")}</option>
                          <option value="low">{i18n.t("settings.reasoningEffortLow")}</option>
                          <option value="medium">{i18n.t("settings.reasoningEffortMedium")}</option>
                          <option value="high">{i18n.t("settings.reasoningEffortHigh")}</option>
                          <option value="max">{i18n.t("settings.reasoningEffortMax")}</option>
                        </select>
                        <span className={hintClass}>{i18n.t("settings.reasoningEffortDesc")}</span>
                      </label>

                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{i18n.t("settings.saved")}: </span>
                        <span className="break-all font-mono">{settings.env_path}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-70 cursor-pointer shadow-sm"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? i18n.t("settings.saving") : i18n.t("settings.save")}
                  </button>
                </section>
              </>
            )}
          </form>

          {/* Tenant Data Source Settings */}
          <form onSubmit={submitDataSources} className="rounded-lg border bg-card p-5 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">{i18n.t("settings.dataSourceSettings")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{i18n.t("settings.dataSourceSettingsDesc")}</p>
              </div>
              <div className="flex items-center gap-2 bg-muted/65 p-1 rounded-lg border border-border/80">
                <button
                  type="button"
                  onClick={() => setDataMode("default")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    dataMode === "default"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  默认 (项目配置)
                </button>
                <button
                  type="button"
                  onClick={() => setDataMode("custom")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    dataMode === "custom"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  自定义 (覆盖配置)
                </button>
              </div>
            </div>

            {dataMode === "default" ? (
              <div className="rounded-lg border bg-muted/20 p-8 text-center space-y-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-full w-fit mx-auto">
                  <Database className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">已启用“默认项目数据源配置”</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    当前数据源配置已设置为继承系统管理员配置的全局默认参数（包括 Tushare, iWencai, FRED 等）。如果您想要独立自定义，请点击上方“自定义 (覆盖配置)”按钮。
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={dataSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-70 cursor-pointer shadow-sm"
                >
                  {dataSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  确认保存，使用项目默认数据源
                </button>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                <div className="grid gap-4">
                  <label className="grid gap-2">
                    <span className={labelClass}>{i18n.t("settings.tushareToken")}</span>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="password"
                        value={tushareToken}
                        onChange={(event) => setTushareToken(event.target.value)}
                        className={`${fieldClass} pl-9`}
                        placeholder={tushareStatus}
                        autoComplete="current-password"
                        disabled={clearTushareToken}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={hintClass}>{i18n.t("settings.tushareDesc")}</span>
                      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearTushareToken}
                          onChange={(event) => {
                            setClearTushareToken(event.target.checked);
                            if (event.target.checked) setTushareToken("");
                          }}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        {i18n.t("settings.clearTushareToken")}
                      </label>
                    </div>
                  </label>

                  <label className="grid gap-2">
                    <span className={labelClass}>{i18n.t("settings.iwencaiApiKey")}</span>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="password"
                        value={iwencaiKey}
                        onChange={(event) => setIwencaiKey(event.target.value)}
                        className={`${fieldClass} pl-9`}
                        placeholder={dataSettings.iwencai_key_configured ? i18n.t("settings.configured") : i18n.t("settings.keepCurrentKey")}
                        autoComplete="current-password"
                        disabled={clearIwencaiKey}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={hintClass}>{i18n.t("settings.iwencaiDesc")}</span>
                      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearIwencaiKey}
                          onChange={(event) => {
                            setClearIwencaiKey(event.target.checked);
                            if (event.target.checked) setIwencaiKey("");
                          }}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        {i18n.t("settings.clearSavedKey")}
                      </label>
                    </div>
                  </label>

                  <label className="grid gap-2">
                    <span className={labelClass}>{i18n.t("settings.fredApiKey")}</span>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="password"
                        value={fredApiKey}
                        onChange={(event) => setFredApiKey(event.target.value)}
                        className={`${fieldClass} pl-9`}
                        placeholder={dataSettings.fred_api_key_configured ? i18n.t("settings.configured") : i18n.t("settings.keepCurrentKey")}
                        autoComplete="current-password"
                        disabled={clearFredApiKey}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={hintClass}>{i18n.t("settings.fredDesc")}</span>
                      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearFredApiKey}
                          onChange={(event) => {
                            setClearFredApiKey(event.target.checked);
                            if (event.target.checked) setFredApiKey("");
                          }}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        {i18n.t("settings.clearSavedKey")}
                      </label>
                    </div>
                  </label>

                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{i18n.t("settings.saved")}: </span>
                    <span className="break-all font-mono">{dataSettings.env_path}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={dataSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-70 cursor-pointer shadow-sm"
                  >
                    {dataSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {dataSaving ? i18n.t("settings.saving") : i18n.t("settings.saveDataSourceSettings")}
                  </button>
                </div>

                <div className="rounded-md border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{i18n.t("settings.baostock")}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${dataSettings.baostock_supported ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                      {dataSettings.baostock_supported ? i18n.t("settings.loaderAvailable") : i18n.t("settings.noProjectLoader")}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground font-sans">
                    <p>{dataSettings.baostock_message}</p>
                    <p>
                      {dataSettings.baostock_installed
                        ? i18n.t("settings.pythonPackageInstalled")
                        : i18n.t("settings.pythonPackageNotInstalled")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* --- System Version Card --- */}
      {versionInfo && (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">系统版本管理</h2>
                <p className="text-xs text-muted-foreground mt-0.5">查看当前版本并一键升级到最新版</p>
              </div>
            </div>
            <button
              id="system-version-refresh-btn"
              type="button"
              onClick={() => {
                setVersionLoading(true);
                api.getSystemVersion()
                  .then((info) => setVersionInfo(info))
                  .catch(() => {})
                  .finally(() => setVersionLoading(false));
              }}
              disabled={versionLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${versionLoading ? "animate-spin" : ""}`} />
              刷新版本信息
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {/* Current version */}
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">当前版本</p>
              <p className="font-mono font-semibold text-sm text-foreground">{versionInfo.current_version}</p>
            </div>
            {/* Latest version */}
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">最新版本</p>
              <div className="flex items-center gap-2">
                <p className="font-mono font-semibold text-sm text-foreground">{versionInfo.latest_version}</p>
                {versionInfo.has_update ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    有新版本
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    已是最新
                  </span>
                )}
              </div>
            </div>
          </div>

          {versionInfo.has_update && (
            <button
              id="system-one-click-upgrade-btn"
              type="button"
              onClick={handleTriggerUpgrade}
              disabled={upgrading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition disabled:opacity-70 cursor-pointer"
            >
              {upgrading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="h-4 w-4" />
              )}
              {upgrading ? "正在触发升级…" : `立即升级到 ${versionInfo.latest_version}`}
            </button>
          )}

          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            点击"立即升级"后，系统将在后台执行 <code className="font-mono text-xs bg-muted px-1 rounded">update.sh</code> 拉取最新代码并平滑重启服务。页面将自动进入等待重启状态。
          </p>
        </div>
      )}

      {/* --- MODALS --- */}

      {/* Upgrade Countdown Modal */}
      {showUpgradeModal && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-lg">
          {/* Glassmorphism card */}
          <div className="relative flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-xl text-center max-w-sm w-full mx-4">
            {/* Animated ring */}
            <div className="relative flex items-center justify-center" style={{ height: "128px", width: "128px" }}>
              <svg className="absolute h-28 w-28 -rotate-90 animate-spin-slow" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="6"
                />
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke="rgba(251,191,36,0.7)"
                  strokeWidth="6"
                  strokeLinecap="round"
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

      {/* Feishu Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {editingChannel ? i18n.t("settings.editChannel") : i18n.t("settings.addChannel")}
            </h3>
            <form onSubmit={submitFeishuChannel} className="space-y-4">
              <label className="grid gap-1.5">
                <span className={labelClass}>{i18n.t("settings.channelName")}</span>
                <input
                  type="text"
                  required
                  value={chanName}
                  onChange={(e) => setChanName(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. 飞书监控机器人"
                />
              </label>

              <label className="grid gap-1.5">
                <span className={labelClass}>{i18n.t("settings.feishuAppId")}</span>
                <input
                  type="text"
                  required
                  value={chanAppId}
                  onChange={(e) => setChanAppId(e.target.value)}
                  className={fieldClass}
                  placeholder="cli_xxxxxxxx"
                />
              </label>

              <label className="grid gap-1.5">
                <span className={labelClass}>{i18n.t("settings.feishuAppSecret")}</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    required={!editingChannel}
                    value={chanAppSecret}
                    onChange={(e) => setChanAppSecret(e.target.value)}
                    className={`${fieldClass} pl-9`}
                    placeholder={
                      editingChannel && editingChannel.app_secret_configured
                        ? i18n.t("settings.configured")
                        : "App Secret"
                    }
                    autoComplete="new-password"
                  />
                </div>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chanAllowAllUsers"
                  checked={chanAllowAllUsers}
                  onChange={(e) => setChanAllowAllUsers(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <label htmlFor="chanAllowAllUsers" className="text-xs text-muted-foreground cursor-pointer select-none">
                  {i18n.t("settings.feishuAllowAllUsers")}
                </label>
              </div>

              {!chanAllowAllUsers ? (
                <label className="grid gap-1.5">
                  <span className={labelClass}>{i18n.t("settings.feishuAllowedUsers")}</span>
                  <input
                    type="text"
                    value={chanAllowedUsers}
                    onChange={(e) => setChanAllowedUsers(e.target.value)}
                    className={fieldClass}
                    placeholder="ou_xxxxxxxx,ou_yyyyyyyy"
                  />
                  <span className={hintClass}>{i18n.t("settings.feishuAllowedUsersDesc")}</span>
                </label>
              ) : (
                <div className="rounded-md bg-amber-500/10 p-3.5 text-xs text-amber-500 border border-amber-500/20 leading-relaxed">
                  ⚠️ <strong>{i18n.t("settings.publicDebugMode")}</strong>：
                  {i18n.t("settings.publicDebugModeDesc")}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chanEnabled"
                  checked={chanEnabled}
                  onChange={(e) => setChanEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <label htmlFor="chanEnabled" className="text-xs text-muted-foreground cursor-pointer select-none">
                  {i18n.t("settings.feishuEnabled")}
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent px-4 py-2 text-sm font-medium transition cursor-pointer"
                >
                  {i18n.t("agent.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={feishuSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-70 transition cursor-pointer"
                >
                  {feishuSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {feishuSaving ? i18n.t("settings.saving") : i18n.t("settings.save")}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Tenant Keys Modal */}
      {isTenantModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {generatedKey ? "密钥生成成功" : "生成新租户密钥"}
            </h3>
            
            {generatedKey ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
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
                  <span className={labelClass}>租户备注名称 (例如：量化团队A)</span>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className={fieldClass}
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
                      if (profile?.role === "admin" || profile?.is_local) {
                        try {
                          const keys = await api.getTenantKeys();
                          setTenantKeys(keys);
                        } catch (e) {
                          console.error("Failed to refresh tenant keys list:", e);
                        }
                      }
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
