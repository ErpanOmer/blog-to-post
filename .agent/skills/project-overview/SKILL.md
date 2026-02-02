---
name: project-overview
description: Blog-to-Post 项目全貌指南：架构、技术栈与目录结构导航。
skill_version: 1.0.0
updated_at: 2026-02-02T00:00:00Z
tags: [project-structure, architecture, tech-stack, monorepo-lite]
---

# Blog-to-Post 项目全貌指南

本指南帮助 AI 快速建立对 Blog-to-Post 项目的整体认知。

## 1. 核心架构 (Architecture)

本项目采用 **Client-Worker** 架构，前端为 SPA，后端为 Cloudflare Worker，二者共存于同一代码库 (Monorepo-lite 模式)。

- **前端 (Frontend)**: React 18 + Vite + TailwindCSS + Shadcn UI。运行在浏览器中，通过 REST API 与后端通信。
- **后端 (Backend)**: Hono.js + Cloudflare Workers。运行在 Cloudflare 边缘网络，处理业务逻辑、数据库 (D1) 和 AI 服务交互。
- **数据库 (Database)**: Cloudflare D1 (SQLite)。
- **共享层 (Shared)**: TypeScript 类型定义在前后端之间共享。

## 2. 目录结构导航 (Directory Map)

AI 在寻找文件时，请遵循以下地图：

| 路径 | 说明 | 关键文件 |
| :--- | :--- | :--- |
| **`src/react-app/`** | **前端源码** | `App.tsx` (入口), `api.ts` (API 封装), `components/` (UI 组件) |
| **`src/worker/`** | **后端源码** | `index.ts` (入口/路由挂载), `routes/` (路由模块), `db/` (数据库操作), `ai/` (AI 逻辑) |
| **`src/shared/`** | **共享代码** | `types.ts` (前后端通用类型) |
| **`migrations/`** | **数据库迁移** | `000X_name.sql` |
| **`.agent/skills/`** | **AI 技能库** | 本开发指南存放处 |

## 3. 关键技术栈 (Tech Stack)

AI 在生成代码时，应严格遵守以下技术选型：

- **语言**: TypeScript (严格模式)。
- **Web 框架**: React (使用 Hooks, 不使用 Class Component)。
- **后端框架**: Hono (轻量级，Web Standards 兼容)。
- **样式**: Tailwind CSS (Utility-first)。
- **UI 组件**: Shadcn UI (基于 Radix UI, 代码拷贝式组件)。
- **图标**: Lucide React。
- **构建工具**: Vite。
- **包管理**: npm。

## 4. 开发环境规范

- **启动命令**: `npm run dev` (同时启动 Vite 前端和 Wrangler 后端代理)。
- **环境隔离**:
  - `src/react-app` 下的代码**严禁**引用 Node.js 特定模块 (如 `fs`, `path`)。
  - `src/worker` 下的代码只能通过 `import { ... } from "cloudflare-env"` (或类似绑定) 访问 D1/KV/R2，不能直接连接传统数据库。

## 5. AI 行为准则

1. **类型优先**: 修改接口时，**必须**同步更新 `src/shared/types.ts`。
2. **模块边界**: 前端不要直接写 SQL，后端不要写 React 组件。
3. **路由规范**: 后端路由请在 `src/worker/routes/` 下创建模块，并在 `index.ts` 中挂载。

---
**由 Antigravity 整理，作为项目开发的“地图”。**
