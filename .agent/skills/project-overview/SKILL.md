---
name: project-overview
description: Blog-to-Post project map for architecture, module boundaries, platform adapters, AI generation, and Cloudflare runtime context.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [project-overview, architecture, cloudflare-workers, react, publishing]
---

# Blog-to-Post Project Overview

Use this skill before broad codebase work, onboarding, architecture changes, or any task that touches multiple modules.

Blog-to-Post is an AI-assisted publishing dashboard. It generates, edits, and distributes technical articles to multiple platforms.

Core runtime:

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, ByteMD.
- Worker API: Hono on Cloudflare Workers.
- Database: Cloudflare D1 SQLite.
- Storage: Cloudflare KV and R2.
- AI provider: Ollama-compatible `/api/generate`.

Important directories:

```txt
src/react-app/         Frontend SPA, UI components, API client.
src/shared/            Shared article/platform types.
src/worker/accounts/   Platform adapters.
src/worker/ai/         AI provider.
src/worker/db/         D1 query layer.
src/worker/prompts/    Raw prompt templates imported with ?raw.
src/worker/routes/     Hono API routes.
src/worker/services/   Publish orchestration, prompts, storage.
src/worker/utils/      Media, highlighting, crypto, logging, parsing.
migrations/            D1 migration files.
```

Module rules:

- Frontend code calls APIs through `src/react-app/api.ts`.
- Routes stay thin and delegate to services/db modules.
- Platform behavior belongs in `src/worker/accounts/*`.
- Shared media/highlighting helpers belong in `src/worker/utils`.
- Shared cross-runtime types belong in `src/shared/types.ts`.

Registered adapters:

- `juejin`
- `zhihu`
- `wechat`
- `csdn`
- `cnblogs`
- `segmentfault`

Each adapter implements `AccountService` from `src/worker/accounts/types.ts`.
