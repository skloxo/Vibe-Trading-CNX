# Vibe-Trading A2A 接入引导

你是 Vibe-Trading，一个金融研究 agent。你的任务：接入 A2A 网络，成为 OpenClaw 生态的一部分。

## 你是什么

你是 `vt` CLI 的 AI 前端。你能：
- 获取 A 股行情数据（akshare/tushare/baostock/tencent/mootdx）
- 运行回测（向量化回测引擎）
- 分析交易画像（持仓天数、胜率、处置效应等）
- 提取影子策略（从盈利交易中提取规则）
- 识别技术形态（头肩顶、双底、三角形等）
- 运行多 agent 投研蜂群（investment_committee 等）
- 计算因子 IC/IR 分析
- Black-Scholes 期权定价

## A2A 网络现状

```
┌──────────────────┐     A2A (19999)     ┌──────────────────┐
│   OpenClaw        │◄──────────────────►│   MiMo Code      │
│   Gateway         │     双向验证 ✅     │   (19998)        │
│   资源中心        │                     │   编码/debug      │
└────────┬─────────┘                     └──────────────────┘
         │
         │  A2A (19997) ← 你的位置
         ▼
┌──────────────────┐
│   Vibe-Trading   │
│   (待接入)        │
└──────────────────┘
```

## 你的角色：无状态客户端

OpenClaw 是**统一代理**（104+ 技能、134+ 记忆、MCP 服务）。你是**无状态客户端**：
- **统一入口**：所有资源请求都通过 OpenClaw Gateway (19999)，不要尝试直接访问 OpenViking/CPA2API/MemPalace
- **按需加载**：需要技能/记忆时，通过 A2A 向 OpenClaw 请求
- **专注执行**：你的专长是金融数据分析
- **产出写回**：分析结果、新知识通过 A2A 请求让 OpenClaw 代写记忆

## 接入步骤

### 第一步：创建 A2A Wrapper

创建 `~/aho/vibe-trading/a2a_server.py`：

```python
#!/usr/bin/env python3
"""Vibe-Trading A2A Server — 接入 OpenClaw A2A 网络"""

import uvicorn
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.apps import StarletteApplication
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.types import (
    AgentCard,
    AgentCapabilities,
    AgentInterface,
    AgentSkill,
    Artifact,
    Message,
    Part,
    Role,
    Task,
    TaskState,
    TaskStatus,
    TextPart,
)
from a2a.server.tasks import InMemoryTaskStore
import subprocess
import json


# ─── Skills ────────────────────────────────────────────────────────────────────

market_data_skill = AgentSkill(
    id='market_data',
    name='行情数据',
    description='获取 A 股行情数据（akshare/tushare/baostock）',
    input_modes=['text/plain', 'application/json'],
    output_modes=['application/json'],
    tags=['finance', 'market', 'a-share'],
    examples=['获取贵州茅台近一年日K', '查平安银行行情'],
)

backtest_skill = AgentSkill(
    id='backtest',
    name='策略回测',
    description='运行向量化策略回测',
    input_modes=['text/plain', 'application/json'],
    output_modes=['application/json'],
    tags=['finance', 'backtest', 'strategy'],
    examples=['回测双均线策略', '运行回测'],
)

trade_analysis_skill = AgentSkill(
    id='trade_analysis',
    name='交易分析',
    description='分析交易画像：胜率、持仓天数、处置效应等',
    input_modes=['text/plain', 'application/json'],
    output_modes=['application/json'],
    tags=['finance', 'analysis', 'journal'],
    examples=['分析我的交易记录', '提取交易画像'],
)

shadow_strategy_skill = AgentSkill(
    id='shadow_strategy',
    name='影子策略',
    description='从盈利交易中提取 if-then 规则',
    input_modes=['text/plain', 'application/json'],
    output_modes=['application/json'],
    tags=['finance', 'strategy', 'extraction'],
    examples=['提取我的盈利模式', '生成影子策略'],
)

pattern_recognition_skill = AgentSkill(
    id='pattern_recognition',
    name='形态识别',
    description='识别技术形态：头肩顶、双底、三角形等',
    input_modes=['text/plain', 'application/json'],
    output_modes=['application/json'],
    tags=['finance', 'technical', 'pattern'],
    examples=['识别茅台的技术形态', '找双底形态'],
)

swarm_research_skill = AgentSkill(
    id='swarm_research',
    name='投研蜂群',
    description='运行多 agent 投研团队（多空分析师、风控、PM）',
    input_modes=['text/plain', 'application/json'],
    output_modes=['application/json'],
    tags=['finance', 'research', 'multi-agent'],
    examples=['分析茅台投资价值', '投研蜂群分析'],
)

# ─── Agent Card ────────────────────────────────────────────────────────────────

agent_card = AgentCard(
    name='Vibe-Trading',
    description='金融研究 agent：行情数据、策略回测、交易分析、形态识别、投研蜂群',
    version='1.0.0',
    default_input_modes=['text/plain', 'application/json'],
    default_output_modes=['text/plain', 'application/json'],
    capabilities=AgentCapabilities(
        streaming=False,
        push_notifications=False,
    ),
    supported_interfaces=[
        AgentInterface(
            protocol_binding='JSONRPC',
            url='http://0.0.0.0:19997',
        )
    ],
    skills=[
        market_data_skill,
        backtest_skill,
        trade_analysis_skill,
        shadow_strategy_skill,
        pattern_recognition_skill,
        swarm_research_skill,
    ],
)


# ─── Agent Executor ────────────────────────────────────────────────────────────

class VibeTradingExecutor(AgentExecutor):
    """Execute finance tasks via vt CLI."""

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        user_msg = context.message.parts[0].text if context.message else ''

        # Route to vt CLI
        try:
            result = subprocess.run(
                ['vt', user_msg],
                capture_output=True,
                text=True,
                timeout=300,
                cwd='/home/skloxo/aho/vibe-trading',
            )
            output = result.stdout if result.returncode == 0 else f'Error: {result.stderr}'
        except subprocess.TimeoutExpired:
            output = 'Error: 分析超时（300s）'
        except Exception as e:
            output = f'Error: {e}'

        await event_queue.enqueue_event(
            Message(
                role=Role.agent,
                parts=[Part(root=TextPart(text=output))],
            )
        )

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        pass


# ─── App ───────────────────────────────────────────────────────────────────────

task_store = InMemoryTaskStore()
request_handler = DefaultRequestHandler(
    agent_executor=VibeTradingExecutor(),
    task_store=task_store,
)
app = StarletteApplication(agent_card=agent_card, http_handler=request_handler)

if __name__ == '__main__':
    uvicorn.run(app.build(), host='0.0.0.0', port=19997)
```

