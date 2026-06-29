<p align="center">
  <img src="assets/icon.png" width="120" alt="Vibe-Trading-CNX Logo"/>
</p>

<h1 align="center">Vibe-Trading-CNX：聚焦 A股与港股的智能交易与多维分析工作站</h1>

<p align="center">
  <b>融合多维特征分析（情绪面、资金面、技术面、基本面）与多通道协同的个人投研工作站</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat" alt="FastAPI">
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=flat&logo=react&logoColor=white" alt="React">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=flat" alt="License"></a>
  <a href="https://github.com/skloxo/Vibe-Trading-CNX/actions/workflows/test.yml"><img src="https://github.com/skloxo/Vibe-Trading-CNX/actions/workflows/test.yml/badge.svg" alt="CI Status"></a>
  <a href="https://github.com/skloxo/Vibe-Trading-CNX/actions/workflows/docker-publish.yml"><img src="https://github.com/skloxo/Vibe-Trading-CNX/actions/workflows/docker-publish.yml/badge.svg" alt="Docker Build Status"></a>
</p>

<p align="center">
  <a href="https://codespaces.new/skloxo/Vibe-Trading-CNX"><img src="https://github.com/codespaces/badge.svg" alt="Open in GitHub Codespaces" style="max-width: 100%;"></a>
</p>

