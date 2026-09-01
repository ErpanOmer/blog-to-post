# wechat-relay

微信 API 固定出口 IP 转发服务。部署在 Oracle Cloud（`192.9.132.160`）Docker 容器中，
把 blog-to-post Worker 的微信请求原样转发到 `api.weixin.qq.com`，使微信看到的服务器出口 IP
固定为 Oracle 服务器 IP，从而满足公众号 IP 白名单要求。

零 npm 运行时依赖（仅 TypeScript 编译依赖），Node 22 原生 `node:http` + `fetch`。

## 安全模型

- **鉴权**：所有非 `/healthz` 请求必须带 `x-relay-token` 头，值等于环境变量 `RELAY_API_KEY`，常量时间比较。
- **目标锁定**：只转发路径前缀 `/cgi-bin/` 到固定上游 `https://api.weixin.qq.com`，其余一律 404。不是开放代理。
- **凭证不落盘**：AppSecret / access_token 只随请求透传，服务不存储任何状态。
- **日志脱敏**：只记录 method、path（去掉 query）、状态码、耗时、字节数；query/header/body 永不落日志；
  错误信息中的 URL 一律替换为 `[redacted-url]`（undici 错误消息可能内嵌完整 URL）。

## 端点

| 端点 | 鉴权 | 说明 |
|---|---|---|
| `GET /healthz` | 免 | 存活检查，返回 `{"ok":true}` |
| `GET /debug/egress-ip?appid=<真实appid>` | 需 | 用真实 appid + 假 secret 调 `/cgi-bin/token`，微信按"appid 有效性 → IP 白名单"顺序校验，非白名单 IP 返回 40164 并在其中给出微信实际看到的出口 IP（配置白名单前验证用） |
| `GET/POST /cgi-bin/*` | 需 | 原样转发到微信（JSON 与 multipart/FormData 均为字节级透传） |

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `RELAY_API_KEY` | 是 | 与 Worker 端 `WECHAT_RELAY_API_KEY` 一致的共享密钥 |
| `RELAY_PORT` | 否 | 监听端口，容器内固定 80 |

## 本地运行

```bash
cd relay
npm ci
npm run build
RELAY_API_KEY=devkey RELAY_PORT=18080 npm start
curl -s http://127.0.0.1:18080/healthz
curl -s -H "x-relay-token: devkey" http://127.0.0.1:18080/debug/egress-ip
```

## Oracle 服务器部署

服务器目录 `/opt/wechat-relay/`，包含 `dist/`、`Dockerfile`、`package.json`、`compose.yml`、`.env`：

```bash
# .env 内容：RELAY_API_KEY=<openssl rand -hex 32 生成>
cd /opt/wechat-relay
docker compose up -d --build
curl -s http://127.0.0.1/healthz
```

CI（`.github/workflows/deploy-relay.yml`）在 `relay/**` 变更推送到 master 时自动执行相同部署。
需要在 GitHub 仓库 Settings → Secrets and variables → Actions 配置三个 Secret：
`ORACLE_HOST`（服务器 IP）、`ORACLE_SSH_USER`（opc）、`ORACLE_SSH_KEY`（部署专用私钥全文）。