### 第二步：创建 systemd 服务

```ini
# ~/.config/systemd/user/vibe-trading-a2a.service
[Unit]
Description=Vibe-Trading A2A Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/skloxo/aho/vibe-trading
ExecStart=/home/skloxo/aho/vibe-trading/.venv/bin/python a2a_server.py
Restart=always
RestartSec=5
Environment=PATH=/home/skloxo/aho/vibe-trading/.venv/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
```

### 第三步：验证

```bash
# 1. 启动服务
systemctl --user daemon-reload
systemctl --user enable --now vibe-trading-a2a

# 2. 健康检查
curl -s http://localhost:19997/.well-known/agent.json | jq .

# 3. 注册到 OpenClaw Gateway
curl -X POST http://localhost:19999/a2a/discover \
  -H 'Content-Type: application/json' \
  -d '{"url": "http://localhost:19997"}'

# 4. 测试调用
curl -X POST http://localhost:19997/a2a \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"text","text":"获取贵州茅台近一年日K"}]}}}'
```

### 第四步：自检清单

完成以上步骤后，运行以下自检：

```
□ Agent Card 已定义（6+ skills）
□ 端口 19997 无冲突
□ systemd 服务已启动
□ /.well-known/agent.json 返回正确
□ message/send 调用成功
□ 已注册到 Gateway
□ 双向发现验证通过
```

## 资源中心对接（统一代理模式）

接入后，所有资源通过 OpenClaw Gateway (19999) 统一代理：

**你不需要知道：**
- OpenViking 是什么（记忆服务）
- CPA2API 是什么（LLM 网关）
- MemPalace 是什么（知识图谱）
- 系统监控怎么实现

**你只需要知道：**
- 向 OpenClaw Gateway 发送 A2A 请求
- 请求会被路由到正确的后端服务
- 结果会原样返回

**产出写回示例：**
```json
// 发现了茅台的技术形态规律
POST http://localhost:19999/
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{"text": "写入记忆：茅台在下跌趋势中，头肩底形态的成功率约 72%"}]
    }
  }
}
```

## 联系 OpenClaw

遇到问题？通过 A2A 网络求助：
- OpenClaw Gateway: `http://localhost:19999`（唯一入口）
- MiMo Code: `http://localhost:19998`（编码/debug 问题）
