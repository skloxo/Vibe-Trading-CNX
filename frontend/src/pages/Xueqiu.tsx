import { useState, useEffect, type FormEvent } from "react";
import { 
  Activity, 
  Layers, 
  Plus, 
  Trash2, 
  Loader2, 
  Send, 
  Save, 
  MessageSquare, 
  Key, 
  RefreshCw, 
  History,

  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  TrendingUp
} from "lucide-react";
import { api, type XueqiuSettings, type XueqiuRebalancingLog, type XueqiuComboDetail } from "@/lib/api";
import { toast } from "sonner";
export function Xueqiu() {
  // Settings State
  const [settings, setSettings] = useState<XueqiuSettings | null>(null);
  const [logs, setLogs] = useState<XueqiuRebalancingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);



  // Combo Details State
  const [combosDetails, setCombosDetails] = useState<XueqiuComboDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [expandedCombos, setExpandedCombos] = useState<Record<string, boolean>>({});
  const [expandedStock, setExpandedStock] = useState<Record<string, string | null>>({});

  // Pagination State for Rebalancing Logs
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset to first page when new logs are loaded/refreshed
  useEffect(() => {
    setCurrentPage(1);
  }, [logs]);

  // Forms State
  const [newComboName, setNewComboName] = useState("");
  const [newComboId, setNewComboId] = useState("");
  const [newXqToken, setNewXqToken] = useState("");
  const [newInfluencerName, setNewInfluencerName] = useState("");
  const [newInfluencerUid, setNewInfluencerUid] = useState("");


  const refreshCombosDetails = async () => {
    setDetailsLoading(true);
    try {
      const detailsData = await api.getXueqiuCombosDetails();
      setCombosDetails(detailsData);
    } catch (error) {
      console.error("加载组合持仓详情失败:", error);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsData, logsData] = await Promise.all([
        api.getXueqiuSettings(),
        api.getXueqiuLogs()
      ]);
      setSettings(settingsData);
      setLogs(logsData);
      
      if (settingsData && Object.keys(settingsData.combos).length > 0) {
        refreshCombosDetails();
      }
    } catch (error) {
      toast.error("加载数据失败");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const refreshLogs = async () => {
    setLogsLoading(true);
    try {
      const logsData = await api.getXueqiuLogs();
      setLogs(logsData);
      toast.success("调仓日志已刷新");
    } catch (error) {
      toast.error("刷新调仓日志失败");
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Actions
  const handleSaveSettings = async (updated: XueqiuSettings) => {
    setSaving(true);
    try {
      const saved = await api.updateXueqiuSettings(updated);
      setSettings(saved);
      toast.success("配置已保存");
      if (saved && Object.keys(saved.combos).length > 0) {
        refreshCombosDetails();
      } else {
        setCombosDetails([]);
      }
    } catch (error) {
      toast.error("保存配置失败");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = () => {
    if (!settings) return;
    handleSaveSettings({
      ...settings,
      enabled: !settings.enabled
    });
  };

  const handleTestWebhook = async () => {
    if (!settings?.feishu_webhook) {
      toast.error("请先填写并保存飞书 Webhook 地址");
      return;
    }
    setTesting(true);
    try {
      await api.testXueqiuWebhook(settings.feishu_webhook);
      toast.success("测试通知已推送，请在飞书群中查看");
    } catch (error) {
      toast.error("推送测试失败，请检查 Webhook URL");
    } finally {
      setTesting(false);
    }
  };

  const handleAddCombo = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const name = newComboName.trim();
    const id = newComboId.trim().toUpperCase();
    if (!name || !id) {
      toast.error("组合名称或ID不能为空");
      return;
    }
    if (!id.startsWith("ZH")) {
      toast.error("组合ID必须以 ZH 开头，例如 ZH123456");
      return;
    }
    if (settings.combos[name]) {
      toast.error(`组合名称「${name}」已存在`);
      return;
    }
    const updated = {
      ...settings,
      combos: {
        ...settings.combos,
        [name]: id
      }
    };
    setNewComboName("");
    setNewComboId("");
    await handleSaveSettings(updated);
  };

  const handleDeleteCombo = async (name: string) => {
    if (!settings) return;
    const newCombos = { ...settings.combos };
    delete newCombos[name];
    await handleSaveSettings({
      ...settings,
      combos: newCombos
    });
  };

  const handleAddInfluencer = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const name = newInfluencerName.trim();
    const uid = newInfluencerUid.trim();
    if (!name || !uid) {
      toast.error("大 V 名称或 UID 不能为空");
      return;
    }
    if (!/^\d+$/.test(uid)) {
      toast.error("大 V UID 必须为纯数字（雪球个人主页 URL 末尾数字）");
      return;
    }
    const watchUids = settings.watch_uids || {};
    if (watchUids[name]) {
      toast.error(`大 V 名称「${name}」已存在`);
      return;
    }
    const updated = {
      ...settings,
      watch_uids: {
        ...watchUids,
        [name]: uid
      }
    };
    setNewInfluencerName("");
    setNewInfluencerUid("");
    await handleSaveSettings(updated);
  };

  const handleDeleteInfluencer = async (name: string) => {
    if (!settings) return;
    const watchUids = { ...(settings.watch_uids || {}) };
    delete watchUids[name];
    await handleSaveSettings({
      ...settings,
      watch_uids: watchUids
    });
  };

  const handleAddToken = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const token = newXqToken.trim();
    if (!token) return;
    if (settings.xq_tokens.includes(token)) {
      toast.error("Token 已存在池中");
      return;
    }
    const updated = {
      ...settings,
      xq_tokens: [...settings.xq_tokens, token]
    };
    setNewXqToken("");
    await handleSaveSettings(updated);
  };

  const handleDeleteToken = async (index: number) => {
    if (!settings) return;
    await handleSaveSettings({
      ...settings,
      xq_tokens: settings.xq_tokens.filter((_, i) => i !== index)
    });
  };



  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span>加载雪球监控配置中…</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-red-500">
        <AlertCircle className="h-8 w-8" />
        <span>无法获取雪球监控配置，请刷新重试</span>
      </div>
    );
  }

  // Paginated Logs calculation
  const totalLogs = logs.length;
  const totalPages = Math.ceil(totalLogs / pageSize) || 1;
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">雪球组合监控监控平台</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            实时监测配置的雪球组合持仓变动，自动组装富文本卡片并推送到飞书群组。支持租户独立配置隔离。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            监控服务状态: {settings.enabled ? "🟢 运行中" : "🔴 已停用"}
          </span>
          <button
            type="button"
            onClick={handleToggleEnabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                settings.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Configuration Panels */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Token Acquisition Guide Card */}
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm border-b pb-2">
              <Key className="h-4 w-4" />
              <span>获取雪球登录凭证 (xq_a_token)</span>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                因雪球安全机制升级，其关键令牌 <strong>xq_a_token</strong> 被标记为了 <strong>HttpOnly</strong>，任何网页脚本（含书签小工具）均被浏览器物理阻断读取。请按以下简易步骤手动获取：
              </p>
              
              <div className="bg-muted/10 border rounded p-3 space-y-2.5 text-[11px] text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">1</span>
                  <span>
                    在电脑浏览器中打开并登录 <a href="https://xueqiu.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5">雪球官网 (xueqiu.com)<ExternalLink className="h-2.5 w-2.5" /></a>。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">2</span>
                  <span>
                    在页面任意空白处右键选择 <strong>“检查”</strong>（或按键盘 <strong>F12</strong>）打开工具栏。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">3</span>
                  <span>
                    在控制面板顶部选择 <strong>“Application (应用)”</strong> 选项卡（部分浏览器显示为“存储”）。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">4</span>
                  <span>
                    在左侧菜单展开 <strong>“Cookies”</strong> 并点击 <code>https://xueqiu.com</code>。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">5</span>
                  <span>
                    在列表中双击 <strong><code>xq_a_token</code></strong> 后方的 Value（值）并进行复制。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">6</span>
                  <span>
                    将值粘贴到下方<strong>【xq_a_token 令牌池】</strong>输入框中并点击<strong>“添加”</strong>保存即可。
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Webhook & Notification Settings */}
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-semibold text-sm border-b pb-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span>通知接收通道</span>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">飞书 Webhook 地址</label>
                <input
                  type="text"
                  value={settings.feishu_webhook}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, feishu_webhook: e.target.value } : null)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testing || saving}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-input bg-background hover:bg-accent text-xs font-medium transition h-9 cursor-pointer disabled:opacity-50"
                >
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  测试推送
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSettings(settings)}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary text-primary-foreground text-xs font-medium transition h-9 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存配置
                </button>
              </div>
            </div>
          </div>

          {/* Manual Token Pool */}
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Key className="h-4 w-4 text-primary" />
                <span>xq_a_token 令牌池</span>
              </div>
              <span className="text-[10px] text-muted-foreground">自定义/轮换</span>
            </div>
            
            <div className="space-y-3">
              {settings.xq_tokens.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded bg-muted/5">
                  当前无自定义 Token。将使用系统预设共享池。
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {settings.xq_tokens.map((token, index) => (
                    <div key={index} className="flex items-center gap-1 rounded bg-muted/30 px-2 py-1 text-[10px] border font-mono shadow-sm">
                      <span className="truncate max-w-[120px]" title={token}>{token}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteToken(index)}
                        className="text-red-400 hover:text-red-500 rounded p-0.5"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddToken} className="flex gap-2 pt-2 border-t">
                <input
                  type="text"
                  required
                  value={newXqToken}
                  onChange={(e) => setNewXqToken(e.target.value)}
                  className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-3 text-[10px] shadow-sm transition-colors focus-visible:outline-none placeholder:text-muted-foreground font-mono"
                  placeholder="手动粘贴 xq_a_token"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-primary text-primary-foreground text-xs font-medium transition px-2.5 h-8 cursor-pointer hover:bg-primary/95"
                >
                  <Plus className="h-3 w-3" />
                  添加
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Side: Combo CRUD and Rebalancing History Logs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Combinations Management Dashboard */}
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Layers className="h-4 w-4 text-primary" />
                <span>监控组合持仓与净值</span>
              </div>
              <button
                type="button"
                onClick={refreshCombosDetails}
                disabled={detailsLoading}
                className="inline-flex items-center justify-center gap-1 rounded border px-2 py-0.5 text-xs bg-background hover:bg-accent text-muted-foreground font-medium transition cursor-pointer disabled:opacity-50"
              >
                {detailsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                刷新持仓
              </button>
            </div>
            
            <div className="space-y-4">
              {Object.keys(settings.combos).length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground bg-muted/10 rounded-lg">
                  暂未添加任何监控组合。请在下方输入框添加要监控的组合 ID。
                </div>
              ) : detailsLoading && combosDetails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>正在获取组合最新净值与持仓数据…</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* List of Combos */}
                  {Object.entries(settings.combos).map(([name, id]) => {
                    const detail = combosDetails.find(d => d.symbol === id);
                    const isExpanded = !!expandedCombos[id];
                    
                    // Format gains defensively
                    const totalGain = typeof detail?.total_gain === 'number' ? parseFloat(detail.total_gain.toFixed(2)) : null;
                    const dailyGain = typeof detail?.daily_gain === 'number' ? parseFloat(detail.daily_gain.toFixed(2)) : null;
                    const monthlyGain = typeof detail?.monthly_gain === 'number' ? parseFloat(detail.monthly_gain.toFixed(2)) : null;
                    
                    const toggleCombo = (sym: string) => {
                      setExpandedCombos(prev => ({ ...prev, [sym]: !prev[sym] }));
                    };
                    
                    return (
                      <div 
                        key={id} 
                        className="rounded-lg border bg-card/50 shadow-sm overflow-hidden hover:border-primary/20 transition-all duration-200"
                      >
                        {/* Combo Header Row */}
                        <div 
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-3 bg-muted/10 border-b cursor-pointer hover:bg-muted/20 select-none transition"
                          onClick={() => toggleCombo(id)}
                        >
                          {/* Name and Link */}
                          <div className="space-y-0.5 min-w-0 md:flex-1">
                            <div className="font-bold text-sm text-foreground flex items-center gap-2">
                              <span>{name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{id}</span>
                            </div>
                            <a 
                              href={`https://xueqiu.com/P/${id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()} // Stop propagation so link clicks don't toggle expansion
                              className="font-mono text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5 mt-0.5"
                            >
                              在线查看详情
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>

                          {/* Stats Summary */}
                          {detail && !detail.error ? (
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs">
                              {/* Net Asset Value */}
                              <div className="flex flex-col md:items-end">
                                <span className="text-[10px] text-muted-foreground">当前净值</span>
                                <span className="font-mono font-bold text-foreground">{typeof detail.net_value === 'number' ? detail.net_value.toFixed(4) : '--'}</span>
                              </div>
                              {/* Daily Gain */}
                              <div className="flex flex-col md:items-end">
                                <span className="text-[10px] text-muted-foreground">日收益率</span>
                                <span className={`font-mono font-semibold ${
                                  dailyGain === null ? 'text-muted-foreground' :
                                  dailyGain > 0 ? 'text-rose-500' :
                                  dailyGain < 0 ? 'text-emerald-500' : 'text-muted-foreground'
                                }`}>
                                  {dailyGain !== null ? `${dailyGain > 0 ? '+' : ''}${dailyGain}%` : '--'}
                                </span>
                              </div>
                              {/* Monthly Gain */}
                              <div className="flex flex-col md:items-end">
                                <span className="text-[10px] text-muted-foreground">月收益率</span>
                                <span className={`font-mono font-bold ${
                                  monthlyGain === null ? 'text-muted-foreground' :
                                  monthlyGain > 0 ? 'text-rose-500' :
                                  monthlyGain < 0 ? 'text-emerald-500' : 'text-muted-foreground'
                                }`}>
                                  {monthlyGain !== null ? `${monthlyGain > 0 ? '+' : ''}${monthlyGain}%` : '--'}
                                </span>
                              </div>
                              {/* Total Gain */}
                              <div className="flex flex-col md:items-end">
                                <span className="text-[10px] text-muted-foreground">累计收益</span>
                                <span className={`font-mono font-bold ${
                                  totalGain === null ? 'text-muted-foreground' :
                                  totalGain > 0 ? 'text-rose-500' :
                                  totalGain < 0 ? 'text-emerald-500' : 'text-muted-foreground'
                                }`}>
                                  {totalGain !== null ? `${totalGain > 0 ? '+' : ''}${totalGain}%` : '--'}
                                </span>
                              </div>
                            </div>
                          ) : detail?.error ? (
                            <div className="text-xs text-amber-500 font-medium flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>{detail.error}</span>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              <span>获取数据中…</span>
                            </div>
                          )}

                          {/* Expand/Collapse Chevron & Delete */}
                          <div className="flex items-center justify-end gap-2 border-t md:border-t-0 pt-2 md:pt-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleCombo(id)}
                              className="text-muted-foreground hover:text-foreground rounded p-1 hover:bg-muted transition"
                              title={isExpanded ? "收起持仓" : "展开持仓"}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCombo(name)}
                              className="text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded p-1 transition"
                              title="删除监控"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Holdings Panel */}
                        {isExpanded && (
                          <div className="p-4 bg-muted/5 border-t space-y-3">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 border-b pb-1">
                              <TrendingUp className="h-3 w-3" />
                              <span>当前持仓明细 ({detail?.holdings?.length || 0} 只)</span>
                            </div>

                            {!detail ? (
                              <div className="flex items-center gap-2 py-4 justify-center text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                正在查询雪球实时持仓…
                              </div>
                            ) : detail.error ? (
                              <div className="text-xs text-amber-500 bg-amber-500/5 border border-amber-500/10 rounded-md p-3 font-medium flex items-center gap-1.5">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{detail.error}</span>
                              </div>
                            ) : !detail.holdings || detail.holdings.length === 0 ? (
                              <div className="text-xs text-muted-foreground py-4 text-center">
                                当前为空仓运行状态。
                              </div>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                {detail.holdings.map((h, hidx) => {
                                  const weight = typeof h.weight === 'number' ? h.weight : 0;
                                  const isStockHistoryExpanded = expandedStock[id] === h.stock_symbol;
                                  const stockLogs = logs.filter(log => log.combo_id === id && log.stock_symbol === h.stock_symbol);
                                  
                                  const toggleStockHistory = (comboId: string, symbol: string) => {
                                    setExpandedStock(prev => ({
                                      ...prev,
                                      [comboId]: prev[comboId] === symbol ? null : symbol
                                    }));
                                  };
                                  
                                  return (
                                    <div 
                                      key={hidx} 
                                      onClick={() => toggleStockHistory(id, h.stock_symbol)}
                                      className="bg-card border rounded p-2.5 flex flex-col gap-2 text-xs hover:border-primary/30 hover:bg-muted/5 transition select-none cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <div className="min-w-0 pr-2">
                                          <div className="font-semibold truncate text-foreground flex items-center gap-1.5">
                                            <span>{h.stock_name}</span>
                                            {stockLogs.length > 0 && (
                                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary scale-90 origin-left font-bold">
                                                {stockLogs.length}次调仓
                                              </span>
                                            )}
                                          </div>
                                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{h.stock_symbol}</div>
                                        </div>
                                        <div className="text-right shrink-0 space-y-1">
                                          <div className="font-mono font-bold text-primary">{weight.toFixed(2)}%</div>
                                          <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                                            <div 
                                              className="bg-primary h-full rounded-full" 
                                              style={{ width: `${Math.min(weight, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {isStockHistoryExpanded && (
                                        <div className="pt-2 border-t text-[11px] space-y-1.5 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                          <div className="font-semibold text-foreground flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80 pb-0.5">
                                            <History className="h-3 w-3 text-primary" />
                                            <span>📜 调仓历史明细</span>
                                          </div>
                                          {stockLogs.length === 0 ? (
                                            <div className="text-[10px] text-muted-foreground/80 py-1">本租户监控启动后，该标的尚未发生调仓行为。</div>
                                          ) : (
                                            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 divide-y divide-muted/10 font-mono text-[10px]">
                                              {stockLogs.map((slog, sidx) => (
                                                <div key={sidx} className="flex justify-between items-center py-1 gap-2">
                                                  <span className="text-muted-foreground/80 shrink-0">{slog.trade_time.split(' ')[0]}</span>
                                                  <span className={`font-bold shrink-0 ${
                                                    slog.operation.includes("买") || slog.operation.includes("加") ? "text-rose-500" : "text-emerald-500"
                                                  }`}>{slog.operation}</span>
                                                  <span className="text-foreground font-semibold shrink-0">价格:{slog.price}</span>
                                                  <span className="text-muted-foreground shrink-0">{slog.prev_weight}% → {slog.current_weight}%</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleAddCombo} className="flex flex-col sm:flex-row gap-3 pt-3 border-t">
                <input
                  type="text"
                  required
                  value={newComboName}
                  onChange={(e) => setNewComboName(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:flex-1"
                  placeholder="组合名称 (如: 腾讯价值群力)"
                />
                <input
                  type="text"
                  required
                  value={newComboId}
                  onChange={(e) => setNewComboId(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-48 font-mono"
                  placeholder="组合ID (如: ZH104325)"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-primary text-primary-foreground text-xs font-medium h-9 px-4 cursor-pointer hover:bg-primary/95 shadow"
                >
                  <Plus className="h-4 w-4" />
                  添加组合
                </button>
              </form>
            </div>
          </div>

          {/* Watchlist Monitor Card */}
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm border-b pb-2">
              <TrendingUp className="h-4 w-4" />
              <span>关注大 V 自选股监控 (实时盯梢)</span>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              除了监控具体的组合调仓外，系统还支持监控指定大 V 的<strong>“自选股列表”</strong>变动（新增或移出）。大 V 新增自选股往往是建仓的先期信号。
            </p>

            <div className="space-y-3">
              {(!settings || !settings.watch_uids || Object.keys(settings.watch_uids).length === 0) ? (
                <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 rounded-lg">
                  暂未添加监控的自选股大 V。请在下方输入大 V 的 UID 添加。
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {Object.entries(settings.watch_uids).map(([name, uid]) => (
                    <div 
                      key={uid} 
                      className="bg-card border rounded p-3 flex items-center justify-between text-xs hover:border-primary/20 transition shadow-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold truncate text-foreground">{name}</div>
                        <a 
                          href={`https://xueqiu.com/u/${uid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5 mt-0.5"
                        >
                          UID: {uid}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteInfluencer(name)}
                        className="text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded p-1.5 transition shrink-0"
                        title="删除监控"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddInfluencer} className="flex flex-col sm:flex-row gap-3 pt-3 border-t">
                <input
                  type="text"
                  required
                  value={newInfluencerName}
                  onChange={(e) => setNewInfluencerName(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:flex-1"
                  placeholder="大 V 备注名称 (如: 趋势投机)"
                />
                <input
                  type="text"
                  required
                  value={newInfluencerUid}
                  onChange={(e) => setNewInfluencerUid(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-48 font-mono"
                  placeholder="用户 UID (如: 1042741656)"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-primary text-primary-foreground text-xs font-medium h-9 px-4 cursor-pointer hover:bg-primary/95 shadow"
                >
                  <Plus className="h-4 w-4" />
                  添加大 V
                </button>
              </form>
            </div>
          </div>

          {/* Rebalancing Log History Table */}
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Activity className="h-4 w-4 text-primary" />
                <span>实时调仓历史日志</span>
              </div>
              <button
                type="button"
                onClick={refreshLogs}
                disabled={logsLoading}
                className="inline-flex items-center justify-center gap-1 rounded border px-2.5 py-1 text-xs bg-background hover:bg-accent text-muted-foreground font-medium transition cursor-pointer disabled:opacity-50"
              >
                {logsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                刷新日志
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b text-muted-foreground font-medium">
                    <th className="p-3">调仓时间</th>
                    <th className="p-3">组合名称</th>
                    <th className="p-3">标的信息</th>
                    <th className="p-3 text-center">操作</th>
                    <th className="p-3 text-right">旧仓位</th>
                    <th className="p-3 text-right">新仓位</th>
                    <th className="p-3 text-right">仓位变动</th>
                    <th className="p-3 text-right">价格</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        暂无调仓历史日志。当监控服务触发实际调仓时，记录会自动归集于此。
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log, index) => {
                      const isBuy = log.operation.includes("买") || log.operation.includes("加");
                      const isSell = log.operation.includes("卖") || log.operation.includes("减");
                      
                      return (
                        <tr key={index} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-muted-foreground whitespace-nowrap">{log.trade_time}</td>
                          <td className="p-3 font-medium text-foreground">{log.combo_name}</td>
                          <td className="p-3">
                            <div className="font-medium text-foreground">{log.stock_name}</div>
                            <div className="font-mono text-muted-foreground text-[10px]">{log.stock_symbol}</div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isBuy ? "bg-green-500/10 text-green-500" :
                              isSell ? "bg-red-500/10 text-red-500" :
                              "bg-orange-500/10 text-orange-500"
                            }`}>
                              {log.operation}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono">{log.operation.includes("自选") ? "--" : `${log.prev_weight}%`}</td>
                          <td className="p-3 text-right font-mono">{log.operation.includes("自选") ? "--" : `${log.current_weight}%`}</td>
                          <td className={`p-3 text-right font-mono font-semibold ${
                            log.operation.includes("自选") ? "text-muted-foreground" :
                            log.position_change > 0 ? "text-green-500" :
                            log.position_change < 0 ? "text-red-500" :
                            "text-muted-foreground"
                          }`}>
                            {log.operation.includes("自选") ? "--" : (log.position_change > 0 ? `+${log.position_change}%` : `${log.position_change}%`)}
                          </td>
                          <td className="p-3 text-right font-mono text-muted-foreground">{log.price}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalLogs > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t text-xs text-muted-foreground select-none">
                <div className="flex items-center gap-2">
                  <span>每页显示</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded border bg-background px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  >
                    <option value={20}>20 条</option>
                    <option value={50}>50 条</option>
                    <option value={100}>100 条</option>
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <span>
                    第 <span className="font-semibold text-foreground">{currentPage}</span> / <span className="font-semibold text-foreground">{totalPages}</span> 页 (共 {totalLogs} 条记录)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border bg-background hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border bg-background hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
