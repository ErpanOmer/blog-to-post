---
name: backend-api
description: Blog-to-Post backend API guide for Hono routes, services, D1 access, Cloudflare bindings, and error handling.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [hono, cloudflare-workers, api, backend]
---

# Backend API

Use this skill when changing Worker routes, services, request validation, or API response behavior.

Runtime:

- Entry point: `src/worker/index.ts`.
- Route modules: `src/worker/routes/*`.
- Service modules: `src/worker/services/*`.
- D1 access: `src/worker/db/*`.
- Bindings type: `Env` in `src/worker/types.ts`.

Rules:

- Keep Hono handlers small.
- Use `new Hono<{ Bindings: Env }>()`.
- Return JSON with `c.json`.
- Parse request bodies once.
- Validate required fields near the top.
- Delegate orchestration to services.
- Keep SQL in `src/worker/db/*` or migrations.
- Avoid Node-only APIs in Worker code.
- Sanitize credentials and tokens before logging.
