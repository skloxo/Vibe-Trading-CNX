import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  ShieldCheck, 
  Activity, 
  CheckCircle2, 
  Loader2, 
  XCircle,
  Key
} from "lucide-react";
import { api } from "@/lib/api";

export function XueqiuAuth() {
  const [searchParams] = useSearchParams();
  const qrcodeId = searchParams.get("id");

  const [token, setToken] = useState("b9696defb7a32f1ad38bfaab4555508ca2f5ed33");
  const [scanned, setScanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trigger scan state on backend when page is loaded
  useEffect(() => {
    if (!qrcodeId) {
      setError("缺少二维码会话 ID (id)。无法进行授权。");
      return;
    }

    const reportScan = async () => {
      try {
        await api.scanXueqiuQRCode(qrcodeId);
        setScanned(true);
      } catch (err) {
        console.error("Failed to notify scan event", err);
      }
    };

    reportScan();
  }, [qrcodeId]);

  const handleAuthorize = async () => {
    if (!qrcodeId) return;
    if (!token.trim()) {
      setError("Token 不能为空");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.confirmXueqiuQRCode(qrcodeId, token.trim());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认授权失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-slate-700 bg-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Decorative background gradient */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">雪球三方授权登录模拟器</h1>
            <p className="text-xs text-slate-400 mt-1">本地沙箱环境安全验证</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          // Success State
          <div className="space-y-6 py-4 text-center">
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-500">
                <CheckCircle2 className="h-10 w-10 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-green-400">授权确认成功！</h3>
                <p className="text-xs text-slate-400">令牌已安全注入租户的配置中</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
              您可以安全地关闭此浏览器窗口，并返回 Vibe-Trading-CNX 主界面以开始监控组合。
            </p>
          </div>
        ) : (
          // Normal State
          <div className="space-y-4">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 text-xs space-y-2 leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>授权提示</span>
              </div>
              <p className="text-slate-400">
                Vibe-Trading-CNX 量化交易工作站正在申请获取您的雪球授权令牌。授权后，系统将自动读取您的组合调仓变动。
              </p>
              {scanned && (
                <p className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded inline-block">
                  ✓ 检测到已在主界面扫码/打开链接
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-primary" />
                雪球 xq_a_token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono text-slate-200"
                placeholder="请输入 xq_a_token"
              />
              <p className="text-[10px] text-slate-500">
                支持手动修改为您的真实 Token，默认预填测试模拟 Token。
              </p>
            </div>

            <button
              onClick={handleAuthorize}
              disabled={submitting || !qrcodeId}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold h-10 transition hover:bg-primary/95 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>提交授权中…</span>
                </>
              ) : (
                <span>确认授权并登录</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
