import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { api } from "../../lib/api";

interface EChartsRelationGraphProps {
  onSelectNode: (nodeName: string | null) => void;
  activeNode: string | null;
}

export function EChartsRelationGraph({ onSelectNode, activeNode }: EChartsRelationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] } | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  // Watch for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Fetch graph data from backend
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const res = await api.getDashboardGraph();
        if (active && res) {
          setGraphData(res);
        }
      } catch (err) {
        console.error("Failed to load dashboard graph:", err);
      }
    };
    fetchData();
    // Poll every 5 seconds for simulation updates
    const interval = setInterval(fetchData, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Dispose chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
      }
    };
  }, []);

  // Update chart when graphData changes
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    const chart = chartRef.current || echarts.init(containerRef.current);
    chartRef.current = chart;

    // Theme-aware colors
    const tooltipBg = isDark ? "#11111e" : "#ffffff";
    const tooltipBorder = isDark ? "#333344" : "#e2e8f0";
    const tooltipText = isDark ? "#e2e8f0" : "#1e293b";
    const tooltipSubText = isDark ? "#94a3b8" : "#64748b";
    const labelColor = isDark ? "#94a3b8" : "#475569";
    const legendColor = isDark ? "#94a3b8" : "#475569";

    const categories = [
      { name: "题材板块" },
      { name: "热门个股" },
      { name: "AI智能体" },
    ];

    const formattedNodes = graphData.nodes.map((node: any) => {
      let category = 1;
      let symbolSize = 26;
      let defaultColor = "#ff3366";
      let borderColor = "rgba(255,51,102,0.4)";
      let borderWidth = 3;

      if (node.categoryName === "题材板块") {
        category = 0;
        symbolSize = 34;
        defaultColor = "#e5a93c";
        borderColor = "rgba(229,169,60,0.4)";
        borderWidth = 4;
      } else if (node.categoryName === "AI智能体") {
        category = 2;
        symbolSize = 30;
        defaultColor = "#00e5ff";
        borderColor = "rgba(0,229,255,0.4)";
        borderWidth = 4;
      }

      return {
        id: node.id,
        name: node.name,
        value: node.value || "",
        category,
        categoryName: node.categoryName,
        symbolSize,
        itemStyle: {
          color: node.itemStyle?.color || defaultColor,
          borderColor,
          borderWidth,
        }
      };
    });

    const formattedLinks = graphData.links.map((link: any) => {
      const isAgent = link.source.includes("yuzi") || link.source.includes("beixiang") || link.source.includes("bull") || link.source.includes("bear") || link.source.includes("pm") || link.source.includes("conductor") || link.source.includes("analyst");
      return {
        source: link.source,
        target: link.target,
        lineStyle: {
          width: (link.weight || 0.5) * 3,
          type: isAgent ? "dashed" : "solid",
          color: isAgent ? "rgba(0,229,255,0.6)" : "rgba(255,51,102,0.6)"
        }
      };
    });

    const option: any = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        extraCssText: `box-shadow: none;`,
        formatter: (params: any) => {
          if (params.dataType === "node") {
            const data = params.data;
            return `<div style="background:${tooltipBg};border:1px solid ${tooltipBorder};padding:8px 10px;border-radius:6px;font-size:11px;line-height:1.8;box-shadow: 0 4px 20px rgba(0,0,0,${isDark ? "0.5" : "0.08"});">
              <span style="font-weight:bold;font-size:12px;color:${data.itemStyle?.color || '#00e5ff'}">${data.name}</span><br/>
              <span style="color:${tooltipSubText}">类型: <span style="color:${tooltipText}">${data.categoryName}</span></span><br/>
              <span style="color:${tooltipSubText}">详情: <span style="color:${tooltipText}">${data.value || "无数据"}</span></span>
            </div>`;
          }
          return "";
        },
      },
      legend: [
        {
          data: ["题材板块", "热门个股", "AI智能体"],
          textStyle: {
            color: legendColor,
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
          categories,
          nodes: formattedNodes,
          links: formattedLinks,
          label: {
            show: true,
            position: "bottom",
            color: labelColor,
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
      window.removeEventListener("resize", handleResize);
    };
  }, [graphData, onSelectNode, isDark]);

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
