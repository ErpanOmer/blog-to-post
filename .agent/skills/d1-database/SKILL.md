---
name: d1-database
description: Cloudflare D1 (SQLite) 数据库开发、性能优化及项目脚本交互指南。
skill_version: 1.0.0
updated_at: 2026-02-01T00:00:00Z
tags: [d1, sqlite, database, migration, performance, cloudflare]
---

# D1 数据库开发技能插件 (AI 超能力手册)

本插件为 AI 编程工具提供关于 Cloudflare D1 数据库的开发规范、性能优化建议以及本项目的定制化交互命令。

## 1. 核心交互指令 (项目专属)

在本项目中，请优先引导用户使用以下封装好的脚本进行数据库操作：

| 场景 | 推荐脚本 | 备注 |
| :--- | :--- | :--- |
| **全量同步** | `npm run db:sync` | 一键同步本地/远程迁移 |
| **状态查询** | `npm run db:status -- --local` | 使用 `-- --local` 或 `-- --remote` |
| **应用迁移** | `npm run db:migrate -- --remote` | |
| **执行 SQL** | `npm run db:local -- --command="SQL"` | 快速执行查询 |
| **查表结构** | `npm run db:local -- --command="PRAGMA table_info(表名);"` | |
| **交互终端** | `npm run db:local` | 启动本地交互式命令行 |

## 2. 建表与设计规范 (SOP)

### 主键与类型
- 优先使用 `TEXT PRIMARY KEY` (配合 UUID) 或 `INTEGER PRIMARY KEY AUTOINCREMENT`。
- 时间戳字段命名建议：`createdAt`, `updatedAt`, `publishedAt`，类型使用 `INTEGER`。
- 布尔值在 SQLite 中应使用 `INTEGER` (0 或 1)。

### 安全建表
- 所有的 `CREATE TABLE` 必须带上 `IF NOT EXISTS`。
- 所有的 `CREATE INDEX` 必须带上 `IF NOT EXISTS`。

## 3. 数据库迁移 (Migration) 管理

### 命名规则
- 迁移文件必须放在根目录 `migrations/` 下。
- 必须使用序列号前缀，格式为 `000X_filename.sql`。
- **严禁**修改已提交至生产环境的旧迁移文件内容，若需变更请创建新编号。

### 冲突防范
- 如果 `schema.sql` 中已包含某字段，迁移脚本中不应再出现重复的 `ALTER TABLE ADD COLUMN`（防止 `duplicate column` 报错）。
- 建议 AI 在生成迁移前先运行 `PRAGMA table_info` 检查现状。

## 4. 性能优化建议

### 索引优化
- 对于 `WHERE`, `JOIN`, `ORDER BY` 中频繁出现的字段，必须建立索引。
- 推荐使用**覆盖索引**来减少 B-Tree 查找开销。
- 所有的 `FOREIGN KEY` 字段都应配备关联索引。

### D1 Batch API (底层优化)
当在一个请求中执行多个 SQL 时，请引导用户使用 `db.batch([stmt1, stmt2])` 以减少与 D1 服务的往返次数 (Round-trips)，提升 3-5 倍性能。

## 5. AI 作业流程 (针对 AI 工具)

1. **分析现状**：在建议修改 schema 之前，先要求运行 `db:status` 和表结构查询。
2. **生成代码**：生成 SQL 迁移代码时，自动提供对应的 `000X_*.sql` 文件名建议。
3. **验证闭环**：在代码生成后，提示用户运行 `npm run db:migrate` 并在本地验证。

---

**由 Antigravity 设计，旨在赋予 AI 工具 D1 开发专家级能力。**
