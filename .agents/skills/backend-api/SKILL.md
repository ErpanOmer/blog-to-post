---
name: backend-api
description: Blog-to-Post backend API guide for Hono routes, services, D1 access, Cloudflare bindings, and error handling.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [hono, cloudflare-workers, api, backend]
---

# Backend API

Use this skill when adding or changing Worker routes, services, request validation, or API response behavior.

## Runtime

- Entry point: `src/worker/index.ts`.
- Route modules: `src/worker/routes/*`.
- Service modules: `src/worker/services/*`.
- D1 access: `src/worker/db/*`.
- Bindings type: `Env` in `src/worker/types.ts`.

## Route Rules

- Keep handlers small.
- Use `new Hono<{ Bindings: Env }>()`.
- Mount route modules from `src/worker/index.ts`.
- Return JSON with `c.json`.
- Parse request body once.
- Validate required fields near the top of the handler.
- Delegate complex logic to services.

## Service Rules

- Put task orchestration in services, not routes.
- Throw typed service errors where an existing error class exists.
- Keep platform-specific behavior out of generic services; call adapter methods through `AccountService`.
- Preserve `requestId` and trace context in publish flows.

## Database Rules

- Keep SQL in `src/worker/db/*` or migrations.
- Use `.bind(...)` for every dynamic value.
- Prefer typed `.first<T>()` and `.all<T>()`.
- Add migration files for schema changes.
- Keep `src/worker/schema.sql` useful for fresh local bootstrap.

## Cloudflare Worker Rules

- Avoid Node-only APIs in Worker code.
- Use Web APIs such as `fetch`, `crypto.subtle`, `Blob`, `FormData`, and `URL`.
- Sanitize secrets before logging URLs or payloads.

