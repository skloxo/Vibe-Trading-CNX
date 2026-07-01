import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send } from "lucide-react";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { sender: "User", content: input, isAgent: false };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate Agent response after 1s
    setTimeout(() => {
      let responseContent = "";
      const agentName = selectedAgent === "yuzi" ? "游资·游侠" : "北向资金";
      
      if (selectedAgent === "yuzi") {
        responseContent = `对于您询问的 [${input}]，我们目前判定主力游资席位依旧是持筹观望为主，万丰奥威连板期间未见明显出货痕迹。若今日回调不破10日均线，倾向于继续加仓做多。`;
      } else {
        responseContent = `根据最新的北向持股异动，[${input}] 关联的宁德时代今日获外资逆势抄底增持约 8200 万元。近期由于估值边际改善，外资对新能源权重股呈持续净买入状态。`;
      }

      setMessages((prev) => [
        ...prev,
        { sender: agentName, content: responseContent, isAgent: true },
      ]);
    }, 1000);
  };

  return (
    <div className="border border-slate-200 dark:border-[#222233] bg-white dark:bg-[#10101a]/80 p-3 flex flex-col gap-2 rounded shadow-sm dark:shadow-none h-[320px]">
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#222233] pb-1.5 shrink-0">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-[#00abc0] dark:text-[#00e5ff]" />
          智能体交互质询终端 (CHAT CONSOLE)
        </span>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="text-[9px] bg-slate-100 dark:bg-[#12121e] border border-slate-200 dark:border-[#222233] rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-350 focus:outline-none"
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
          placeholder={`向 ${selectedAgent === "yuzi" ? "游资·游侠" : "北向资金"} 提问板块或个股主力动向...`}
          className="flex-1 text-[10px] bg-slate-50 dark:bg-[#12121e] border border-slate-200 dark:border-[#222233] px-2.5 py-1.5 rounded text-slate-800 dark:text-slate-350 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-[#00abc0] dark:focus:border-[#00e5ff]"
        />
        <button
          type="submit"
          className="bg-rose-600 dark:bg-[#ff3366] hover:bg-rose-700 dark:hover:bg-[#ff1a53] text-white px-2.5 py-1 rounded flex items-center justify-center transition-colors"
        >
          <Send className="h-3 w-3" />
        </button>
      </form>
    </div>
  );
}
