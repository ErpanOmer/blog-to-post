# Docker 部署与数据迁移

## 当前服务器

- SSH：`erpan@urtopiaserver`
- 应用：<https://blog-to-post.nurverse.com/>（Cloudflare Tunnel + Access）
- 本机源站：<http://127.0.0.1:18473/>（仅服务器自身可访问）
- 容器：`blog-to-post-app-1`，自动重启，端口 `18473`
- 当前代码：`/srv/projects/blog-to-post/current`，指向 `releases/` 下的具体版本
- D1 / KV / R2：`/srv/data/blog-to-post/{d1,kv,r2}`
- 运行密钥：`/srv/projects/blog-to-post/shared/runtime.env`，权限 `600`
- 部署设置：`/srv/projects/blog-to-post/shared/deploy.env`
- 部署前备份：`/srv/backups/blog-to-post/`

默认使用 `BLOG_BIND_IP=127.0.0.1`、`BLOG_PORT=18473`，无需手动配置这两个变量。
`shared/deploy.env` 是可选的覆盖文件，示例见 `deploy/urtopiaserver.env.example`。
每次自动部署都会使用默认值，存在覆盖配置时才加载覆盖值。
宿主机上的 systemd `cloudflared` 通过回环地址访问应用，不依赖局域网 IP 或 Tailscale。

服务器数据是迁移后的唯一日常数据源。代码更新不再上传本地数据。
保留在本机 `.wrangler/state/v3` 的数据仅作为迁移时的副本，不会自动与服务器双向同步。
不要同时启动本地开发服务并继续编辑旧副本。

## 运行方式与兼容边界

Docker 使用固定版本 Miniflare `4.20251125.0` 管理 `workerd`，与当前 Vite Cloudflare 插件使用的运行时相同。
直接运行原有 Vite 生产构建出的 Worker 和前端，复用 Hono 路由、D1/KV/R2 接口、平台适配器与加密逻辑。
数据库 ID、KV namespace ID、R2 bucket name 和兼容日期从构建生成的 `wrangler.json` 读取。

这是单实例、自托管的本地存储运行方式：无需 Cloudflare Workers/D1/KV/R2 云服务可用，
但不提供 Cloudflare 托管服务的跨区域复制或自动容灾。Miniflare 原本用于开发测试，
这里由 Docker、持久化挂载、健康检查、备份及外部访问控制承担服务运维。
运行时版本升级前应先备份并在数据副本上验证存储兼容性。

容器以非 root 用户运行，只读根文件系统，数据卷与 `/tmp` 可写。
运行密钥只在启动时注入；`.env`、`.dev.vars`、本地数据和备份均排除在构建上下文之外。
`ENCRYPTION_KEY` 必须沿用原来的 64 位十六进制密钥，否则旧凭据无法解密。

服务器 `ENVIRONMENT=production`，独立站继续使用已配置的线上网站账号。
不迁移另一个项目的 `localhost:4321` 服务；生产环境仍禁止使用本地独立站数据源。
浏览器 localStorage 中的未保存草稿恢复副本、界面偏好不属于 D1/KV/R2，换域名不会自动复制。

每半小时按 UTC `:00` / `:30` 调用现有 `scheduled` handler，处理到期发布和 relay 健康检查。
不会自动补跑停机期间的每个 tick，下一个 tick 会处理已经到期的发布任务。
每日 AI 草稿生成 `0 2 * * *` 保持关闭；加入新的 cron 表达式会使启动失败，必须显式实现后再开启。
迁移和测试副本可用 `DISABLE_SCHEDULED=true` 禁止定时触发。

## 每次 commit 自动部署

本次已在当前 checkout 启用以下设置，新的 clone 需重新执行：

```sh
npm run deploy:install-hook
```

`.githooks/post-commit` 在每次成功 commit 后运行 `node deploy/deploy.mjs`。
只部署该 commit 包含的文件，未暂存、未提交文件不进入日常部署。首次提交时请将本次新增的
`Dockerfile`、`compose.yaml`、`.dockerignore`、`.githooks/`、`deploy/` 和 package 文件一起纳入版本控制。
当前首次服务器部署采用完整工作区快照，保留迁移开始前已有的未提交功能修改。

此机制在本机通过 SSH 执行，不依赖 GitHub Actions 或公网 SSH，也不要求 `git push`。
本机必须能连接 `erpan@urtopiaserver`，commit 命令会等待部署完成。
其他机器或 GitHub 网页上的提交不会触发这个 checkout 的 Git 钩子。
部署失败会显示错误，已经创建的 Git commit 仍然保留。

```sh
# 重试部署当前 commit
npm run deploy:server

# 显式部署当前工作区（包括未提交修改）
npm run deploy:server:working

# 临时关闭自动部署
git config blog-to-post.autoDeploy false

# 重新启用
git config blog-to-post.autoDeploy true
```

`npm run deploy` 现在也部署到此服务器；原 Cloudflare 发布命令保留为 `npm run deploy:cloudflare`。
部署测试：先 `npm run build`，再 `npm run test:server`。测试使用隔离的数据目录和 Git 仓库，
覆盖 D1/KV/R2 写入、进程重启、失败迁移回滚与真实 commit 钩子触发，不写入服务器业务数据。

