import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send } from "lucide-react";
import { api } from "../../lib/api";
import { useTranslation } from "react-i18next";

interface Message {
  sender: string;
  content: string;
  isAgent: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  { sender: "System", content: "已连接多智能体协同仿真终端。可以随时质询板块内的决策智能体。", isAgent: false },
  { sender: "游资·游侠", content: "低空航空板块目前主买资金稳健，高位龙头万丰奥威承接力极强。我会继续盯紧大单流入情况，如有资金异动会第一时间发出预警。", isAgent: true },
];

export function AgentChatConsole() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("yuzi");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { sender: "User", content: input, isAgent: false };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    const agentName = selectedAgent === "yuzi" ? "游资·游侠" : "北向资金";
    const loadingMessage: Message = { sender: agentName, content: "正在研判盘面与筹码分布，请稍候...", isAgent: true };
    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const res = await api.sendAgentChatMessage(selectedAgent, currentInput);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.content !== "正在研判盘面与筹码分布，请稍候...");
        return [...filtered, { sender: agentName, content: res.response, isAgent: true }];
      });
    } catch (err: any) {
      console.error("Agent chat failed:", err);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.content !== "正在研判盘面与筹码分布，请稍候...");
        return [...filtered, { sender: agentName, content: `质询请求失败: ${err.message || err}`, isAgent: true }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3.5 flex flex-col gap-2 h-full w-full">
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#222233] pb-1.5 shrink-0">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-[#00abc0] dark:text-[#00e5ff]" />
          {isEn ? "Agent Chat Console" : "智能体交互质询终端"}
        </span>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          disabled={isLoading}
          className="text-[9px] bg-slate-100 dark:bg-[#12121e] border border-slate-200 dark:border-[#222233] rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-350 focus:outline-none disabled:opacity-50"
        >
          <option value="yuzi">游资·游侠 (Agent)</option>
          <option value="beixiang">北向资金 (Agent)</option>
        </select>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto space-y-2 p-1.5 bg-slate-50 dark:bg-[#09090f] border border-slate-100 dark:border-[#1f1f2e] rounded text-[10px] font-mono">
        {messages.map((msg, idx) => (
          <div key={idx} className="leading-relaxed">
            {msg.sender === "System" ? (
              <span className="text-slate-500 font-bold">{`>>> [${msg.sender}] ${msg.content}`}</span>
            ) : (
              <div>
                <span className={`font-bold ${
                  msg.isAgent 
                    ? "text-[#00abc0] dark:text-[#00e5ff]" 
                    : "text-rose-600 dark:text-[#ff3366]"
                }`}>
                  {msg.sender}:{" "}
                </span>
                <span className="text-slate-700 dark:text-slate-350">{msg.content}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSend} className="flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder={isLoading ? "请等待智能体分析中..." : `向 ${selectedAgent === "yuzi" ? "游资·游侠" : "北向资金"} 提问板块或个股主力动向...`}
          className="flex-1 text-[10px] bg-slate-50 dark:bg-[#12121e] border border-slate-200 dark:border-[#222233] px-2.5 py-1.5 rounded text-slate-800 dark:text-slate-350 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-[#00abc0] dark:focus:border-[#00e5ff] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-rose-600 dark:bg-[#ff3366] hover:bg-rose-700 dark:hover:bg-[#ff1a53] text-white px-2.5 py-1 rounded flex items-center justify-center transition-colors disabled:opacity-50"
        >
          <Send className="h-3 w-3" />
        </button>
      </form>
    </div>
  );
}
