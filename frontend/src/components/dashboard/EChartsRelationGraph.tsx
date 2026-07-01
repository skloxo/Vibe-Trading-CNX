import { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface EChartsRelationGraphProps {
  onSelectNode: (nodeName: string | null) => void;
  activeNode: string | null;
}

export function EChartsRelationGraph({ onSelectNode, activeNode }: EChartsRelationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize ECharts instance
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    const option: any = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          if (params.dataType === "node") {
            const data = params.data;
            return `<div style="background:#11111e;border:1px solid #333344;padding:8px;border-radius:4px;color:#fff;font-size:11px;">
              <span style="font-weight:bold;color:${data.itemStyle?.color || '#00e5ff'}">${data.name}</span><br/>
              类型: ${data.categoryName}<br/>
              资金流: ${data.value}
            </div>`;
          }
          return "";
        },
      },
      legend: [
        {
          data: ["题材板块", "热门个股", "AI智能体"],
          textStyle: {
            color: "#94a3b8",
            fontSize: 10,
          },
          icon: "circle",
          bottom: 10,
          left: "center",
        },
      ],
      series: [
        {
          type: "graph",
          layout: "force",
          animation: true,
          draggable: true,
          roam: true,
          focusNodeAdjacency: true,
          force: {
            repulsion: 180,
            edgeLength: 75,
            gravity: 0.1,
          },
          categories: [
            { name: "题材板块" },
            { name: "热门个股" },
            { name: "AI智能体" },
          ],
          nodes: [
            {
              id: "low-alt",
              name: "低空经济",
              value: "主买+3.4亿",
              category: 0,
              categoryName: "题材板块",
              symbolSize: 34,
              itemStyle: {
                color: "#e5a93c",
                borderColor: "rgba(229,169,60,0.4)",
                borderWidth: 4,
              },
            },
            {
              id: "ai-count",
              name: "AI算力",
              value: "主买+4.1亿",
              category: 0,
              categoryName: "题材板块",
              symbolSize: 34,
              itemStyle: {
                color: "#e5a93c",
                borderColor: "rgba(229,169,60,0.4)",
                borderWidth: 4,
              },
            },
            {
              id: "wanfeng",
              name: "万丰奥威",
              value: "净流入+1.2亿",
              category: 1,
              categoryName: "热门个股",
              symbolSize: 26,
              itemStyle: {
                color: "#ff3366",
                borderColor: "rgba(255,51,102,0.4)",
                borderWidth: 3,
              },
            },
            {
              id: "ningde",
              name: "宁德时代",
              value: "净流入+2.8亿",
              category: 1,
              categoryName: "热门个股",
              symbolSize: 26,
              itemStyle: {
                color: "#ff3366",
                borderColor: "rgba(255,51,102,0.4)",
                borderWidth: 3,
              },
            },
            {
              id: "byd",
              name: "比亚迪",
              value: "净流出-4500万",
              category: 1,
              categoryName: "热门个股",
              symbolSize: 26,
              itemStyle: {
                color: "#00ff88",
                borderColor: "rgba(0,255,136,0.4)",
                borderWidth: 3,
              },
            },
            {
              id: "fulan",
              name: "工业富联",
              value: "净流入+1.9亿",
              category: 1,
              categoryName: "热门个股",
              symbolSize: 26,
              itemStyle: {
                color: "#ff3366",
                borderColor: "rgba(255,51,102,0.4)",
                borderWidth: 3,
              },
            },
            {
              id: "yuzi",
              name: "游资·游侠",
              value: "多头倾向",
              category: 2,
              categoryName: "AI智能体",
              symbolSize: 30,
              itemStyle: {
                color: "#00e5ff",
                borderColor: "rgba(0,229,255,0.4)",
                borderWidth: 4,
              },
            },
            {
              id: "beixiang",
              name: "北向资金",
              value: "做多动向",
              category: 2,
              categoryName: "AI智能体",
              symbolSize: 30,
              itemStyle: {
                color: "#00e5ff",
                borderColor: "rgba(0,229,255,0.4)",
                borderWidth: 4,
              },
            },
          ],
          links: [
            { source: "low-alt", target: "wanfeng", lineStyle: { width: 3, color: "rgba(255,51,102,0.6)" } },
            { source: "low-alt", target: "ningde", lineStyle: { width: 2, color: "rgba(255,51,102,0.4)" } },
            { source: "low-alt", target: "byd", lineStyle: { width: 1.5, color: "rgba(0,255,136,0.3)" } },
            { source: "ai-count", target: "fulan", lineStyle: { width: 3, color: "rgba(255,51,102,0.6)" } },
            { source: "yuzi", target: "wanfeng", lineStyle: { width: 2.5, type: "dashed", color: "rgba(0,229,255,0.6)" } },
            { source: "yuzi", target: "low-alt", lineStyle: { width: 2, type: "dashed", color: "rgba(0,229,255,0.5)" } },
            { source: "beixiang", target: "ningde", lineStyle: { width: 2.5, type: "dashed", color: "rgba(0,229,255,0.6)" } },
            { source: "beixiang", target: "byd", lineStyle: { width: 1.5, type: "dashed", color: "rgba(0,229,255,0.4)" } },
          ],
          label: {
            show: true,
            position: "bottom",
            color: "#94a3b8",
            fontSize: 9,
            fontWeight: "bold",
          },
          lineStyle: {
            opacity: 0.8,
            curveness: 0.1,
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: {
              width: 4,
            },
            itemStyle: {
              shadowBlur: 15,
              shadowColor: "#00e5ff",
            },
          },
        },
      ],
    };

    chart.setOption(option);

    // Click handler
    chart.on("click", (params: any) => {
      if (params.dataType === "node") {
        onSelectNode(params.data.id);
      }
    });

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      chart.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [onSelectNode]);

  // Handle activeNode highlighting externally
  useEffect(() => {
    if (!chartRef.current) return;
    if (activeNode) {
      chartRef.current.dispatchAction({
        type: "highlight",
        seriesIndex: 0,
        name: activeNode,
      });
    } else {
      chartRef.current.dispatchAction({
        type: "downplay",
        seriesIndex: 0,
      });
    }
  }, [activeNode]);

  return (
    <div className="relative w-full h-[320px] bg-slate-50 dark:bg-[#09090f] border border-slate-100 dark:border-[#1f1f2e] rounded overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
