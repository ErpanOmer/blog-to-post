## 微信固定出口 IP 方案：wechat_v2 适配器 + Oracle 转发容器

### 架构

```
CF Worker (wechat_v2 适配器)
   │  原 URL: https://api.weixin.qq.com/cgi-bin/xxx  (逻辑/代码不变)
   │  v2 仅在 request() 汇聚点改写为:
   ▼
http://192.9.132.160/cgi-bin/xxx   + x-relay-token 鉴权头
   │  Oracle Docker 容器 (relay，只允许转发到 api.weixin.qq.com)
   ▼
https://api.weixin.qq.com/cgi-bin/xxx   ← 微信看到的出口 IP = 192.9.132.160
```

- relay 是**无状态转发器**：AppSecret/access_token 不存储在服务器上，只随请求透传（满足"凭证带过去"且更安全）。
- relay 强制鉴权（共享密钥 `x-relay-token`，常量时间比较），路径只放行 `/cgi-bin/` 前缀 → 不是开放代理。
- 日志只记 method + 去掉 query 的 path + 状态码 + 耗时，永不记录 query/header/body → AppSecret、access_token、签名不出现在任何日志；Worker 侧 tracing 沿用现有 `sanitizeUrlForLog` 脱敏。

---

### Phase A：仓库内新建 `relay/` 转发服务（零依赖 Node 22 + TS）

新建文件（`relay/` 自带 package.json/tsconfig，不进主工程 tsc/vitest/eslint 范围）：
- `relay/src/server.ts` — Node 原生 `node:http` 服务（零 npm 依赖）：
  - `GET /healthz` 免鉴权（供 CI/监控用，无信息泄露）
  - `GET /debug/egress-ip` 需鉴权：用假 appid/secret 调 `/cgi-bin/token`，从微信 40164 错误里提取"微信实际看到的出口 IP"——用于白名单配置前的验证
  - 其余：校验 `x-relay-token` → 路径前缀白名单（仅 `/cgi-bin/`）→ 读取原始 body（上限 64MB，覆盖 10MB 图片 multipart）→ 原样转发 method/query/`content-type` 到 `https://api.weixin.qq.com<path>?<query>` → 90s 超时 → 原样回传响应。JSON 和 FormData(multipart) 走同一透传路径，天然正确。
- `relay/Dockerfile`（多阶段：builder 装 typescript 编译 → runtime 仅 `node:22-alpine` + dist，无 npm install）、`relay/compose.yml`（`unless-stopped`、内存限制 256MB、日志轮转 max-size=10m）、`.dockerignore`、`README.md`

### Phase B：Oracle 服务器部署（现在就手动做，验证可用后 CI 接管）

1. 生成本机新部署专用密钥 `~/.ssh/oci_wechat_deploy_ed25519`（与个人密钥分离），pubkey 追加到服务器 `authorized_keys`
2. 删除 `hello-server` 容器腾出 80 端口；scp relay 文件到 `/opt/wechat-relay/`；生成 `RELAY_API_KEY`（openssl rand -hex 32）写入服务器 `.env`；`docker compose up -d --build`
3. 验收①：本机 `curl http://192.9.132.160/healthz` → ok
4. 验收②（关键）：本机调 `/debug/egress-ip` → 微信 40164 错误里显示 `192.9.132.160` = 微信确认出口 IP 正确
5. ⚠️ **需要你操作**：微信公众平台 → 设置与开发 → 基本配置 → IP 白名单，加入 `192.9.132.160`
6. 验收③：从本地用真实 appid/secret 发起 `/cgi-bin/token`（经 relay）→ 拿到 `access_token` = 白名单生效。凭证来源：从生产 D1 读出 `wechat` 账户的加密 authToken，用 `.env` 的 ENCRYPTION_KEY 在本地解密（解密脚本放 `.tmp/`，不入库）

### Phase C：GitHub Actions 自动部署

- `.github/workflows/deploy-relay.yml`：push 到 master 且 `relay/**` 有变更时（含 workflow_dispatch）触发：runner 上 `npm ci && tsc` 编译 relay → scp `dist + Dockerfile + compose.yml` 到 `/opt/wechat-relay/` → ssh `docker compose up -d --build` → curl healthz 验活。不用镜像仓库，只需 SSH secrets。
- ⚠️ **需要你操作（一次性）**：GitHub 仓库 Settings → Secrets 添加 `ORACLE_HOST`、`ORACLE_SSH_USER=opc`、`ORACLE_SSH_KEY`（部署私钥）。我会把私钥内容输出到指定位置供你粘贴（本机无 gh CLI；若你装好 gh 并 `gh auth login`，我也可以代为写入）。

