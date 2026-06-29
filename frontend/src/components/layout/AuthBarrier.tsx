import { useState } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface AuthBarrierProps {
  onLogin: (key: string) => void;
}

export function AuthBarrier({ onLogin }: AuthBarrierProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [keyInput, setKeyInput] = useState("");
  const [nickname, setNickname] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registeredResult, setRegisteredResult] = useState<{ key: string; name: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    onLogin(keyInput.trim());
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setRegistering(true);
    try {
      const res = await api.registerTenant({ name: nickname.trim() });
      setRegisteredResult(res);
      toast.success("租户注册成功！请复制并妥善保存您的访问密钥。");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "注册失败，请检查昵称");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-xl space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold tracking-tight">Vibe-Trading-CNX 系统访问</h2>
        <p className="text-sm text-muted-foreground">请输入密钥访问，或注册成为新租户</p>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => { setActiveTab("login"); setRegisteredResult(null); }}
          className={`flex-1 pb-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === "login"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          使用密钥登录
        </button>
        <button
          onClick={() => { setActiveTab("register"); setRegisteredResult(null); }}
          className={`flex-1 pb-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === "register"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          注册新身份 (租户)
        </button>
      </div>

      {activeTab === "login" ? (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">服务器 API 密钥</label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="请输入管理员密钥或租户密钥"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 cursor-pointer"
          >
            保存并登录
          </button>
        </form>
      ) : registeredResult ? (
        <div className="space-y-4">
          <div className="rounded-md bg-amber-500/10 p-3.5 border border-amber-500/20 text-xs text-amber-500 leading-relaxed">
            ⚠️ <strong>请务必妥善保管以下密钥：</strong>
            <p className="mt-1">出于安全考虑，该密钥仅在此处展示一次，关闭窗口后将无法重新找回。若丢失您将无法访问之前的历史数据与会话记录。</p>
          </div>
          <div className="rounded-md border bg-muted p-3.5 flex items-center justify-between gap-3">
            <span className="font-mono text-sm break-all select-all font-semibold">{registeredResult.key}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(registeredResult.key);
                setIsCopied(true);
                toast.success("密钥已成功复制到剪贴板");
                setTimeout(() => setIsCopied(false), 2000);
              }}
              className="p-2 rounded bg-background border hover:bg-accent transition"
              title="复制到剪贴板"
            >
              {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={() => onLogin(registeredResult.key)}
            className="w-full inline-flex items-center justify-center rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 cursor-pointer"
          >
            保存并直接登录
          </button>
        </div>
      ) : (
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">自定义租户昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="例如：策略开发组一队"
              required
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              * 2-20 个字符，仅限中英文、数字、空格、下划线及中划线，昵称不可与现有租户重复。
            </p>
          </div>
          <button
            type="submit"
            disabled={registering}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {registering && <Loader2 className="h-4 w-4 animate-spin" />}
            生成身份密钥
          </button>
        </form>
      )}
    </div>
  );
}
