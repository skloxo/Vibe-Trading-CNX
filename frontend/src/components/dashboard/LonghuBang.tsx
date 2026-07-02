import { useTranslation } from "react-i18next";

interface LonghuItem {
  code: string;
  name: string;
  reason: string;
  netAmount: number; // 净买入（万）
  instBuyCount: number; // 机构买入席位数
  yuziSeat: string; // 知名买入席位
}

interface LonghuBangProps {
  data?: LonghuItem[];
}

export function LonghuBang({ data }: LonghuBangProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const defaultItems: LonghuItem[] = [
    { code: "301550", name: "万丰奥威", reason: "三日涨幅达20%", netAmount: 18500, instBuyCount: 2, yuziSeat: "中信证券西安朱雀大街" },
    { code: "601138", name: "工业富联", reason: "日涨幅偏离值达7%", netAmount: 12400, instBuyCount: 3, yuziSeat: "国泰君安上海分公司" },
    { code: "000063", name: "中兴通讯", reason: "日涨幅偏离值达7%", netAmount: 8900, instBuyCount: 1, yuziSeat: "东方财富拉萨团结路" },
    { code: "300496", name: "中科创达", reason: "日跌幅偏离值达-7%", netAmount: -4200, instBuyCount: 0, yuziSeat: "申万宏源上海分公司" }
  ];

  const items = data && data.length > 0 ? data : defaultItems;

  return (
    <div className="p-3.5 flex flex-col gap-2 h-full w-full">
      <div className="flex justify-between items-center border-b border-border/60 pb-1.5">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">📋 {isEn ? "Dragon-Tiger List" : "龙虎榜席位分析"}</span>
        <span className="text-[9px] text-rose-600 dark:text-[#ff3366] font-bold">{isEn ? "POST-MARKET" : "每日盘后更新"}</span>
      </div>

      <div className="space-y-3 flex-1 overflow-auto">
        {items.map((item) => {
          const isBuy = item.netAmount >= 0;
          return (
            <div key={item.code} className="text-xs border-b border-slate-100 dark:border-[#181827] pb-2 last:border-0 last:pb-0">
              <div className="flex justify-between items-center font-bold">
                <span className="text-slate-900 dark:text-white font-sans">{item.name} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({item.code})</span></span>
                <span className={`font-mono ${isBuy ? "text-rose-600 dark:text-[#ff3366]" : "text-emerald-600 dark:text-[#00ff88]"}`}>
                  {isBuy ? "净买入" : "净卖出"} {Math.abs(item.netAmount / 10000).toFixed(2)}亿
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate font-sans">{item.reason}</p>
              
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                <span>机构席位: <span className="text-slate-800 dark:text-white font-bold">{item.instBuyCount}</span> 家买入</span>
                <span className="truncate max-w-[150px] font-sans">主买: <span className="text-orange-600 dark:text-orange-400 font-bold">{item.yuziSeat}</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