### Phase D：Worker 端 `wechat_v2` 适配器（不动 wechat.ts 逻辑）

- 新建 `src/worker/accounts/wechat-v2.ts`：`class WechatV2AccountService extends WechatAccountService`，仅覆写 `request()`——`https://api.weixin.qq.com` 前缀改写为 `WECHAT_RELAY_BASE_URL`（默认 `http://192.9.132.160`）+ 注入 `x-relay-token`（缺 `WECHAT_RELAY_API_KEY` 时直接抛中文错误，publish steps 可见）；`registerAccountService("wechat_v2", ...)`。超时/延迟/tracing/重试/token 刷新/图片候选重试全部继承。
- 平台注册面（探查已定位到行号）：`src/shared/types.ts:1`（PlatformType）、`src/shared/platform-settings.ts`（列表/显示名"公众号V2"/图标）、`src/worker/routes/publish.ts:36`、`src/worker/routes/accounts.ts:65,85`（appId/appSecret 表单分支，抽 `isWechatFamilyPlatform()` 共享判断）、`src/worker/services/publish.ts:899`（草稿 URL 特例）、`src/worker/platform/adapters.ts:62`、`src/worker/routes/articles.ts:461`（发布 URL 形状校验）、`src/react-app/components/platform-brand-data.ts`（Record 穷尽，TS 会强制）、`src/react-app/components/PlatformAccountForm.tsx:124`（凭证表单分支）、`PlatformPublishSettingsPanel.tsx`（描述文案）。**D1 无需迁移**；`cron.ts` 不加 v2（避免重复生成草稿）。
- Env：`src/worker/types.ts` 加 `WECHAT_RELAY_BASE_URL?`、`WECHAT_RELAY_API_KEY?`；wrangler.json 加 base URL var；API key 用 `wrangler secret put` 写入生产，`.env` 加本地开发值。验证：`npm run lint && npm run build`。

### Phase E：端到端验收（用最近一篇文章）

1. `npm run deploy` 发布 Worker（与现有部署方式一致）
2. 通过 API 创建 `wechat_v2` 账户（真实 appId/appSecret）→ 创建时的 verify 调 `/cgi-bin/getcallbackip` 走通全链路
3. **草稿发布**（draftOnly）：选生产 D1 最新文章 → 走 `wechat_v2` 账户 → 验收：token 获取成功（=微信认 192.9.132.160）、`publish_task_steps` 无错误、草稿出现在公众平台后台、图片正常
4. **完整发布**：同文章 freepublish → 验收：发布成功、`article_publications` URL 形状正确、文章在公众号可见
5. **回滚能力验证**：旧 `wechat` 平台账户全程未动，随时可在发布对话框换回旧账户 = 秒级回滚；删掉 v2 账户即完全下线新链路

### Phase F：转正

验收通过后：账户表单中 `wechat_v2` 设为微信类平台默认选项，文案标注"推荐（固定出口 IP）"；旧 `wechat` 保留可用作为逃生通道。

### 安全说明（按你的指示执行 + 一点提醒）

- 仅代理 `api.weixin.qq.com`，路径限定 `/cgi-bin/`；鉴权失败/越径一律 403。
- 明确风险：Worker→relay 是明文 HTTP，AppSecret（token 换取的 query 参数）在该段链路对网络观察者可见，靠 x-relay-token + 后续可做 NSG 限源（Cloudflare IP 段）缓解；未来若你有域名，可加 Caddy/Let's Encrypt 升级 HTTPS，Worker 只需改 `WECHAT_RELAY_BASE_URL` 一个变量。
- `.tmp/` 下的解密脚本、私钥、RELAY_API_KEY 不进 git；所有日志/trace 脱敏规则两端都遵守。

### 明确不做的事

不改 `wechat.ts` 任何逻辑；不代理 `mmbiz.qpic.cn` 图片验证/下载（非 api.weixin.qq.com 域，按你要求只代理微信 API 域）；不动 D1 schema；不改发布编排流程；不新增付费资源。