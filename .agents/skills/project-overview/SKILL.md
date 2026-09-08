---
name: project-overview
description: Blog-to-Post project map for architecture, module boundaries, platform adapters, AI generation, and Cloudflare runtime context.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [project-overview, architecture, cloudflare-workers, react, publishing]
---

# Blog-to-Post Project Overview

Use this skill before broad codebase work, onboarding, architecture changes, or any task that touches multiple modules.

## Product Shape

Blog-to-Post is an AI-assisted publishing dashboard. It helps generate, edit, and distribute technical articles to multiple platforms.

Core capabilities:

- AI title/content/summary/tag/cover generation.
- Article editing with markdown and optional rendered HTML.
- Platform account management and verification.
- Draft-only or full publish task orchestration.
- Step-by-step publish traces in D1.
- Platform-specific image upload and URL replacement.
- Platform-specific code block formatting for WeChat and CSDN.

## Runtime

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, ByteMD.
- Worker API: Hono on Cloudflare Workers.
- Database: Cloudflare D1 SQLite.
- Storage: Cloudflare KV for prompts/settings and R2 for drafts.
- AI provider: Ollama-compatible `/api/generate`.

## Directory Map

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

## Module Boundaries

- Frontend code calls APIs through `src/react-app/api.ts`.
- Hono routes stay thin and delegate to `src/worker/services` or `src/worker/db`.
- SQL belongs in `src/worker/db` or migrations, not deeply inside UI or adapter code.
- Platform-specific publishing behavior belongs in `src/worker/accounts/*`.
- Shared image/media/highlighting helpers belong in `src/worker/utils`.
- Shared cross-runtime types belong in `src/shared/types.ts`.

## Platform Adapters

Registered adapters:

- `juejin`
- `zhihu`
- `wechat`
- `wechat_v2` (inherits `wechat`; routes api.weixin.qq.com calls through the self-hosted relay on Oracle so WeChat sees a fixed egress IP)
- `csdn`
- `cnblogs`
- `segmentfault`
- `51cto`
- `website`

Each adapter implements `AccountService` from `src/worker/accounts/types.ts`.

## Deployment Topology

- Cloudflare Worker (`blog-to-post`) serves the dashboard/API and a `*/30 * * * *` cron that probes the relay's `/healthz`.
- WeChat traffic for `wechat_v2` flows through a stateless relay container (`relay/`, zero-dependency Node 22) on an Oracle Always Free server, publicly reached via `https://wechat-static-ip.nurverse.com` (Cloudflare Full strict + Origin CA). Auth is a shared `x-relay-token` header; only `/cgi-bin/*` of `api.weixin.qq.com` is forwarded.
- `platform_accounts.isActive` is the user-controlled enable/disable flag; disabled accounts are rejected by the publish pipeline and hidden from the publish dialog.

## AI Agent Guidance

Before changing behavior:

- Read the target route/service/adapter first.
- Preserve platform-specific behavior inside the adapter unless a utility is already shared by multiple adapters.
- Prefer draft-only validation for publishing changes.
- Keep adapter traces informative; silent fallback makes production debugging painful.
- Do not expose cookies, access tokens, app secrets, or upload signatures in logs.

