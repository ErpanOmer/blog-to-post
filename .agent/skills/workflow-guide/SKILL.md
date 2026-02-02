---
name: workflow-guide
description: 常用开发命令清单与工作流指南（启动、构建、部署）。
skill_version: 1.0.0
updated_at: 2026-02-02T00:00:00Z
tags: [workflow, scripts, npm, deployment, debugging]
---

# 开发工作流与命令指南

本指南汇集了项目开发中常用的 NPM 脚本与工作流。

## 1. 日常开发

| 命令 | 说明 | 适用场景 |
| :--- | :--- | :--- |
| **`npm run dev`** | **启动开发服务器** | 默认开发命令。同时启动 Vite 前端 (5173) 和 Wrangler 后端代理。 |
| `npm run type-check` | 执行 TypeScript 类型检查 | 提交代码前必跑。确保无红线报错。 |
| `npm run build` | 构建生产版本 | 包含前端构建 (`vite build`) 和后端构建。 |

## 2. 数据库操作 (D1)

*详见 `d1-database` Skill*

| 命令 | 说明 | 备注 |
| :--- | :--- | :--- |
| `npm run db:local` | 启动本地 D1 Shell | 交互式 SQL 查询 |
| `npm run db:status` | 查看迁移状态 | 检查是否有未应用的 Migration |
| `npm run db:migrate` | 应用迁移 | 也就是 `wrangler d1 migrations apply` |
| `npm run db:sync` | 同步迁移文件 | 辅助脚本 |

## 3. 部署 (Deployment)

本项目通过 GitHub Actions 自动部署，或者手动部署到 Cloudflare Pages / Workers。

| 命令 | 说明 |
| :--- | :--- |
| `npm run deploy` | 部署到生产环境 (Cloudflare) |

**部署前检查清单**:
1. 运行 `npm run type-check` 确保无错。
2. 运行 `npm run build` 确保构建成功。
3. 检查 `d1-database` 迁移是否已在生产环境应用 (`npm run db:status -- --remote`)。

## 4. 调试技巧 (Debugging)

- **前端调试**: 使用 Chrome DevTools。API 请求在 Network Tab 查看。
- **后端调试**:
  - 本地: `npm run dev` 输出日志。
  - 生产: 使用 `wrangler tail` 查看实时日志。
- **404 错误**: 检查 `src/worker/index.ts` 中的路由挂载，以及 `src/react-app/api.ts` 的路径是否匹配。
- **500 错误**: 检查后端控制台日志，通常是数据库查询错误或 JSON 解析错误。

---
**由 Antigravity 整理，助你流畅开发。**
