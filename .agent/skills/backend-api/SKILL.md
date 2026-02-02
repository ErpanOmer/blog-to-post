---
name: backend-api
description: 后端开发指南：Hono.js 框架、路由模块化、Worker 环境及数据库交互。
skill_version: 1.0.0
updated_at: 2026-02-02T00:00:00Z
tags: [hono, cloudflare-workers, backend, api, rest]
---

# 后端 API 开发指南 (Hono.js)

本指南指导 AI 如何构建结构清晰、类型安全的 Cloudflare Workers 后端。

## 1. 框架与环境

本项目使用 **Hono** 框架。

- **入口文件**: `src/worker/index.ts`。
- **环境绑定 (Bindings)**: 通过 `Env` 接口定义 (`src/worker/types.ts`)。
  - `c.env.DB`: D1 数据库。
  - `c.env.PROMPTS`: KV 存储。
  - `c.env.DRAFTS`: R2 存储（如有）。
  - `c.env.OLLAMA_BASE_URL`: 环境变量。

## 2. 路由模块化 (Routing)

为了避免 Monolithic 代码，所有新功能必须按模块拆分到 `src/worker/routes/` 目录下。

### 创建新路由模块标准
```typescript
// src/worker/routes/example.ts
import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ message: "List" }));
app.post("/", (c) => c.json({ message: "Create" }));

export default app;
```

### 挂载路由
在 `src/worker/index.ts` 中挂载：
```typescript
import exampleApp from "./routes/example";
app.route("/api/examples", exampleApp);
```

## 3. 请求与响应规范

- **RESTful**: 尽量遵循 REST 语义 (`GET` 获取, `POST` 创建, `PUT` 更新, `DELETE` 删除).
- **JSON 响应**: 使用 `c.json({ ... })`。
- **错误响应**:
  ```typescript
  return c.json({ message: "Error description", code: "ERROR_CODE" }, 400);
  ```
- **输入验证**: 在 Handler 开始处验证 `await c.req.json()` 或 `c.req.param()`。

## 4. 数据库交互

- **DB 操作位置**: 复杂的 SQL 操作应封装在 `src/worker/db/` 目录下的专用文件中 (如 `articles.ts`, `publications.ts`)。不要在 Router handler 里直接写长 SQL。
- **类型安全**: 使用泛型 `db.prepare(...).first<T>()` 或 `.all<T>()` 确保返回类型安全。

## 5. AI 能力集成

- 使用 `src/worker/ai/providers.ts` 中的 `AIProvider` 接口。
- 提示词 (Prompts) 应存储在 `src/worker/prompts/` 目录下的 `.txt` 文件中，并通过 `import ...?raw` 导入。

## 6. 注意事项

- **禁止 Node.js API**: Cloudflare Workers 不支持所有 Node.js API。避免使用 `fs`, `net` 等。
- **冷启动**: 尽量减少全局变量的初始化开销。

---
**由 Antigravity 设计，构建可扩展的 Serverless 后端。**
