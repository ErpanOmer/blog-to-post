## 五项功能实施计划

### 功能 1：账号健康面板（/accounts 页）

- **过期预警**：`PlatformAccountList` 卡片在"验证于"旁增加时效徽章——`lastVerifiedAt` 超过 7 天显示琥珀色"7天未验证"，超过 30 天红色"30天未验证"（纯客户端计算，无后端改动）。
- **健康摘要条 + 批量验证**：`PlatformAccountsPanel` 过滤栏增加统计（启用 x · 停用 y · 未验证 z · 超期 n）+ "批量验证"按钮：对当前筛选下**启用**的账号按并发 2 顺序调用现有 `POST /:id/verify`，sonner 进度 toast 实时更新（x/y），完成后汇总成功/失败并 `fetchAccounts()` 刷新。
- **启用时自动验证**（你的核心诉求）：`handleToggleActive` 在 `nextActive=true` 时，更新状态后立即 `verifyPlatformAccount(id)`，用 `toast.promise` 展示"正在验证账号可用性…"，结果 toast 报告账号是否真实可用（valid 与否），完成后刷新列表。停用方向不验证。
- 不新增 worker 路由，复用现有 verify 接口。

### 功能 2：Dashboard 数据可视化（"数据洞察"新区块）

用**已安装但从未使用的 recharts**（不新增依赖）在 Dashboard 双列区下方新增两个 SectionCard：
1. **平台发布分布** donut 图：各平台成功发布次数占比（正式+草稿），颜色映射各平台品牌色（新增 platform→hex 常量表，与现有徽章色一致）。
2. **发布构成与任务耗时**：左环形图（正式/草稿/失败占比），右折线图（最近 20 次发布任务耗时，含平均参考线）。
- 数据全部来自现有 API（`/api/publish/history` + `/api/publish/tasks`，Dashboard 已在拉取），客户端聚合，**无后端改动**；遵循 DESIGN.md（SectionCard、无装饰渐变）。

### 功能 3：Worker cron 健康检查（每 30 分钟）

- `wrangler.json` 启用 `"triggers": { "crons": ["*/30 * * * *"] }`。
- **关键安全点**：现有 `scheduled` handler 会无条件跑 `processScheduledTasks` + `runDailyCron`（后者每次生成 3 篇 AI 草稿并把全部草稿转 reviewed！）。改造为三参签名 `(event, env, ctx)` 按分支执行：
  - `processScheduledTasks`（幂等、轻量）→ 所有 cron 都执行；
  - `event.cron === "*/30 * * * *"` → `ctx.waitUntil(fetch ${WECHAT_RELAY_BASE_URL}/healthz)`（复用现有变量，10s 超时，结果写日志，失败不抛错）；
  - `runDailyCron` 仅在 `"0 2 * * *"` 表达式时执行——**该表达式不排入 triggers**，保持休眠，避免 30 分钟一次的副作用；将来想开每日 AI 生成，triggers 加一行即可。
- 期望管理：healthz 入站流量对 Oracle 空闲判定贡献很小，防回收主力仍是服务器上已部署的 systemd keep-alive；这个 cron 的价值是**持续拨测 + 生产日志留痕**（配合 `wrangler tail` 可观察）。

### 功能 4：文档刷新

- **AGENTS.md**：环境变量删掉 `OLLAMA_*` 换成真实清单（`ENCRYPTION_KEY`、`WECHAT_RELAY_BASE_URL/API_KEY` 等）；平台列表补 `wechat_v2`；仓库地图补 `relay/`、`.github/workflows/`、`cron.ts`；重要表清单补 `ai_provider_profiles`/`ai_model_routes`；"AI, Prompts, and Settings"章节改写为 provider profiles + 功能路由架构；新增"部署拓扑"节（CF Worker → 域名/CF Full(strict) → Oracle relay 容器 → 微信，含 keep-alive 与监控）；新增账号启用/停用说明（isActive 语义与发布门禁）。
- **relay/README.md**：补域名接入 + CF 回源模式、证书位置与 2041 有效期、"监控与防回收"节（Worker cron、ZCode 定时任务、systemd keep-alive 三层）。
- **.agents/skills/project-overview/SKILL.md**：适配器清单补 `51cto`/`website`/`wechat_v2`，补 relay 拓扑一段（该文件供 AI 代理阅读，与 AGENTS.md 同步）。
- 根 README.md 如存在过期内容则同步关键段落。

### 功能 5：AI 多平台接入（评估结论 + 两项优化）

**评估结论：不需要重构，也建议不引入 LiteLLM/OneAPI 等网关**（个人工具跑网关过重）。现有 `openai-compatible` + `anthropic` 双协议（Vercel AI SDK）已覆盖：DeepSeek、Claude、Gemini（compat baseUrl）、NVIDIA NIM、月之暗面、通义 DashScope、智谱 GLM、硅基流动、OpenRouter、Ollama 等——**加平台=加一条 provider profile，零代码**。真正的缺口是配置体验，补两项：
1. **平台预设目录**：`AIConfigurationPanel` 协议/表单区增加预设下拉（约 10 个平台：名称、协议、baseUrl、默认模型、备注），选择即一键填充，减少查文档成本。
2. **未保存配置的模型发现**：worker 新增 `GET /api/ai/models?protocol&baseUrl&apiKey`（复用现有 `listModelsForProvider`），表单在未保存状态下也能"获取模型列表"下拉选择（已保存配置的 `:id/models` 已存在）。
3. 已知限制写入文档：生产环境 baseUrl 强制 HTTPS，故本地 Ollama 仅限本地开发使用。

### 实施顺序与验收

顺序：③ cron（最小）→ ① 账号健康 → ② Dashboard → ⑤ AI 预设 → ④ 文档（最后写，反映最终状态）。
验收：`npm run lint` + `npm run build` 全绿；dev server 实测（启用开关自动 verify、批量验证进度、过期徽章、AI 预设填充、Dashboard 截图）；cron 用 `wrangler deploy --dry-run` 验证配置，部署后用 `wrangler tail` 观察首次触发日志。