> [!NOTE]
> 本项目是 [Vibe-Trading](https://github.com/HKUDS/Vibe-Trading) 的高级定制分支版本（超集）。深度聚焦 **A股和港股** 市场，在整合技术指标与量化回测的同时，重点强化了**多维度市场特征提取**（如雪球网与主流社交媒体监控、舆情情绪面量化、大单资金流向监测、行业基本面复盘）与**多通道即插即用推送**（微信 iLink / 飞书），并实现了多租户安全沙箱隔离机制与本地 API 可信授权，旨在为个人投资者提供更懂中国市场、多维立体的智能投研工作站。

<p align="center">
  <a href="#-最新动态">最新动态</a> &nbsp;&middot;&nbsp;
  <a href="#-核心功能">核心功能</a> &nbsp;&middot;&nbsp;
  <a href="#-shadow-account">Shadow Account</a> &nbsp;&middot;&nbsp;
  <a href="#-功能演示">功能演示</a> &nbsp;&middot;&nbsp;
  <a href="#-快速开始">快速开始</a> &nbsp;&middot;&nbsp;
  <a href="#-典型示例">典型示例</a> &nbsp;&middot;&nbsp;
  <a href="#-api-与-mcp-服务">API / MCP</a> &nbsp;&middot;&nbsp;
  <a href="#-cnx-路线图与未来蓝图">路线图</a> &nbsp;&middot;&nbsp;
  <a href="#参与贡献">参与贡献</a>
</p>

---

## 📰 最新动态

- **2026-06-29** 🚀 **v0.1.10.cnx.1.1 — 服务看板与公网隔离优化版本发布**：
  - **局域网服务看板与实时日志**：新增 `/monitor` 服务看板，展示系统内存占用、会话数、运行数、活动租户等关键指标，并集成支持关键词和级别检索的日志控制台。出于安全考量，仅限局域网/本地回环（LAN/Loopback）物理设备访问。
  - **公网访问租户配置隐私隔离**：当租户从公网环境访问设置时，自动安全屏蔽所有继承自全局 Admin 的敏感 API 密钥和数据源 Token，彻底杜绝全局资源被租户或外部网络盗用风险，仅在租户显式配置自定义覆盖时展示。
- **2026-06-29** 🚀 **v0.1.10.cnx.1 — Vibe-Trading-CNX 量化工作站正式版本发布**：
  - **项目全面品牌重命名**：无缝将全局运行时数据路径迁移至 `~/.vibe-trading-cnx`，并适配前端与 CLI 二进制指令（`vibe-trading-cnx`）。
  - **微信 iLink 网关深度整合**：实现微信个人号 Bot 扫码登录状态与 `context_token` 的本地持久化（防止重启丢失），且发送欢迎语前增加 10 秒自动退避轮询，彻底解决主动发送被微信屏蔽问题。
  - **安全与跨域加固（CORS）**：更新 CORS 环回检测，使配置的 `API_ALLOWED_HOSTS` 公网/局域网可信 IP 允许执行不安全的 POST/PUT/DELETE 请求，解决异地登录时修改设置报 `Cross-site request denied` 拦截问题。
  - **Docker 容器向前兼容**：添加了 `/home/vibe/.vibe-trading` -> `/home/vibe/.vibe-trading-cnx` 的软链接守护，确保生产环境存量用户无缝升级，旧有历史数据及会话记录百分百兼容。
<details>
<summary>更早的更新</summary>

- **2026-06-23** 🛡️ **本地 API CSRF 加固**：恶意网页不再能对环回（loopback）API 发起不安全的跨站请求（POST/PUT/DELETE）——CORS 只挡响应读取、挡不住副作用，因此环回 dev-mode 信任现在会在放行**之前**先对不安全方法应用既有的跨站防护。安全方法与本地 CLI / 非浏览器上传不受影响（[#293](https://github.com/HKUDS/Vibe-Trading/pull/293)，感谢 @Hinotoi-agent）。
- **2026-06-22** 🔧 **Live 授权 OAuth 修复 + Alpha Zoo 标题修复**：`connector authorize` 现在能在长达数分钟的券商登录期间保持 OAuth 握手不断开（可通过 `VIBE_LIVE_AUTHORIZE_TIMEOUT_SECONDS` 调整），且重试时不再另起一个抢占式回调服务器，token 终于能正确保存（[#281](https://github.com/HKUDS/Vibe-Trading/pull/281)，关闭 [#259](https://github.com/HKUDS/Vibe-Trading/issues/259)，感谢 @Robin1987China）。Alpha Zoo 页面不再把 alpha 数量渲染两次（[#287](https://github.com/HKUDS/Vibe-Trading/pull/287)，关闭 [#286](https://github.com/HKUDS/Vibe-Trading/issues/286)，感谢 @digger-yu）。定时研究也补上了端到端使用文档（[#288](https://github.com/HKUDS/Vibe-Trading/pull/288)）。
- **2026-06-21** ⏰ **定时研究执行器 + 报告库 + 回测后归因**：定时研究现已**端到端**跑通——一个默认关闭的后台执行器（`VIBE_TRADING_ENABLE_SCHEDULER`）按 interval/cron 到点触发任务并经会话运行时执行（[#278](https://github.com/HKUDS/Vibe-Trading/pull/278)，感谢 @mvanhorn，关闭 [#254](https://github.com/HKUDS/Vibe-Trading/issues/254)）。新增 **`/reports` 运行库**页面，可列出、搜索、筛选有报告产出的运行，并链接到运行详情 + 对比（[#224](https://github.com/HKUDS/Vibe-Trading/pull/224)，感谢 @LemonCANDY42）。此外每次回测后 agent 现在会自动跑**分层归因**——交易级盈亏 Top 榜、Beta 回归、市场状态（regime）分析与 Monte Carlo 置换检验，按数据可用性与路由条件触发（[#280](https://github.com/HKUDS/Vibe-Trading/pull/280)，感谢 @shadowinlife）。

- **2026-06-20** 🔬 **Research Autopilot 闭环（第三阶段）+ loader OHLC 完整性守卫 + 4 个学术因子**：**Research Autopilot** 现在可端到端跑通 **假设 → 信号引擎 → 回测**——`scaffold_signal_engine` 按 runner 契约生成信号引擎，`link_autopilot_backtest` 把回测指标自动回写到假设（**68 个工具**）（[#267](https://github.com/HKUDS/Vibe-Trading/pull/267)）。一道结构性的 **OHLC 合法性校验**在 loader 边界集中丢弃脏 bar（`high < low`、非正价格、high/low 未包住 open/close），守护每一个数据源（[#274](https://github.com/HKUDS/Vibe-Trading/pull/274)，感谢 @Shizoqua）。同时 **academic 学术因子家族从 6 个扩到 10 个**——Jegadeesh 反转、George-Hwang 52 周高、Amihud 非流动性、Harvey-Siddique 偏度（**456 个因子**）（[#277](https://github.com/HKUDS/Vibe-Trading/pull/277)，感谢 @Robin1987China）。
- **2026-06-19** 🚀 **v0.1.10 — 全球数据层**：行情数据源从 10 个增至 18 个（免费直连 **东方财富 / 新浪 / Stooq / Yahoo** + 可选 key 的 **Finnhub / Alpha Vantage / Tiingo / FMP**，按封禁风险排序 fallback），外加 **18 个只读数据工具**（资金流、龙虎榜、北向、融资融券、大宗交易、SEC EDGAR + XBRL、财报、期权链、全市场筛选……）覆盖 A股 / 美股 / 港股，全部经 MCP 暴露。本版同时卷入 0.1.9 以来的全部更新——10 个券商连接器、`alpha compare`、provider 可靠性大修、可选数据缓存。`pip install -U vibe-trading-ai`
- **2026-06-18** 🔬 **Research Autopilot 第一阶段 + 本地 Data Bridge 加载器，外加 Discord 安全提示**：新增 `run_research_autopilot` + `generate_backtest_config`，把**假设 → 研究目标 → 回测**打通（现 **50 个工具**），新 **`local`** 加载器直接从你的 **CSV / Parquet / DuckDB** 文件读 OHLCV（[#260](https://github.com/HKUDS/Vibe-Trading/pull/260)、[#252](https://github.com/HKUDS/Vibe-Trading/pull/252)，感谢 @Robin1987China），并修了 DeepSeek `DSML` 工具调用解析与一波标识符收敛加固。⚠️ **安全提示**：旧社区 Discord 邀请现指向一个我们已无法控制、跑着假冒 Collab.Land 钱包"验证"钓鱼的服务器——已全部移除；**唯一**官方 Discord 是 HKUDS 服务器（[discord.gg/6TdQnT5xcF](https://discord.gg/6TdQnT5xcF)），我们绝不会要求你连接钱包。
- **2026-06-17** 🧩 **安装兼容 + Opus/Kimi provider 修复**：基础 `pip install vibe-trading-ai` 不再拉取可选的 `pyharmonics` / `ta` 依赖链；谐波形态识别现在放到 `vibe-trading-ai[harmonic]` extra 后面，同时保留内置 fallback 检测器（[#250](https://github.com/HKUDS/Vibe-Trading/pull/250)，关闭 [#249](https://github.com/HKUDS/Vibe-Trading/issues/249)）。Agent loop 也不再发送 Opus 4.8+ 会拒绝的 assistant-prefill handoff 消息，Kimi/Moonshot 可通过 `MOONSHOT_USER_AGENT` 覆盖客户端 `User-Agent`（[#248](https://github.com/HKUDS/Vibe-Trading/pull/248)，关闭 [#246](https://github.com/HKUDS/Vibe-Trading/issues/246) 和 [#204](https://github.com/HKUDS/Vibe-Trading/issues/204)）；后续测试已直接覆盖 background-result 与 auto-compact 两条 handoff 路径（[#251](https://github.com/HKUDS/Vibe-Trading/pull/251)）。
- **2026-06-16** 🛡️ **安全/API 加固 + GLM/Zhipu alias**：Settings 写入在配置认证时必须鉴权（[#245](https://github.com/HKUDS/Vibe-Trading/pull/245)）；API session 中 shell-capable 工具必须显式设置 `VIBE_TRADING_ENABLE_SHELL_TOOLS=1` 才会暴露（[#243](https://github.com/HKUDS/Vibe-Trading/pull/243)）；配置 API key 后 local shutdown 也要求鉴权（[#241](https://github.com/HKUDS/Vibe-Trading/pull/241)）；看似 loopback 但不可信的 Host 会被拒绝，而不再被当成本地请求（[#242](https://github.com/HKUDS/Vibe-Trading/pull/242)）。运行边角也继续打磨：Web chat 会同步已完成尝试（[#236](https://github.com/HKUDS/Vibe-Trading/pull/236)），run card 对非有限指标写出 strict JSON（[#238](https://github.com/HKUDS/Vibe-Trading/pull/238)），畸形 `RSSHUB_TIMEOUT_S` / `RSSHUB_FETCH_BUDGET_S` 会安全回退（[#240](https://github.com/HKUDS/Vibe-Trading/pull/240)），ddgs retry fallback 已有回归覆盖（[#239](https://github.com/HKUDS/Vibe-Trading/pull/239)）。GLM/Zhipu 现在是一等 provider alias，并支持按模型名推断（[#247](https://github.com/HKUDS/Vibe-Trading/pull/247)，关闭 [#237](https://github.com/HKUDS/Vibe-Trading/issues/237)）。
- **2026-06-15** 🧭 **Web 搜索韧性 + Web UI 运行连续性修复**：`web_search` 不再因单个引擎被限流而失败——现在按序查询多个免费、免 key 的引擎（DuckDuckGo、Google、Bing、Brave、Mojeek、Yahoo），带重试/退避，把"无结果"当作空答案而非错误，所有引擎都被限流时返回可操作的提示而不是一个干巴巴的 ❌（可用 `VIBE_TRADING_SEARCH_BACKENDS` 覆盖引擎列表）（[#232](https://github.com/HKUDS/Vibe-Trading/pull/232)，关闭 [#231](https://github.com/HKUDS/Vibe-Trading/issues/231)，感谢 @Ethan-sun01）。Web UI 方面，运行过程中切换页面不再卡死——聊天页返回时会重新订阅实时流并回放期间错过的进度（[#234](https://github.com/HKUDS/Vibe-Trading/pull/234)）——停止按钮现在会在流式中和工具之间即时生效，而不只是在迭代边界（[#235](https://github.com/HKUDS/Vibe-Trading/pull/235)），两个症状一起关闭了 [#229](https://github.com/HKUDS/Vibe-Trading/issues/229)（感谢 @kalkinj）。baostock loader 也开始接受原生的 `sh.601398` / `sz.000001` 代码格式，与 tushare 风格的 `601398.SH` 并存（[#230](https://github.com/HKUDS/Vibe-Trading/pull/230)，感谢 @bhlt）。
- **2026-06-14** 📊 **按运行记录 token 用量 + Run Detail 图表按需加载**：每次 agent 运行现在都会把 provider 上报的 token 用量持久化为运行级的 `llm_usage.json`——provider/模型、累计总量、逐迭代计数——并附加到 `/runs/{id}` 上，这样一次运行结束、实时流消失后，它的 token 成本依然可审计（仅 provider 上报值；不抓 prompt/内容，不估算价格）（[#223](https://github.com/HKUDS/Vibe-Trading/pull/223)，感谢 @LemonCANDY42）。Run Detail 页面也不再一上来就加载每个标的的 K 线：默认 `/runs/{id}` 响应保持不变，但 UI 现在先渲染运行摘要，再通过可选的 `?chart_payload=summary` / `?chart_symbol=` 模式按需加载每个标的的图表，带有逐标的的加载状态和一个"全部加载 + 进度"控件（[#225](https://github.com/HKUDS/Vibe-Trading/pull/225)，感谢 @LemonCANDY42）。两个 loader 修复收尾：yfinance 的排他 `end` 边界不再漏掉请求范围内的最后一个交易日——下载调用现在传 `end + 1 天`，而缓存键仍保留原始范围（[#226](https://github.com/HKUDS/Vibe-Trading/pull/226)，感谢 @gyx09212214-prog）；畸形的 `CCXT_TIMEOUT_MS` / `OKX_TIMEOUT_S` 值现在会告警并回退到默认值，而不是在 import 时抛错、阻塞启动（[#227](https://github.com/HKUDS/Vibe-Trading/pull/227)，感谢 @gyx09212214-prog）。
- **2026-06-13** ↩️ **从 CLI 按 ID 恢复历史会话**：交互式 CLI 现在会在退出时打印 session-id，并附上可直接复制的 `vibe-trading resume <session-id>` 提示——找某次运行对应的 trace 不再需要靠时间戳去猜 `agent/sessions/` 下哪个目录最新。新增的 `vibe-trading resume <session-id>` 子命令会重新打开那个确切的会话，并把最近几轮对话回放进 loop；ID 不存在时会立即报错退出，而不是静默开一个空会话（[#218](https://github.com/HKUDS/Vibe-Trading/pull/218)，感谢 @zwrong）。
- **2026-06-11** 🐝 **Swarm worker 全面接入 loader 层行情数据**：一次 NVDA 投资委员会运行暴露出一串缺口——worker 自己手写 yfinance 脚本、轻信了一根残缺的最新 K 线（有成交量但 OHLC 为空）、`NaN` 泄漏进非严格 JSON，丢失上下文的续跑 prompt 还被路由到错误的 preset（[#198](https://github.com/HKUDS/Vibe-Trading/issues/198)，感谢 @BillDin 出色的诊断和两个修复 PR）。现在 swarm worker 拥有本地 `get_market_data` 工具，与 MCP 共用同一套归一化 loader 注册表——严格 JSON、非有限浮点序列化为 `null`——并接入**所有行情类 preset**（13 个 preset、21 个 worker），prompt 政策引导 OHLCV 工作优先走工具（[#199](https://github.com/HKUDS/Vibe-Trading/pull/199)）；`run_swarm` 支持显式 `preset_name`，含糊的续跑片段会被直接拒绝，而不是静默回落到 `equity_research_team`（[#200](https://github.com/HKUDS/Vibe-Trading/pull/200)）。Grounding 也更聪明：swarm prompt 里裸写的美股代码（如 `NVDA`）会自动提升为 `NVDA.US`（带停用词防误判），worker 从一开始就拿到权威的预取价格。该工具同时进入主 agent 注册表——现在共 **48 个工具**。另外：**Docker 数据现在可以跨更新存活**——持久记忆、会话搜索索引、自建 skills、shadow account 和 broker 配置都放进了命名数据卷，`docker compose up --build` 不会再清空它们（[#197](https://github.com/HKUDS/Vibe-Trading/issues/197)，感谢 @FlyerJ）。
- **2026-06-10** 🐳 **Docker 开箱即可访问宿主机 Ollama**：容器内的 `localhost` 指向容器自身，默认的 `OLLAMA_BASE_URL=http://localhost:11434` 让所有 Docker + Ollama 组合的 LLM 预检直接失败。`docker-compose.yml` 现在默认指向 `http://host.docker.internal:11434`（导出 `OLLAMA_BASE_URL` 可覆盖），并加入 `host-gateway` 的 `extra_hosts` 映射，在 Linux 上与 Docker Desktop 一样开箱即用（[#196](https://github.com/HKUDS/Vibe-Trading/pull/196)，感谢 @ShahNewazKhan）。
- **2026-06-09** 🔑 **从另一台机器打开 Web UI 时的报错更清晰**：从非 loopback 客户端（另一台机器、虚拟机宿主机、局域网里的手机）访问聊天且未设 `API_AUTH_KEY` 时，所有敏感接口——发消息、列会话、live 状态——都会返回 `403`，但聊天界面只笼统显示 “Failed to send message, please retry.”。现在发送路径会直接给出真实原因——*“Remote API access requires an API key. Add it in Settings, or run the backend on localhost for local-only use.”*——README 的 Web UI 配置说明也讲清了 localhost 与局域网的区别以及三种解法（在同一台机器上用 `localhost` 访问；设置 `API_AUTH_KEY` 并在 Settings 里填一次；或为 Docker Desktop 宿主网关设 `VIBE_TRADING_TRUST_DOCKER_LOOPBACK=1`）（[#191](https://github.com/HKUDS/Vibe-Trading/issues/191)，感谢 @mafia23）。
- **2026-06-08** 🔧 **Gemini 3.x 多轮工具调用修复**：补全了 Gemini 3.x 思考模型的修复。6/05 的回传（[#176](https://github.com/HKUDS/Vibe-Trading/pull/176)）只覆盖了内存中的历史，而真正的 agent loop 会把历史以 OpenAI 格式的 dict 回放，LangChain 在构建请求前丢掉了每个工具调用的 `thought_signature`——导致多轮工具调用仍以 `missing thought_signature` 报 400。现在它会在 `invoke` 与 `stream` 共用的唯一入口 `_convert_input` 处重新挂回（并行调用——N 个里只有第一个带签名——也已涵盖）（[#184](https://github.com/HKUDS/Vibe-Trading/pull/184)，感谢 @ngoanpv）。
- **2026-06-07** 🐝 **聊天时间线中的实时 swarm 状态**：当 agent 启动多智能体 swarm（投资委员会、量化台、风险委员会……）时，聊天界面现在会内联渲染一张**状态卡**，实时流式展示每个 worker 的状态——等待 / 运行 / 完成 / 失败 / 阻塞 / 重试——与独立 swarm 仪表盘一致的逐 agent 可见性。运行时事件被桥接进会话 SSE 流，且不改动现有的 `/swarm/runs` API；重连或回放历史时，已结束的卡片会从最终的 `run_swarm` 结果复原（[#188](https://github.com/HKUDS/Vibe-Trading/pull/188)，感谢 @BillDin）。preset 路由也更精准：显式指定的 preset（如 `investment_committee`，带不带下划线均可）现在优先于关键词打分，而裸 `IV` 衍生品关键词也不再误匹配 “g**iv**en” 之类普通单词（[#189](https://github.com/HKUDS/Vibe-Trading/pull/189)，感谢 @BillDin）。
- **2026-06-06** ⚖️ **Alpha 对比 —— CLI / Web UI / REST / agent 四端齐全**：新增 `alpha compare`，把你手选的一组 Alpha Zoo 因子放在同一 universe 和区间上两两对比，按 IC 均值/标准差、IR、IC>0 比例或样本数排名，并标出每个因子与榜首的差距。不同于整库 bench，它**只评估你点名的因子**（新增 `run_bench(only=…)` 子集过滤），所以对比 3 个因子不会再把整库 191 个全跑一遍。四端共用同一套核心：`vibe-trading alpha compare <id1> <id2> … --sort ir`（CLI）、Alpha Zoo Web UI 的 **Compare 视图**（在目录里勾选因子 → 一键对比 + 流式排名表）、`POST /alpha/compare` + SSE（REST），以及只读的 `alpha_compare` agent 工具（工具数达 **47**）。
- **2026-06-05** 🇮🇳 **Dhan + Shoonya connector（印度）——10 家券商**：connector-first 交易层新增 **Dhan** 与 **Shoonya** 两个印度券商（NSE/BSE 股票 + F&O），券商总数达到十家。两者均为**模拟盘 + 只读**——与长桥一样，其 API 不暴露运行时的模拟/正式判别标识，因此 `place_order` / `cancel_order` 在第一行就硬拒任何非模拟配置（通用规则：无结构性模拟/正式守卫的券商一律封顶模拟盘 + 只读）（[#181](https://github.com/HKUDS/Vibe-Trading/pull/181)，收尾 [#174](https://github.com/HKUDS/Vibe-Trading/issues/174)）。本轮还修复了 **Gemini 2.5 / 3.x 思考模型**：每个工具调用的 `thoughtSignature` 现在能在 OpenAI 兼容路径上完整回传，多轮 function calling 不再因 `INVALID_ARGUMENT` 失败（[#176](https://github.com/HKUDS/Vibe-Trading/pull/176)，关闭 [#170](https://github.com/HKUDS/Vibe-Trading/issues/170)，感谢 @mvanhorn 与 @jliu6789）。全部 **452 个 Alpha Zoo 因子**补上了中文 docstring（中文名称/说明/用途）（[#180](https://github.com/HKUDS/Vibe-Trading/pull/180)，感谢 @LeeCQiang）；**前端测试套件（197 个 vitest 用例）**加上后端鉴权 / 路径穿越 / CORS 安全测试也进了 CI（[#175](https://github.com/HKUDS/Vibe-Trading/pull/175)，感谢 @sambazhu）。
- **2026-06-04** 🗃️ **全部 7 个数据源的可选本地缓存**：新增 `VIBE_TRADING_DATA_CACHE` 开关，让每个回测 loader——tushare、okx、ccxt、akshare、mootdx、yfinance、futu——把已结算的历史 bar 缓存到 `~/.vibe-trading/cache`（用户主目录，绝不写入仓库），让重复以及长周期 / 跨市场回测跳过网络、避开数据源限流。默认关闭。批量与连接型 loader（yfinance、futu）在缓存全部命中时完全跳过批量下载 / FutuOpenD 连接；结算守卫绝不缓存截止到当天的区间（最后一根 bar 还在形成中）；缓存帧与实时拉取的结果逐字节一致（[#177](https://github.com/HKUDS/Vibe-Trading/pull/177)，感谢 @mvanhorn）。同时还落地了一份面向 AI / 自动化辅助 PR 的贡献者指南，梳理了安全的本地检查项与高风险的 broker/MCP/凭证操作面（[#173](https://github.com/HKUDS/Vibe-Trading/pull/173)）。
- **2026-06-03** 🧹 **社区 triage + trace 关联**：工具调用的 trace 条目现在带上原始 `call_id`，回放 run trace 时可以把 `tool_result` 对回它的 `tool_call`——入参预览仍保持截断，避免 trace 文件膨胀（[#168](https://github.com/HKUDS/Vibe-Trading/pull/168)，感谢 @zwrong）。源码注释不再指向外部贡献者找不到的内部文档路径（[#166](https://github.com/HKUDS/Vibe-Trading/issues/166)，感谢 @jaleelpersonal）。另外澄清了安装时的 `langchain-community` 依赖解析告警只是残留旧包的无害提示、并非安装失败（[#167](https://github.com/HKUDS/Vibe-Trading/issues/167)），并把 Gemini 2.5/3.0 函数调用的 `thoughtSignature` 往返梳理成一条带完整修复方案的 `help wanted` 任务（[#170](https://github.com/HKUDS/Vibe-Trading/issues/170)，感谢 @jliu6789）。
- **2026-06-02** 🔌 **六个新券商 connector（老虎 / 长桥 / Alpaca / OKX / 币安 / 富途）**：connector-first 交易层在 IBKR（本地）和 Robinhood（MCP）之外，新增一条直连 SDK 传输。每个 connector 都暴露只读的账户 / 持仓 / 订单 / 行情 / 历史，外加模拟账户下单——把你的策略放到这些券商的模拟盘上跑。其中五个（老虎、Alpaca、OKX、币安、富途）还支持在用户提交的 mandate（标的/单量/敞口/杠杆/每日笔数）约束下的有界下单，沿用与 Robinhood 同一套安全模型：用户提交的 mandate、文件级即时 kill switch、fail-closed 的下单前门禁，以及完整审计账本。长桥仅支持模拟盘 + 只读（其 API 不暴露运行时的模拟/正式判别标识）。每一处模拟/正式的区分都是按券商落实的结构性守卫——账户 id 格式、host 隔离、demo 标志或 trade environment。新增 `trading_place_order` / `trading_cancel_order` 工具；mandate universe 也补上了港股和 A 股资产类别。实验性 / 风险自负。
- **2026-06-01** 🚀 **v0.1.9 发布**（`pip install -U vibe-trading-ai`）：汇总 0.1.8 以来的全部更新。Connector-first 券商 profile（IBKR 本地只读 TWS / IB Gateway + Robinhood Agentic Trading，受 OAuth、已提交 mandate、order guard、审计账本和即时 halt 约束）。Research Goal 运行时贯通 CLI / REST / MCP / Web。一轮 swarm 升级——实时 reconcile + MCP keepalive、operator 配置的 worker MCP 工具、严格 alpha-bench 随机控制，以及新增 `retry_run` 重跑失败/过期 run（现 **36 个 MCP 工具**）。`agent/cli/` 包重构 + 刷新的终端 UI、`mootdx` 免 token A 股 loader，以及 backtest / agent loop / session 的健壮性增强。`--version` 现在始终与已安装版本一致，修复 0.1.8 漂移（[#156](https://github.com/HKUDS/Vibe-Trading/issues/156)）。
- **2026-05-31** 🔌 **Connector-first 券商架构（IBKR + Robinhood）**：交易接入现在从可选择的 connector profile 开始，不再拆成分散的券商入口和 live 入口。`vibe-trading connector list/use/check/account/positions/orders/quote/history` 与 MCP `trading_*` 工具共享同一个选中的 profile；paper/live 只是该 connector 下的属性。IBKR 可立即通过本地只读 TWS / IB Gateway profile 使用；官方 IBKR 远程 MCP 先作为 OAuth `mcp.read` 探测种子，等待稳定 read 工具名后再映射。Robinhood Agentic Trading 仍是有界 live MCP connector，必须经过 OAuth、已提交 mandate、order guard、审计账本和即时 halt。
- **2026-05-30** 🧰 **健壮性专项 — backtest、agent loop、session**：LLM 生成的 signal engine 现在会在实例化前先过接口预检，提前抓出循环 self-import、缺失 `generate()`、`__init__` 参数没有默认值、返回类型错误等常见问题，并给出可操作的 JSON 报错而非原始 traceback（[#149](https://github.com/HKUDS/Vibe-Trading/pull/149)）；后续一并把源码级 AST 校验的报错也走同一套干净的 JSON 信封。agent loop 不再把 50 次迭代全烧光后留下一个没有任何输出的 `failed` 状态——它复用 swarm worker 已验证的做法：在迭代预算 80% 处注入 wrap-up nudge，并在最后一次迭代丢掉 tool 定义以强制产出文本答案（[#148](https://github.com/HKUDS/Vibe-Trading/pull/148)），且只在中途触发，绝不挤掉 research-goal 上下文。session 消息写入现在每次 append 后 `flush + fsync`，让昂贵的 AI 回复能在写到一半崩溃时存活；读取端则跳过损坏的 JSONL 行（记录前 200 字符以便人工恢复），而不是让整个 `/messages` 端点 500（[#147](https://github.com/HKUDS/Vibe-Trading/pull/147)）。Web 输入框也修了 IME 回车处理，让中日韩输入法的确认上屏回车不再误触发提交（[#146](https://github.com/HKUDS/Vibe-Trading/pull/146)）。
- **2026-05-29** 🔐 **支持 Robinhood Agentic Trading（可选开启、有界自主）**：新增对 Robinhood Agentic Trading 的支持（远程 MCP，OAuth）。默认关闭且只读；仅在用户提交的 mandate（标的/单量/敞口/杠杆/每日笔数）内自主交易，配文件级即时 kill switch、抢占式平仓、mandate 自动过期、完整审计账本，以及一个持久自主 runner。无托管、无场所——券商持有资金并执行，我们只中继意图。实验性 / 风险自负。
- **2026-05-28** 🧪 **Swarm 安全 + 严格 alpha 门 + worker 端 MCP**：Swarm DAG 在上游任务失败时阻断下游任务（[#145](https://github.com/HKUDS/Vibe-Trading/pull/145)）。新增 `run_bench_strict()` 在 IC 门之上加入同 universe 随机控制 + 训练/测试 OOS 切分，识别只是跟随市场 beta 的伪因子（[#143](https://github.com/HKUDS/Vibe-Trading/pull/143)，感谢 @Soli22de）。Swarm worker 现在可以调用 operator 配置的外部 MCP server，信任边界由专项测试固定（[#142](https://github.com/HKUDS/Vibe-Trading/pull/142)，感谢 @shadowinlife）。
- **2026-05-27** 📊 **mootdx A 股数据源 + 输出排版**：新增 `mootdx` loader，走原生通达信 TCP 协议拉 A 股 OHLCV（无需 token，无 IP 速率限制，日线 + 分钟线 25 页 walk-back 分页），在 fallback chain 中位于 tushare 和 akshare 之间（[#107](https://github.com/HKUDS/Vibe-Trading/issues/107)）。CCXT loader 现在会读取 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY`，使 Binance/OKX 公开数据可在受限网络下拉取（[#126](https://github.com/HKUDS/Vibe-Trading/pull/126)，感谢 @ruok808）。最终回答的渲染也去掉了 CLI 和 Web 上丑陋的全宽 `---` 分隔符：系统提示鼓励 agent 用 markdown 表格和 `##` 标题，CLI 渲染端兜底 strip 孤立 HR，前端 chat 气泡隐藏任何漏过去的 `<hr>`（[#139](https://github.com/HKUDS/Vibe-Trading/issues/139)，感谢 @sdwxm188）。
- **2026-05-26** ✅ **Research Goal 生命周期闭环**：Goal 模式现在像真正的任务运行器：Web UI 创建 goal 会创建或绑定 session，并立刻发出 kickoff turn；active goal 可在 Web/API/CLI/MCP 中继续、编辑、取消和完成；agent loop 会按当前 goal snapshot（criteria、evidence、claims、open items）推进，而不是只按最初 prompt。criteria 已 covered 但 goal 仍 active 时，会进入 audit/status 更新，不再静默停住，并用 backend、CLI、MCP 与 frontend events 回归覆盖固定。

- **2026-05-25** 🧼 **更干净的 Chat UI + composer 工作流**：Web UI 现在把注意力留给下一步输入：upload、swarm 和 research-goal 模式都收进 composer 的 `+` 菜单，不再用漂浮面板打断聊天。当前上下文会以紧凑 chip 附在输入框上方，goal 详情只在点击 chip 时原地展开。UI 也移除了旧的自定义 i18n 层，改用直接英文文案；Full Report card 只在真正有报告价值的 run 出现；本地 dev 启动与状态报告也加固，方便稳定做浏览器 smoke test。
- **2026-05-24** 🎯 **Research Goal runtime**：新增 session 级 Research Goal 层，贯通 backend、CLI、API/MCP、SSE 和 Web UI。Goal 会持久化 claim、acceptance criteria、evidence row、budget 与 completion policy；agent tools 可以创建 goal 并追加 evidence；`/goal` 成为 CLI 入口；REST/MCP 暴露 goal snapshot 和 evidence 写入；SSE 保持 chat client 状态新鲜。后续审计修复锁紧 verified evidence，阻断 agent tool 写入 live-trading 风险层，串起 CLI 创建的 goal 与后续 turn，删除 session 时清理 goal ledger，接上 replay-all，并修复前端跨 session snapshot race。
- **2026-05-23** 🖥️ **交互式 CLI 刷新**：终端入口现在使用更大的 Vibe-Trading banner、更清晰的 prompt 分隔线、上一轮摘要、运行后耗时，以及 Claude Code 风格的活动轨来展示实时 agent 工作。工具调用、网页/数据抓取、shell 风格动作、Markdown 回答和管道表格都会以更易读的 transcript 渲染；pipe 或非 TTY 运行仍保留适合自动化的纯文本输出。生成的 CLI 截图现在作为本地 artifact 处理，不再提交进 docs，让仓库更轻。
- **2026-05-22** 🧭 **Swarm 恢复 + MCP keepalive**：Swarm 状态现在每次读取都会从实时 task 文件 reconcile，API/MCP/SSE/list 视图可以自动恢复 crash 或过期 run，不再永久停在 `running` 快照。`run_swarm` 在 MCP polling 期间持续发送 progress heartbeat，首帧固定为 `swarm_started run_id=<id>`，方便 transport 掉线后的客户端找回句柄；worker 的 LLM streaming、grounding fetch、tool execution 也都包上了 heartbeat。stale-run reaper 按每个 run 的阈值判断，并从 task 状态推导终态；`SwarmTool` wait budget 用尽后不再取消仍在跑的 team，MCP 客户端也可以调用 `reap_stale_runs()` 显式清理。今天的 DX pass 还同步刷新 provider 默认模型，并把 CI syntax check 对齐到新的 `agent/cli/` 包。22 条新回归覆盖 hydrate、终态恢复、stale 回收、keepalive cadence、env 容错和 heartbeat wiring；完整 swarm/MCP 套件 169 passed、4 skipped。
- **2026-05-21** 🧱 **CLI 包重构**：`agent/cli.py`（3216 行）拆成 `agent/cli/` 包 —— 交互入口、slash 路由、Rich 组件，加 `_legacy.py` shim 保留所有子命令并 re-export 所有公共符号，`cli.cmd_*` / `cli._INIT_ENV_PATH` / `cli.Confirm` 不变。新增 FastAPI middleware：浏览器直开 `/runs/{id}` 或 `/correlation` 时返回 SPA shell；Vite dev proxy 同步收窄到相同 regex。版本号通过 `cli/_version.py` 单一来源（`--version` 与 banner 不再 drift），`python -m cli` 通过 `__main__.py` 恢复，chat-gate 收窄使 `chat --help` / `chat extra` 正确走 legacy argparse 而不被新 REPL 吞掉。
- **2026-05-20** 🔬 **Hypothesis Registry CLI**：补齐了 5-16 上线但只有后端的 Hypothesis Registry 的 CLI 侧。`vibe-trading hypothesis list` 输出 Rich 表格或 JSON（支持 `--status` 过滤、`--limit`）；`show <id>` 渲染详情面板，包含已 link 的 run card；`invalidate <id> --note "..."` 把 status 翻成 `rejected`，省略 `--note` 时保留原有 invalidation notes。沿用 `VIBE_TRADING_HYPOTHESES_PATH` 环境变量，并新增按调用覆盖的 `--path`。22 个新单测覆盖 wiring、JSON 输出、状态过滤、limit、缺 id 报错、备注持久化。
- **2026-05-19** ✨ **工具实时反馈 + 优雅取消**：长时间运行的工具（回测、大 PDF、swarm worker）不再看起来卡死。每个工具调用现在会发出 3 秒一次的心跳，以及结构化的阶段进度 —— `run_backtest` 输出阶段标记（`validate` / `simulate` / `finalize`），`read_document` 在 PDF 上按页打点 / Excel 上按工作表打点，`read_url` 标记 `fetch` / `parse`。CLI 的 Rich Live 面板渲染 Unicode 转轮、ASCII 进度条、ETA，按工具名最多堆叠 3 个并行工具；前端 chat 新增 `ToolProgressIndicator`，rAF 合并刷新、ARIA `role="status"` + 隐藏的原生 `<progress>` 供屏幕阅读器使用，已知总数时切换为 determinate 的 `ProgressRing` SVG。CLI 中第一次 `Ctrl+C` 现在会调 `agent.cancel()` 优雅退出（当前步骤跑完、trace 干净关闭）；2 秒内第二次 `Ctrl+C` 强制退出。顺手抽出可复用基础件：`ProgressBar.tsx` 和 `lib/tools.ts`（共享工具名 i18n 映射）。
- **2026-05-18** 🧹 **清理一次 + 3 个潜伏 bug 修复**：`CompositeEngine` 不再把无交易所后缀的中国期货代码（如 `RB2410`）错误路由到 `GlobalFuturesEngine` —— `_is_china_futures` 移到共享的 `_market_hooks` 模块，产品代码表做了大小写归一并加入非中国交易所守卫，新增 9 条回归用例。session FTS5 索引现在会持久化时间戳，跨 session 搜索可按日期排序；同一改动也修复了 re-upsert 路径每次都用 wall-clock 覆盖 `started_at` 的副作用 bug。前端 Vite dev proxy 补上漏配的 `/alpha`，AlphaZoo 页在 `npm run dev` 下不再 404。`tests/test_e2e_harness_v2.py`（真 LLM 的 e2e 套件）现在用 `VIBE_TRADING_RUN_LIVE_E2E=1` 做环境门控，CI 不再因为有无 LLM key 而静默切状态。Ruff 为 factor zoo 添加 `per-file-ignores`（3783 → 0 F401 噪音），前端 tsconfig 打开 `noUnusedLocals` / `noUnusedParameters` 做回归护栏，并删掉了 76 个 `gtja191` alpha 文件里没用上的 `vw = vwap(...)` 残留。净 **-918 行**。
- **2026-05-17** 🧬 **Alpha Zoo v1（0.1.8）**：内置 452 个量化 alpha，覆盖 4 个 zoo —— `qlib158`（Microsoft Qlib 的 Alpha158 特征，Apache-2.0 出处声明）、`alpha101`（Kakushadze 的 "101 Formulaic Alphas"，从 arXiv:1601.00991 论文公式重写）、`gtja191`（国君证券 2014 短周期交易型因子研报）、`academic`（Fama-French 5 因子 + Carhart 动量的价格代理实现）。一行 CLI 就能在自己的 universe 上跑横评：`vibe-trading alpha bench --zoo gtja191 --universe csi300 --period 2018-2025`。配套设施包括 AST 纯函数门禁、lookahead 防护测试、`pytest-socket` 网络隔离、每个 zoo 一份 LICENSE.md、社区贡献用的 DCO 签名流程；Alpha Library 自动渲染上线 [vibetrading.wiki/alpha-library/](https://vibetrading.wiki/alpha-library/)；Research Lab 同步发布 [《191 个 GTJA alpha 哪些在 2026 还能用》](https://vibetrading.wiki/research-lab/posts/alpha-191-in-2026.html)。
- **2026-05-16** 🧪 **研究主干更新**：新增后端 Hypothesis Registry，提供 `create_hypothesis`、`update_hypothesis`、`link_backtest`、`search_hypotheses`；外部内容读取工具现在会附加 warning-only 的 `security_warnings`；Shadow Account 扫描也从旧的日历 phase stub 升级为确定性的 OHLCV 特征评估。
- **2026-05-15** 🪪 Run 详情页现在会在 metrics 和 artifacts 旁边渲染 Trust Layer 的 run card，把 2026-05-12 已落地的 `run_card.json` 工作补齐到 UI 一侧。`PersistentMemory.add()` 也根据 #108/#109/#110 的 triage，在长度限制、空 / 纯空白 name、以及 C0/C1 控制字节三条路径上做了加固（[#112](https://github.com/HKUDS/Vibe-Trading/pull/112)，感谢 @Teerapat-Vatpitak）。
- **2026-05-14** 🌐 公开 Wiki 已上线 [vibetrading.wiki](https://vibetrading.wiki/)，包含 docs、tutorials、Research Lab 和 Alpha Library，并通过 Cloudflare Pages 部署。持久记忆也可以通过 CLI 使用 `vibe-trading memory list/show/search/forget` 检查（[#102](https://github.com/HKUDS/Vibe-Trading/pull/102)，感谢 @Teerapat-Vatpitak）；记忆 tokenizer/slug 现在支持泰语、阿拉伯语、希伯来语和西里尔文字（[#104](https://github.com/HKUDS/Vibe-Trading/pull/104)）。
- **2026-05-13** 🧭 Swarm 运行现在会用已获取的市场数据为 worker 提供依据，并生成更清晰的持久化报告（[#93](https://github.com/HKUDS/Vibe-Trading/pull/93)，[#84](https://github.com/HKUDS/Vibe-Trading/pull/84)）。
- **2026-05-12** 🧾 回测现在会随 artifacts 一起输出 `run_card.json` 和 `run_card.md`，便于复现实验研究。
- **2026-05-11** 🧭 **记忆 slug、swarm 统计与 CLI 预检**：持久记忆在生成文件 slug 时会保留 CJK 字符，避免中文/日文/韩文笔记发生静默文件名冲突（[#95](https://github.com/HKUDS/Vibe-Trading/pull/95)，感谢 @voidborne-d）。Swarm 运行总量现在优先采用 provider 返回的 token 用量，并保留原有估算作为 fallback（[#94](https://github.com/HKUDS/Vibe-Trading/pull/94)，感谢 @Teerapat-Vatpitak）。CLI 运行界面也新增了启动预检，用于发现常见环境问题（[#96](https://github.com/HKUDS/Vibe-Trading/pull/96)，感谢 @ykykj）。
- **2026-05-10** 🧱 **回归护栏与运行元数据**：记忆召回现在将下划线视为 token 边界，因此 `mcp_wiring_test` 这类 snake_case 记忆可以匹配 "mcp wiring" 等自然语言查询（[#87](https://github.com/HKUDS/Vibe-Trading/pull/87)，感谢 @hp083625）。MCP server 增加了覆盖 initialize → `tools/list` → `tools/call` 的 subprocess smoke test，以防止首次调用死锁路径回归（[#86](https://github.com/HKUDS/Vibe-Trading/pull/86)）。同时还完成了多项低风险加固：Windows 路径敏感测试、API best-effort 异常处理、backtest `run_dir` allowed-root 校验，以及 SwarmRun provider/model 元数据（[#88](https://github.com/HKUDS/Vibe-Trading/pull/88)，[#90](https://github.com/HKUDS/Vibe-Trading/pull/90)，[#91](https://github.com/HKUDS/Vibe-Trading/pull/91)，[#92](https://github.com/HKUDS/Vibe-Trading/pull/92)，感谢 @Teerapat-Vatpitak）。
- **2026-05-09** 🛡️ **API 路径加固与 MCP server 稳定性**：API run/session 路由现在会在查询前校验 path ID，拒绝包含换行等异常字符的参数，并将该行为纳入 auth/security 回归测试（[#80](https://github.com/HKUDS/Vibe-Trading/pull/80)，感谢 @SJoon99）。MCP server 现在会在主线程预热工具注册表再处理 `tools/call`，避免懒加载工具发现中的首次调用死锁（[#85](https://github.com/HKUDS/Vibe-Trading/pull/85)，感谢 @Teerapat-Vatpitak）。Vite dev proxy 也会为非默认后端目标遵循 `VITE_API_URL`（[#82](https://github.com/HKUDS/Vibe-Trading/pull/82)，感谢 @voidborne-d）。
- **2026-05-08** 🧾 **筛选器支持 Tushare 财报字段**：A 股日线回测现在可以通过 `fundamental_fields` 请求 PIT-safe 财务报表字段，使信号引擎能够在公告/披露日之后筛选 `income_total_revenue`、`income_n_income`、`balancesheet_total_hldr_eqy_exc_min_int`、`fina_indicator_roe` 等带表名前缀的字段（[#76](https://github.com/HKUDS/Vibe-Trading/pull/76)，感谢 @mrbob-git）。后续加固让显式财报字段请求在 Tushare enrich 无法运行时快速失败，而不是静默回退到原始价格 bar（[#77](https://github.com/HKUDS/Vibe-Trading/pull/77)）。
- **2026-05-07** 📈 **Tushare fundamentals 与社区 triage**：新增面向基本面研究工作流的 point-in-time `TushareFundamentalProvider` contract，并为项目 `TUSHARE_TOKEN` 环境路径加入回归覆盖（[#74](https://github.com/HKUDS/Vibe-Trading/pull/74)）。社区 triage 也明确了：Vibe-Trading 目前会将快速迭代聚焦在单一 UI 语言；在已内置 DuckDuckGo 支持的 `web_search` 时避免添加冗余搜索依赖；非官方托管部署不应被视为 API key 或数据源 token 的可信存放位置。
- **2026-05-06** 🚀 **v0.1.7 发布**（[Release notes](https://github.com/HKUDS/Vibe-Trading/releases/tag/v0.1.7)，`pip install -U vibe-trading-ai`）：安全边界加固已发布到 PyPI 和 ClawHub，覆盖更安全的 API/read/upload/file/URL/generated-code/shell-tool/Docker 默认行为，同时保持 localhost CLI/Web UI 工作流低摩擦。本周期还包含 Web UI Settings、相关性热力图、OpenAI Codex OAuth、A 股 pre-ST 筛选、交互式 CLI UX、swarm preset 检查、股息分析、开发工作流打磨，以及经审计的前端构建依赖下限。感谢 0.1.7 贡献者，也感谢 lemi9090 (S2W) 的协同安全验证。
- **2026-05-05** 🛡️ **安全边界后续加固**：完成围绕显式 CORS origins、Settings 凭据指示、Web URL 读取和 Shadow Account 代码生成的剩余安全边界加固，并为每条路径加入回归测试。普通 localhost CLI/Web UI 工作流保持不变；远程部署应继续使用 `API_AUTH_KEY` 和显式可信 origins。
- **2026-05-04** 🖥️ **交互式 CLI UX 与 CI 清理**：交互模式现在拥有实时底部状态栏，可显示 provider/model、session 时长、最近一次运行延迟和累计工具调用统计；并通过 `prompt_toolkit` 支持 prompt 历史导航和方向键光标编辑（[#69](https://github.com/HKUDS/Vibe-Trading/pull/69)）。当 `prompt_toolkit` 或 TTY 不可用时，CLI 仍会回退到 Rich prompts。CI 路径期望也已与加固后的 file-import sandbox 和跨平台 `/tmp` 解析对齐，使 main 恢复绿色（[`bb67dc7`](https://github.com/HKUDS/Vibe-Trading/commit/bb67dc7cfcc11553c57d8962bee56381dca43758)）。
- **2026-05-03** 🛡️ **安全加固补丁**：收紧非本地部署的默认 API 认证，保护敏感 run/session/swarm 读取，限制上传与本地文件读取边界，按入口限制 shell-capable 工具，导入前校验生成策略加载，并让 Docker 镜像默认以非 root 用户和 localhost-only 端口发布运行。本地 CLI 和 localhost Web UI 工作流仍保持低摩擦；远程 API/Web 部署应设置 `API_AUTH_KEY`。
- **2026-05-02** 🧭 **股息分析与更清晰路线图**：新增 `dividend-analysis` skill，用于收入型股票、派息可持续性、股息增长、股东收益、除息机制和收益率陷阱检查，并由 bundled-skill 回归测试固定。公开路线图现在聚焦即将开展的工作：Research Autopilot、Data Bridge、Options Lab、Portfolio Studio、Alpha Zoo、Research Delivery、Trust Layer 和 Community sharing。
- **2026-05-01** 🔥 **相关性热力图、OpenAI Codex OAuth 与 A 股 pre-ST 筛选**：新的相关性 dashboard/API 会计算滚动收益相关性，并为组合与标的分析渲染 ECharts 热力图（[#64](https://github.com/HKUDS/Vibe-Trading/pull/64)）。OpenAI Codex provider 现在通过 `vibe-trading provider login openai-codex` 使用 ChatGPT OAuth，并加入 Settings 元数据和 adapter 回归测试（[#65](https://github.com/HKUDS/Vibe-Trading/pull/65)）。新增并加固 `ashare-pre-st-filter` skill，用于 A 股 ST/*ST 风险筛查，包括 Sina 处罚相关性过滤，避免证券账户提及错误抬高 E2 计数（[#63](https://github.com/HKUDS/Vibe-Trading/pull/63)）。
- **2026-04-30** ⚙️ **Web UI Settings 与 validation CLI 加固**：新增 Settings 页面，用于配置 LLM provider/model、base URL、reasoning effort 和数据源凭据，由本地/认证保护的 settings API 与数据驱动的 provider metadata 支撑（[#57](https://github.com/HKUDS/Vibe-Trading/pull/57)）。同时加固 `python -m backtest.validation <run_dir>`，让缺失、空白、格式错误、不存在和非目录输入在 validation 开始前以清晰的面向操作者的信息失败（[#60](https://github.com/HKUDS/Vibe-Trading/pull/60)）。
- **2026-04-28** 🚀 **v0.1.6 发布**（`pip install -U vibe-trading-ai`）：修复 `pip install` / `uv tool install` 后 `vibe-trading --swarm-presets` 返回空的问题（[#55](https://github.com/HKUDS/Vibe-Trading/issues/55)）—— preset YAML 现在打包在 `src.swarm` 包内，并由 6 个回归测试固定。同时 AKShare loader 会将 ETF（`510300.SH`）和外汇（`USDCNH`）正确路由到对应 endpoint，并强化 registry fallback。汇总 v0.1.5 以来的所有内容：benchmark comparison panel、`/upload` streaming + size limits、Futu loader（港股 + A 股）、vnpy export skill、安全加固、前端懒加载（688KB → 262KB）。
- **2026-04-27** 📊 **Benchmark panel 与上传安全**：回测输出现在包含 benchmark comparison panel（ticker / benchmark return / excess return / information ratio），并通过 yfinance 支持 SPY、沪深 300 等解析（[#48](https://github.com/HKUDS/Vibe-Trading/issues/48)）。此外 `/upload` 会以 1 MB chunk 流式读取请求体，并在超过 `MAX_UPLOAD_SIZE` 时中止，在超大/畸形客户端场景下限制内存使用（[#53](https://github.com/HKUDS/Vibe-Trading/pull/53)）——由 4 个回归用例固定。
- **2026-04-22** 🛡️ **加固与新集成**：`safe_path` + journal/shadow tool sandbox 强制路径 containment，`MANIFEST.in` 在 sdist 中包含 `.env.example` / tests / Docker files，route-level lazy loading 将前端初始 bundle 从 688KB 降到 262KB。另有面向港股与 A 股 equities 的 Futu data loader（[#47](https://github.com/HKUDS/Vibe-Trading/pull/47)）和 vnpy CtaTemplate export skill（[#46](https://github.com/HKUDS/Vibe-Trading/pull/46)）。
- **2026-04-21** 🛡️ **Workspace 与文档**：相对 `run_dir` 会规范化到 active run dir（[#43](https://github.com/HKUDS/Vibe-Trading/pull/43)）。README 使用示例（[#45](https://github.com/HKUDS/Vibe-Trading/pull/45)）。
- **2026-04-20** 🔌 **Reasoning 与 Swarm**：所有 `ChatOpenAI` 路径都会保留 `reasoning_content`，Kimi / DeepSeek / Qwen thinking 全链路可用（[#39](https://github.com/HKUDS/Vibe-Trading/issues/39)）。Swarm streaming 与干净的 Ctrl+C（[#42](https://github.com/HKUDS/Vibe-Trading/issues/42)）。
- **2026-04-19** 📦 **v0.1.5**：发布到 PyPI 与 ClawHub。`python-multipart` CVE 下限升级，接入 5 个新 MCP tools（`analyze_trade_journal` + 4 个 shadow-account tools），修复 `pattern_recognition` → `pattern` registry，Docker 依赖对齐，SKILL manifest 同步（22 MCP tools / 71 skills）。
- **2026-04-18** 👥 **Shadow Account**：从券商流水中提取你的策略规则 → 跨市场回测 shadow → 生成 8 节 HTML/PDF 报告，明确展示你错过了多少机会（规则违背、过早离场、错过信号、反事实交易）。新增 4 个工具、1 个 skill，总计 32 tools。Trade Journal + Shadow Account 示例现在已在 Web UI 欢迎页中提供。
- **2026-04-17** 📊 **Trade Journal Analyzer 与 Universal File Reader**：上传券商导出（同花顺/东财/富途/generic CSV）→ 自动生成交易画像（持仓天数、胜率、盈亏比、回撤）+ 4 类行为偏差诊断（处置效应、过度交易、追涨、锚定）。`read_document` 现在以统一调用分发 PDF、Word、Excel、PowerPoint、图片（OCR）和 40+ 文本格式。
- **2026-04-16** 🧠 **Agent Harness**：跨 session 持久记忆、FTS5 session search、自进化 skills（完整 CRUD）、5 层上下文压缩、read/write tool batching。27 tools，107 个新增测试。
- **2026-04-15** 🤖 **Z.ai 与 MiniMax**：Z.ai provider（[#35](https://github.com/HKUDS/Vibe-Trading/pull/35)），MiniMax temperature 修复与模型更新（[#33](https://github.com/HKUDS/Vibe-Trading/pull/33)）。13 个 providers。
- **2026-04-14** 🔧 **MCP 稳定性**：修复 stdio transport 下 backtest tool 的 `Connection closed` 错误（[#32](https://github.com/HKUDS/Vibe-Trading/pull/32)）。
- **2026-04-13** 🌐 **跨市场组合回测**：新的 `CompositeEngine` 可用共享资金池和分市场规则回测混合市场组合（例如 A 股 + crypto）。同时修复 swarm template variable fallback 和前端 timeout。
- **2026-04-12** 🌍 **多平台导出**：`/pine` 可一条命令将策略导出到 TradingView（Pine Script v6）、TDX（通达信/同花顺/东方财富）和 MetaTrader 5（MQL5）。
- **2026-04-11** 🛡️ **可靠性与 DX**：`vibe-trading init` .env bootstrap（[#19](https://github.com/HKUDS/Vibe-Trading/pull/19)）、预检、运行时数据源 fallback、加固的回测引擎。多语言 README（[#21](https://github.com/HKUDS/Vibe-Trading/pull/21)）。
- **2026-04-10** 📦 **v0.1.4**：Docker 修复（[#8](https://github.com/HKUDS/Vibe-Trading/issues/8)）、`web_search` MCP tool、12 个 LLM providers、`akshare`/`ccxt` 依赖。发布到 PyPI 与 ClawHub。
- **2026-04-09** 📊 **Backtest Wave 2**：ChinaFutures、GlobalFutures、Forex、Options v2 engines。Monte Carlo、Bootstrap CI、Walk-Forward validation。
- **2026-04-08** 🔧 **多市场回测**，支持分市场规则、Pine Script v6 导出、5 个数据源自动 fallback。

</details>

---

## ✨ 核心功能

🎯 **聚焦 A股与港股**，深度定制，而非泛化全球市场的通用工具

| 功能模块 | 描述 |
|----------|------|
| 🧠 **自然语言驱动研究** | 用中文对话驱动投研工作流：分析个股、回测策略、解读财报、挖掘题材，无需写代码 |
| 📡 **多维市场特征提取** | 同步抓取**情绪面**（雪球大V舆情）、**资金面**（大单龙虎榜）、**技术面**（指标形态）、**基本面**（财报题材）四维立体信号 |
| 🤖 **多智能体分析团队** | 29 个预置 Swarm 团队（投资委员会、量化台、技术分析团、风控审计等），多 Agent 协同辩论出研究共识 |
| 📲 **多通道即时推送** | 微信个人号（iLink）/ 飞书机器人即插即用，策略信号与研究简报实时直达手机 |
| 🔬 **策略回测与 Alpha 横评** | 支持 A股/港股策略回测、452 个预置 Alpha 因子（国君191、Qlib158、Alpha101）一键横评 |
| 👥 **Shadow Account 交易复盘** | 上传同花顺/东方财富/富途账单，AI 提取你的交易规律，与 Shadow 策略做对比，找出错失机会 |
| 🔌 **MCP 工具化** | 通过 MCP 协议接入 Claude Desktop / OpenClaw / Cursor 等任意 AI 工具，作为智能体工具箱使用 |
| 🏗 **本地私有部署** | Docker 一键部署，数据留本地，多租户安全隔离，API 可信授权，支持异地局域网访问 |

## 💡 什么是 Vibe-Trading-CNX？

Vibe-Trading-CNX 是面向 **A股与港股** 的开源智能投研工作站，基于上游 [Vibe-Trading](https://github.com/HKUDS/Vibe-Trading) 深度定制。

它将自然语言提示连接到多维度市场特征分析（**情绪面 / 资金面 / 技术面 / 基本面**）、策略回测引擎、报告生成和持久投研记忆，并通过微信（iLink）/ 飞书等通道将研究简报即时推送到你的手机。

它面向研究、模拟和回测——面向理解市场、复盘自己的交易行为、挖掘 A股与港股的投资机会。

---

## ✨ 你能做什么

| 任务 | 输出与多维特征支持 |
|------|------|
| **多维特征提取与监控** | 结合**情绪面**（雪球大V及舆情监控）、**资金面**（大单与龙虎榜）、**技术面**（形态/指标回测）与**基本面**（题材/板块）对 A股与港股标的进行深度分析。 |
| **回测策略想法** | 策略代码、指标、A股/港股 benchmark 对比、验证 artifacts 和 run cards。 |
| **复盘自己的交易** | 国内主流券商（同花顺、东方财富、富途等）日志解析、行为诊断、规则提取和 Shadow Account 对比。 |
| **多通道异常预警** | 即插即用绑定微信个人号（iLink）或飞书（Lark）机器人，将策略信号与运行简报实时推送至手机端。 |
| **运行分析师团队** | 面向投资、量化、宏观题材和风控工作流的多智能体研究评审。 |
| **交付可用成果** | 报告、TradingView Pine Script、通达信 (TDX)、MetaTrader 5、MCP tools，以及可延续的研究 sessions。 |
| **跑预置 alpha zoo 横评** | 452 个 alpha 因子（含国君 191、Qlib 158、Alpha 101），一键在沪深300/中证500上算 IC + IR + alive/reversed/dead 分类。 |

---

## 🗺 CNX 路线图与未来蓝图

Vibe-Trading-CNX 定位为更贴合中国投资者交易习惯的 A股与港股智能投研终端。我们的未来蓝图聚焦于**情绪面、技术面、资金面、基本面**的多维度特征工程，以及多通道即时通知与执行：

| 阶段 | 核心模块 / 特性 | 状态与进展 |
|------|------|------|
| **1. 基础多数据源集成** | 深度整合东方财富/新浪行情、Tushare 与 Akshare 免密通道；支持 A股与港股多因子矩阵热力图及可视化面板 | **已完成** |
| **2. 安全与多租户隔离** | 引入 `API_ALLOWED_HOSTS` 可信 IP 的公网/局域网 CORS 自动授权；实现多租户物理目录隔离与常规账户沙箱机制 | **已完成 (v0.1.10.cnx.1)** |
| **3. 多通道智能体推送** | 微信个人号 (iLink) 与飞书 (Lark) 机器人即插即用集成，支持 `/myid` 反射、断线重试、轮询退避及主动投递 | **已完成 (v0.1.10.cnx.1)** |
| **4. 雪球网与多模态舆情监控 (情绪面)** | 打通雪球网 OAuth 绑定授权；支持实时监控雪球大V动态、主流股吧/论坛情感极性提取、行业热词监测及情绪预警 | **开发中 / 下一步** |
| **5. 大单主力资金与多维技术特征 (资金/技术面)** | 实现 A股与港股主力大单/特大单实时资金流分析、龙虎榜数据异动追踪、个股谐波形态识别与核心技术指标自动回测 | **规划中** |
| **6. 智能财务与题材挖掘 (基本面)** | A股与港股定期财报自动提取归纳、主营业务与热点题材相关度分析、题材轮动路径与市场风格（Regime）分析 | **规划中** |
| **7. 交易执行与期权实验室 (交易层面)** | 盈透证券 (IBKR) 与富途证券 (Futu) 实时状态心跳检测与交易路由；期权隐含波动率曲面、希腊字母面板与组合损益模拟器 | **规划中** |

---



```bash
pip install vibe-trading-cnx-ai

# A股个股回测与多通道简报推送示例
vibe-trading-cnx run -p "回测贵州茅台 (600519) 2024年的 20/50 日均线交叉策略，总结收益率与最大回撤，并通过微信推送研究简报"

# 一行 CLI 跑预置国君 191 因子横评
vibe-trading-cnx alpha bench --zoo gtja191 --universe csi300 --period 2020-2025 --top 20
```

```bash
vibe-trading-cnx --upload trades_export.csv
vibe-trading-cnx run -p "分析我的 A股/港股交易行为，提取我的 Shadow 策略，并与真实交易做对比"
```

---

## 👥 Shadow Account

Shadow Account 从你自己的交易记录出发，而不是从通用策略模板出发。

上传券商导出，让智能体总结你的交易行为，然后将真实交易路径与基于规则的 shadow strategy 进行对比。

| 步骤 | 智能体输出 |
|------|------------|
| **1. 读取交易日志** | 解析来自同花顺、东方财富、富途和 generic CSV 格式的券商导出。 |
| **2. 生成行为画像** | 持仓天数、胜率、盈亏比、回撤、处置效应、过度交易、追涨和锚定检查。 |
| **3. 提取你的规则** | 将反复出现的入场/出场行为转化为明确策略画像，而不是空泛总结。 |
| **4. 运行 shadow** | 回测提取出的规则，并高亮规则违背、过早离场、错过信号和替代交易路径。 |
| **5. 交付报告** | 生成可检查、可归档或在后续 session 中继续精修的 HTML/PDF 报告。 |

```bash
vibe-trading-cnx --upload trades_export.csv
vibe-trading-cnx run -p "分析我的 A股/港股交易行为，提取我的 Shadow 策略，并与真实交易做对比"
```

---

## 🧪 研究工作流

多数运行都会遵循同一条证据路径：路由请求、加载正确的市场上下文、执行工具、验证输出，并保持 artifacts 可检查。

| 层 | 发生什么 |
|----|----------|
| **Plan** | 选择相关金融 skills、tools、数据源，以及在有帮助时选择 swarm preset。 |
| **Ground** | 通过可用 loader 拉取 A 股、港股/美股、加密、期货、外汇、文档或网页上下文。 |
| **Execute** | 生成可测试的策略代码，运行工具，并使用匹配的回测引擎或分析工作流。 |
| **Validate** | 在适用时加入指标、benchmark comparison、Monte Carlo、Bootstrap、Walk-Forward、run cards 和 warnings。 |
| **Deliver** | 返回报告、artifacts、tool traces，以及面向 TradingView、TDX、MetaTrader 5、MCP clients 或后续 sessions 的导出。 |

---

## 🔩 详细能力清单

为保持主 README 易读，详细清单折叠在下方。需要检查可用构件时可展开查看。

<details>
<summary><b>金融能力库 (Finance Skill Library)</b> <sub>8 个类别中的 77 个 skills</sub></summary>

- 📊 77 个专业金融 skills，分布在 8 个类别中
- 🌐 覆盖传统市场、加密与 DeFi
- 🔬 从数据源到量化研究的完整能力链路

| 类别 | Skills | 示例 |
|------|--------|------|
| 数据源 (Data Source) | 7 | `data-routing`, `tushare`, `yfinance`, `okx-market`, `akshare`, `mootdx`, `ccxt` |
| 交易策略 (Strategy) | 17 | `strategy-generate`, `cross-market-strategy`, `technical-basic`, `candlestick`, `ichimoku`, `elliott-wave`, `smc`, `multi-factor`, `ml-strategy` |
| 投研分析 (Analysis) | 17 | `factor-research`, `macro-analysis`, `global-macro`, `valuation-model`, `earnings-forecast`, `credit-analysis`, `dividend-analysis` |
| 资产类别 (Asset Class) | 9 | `options-strategy`, `options-advanced`, `convertible-bond`, `etf-analysis`, `asset-allocation`, `sector-rotation` |
| 加密货币 (Crypto) | 7 | `perp-funding-basis`, `liquidation-heatmap`, `stablecoin-flow`, `defi-yield`, `onchain-analysis` |
| 资金流向 (Flow) | 7 | `hk-connect-flow`, `us-etf-flow`, `edgar-sec-filings`, `financial-statement`, `adr-hshare` |
| 核心工具 (Tool) | 11 | `backtest-diagnose`, `report-generate`, `pine-script`, `doc-reader`, `web-reader`, `vnpy-export`, `alpha-zoo` |
| 风险分析 (Risk Analysis) | 1 | `ashare-pre-st-filter` |

</details>

<details>
<summary><b>自定义数据源</b> <sub>注册你自己的历史 OHLCV loader</sub></summary>

需要一个我们没有内置 loader 的市场或数据商？自己加一个历史 K 线 loader，用
`source="<name>"` 选用即可。以下步骤会改动包源码，请从 clone 运行（`pip install -e .`）。

1. **编写 loader** —— 新建 `agent/backtest/loaders/<name>_loader.py`，写一个满足
   `DataLoaderProtocol` 的类（duck-typed，无需基类），并打上 `@register`：

   ```python
   import pandas as pd
   from backtest.loaders.registry import register

   @register
   class DataLoader:
       name = "mysource"            # the value you pass as source=
       markets = {"us_equity"}      # a_share/us_equity/hk_equity/crypto/futures/fund/macro/forex
       requires_auth = False

       def is_available(self) -> bool:
           return True              # token present? network reachable?

       def fetch(self, codes, start_date, end_date, *, interval="1D", fields=None):
           # return {symbol: DataFrame indexed by trade_date,
           #         columns: open, high, low, close, volume}
           ...
   ```

2. **注册模块** 让 `@register` 生效 —— 把 `"backtest.loaders.<name>_loader"` 加进
   `agent/backtest/loaders/registry.py` 的 `_loader_modules`。
3. **放行名称** 通过配置校验 —— 把 `"mysource"` 加进 `agent/backtest/runner.py`
   的 `_VALID_SOURCES`。
4. *（可选）* 把它放进 `registry.py` 中某个市场的 `FALLBACK_CHAINS`，让
   `source="auto"` 也能命中它。
5. **使用** —— 在回测配置里写 `source="mysource"`，或经 CLI / agent 调用。

> **实时 ticks / 盘口深度不在 loader 范围内** —— loader 层只负责 point-in-time
> 历史 K 线。实时行情走 broker connector：加密用 `okx` / `binance` / `ccxt`，
> 股票用 `futu` / `tiger`。

</details>

<details>
<summary><b>预设交易团队 (Preset Trading Teams)</b> <sub>29 个 swarm presets</sub></summary>

- 🏢 29 个开箱即用的智能体团队
- ⚡ 预配置金融工作流
- 🎯 投资、交易与风险管理 presets

| Preset | 工作流 |
|--------|--------|
| `investment_committee` | 多空辩论 → 风险审查 → PM 最终决策 |
| `global_equities_desk` | A 股 + 港/美股 + 加密研究员 → 全球策略师 |
| `crypto_trading_desk` | Funding/basis + liquidation + flow → 风险经理 |
| `earnings_research_desk` | 基本面 + 预期修正 + options → 财报策略师 |
| `macro_rates_fx_desk` | 利率 + 外汇 + 商品 → 宏观 PM |
| `quant_strategy_desk` | 筛选 + 因子研究 → 回测 → 风险审计 |
| `technical_analysis_panel` | 经典 TA + Ichimoku + harmonic + Elliott + SMC → 共识 |
| `risk_committee` | 回撤 + 尾部风险 + regime review → 审批 |
| `global_allocation_committee` | A 股 + 加密 + 港/美股 → 跨市场配置 |

<sub>另有 20+ 专业 presets，可运行 vibe-trading-cnx --swarm-presets 查看全部。

</sub>

</details>

<details>
<summary><b>Alpha 因子库 (Alpha Zoo)</b> <sub>452 个预置 alpha，覆盖 4 个 zoo</sub></summary>

- 🧬 452 个横截面 alpha，算子层即禁用 lookahead
- 📈 一条 CLI 命令完成 IC + IR + alive/reversed/dead 分类
- 🔬 AST 纯函数门禁 + 300 行 lookahead 哨兵测试 + `pytest-socket` 网络阻断
- 📦 Qlib 部分附 Apache-2 出处声明；每个 zoo 一份 `LICENSE.md`，声明公式属于数学内容
- 🤝 社区 PR 走 Developer Certificate of Origin (DCO) 签名流程

| Zoo | 数量 | 来源 | 许可 |
|-----|------|------|------|
| **qlib158** | 154 | Microsoft Qlib `Alpha158`（Apache-2.0，锁定 commit） | Apache-2.0 |
| **alpha101** | 101 | Kakushadze (2015), "101 Formulaic Alphas", arXiv:1601.00991 | 公式属于数学内容 |
| **gtja191** | 191 | 国君证券 (2014)《191 个短周期交易型 alpha 因子》研报 | 公式属于数学内容 |
| **academic** | 6 | Fama-French 5 因子 + Carhart 动量（基于价格的代理实现） | 公开学术文献 |

运行 `vibe-trading-cnx alpha list` 浏览全部因子，`vibe-trading-cnx alpha show <id>` 查看公式与源码，`vibe-trading-cnx alpha bench --zoo X --universe Y --period Z` 给一整个 zoo 打分。

</details>

## 🎬 功能演示

<div align="center">
<table>
<tr>
<td width="50%">

https://github.com/user-attachments/assets/4e4dcb80-7358-4b9a-92f0-1e29612e6e86

</td>
<td width="50%">

https://github.com/user-attachments/assets/3754a414-c3ee-464f-b1e8-78e1a74fbd30

</td>
</tr>
<tr>
<td colspan="2" align="center"><sub>☝️ 自然语言回测与多智能体 swarm 辩论 — Web UI + CLI（演示视频来自上游 Vibe-Trading，CNX 分支功能超集兼容）</sub></td>
</tr>
</table>
</div>

---

## 🚀 快速开始

### 一行安装（PyPI）

```bash
pip install vibe-trading-cnx-ai
```

然后运行第一个 A股 研究任务：

```bash
vibe-trading-cnx init
vibe-trading-cnx run -p "回测贵州茅台 (600519) 2024年的 20/50 日均线交叉策略，并微信推送研究简报"
```

> **包名与命令：** PyPI 包名是 `vibe-trading-cnx-ai`。安装后会获得三个命令：
>
> | 命令 | 用途 |
> |------|------|
> | `vibe-trading-cnx` | 交互式 CLI / TUI |
> | `vibe-trading-cnx serve` | 启动 FastAPI web server (默认端口 9988，测试/开发环境使用 9888) |
> | `vibe-trading-cnx-mcp` | 启动 MCP server（用于 Claude Desktop、OpenClaw、Cursor 等） |

```bash
vibe-trading-cnx init              # interactive .env setup
vibe-trading-cnx                   # launch CLI
vibe-trading-cnx serve --port 9988 # launch web UI
vibe-trading-cnx-mcp               # start MCP server (stdio)
```

### 或选择一种路径

| 路径 | 最适合 | 时间 |
|------|--------|------|
| **A. Docker** | 立即试用，零本地配置 | 2 min |
| **B. 本地安装** | 开发，完整 CLI 访问 | 5 min |
| **C. MCP plugin** | 接入你现有的智能体 | 3 min |
| **D. ClawHub** | 一条命令，无需 clone | 1 min |

### 前置条件

- 任意受支持 provider 的 **LLM API key**，或使用 **Ollama** 本地运行（无需 key）
- 路径 B 需要 **Python 3.11+**
- 路径 A 需要 **Docker**

> **支持的 LLM providers：** OpenRouter、OpenAI、DeepSeek、Gemini、Groq、DashScope/Qwen、Zhipu、Moonshot/Kimi、MiniMax、Xiaomi MIMO、Ollama（本地）。配置见 `.env.example`。

> **提示：** 由于自动 fallback，数据可以在没有任何 API key 的情况下工作。yfinance（港股）、mootdx（A 股，TCP 直连不封 IP）和 AKShare（A 股、港股、期货、外汇）都是免费的。Tushare token 是可选项 —— mootdx 是首选的免 token A 股 fallback，AKShare 作为覆盖更广的兜底。而情绪面支持则可通过设置页面一键绑定您的雪球网凭证进行深度监控。

<details>
<summary><b>🐳 Path A: Docker 部署（零配置，点击展开）</b></summary>

### Path A: Docker（零配置）

```bash
git clone https://github.com/skloxo/Vibe-Trading-CNX.git
cd Vibe-Trading-CNX
cp agent/.env.example agent/.env
# Edit agent/.env — uncomment your LLM provider and set API key
docker compose up --build
```

打开 `http://localhost:9988`（测试开发环境为 `http://localhost:9888`）。后端 + 前端在同一个容器中运行。

Docker 默认将后端发布在 `127.0.0.1:9988`，并以非 root 容器用户运行应用。如果你有意将 API 暴露到本机之外，请设置强 `API_AUTH_KEY`，并让客户端发送 `Authorization: Bearer <key>`。

</details>

<details>
<summary><b>💻 Path B: 本地源码安装与开发（点击展开）</b></summary>

### Path B: 本地安装

```bash
git clone https://github.com/skloxo/Vibe-Trading-CNX.git
cd Vibe-Trading-CNX
python -m venv .venv

# Activate
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\Activate.ps1       # Windows PowerShell

pip install -e .
cp agent/.env.example agent/.env   # Edit — set your LLM provider API key
vibe-trading-cnx                   # Launch interactive TUI
```

<details>
<summary><b>启动 Web UI（可选）</b></summary>

```bash
# Terminal 1: API server
vibe-trading-cnx serve --port 9988

# Terminal 2: Frontend dev server
cd frontend && npm install && npm run dev
```

打开 `http://localhost:5173` 或控制台打印的前端开发服务地址。前端会将 API 调用代理到 `localhost:9988`（测试/开发环境对应 `localhost:9888`）。

**生产模式（单 server）：**

```bash
cd frontend && npm run build && cd ..
vibe-trading-cnx serve --port 9988     # FastAPI serves dist/ as static files
```

> [!NOTE]
> `vibe-trading-cnx serve` 绑定 `0.0.0.0`，但默认只信任 loopback。若你从**另一台机器、虚拟机宿主机或局域网内的手机**访问，敏感接口会返回 `403` 且阻止写入，报错 `Cross-site request denied`。请配置 `agent/.env` 中的 `API_ALLOWED_HOSTS` 来信任您的公网/局域网域名或 IP 地址，这允许您在安全的局域网内免 key 异地使用和配置 settings；若要公开使用，请同时开启 `API_AUTH_KEY` 以确保网络传输安全。

</details>

</details>

<details>
<summary><b>🔌 Path C: MCP 插件接入（点击展开）</b></summary>

见下方 [MCP 插件](#-api-与-mcp-服务) 章节。
</details>

<details>
<summary><b>📦 Path D: ClawHub 一键安装（点击展开）</b></summary>

### Path D: ClawHub 一键安装

```bash
npx clawhub@latest install vibe-trading-cnx --force
```

skill + MCP config 会下载到你的智能体 skills 目录。详情见 [MCP 插件](#-api-与-mcp-服务)。
</details>

---

<details>
<summary><b>🧠 环境变量配置（.env 属性详解，点击展开）</b></summary>


将 `agent/.env.example` 复制为 `agent/.env`，并取消注释你想使用的 provider block。每个 provider 需要 3-4 个变量：

| 变量 | 必需 | 说明 |
|------|:----:|------|
| `LANGCHAIN_PROVIDER` | Yes | Provider 名称（`openrouter`, `deepseek`, `groq`, `ollama` 等） |
| `<PROVIDER>_API_KEY` | Yes* | API key（`OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY` 等） |
| `<PROVIDER>_BASE_URL` | Yes | API endpoint URL |
| `LANGCHAIN_MODEL_NAME` | Yes | 模型名称（例如 `deepseek-v4-pro`） |
| `TUSHARE_TOKEN` | No | A 股数据的 Tushare Pro token（会 fallback 到 AKShare） |
| `TIMEOUT_SECONDS` | No | LLM 调用超时，默认 120s |
| `API_AUTH_KEY` | 网络部署推荐 | API 可被非本地客户端访问时要求的 Bearer token |
| `VIBE_TRADING_ENABLE_SHELL_TOOLS` | No | 在远程 API/MCP-SSE 风格部署中显式启用 shell-capable tools |
| `VIBE_TRADING_ALLOWED_FILE_ROOTS` | No | 文档和券商日志导入额外允许的逗号分隔 roots |
| `VIBE_TRADING_ALLOWED_RUN_ROOTS` | No | 生成代码 run directories 额外允许的逗号分隔 roots |

<sub>* Ollama 不需要 API key。OpenAI Codex 使用 ChatGPT OAuth，并通过 `oauth-cli-kit` 存储 token，不写入 `agent/.env`。</sub>

**免费数据（无需 key）：** A 股通过 AKShare，港/美股通过 yfinance，加密通过 OKX，100+ 加密交易所通过 CCXT。系统会为每个市场自动选择最佳可用数据源。

</details>

<details>
<summary><b>🎯 推荐的大语言模型（LLM）配置建议（点击展开）</b></summary>

### 🎯 推荐模型

Vibe-Trading 是高度依赖工具的智能体：skills、backtests、memory 和 swarms 都会通过工具调用流转。模型选择会直接决定智能体是实际使用工具，还是从训练数据中编造答案。

| 档位 | 示例 | 使用场景 |
|------|------|----------|
| **Best** | `anthropic/claude-opus-4.7`, `anthropic/claude-sonnet-4.6`, `openai/gpt-5.5-pro`, `google/gemini-3.5-flash` | 复杂 swarms（3+ agents）、长研究 sessions、论文级分析 |
| **Sweet spot**（默认） | `deepseek-v4-pro`, `deepseek/deepseek-v4-pro`, `x-ai/grok-4.20`, `z-ai/glm-5.1`, `moonshotai/kimi-k2.6`, `qwen/qwen3-max-thinking` | 日常主力，约 1/10 成本下具备可靠工具调用 |
| **避免用于 agent** | `*-nano`, `*-flash-lite`, `*-coder-next`, 小型 / 蒸馏变体 | 工具调用不可靠，智能体会看起来像是在“凭记忆回答”，而不是加载 skills 或运行回测 |

默认 `agent/.env.example` 使用 DeepSeek 官方 API + `deepseek-v4-pro`；OpenRouter 用户可以使用 `deepseek/deepseek-v4-pro`。

</details>

---

<details>
<summary><b>🖥 CLI 命令行与交互式 TUI 指南（点击展开）</b></summary>


```bash
vibe-trading-cnx               # interactive TUI
vibe-trading-cnx run -p "..."  # single run
vibe-trading-cnx serve         # API server
vibe-trading-cnx alpha list    # 浏览 452 个预置 alpha；支持 show / bench / compare / export-manifest 子命令
```

<details>
<summary><b>TUI 终端快捷指令 (Slash Commands)</b></summary>

| 命令 | 说明 |
|------|------|
| `/help` | 显示所有命令 |
| `/skills` | 列出全部 77 个 finance skills |
| `/swarm` | 列出 29 个 swarm team presets |
| `/swarm run <preset> [vars_json]` | 运行一个 swarm team，并实时流式展示 |
| `/swarm list` | Swarm 运行历史 |
| `/swarm show <run_id>` | Swarm 运行详情 |
| `/swarm cancel <run_id>` | 取消运行中的 swarm |
| `/list` | 最近 runs |
| `/show <run_id>` | Run 详情 + 指标 |
| `/code <run_id>` | 生成的策略代码 |
| `/pine <run_id>` | 导出指标（TradingView + TDX + MT5） |
| `/trace <run_id>` | 完整执行回放 |
| `/continue <run_id> <prompt>` | 用新指令继续一个 run |
| `/sessions` | 列出 chat sessions |
| `/settings` | 显示运行时配置 |
| `/clear` | 清屏 |
| `/quit` | 退出 |

</details>

<details>
<summary><b>单次运行命令与参数 (Single run & flags)</b></summary>

```bash
vibe-trading-cnx run -p "回测宁德时代 (300750) 2024年的日线突破策略"
vibe-trading-cnx run -p "分析腾讯控股 (00700.HK) 的动量因子" --json
vibe-trading-cnx run -f strategy.txt
echo "回测平安银行 (000001.SZ) RSI" | vibe-trading-cnx run
```

```bash
vibe-trading-cnx -p "your prompt"
vibe-trading-cnx --skills
vibe-trading-cnx --swarm-presets
vibe-trading-cnx --swarm-run investment_committee '{"topic":"A股与港股主力资金流向研判"}'
vibe-trading-cnx --list
vibe-trading-cnx --show <run_id>
vibe-trading-cnx --code <run_id>
vibe-trading-cnx --pine <run_id>           # Export indicators (TradingView + TDX + MT5)
vibe-trading-cnx --trace <run_id>
vibe-trading-cnx --continue <run_id> "精细化止盈止损策略"
vibe-trading-cnx --upload report.pdf
vibe-trading-cnx alpha list --zoo gtja191 --limit 10
vibe-trading-cnx alpha show gtja191_171
vibe-trading-cnx alpha bench --zoo gtja191 --universe csi300 --period 2020-2025 --top 20
```

</details>

</details>

---



## 💡 典型示例

<details>
<summary><b>策略回测示例（点击展开）</b></summary>


```bash
# 均线交叉策略回测 (A股/港股)
vibe-trading-cnx run -p "回测贵州茅台 (600519) 过去一年的 20/50 日均线交叉策略，展示夏普比率与最大回撤"

# 超买超卖均值回归策略测试
vibe-trading-cnx run -p "测试招商银行 (600036) RSI(14) 均值回归策略：低于30买入，高于70卖出，过去6个月"

# 多因子策略回测
vibe-trading-cnx run -p "回测沪深300成分股过去2年的动量+价值+质量多因子策略"

# 回测完成后，一键导出至通达信 (TDX) / TradingView / MetaTrader 5
vibe-trading-cnx --pine <run_id>
```

**一行命令横评预置 alpha zoo**：
```bash
vibe-trading-cnx alpha bench --zoo gtja191 --universe csi300 --period 2020-2025 --top 20
```

**浏览目录** + 查看单个 alpha：
```bash
vibe-trading-cnx alpha list --zoo gtja191 --theme reversal --limit 10
vibe-trading-cnx alpha show gtja191_171
```

**用 zoo 因子组合多因子信号**（Python）：
```python
from src.skills.multi_factor.zoo_signal_engine import ZooSignalEngine
engine = ZooSignalEngine.from_zoo(["gtja191_171", "gtja191_111", "gtja191_163"])
panel = ...  # your wide OHLCV panel
signal = engine.compute_signal(panel)
```

</details>

<details>
<summary><b>市场研究示例（点击展开）</b></summary>


```bash
# 个股深度投研
vibe-trading-cnx run -p "研究比亚迪 (002594)：财报趋势、分析师一致预期、大单资金流向及下季度核心风险"

# 宏观题材分析
vibe-trading-cnx run -p "分析当前中国降准降息政策预期、人民币汇率走势及对 A股 与港股的影响"

# 情绪面舆情特征深度监控
vibe-trading-cnx run -p "深度挖掘雪球热门股情绪指标：监控大V多空动向、股吧热门评论与高管增减持"
```

</details>

<details>
<summary><b>多智能体 Swarm 工作流示例（点击展开）</b></summary>


```bash
# 针对特定标的多空观点辩论
vibe-trading-cnx --swarm-run investment_committee '{"topic": "当前位置的腾讯控股 (00700.HK) 是否值得买入？"}'

# 因子筛选到回测审计的量化工作流
vibe-trading-cnx --swarm-run quant_strategy_desk '{"universe": "csi300", "horizon": "3 months"}'

# 经典技术形态多智能体共识研判
vibe-trading-cnx --swarm-run technical_analysis_panel '{"asset": "600519.SH", "timeframe": "1d"}'

# 宏观配置委员会进行资产配比建议
vibe-trading-cnx --swarm-run macro_rates_fx_desk '{"focus": "央行降息流动性释放对国债与权益资产的再配置建议"}'
```

</details>

<details>
<summary><b>跨 Session 记忆示例（点击展开）</b></summary>


```bash
# 设定您的个人交易风格偏好 (一次记录，全站有效)
vibe-trading-cnx run -p "记住：我偏好 RSI 策略，最大回撤限制为 10%，持仓期 5-20 天"

# 智能体将在未来对话会话中自动读取该偏好约束
vibe-trading-cnx run -p "为我设计一个适合我风险画像的 A股 策略"
```

</details>

<details>
<summary><b>上传与文档分析示例（点击展开）</b></summary>


```bash
# 上传个人交割单或券商账单进行交易复盘画像
vibe-trading-cnx --upload trades_export.csv
vibe-trading-cnx run -p "分析我的 A股/港股交易行为，提取我的 Shadow 策略，并与真实交易做对比"

# 上传财报/研报 PDF 并提炼核心风险与业绩超预期情况
vibe-trading-cnx --upload BYD_earnings.pdf
vibe-trading-cnx run -p "总结该比亚迪季度财报中的核心风险及与业绩预期偏差"
```
</details>


---

## 🔌 API 与 MCP 服务

为保持主 README 易读，API 服务与 MCP 插件的详细配置及接口说明折叠在下方。

<details>
<summary><b>🌐 API 服务接口与安全策略（点击展开）</b></summary>


```bash
vibe-trading-cnx serve --port 9988
```

| Method | Endpoint | 说明 |
|--------|----------|------|
| `GET` | `/runs` | 列出 runs |
| `GET` | `/runs/{run_id}` | Run 详情 |
| `GET` | `/runs/{run_id}/pine` | 多平台指标导出 |
| `POST` | `/sessions` | 创建 session |
| `POST` | `/sessions/{id}/messages` | 发送消息 |
| `GET` | `/sessions/{id}/events` | SSE event stream |
| `POST` | `/upload` | 上传 PDF/file |
| `GET` | `/swarm/presets` | 列出 swarm presets |
| `POST` | `/swarm/runs` | 启动 swarm run |
| `GET` | `/swarm/runs/{id}/events` | Swarm SSE stream |
| `GET` | `/alpha/list` | 按 zoo/theme/universe 过滤列出 alpha |
| `GET` | `/alpha/{alpha_id}` | Alpha 元数据 + 源代码 |
| `POST` | `/alpha/bench` | 启动一个 bench job（返回 `job_id`） |
| `GET` | `/alpha/bench/{job_id}/stream` | SSE 进度流 |
| `GET` | `/settings/llm` | 读取 Web UI LLM settings |
| `PUT` | `/settings/llm` | 更新本地 LLM settings |
| `GET` | `/settings/data-sources` | 读取本地数据源 settings |
| `PUT` | `/settings/data-sources` | 更新本地数据源 settings |

交互式文档：`http://localhost:9988/docs`

### 安全默认策略

对于 localhost 开发，`vibe-trading-cnx serve` 会保持浏览器工作流简单。对任何非本地客户端，敏感 API endpoints 都要求 `API_AUTH_KEY`；JSON/upload 请求请使用 `Authorization: Bearer <key>`。浏览器 EventSource streams 会在你于 Settings 中输入同一个 key 后由 Web UI 处理。

Shell-capable tools 可用于本地 CLI 与可信 localhost 工作流，但不会暴露给远程 API sessions，除非你显式设置 `VIBE_TRADING_ENABLE_SHELL_TOOLS=1`。文档和日志读取器默认限制在 upload/import roots 内；请将文件放在 `agent/uploads`、`agent/runs`、`./uploads`、`./data`、`~/.vibe-trading-cnx/uploads` 或 `~/.vibe-trading-cnx/imports` 下，或通过 `VIBE_TRADING_ALLOWED_FILE_ROOTS` 添加专用目录。

### Web UI 设置

Web UI Settings 页面允许本地用户更新 LLM provider/model、base URL、generation parameters、reasoning effort，以及 Tushare token 等可选市场数据凭据。Settings 会持久化到 `agent/.env`；provider defaults 从 `agent/src/providers/llm_providers.json` 加载。

Settings 读取无副作用：`GET /settings/llm` 和 `GET /settings/data-sources` 永远不会创建 `agent/.env`，并且只返回项目相对路径。Settings 读写可能暴露凭据状态或更新凭据/运行时环境，因此在配置了 `API_AUTH_KEY` 时会要求认证。如果 dev mode 下未设置 `API_AUTH_KEY`，settings 访问只接受 loopback clients。

---

</details>

<details>
<summary><b>🔌 MCP 插件与客户端集成配置（点击展开）</b></summary>


Vibe-Trading-CNX 为任何 MCP-compatible client 暴露 36 个 MCP tools。它作为 stdio subprocess 运行，无需 server setup。核心 research tools 对 A股/港股 零 API key 可用；trading connector tools 使用当前选择的 connector profile；只有 `run_swarm` 需要 LLM key。

<details>
<summary><b>Claude Desktop 客户端配置</b></summary>

添加到 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "vibe-trading-cnx": {
      "command": "vibe-trading-cnx-mcp"
    }
  }
}
```

</details>

<details>
<summary><b>OpenClaw 配置</b></summary>

添加到 `~/.openclaw/config.yaml`：

```yaml
skills:
  - name: vibe-trading-cnx
    command: vibe-trading-cnx-mcp
```

</details>

<details>
<summary><b>Cursor / Windsurf 及其他 MCP 客户端配置</b></summary>

```bash
vibe-trading-cnx-mcp                  # stdio (default)
vibe-trading-cnx-mcp --transport sse  # SSE for web clients
```

</details>

**暴露的 MCP tools（36）：** `list_skills`, `load_skill`, `start_research_goal`, `get_research_goal`, `add_goal_evidence`, `update_research_goal_status`, `backtest`, `factor_analysis`, `analyze_options`, `pattern_recognition`, `read_url`, `read_document`, `web_search`, `write_file`, `read_file`, `list_swarm_presets`, `run_swarm`, `get_market_data`, `get_swarm_status`, `get_run_result`, `list_runs`, `reap_stale_runs`, `retry_run`, `analyze_trade_journal`, `extract_shadow_strategy`, `run_shadow_backtest`, `render_shadow_report`, `scan_shadow_signals`, `trading_connections`, `trading_select_connection`, `trading_check`, `trading_account`, `trading_positions`, `trading_orders`, `trading_quote`, `trading_history`.

<details>
<summary><b>从 ClawHub 安装（一条命令）</b></summary>

```bash
npx clawhub@latest install vibe-trading-cnx --force
```

> 由于该 skill 引用了外部 API，会触发 VirusTotal 自动扫描，因此需要 `--force`。代码完全开源，可自行检查。

这会将 skill + MCP config 下载到你的智能体 skills 目录。无需 clone。

在 ClawHub 浏览：[clawhub.ai/skills/vibe-trading-cnx](https://clawhub.ai/skills/vibe-trading-cnx)

</details>

<details>
<summary><b>OpenSpace — 自进化金融能力集成</b></summary>

全部 77 个 finance skills 都发布在 [open-space.cloud](https://open-space.cloud)，并通过 OpenSpace 的自进化引擎自主演进。

要配合 OpenSpace 使用，请将两个 MCP servers 都加入你的 agent config：

```json
{
  "mcpServers": {
    "openspace": {
      "command": "openspace-mcp",
      "toolTimeout": 600,
      "env": {
        "OPENSPACE_HOST_SKILL_DIRS": "/path/to/vibe-trading-cnx/agent/src/skills",
        "OPENSPACE_WORKSPACE": "/path/to/OpenSpace"
      }
    },
    "vibe-trading-cnx": {
      "command": "vibe-trading-cnx-mcp"
    }
  }
}
```

OpenSpace 会自动发现全部 77 个 skills，启用 auto-fix、auto-improve 和社区分享。在任意已连接 OpenSpace 的智能体中，可通过 `search_skills("finance backtest")` 搜索 Vibe-Trading-CNX skills。

</details>

---

</details>

## 📁 项目结构

为保持主 README 易读，详细的项目源码与目录结构折叠在下方。

<details>
<summary><b>📁 项目源码与目录结构（点击展开）</b></summary>

```
Vibe-Trading-CNX/
├── agent/                          # 后端（Python）
│   ├── cli/                        # CLI 包 —— 交互式 TUI + 子命令
│   ├── api_server.py               # FastAPI server —— runs、sessions、upload、swarm、SSE
│   ├── mcp_server.py               # MCP server —— 36 个工具，面向 OpenClaw / Claude Desktop
│   │
│   ├── src/
│   │   ├── agent/                  # ReAct agent 内核
│   │   │   ├── loop.py             #   5 层上下文压缩 + 读/写工具批处理
│   │   │   ├── context.py          #   system prompt + 持久记忆自动召回
│   │   │   ├── skills.py           #   skill loader（77 个内置 + 通过 CRUD 创建的用户 skill）
│   │   │   ├── tools.py            #   tool 基类 + 注册表
│   │   │   ├── memory.py           #   每个 run 的轻量 workspace 状态
│   │   │   ├── frontmatter.py      #   共享 safety YAML frontmatter
│   │   │   └── trace.py            #   执行 trace 写入器
│   │   │
│   │   ├── memory/                 # 跨 session 持久记忆
│   │   │   └── persistent.py       #   基于文件的记忆（~/.vibe-trading-cnx/memory/）
│   │   │
│   │   ├── tools/                  # 31 个自动发现的 agent 工具
│   │   │   ├── backtest_tool.py    #   运行回测
│   │   │   ├── remember_tool.py    #   跨 session 记忆（save/recall/forget）
│   │   │   ├── skill_writer_tool.py #  skill CRUD（save/patch/delete/file）
│   │   │   ├── session_search_tool.py # FTS5 跨 session 搜索
│   │   │   ├── swarm_tool.py       #   启动 swarm team
│   │   │   ├── web_search_tool.py  #   DuckDuckGo 网络搜索
│   │   │   └── ...                 #   bash、文件 I/O、因子分析、期权、alpha 浏览 + 横评等
│   │   │
│   │   ├── factors/                # Alpha Zoo —— 4 个 zoo 共 452 个 alpha
│   │   │   ├── base.py             #   19 个算子（rank/scale/ts_*/delta/decay_linear/safe_div/vwap）
│   │   │   ├── registry.py         #   纯 AST 元数据加载 + 惰性计算 + sanity 校验
│   │   │   ├── bench_runner.py     #   IC + alive/reversed/dead 分类
│   │   │   └── zoo/                #   qlib158 (154) + alpha101 (101) + gtja191 (191) + academic (6)
│   │   │
│   │   ├── api/                    # FastAPI 路由模块
│   │   │   └── alpha_routes.py     #   /alpha/list、/alpha/{id}、/alpha/bench、SSE 流
│   │   │
│   │   ├── skills/                 # 8 个类别共 77 个 finance skills（每个一份 SKILL.md）
│   │   ├── swarm/                  # Swarm DAG 执行引擎
│   │   │   └── presets/            #   29 个 swarm preset YAML 定义
│   │   ├── session/                # 多轮对话 + FTS5 session 搜索
│   │   └── providers/              # LLM provider 抽象层
│   │
│   └── backtest/                   # 回测引擎
│       ├── engines/                #   7 个引擎 + 跨市场 composite 引擎 + options_portfolio
│       ├── loaders/                #   7 个数据源：tushare、okx、yfinance、akshare、mootdx、ccxt、futu
│       │   ├── base.py             #   DataLoader Protocol
│       │   └── registry.py         #   Registry + 自动 fallback 链路
│       └── optimizers/             #   MVO、equal vol、max div、risk parity
│
├── frontend/                       # Web UI（React 19 + Vite + TypeScript）
│   └── src/
│       ├── pages/                  #   Home、Agent、AlphaZoo、RunDetail、Compare、Correlation、Settings
│       ├── components/             #   chat、charts、layout
│       └── stores/                 #   Zustand 状态管理
│
├── Dockerfile                      # 多阶段构建
├── docker-compose.yml              # 一条命令部署
├── pyproject.toml                  # 包配置 + CLI entrypoint
├── tools/                          # 仓库级 CI 辅助脚本
│   └── ci_grep_gates.sh            # 拦截 yaml.load / 商标 / 个股数据泄露
└── LICENSE                         # MIT
```

</details>

---




## 参与贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解指南。

**Good first issues** 使用 [`good first issue`](https://github.com/skloxo/Vibe-Trading-CNX/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) 标记，可选择一个开始。

想贡献更大的内容？请查看上方 [Roadmap](#-roadmap)，并在开始前先开 issue 讨论。

---

## 贡献者致谢

感谢所有为 Vibe-Trading 做出贡献的人！

近期 v0.1.9 周期贡献者与致谢：

- @toanalien — session JSONL 崩溃加固 (#147)、迭代预算用尽时优雅退出 (#148)、LLM 生成 signal engine 的预检校验 (#149)、跨浏览器 Full Report 链接 (#150)
- @ai7eam-dev — 跨市场相关性时间戳对齐 (#158),以及会话运行状态指示器 + swarm 重试 (#159 → #160)
- @shadowinlife — 通过 SSE/HTTP 的远程 MCP server (#125),以及 swarm worker 中 operator 配置的外部 MCP 工具 (#142)
- @DoubleSky123 — 可配置 SSE idle timeout (#157)
- @ArthurXi — Web composer 的 IME 回车提交处理 (#146)
- @omcdecor-cyber — 上游任务失败时阻断下游的 swarm DAG (#145)
- @Soli22de — 带强制随机对照的严格 alpha-bench (#143)
- @ruok808 — CCXT loader 的 proxy 环境变量支持 (#126)
- @faizack — 远程 Ollama base URL 规范化 (#129)
- @fightZy — agent 会话历史加载修复 (#136)
- @lcwSeven — alpha list 接口接受短 universe 名 (#137)
- @Teerapat-Vatpitak — 解析后的 .env 来源日志 (#124)
- @warren618 / Haozhe Wu — connector-first 券商 profile、Robinhood Agentic Trading 通道、Research Goal 运行时、swarm reconcile + retry_run、agent/cli 重构、mootdx loader、发布集成



---

## 免责声明

Vibe-Trading-CNX 是研究与交易辅助软件，不构成投资建议，不托管任何资金，也不运营执行场所。历史表现不代表未来结果，投资存在风险，请自行判断。

## 开源协议

MIT License — see [LICENSE](LICENSE)

---

<p align="center">
  感谢访问 <b>Vibe-Trading-CNX</b> ✨
</p>