服务器用文件锁串行部署，先构建镜像，构建成功后才停止旧容器并备份数据。
新容器启动前自动执行未应用的 SQL migration，健康检查通过后切换 `current`。
更新会有短暂中断；正在执行的发布任务最多等待约 5 分钟后停止。
启动或健康检查失败时恢复部署前数据并启动旧镜像，失败数据目录另行保留。
备份和旧镜像不会自动清理，定期检查磁盘并按自己的保留策略归档。

## 常用运维

```sh
ssh erpan@urtopiaserver
docker ps --filter name=blog-to-post
docker logs --tail 100 blog-to-post-app-1
docker restart blog-to-post-app-1
curl -fsS http://127.0.0.1:18473/__health
```

健康检查执行实际 D1 查询，返回当前部署版本。公开应用接口仍为 `/api/*`；
Miniflare 的内部控制和调试端点不会通过应用监听端口公开。

在服务器手动调用 Compose 时应加载共享配置，避免误用默认路径：

```sh
cd /srv/projects/blog-to-post/current
set -a
if [ -f /srv/projects/blog-to-post/shared/deploy.env ]; then
  . /srv/projects/blog-to-post/shared/deploy.env
fi
set +a
export BLOG_BIND_IP="${BLOG_BIND_IP:-127.0.0.1}"
export BLOG_PORT="${BLOG_PORT:-18473}"
export BLOG_ENV_FILE=/srv/projects/blog-to-post/shared/runtime.env
export BLOG_DATA_DIR=/srv/data/blog-to-post
export BLOG_IMAGE=$(cat /srv/projects/blog-to-post/shared/current-image)
export DEPLOY_REVISION=$(cat /srv/projects/blog-to-post/shared/current-revision)
docker compose up -d --no-build --wait
```

## 数据迁移与核验

迁移前暂停该项目的本地写入进程，再运行：

```sh
node deploy/snapshot.mjs .wrangler/state/v3 deployment-artifacts/migration-state
node --env-file=.env deploy/runtime/data-report.mjs deployment-artifacts/migration-state
```

快照使用 SQLite 在线 backup API，包含 WAL 中已提交的数据；KV/R2 同时复制对应 blob 文件。
跨存储一致性仍要求快照期间暂停写入。
`data-report.mjs` 输出每张表的条数、内容摘要、所有 blob 的 SHA-256，以及凭据解密成功数，
不输出密钥或凭据明文。容器内核验：

```sh
docker exec blog-to-post-app-1 node deploy/runtime/data-report.mjs
```

2026-09-08 本地迁移基线：58 篇文章、9 个账号、450 条发布记录、7 个发布任务、
1,631 条步骤、72 条通用任务、9 条账号统计、1 个 AI profile、1 条模型路由、
369 个 KV 条目、74 个 R2 对象，共 443 个 blob 文件；4 条加密凭据全部成功解密。
服务器首次启动和替换容器后，13 张业务/存储表及 443 个文件摘要均与快照完全相同。

额外检查了 Cloudflare 远端 D1：0 篇文章，1 个较旧的网站账号（与本地账号用户名、用户 ID、
凭据相同，仅记录 ID 不同），没有额外发布数据。未将旧账号重复导入，完整 SQL 备份保存在
`/srv/backups/blog-to-post/cloud-d1-20260908.sql`；云端数据未修改。

新安装的空数据目录会初始化 `schema.sql`（基线截至 `0012`）并记录基线 migration。
现有数据只执行尚未记录的迁移，不使用 schema 初始化来掩盖结构漂移。

## 接入 Cloudflare Tunnel

应用默认仅绑定本机回环地址，宿主机现有 systemd `cloudflared` 使用以下源站路由：

```yaml
ingress:
  - hostname: blog-to-post.nurverse.com
    service: http://127.0.0.1:18473
  # 保留已有规则及最后的兜底规则
  - service: http_status:404
```

对于远程管理的 Tunnel，在控制台添加 Published application route，Service URL 填
`http://127.0.0.1:18473`，类型选择 HTTP。公网浏览器仍通过 HTTPS 访问。
此配置要求 `cloudflared` 直接运行在宿主机网络中。
如果将来把 Tunnel 改为独立网络的 Docker 容器，应将两者接入同一 Docker 网络，
通过应用服务名连接，而不能使用 Tunnel 容器自身的 `127.0.0.1`。

本应用管理接口没有统一登录入口；发布公网域名时需要给整个应用配置 Cloudflare Access
或等效认证，避免文章与平台凭据向未授权访客开放。HTTPS 也会启用浏览器剪贴板等安全上下文功能。
Tunnel 仅承担入口，应用计算、D1/KV/R2 数据均留在服务器。

官方参考：
- <https://github.com/cloudflare/workerd>
- <https://developers.cloudflare.com/workers/testing/miniflare/core/scheduled/>
- <https://developers.cloudflare.com/workers/local-development/local-data/>
