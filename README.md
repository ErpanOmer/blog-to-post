# AI Multi-Platform Tech Article Distribution System

This project helps you write once and distribute technical articles to multiple platforms such as Zhihu, Juejin, Xiaohongshu, WeChat Official Account, and CSDN.

Current stack:
- Frontend: React 19 + Vite + TypeScript + ByteMD
- Backend: Cloudflare Workers + Hono
- Database: Cloudflare D1 (SQLite)
- Storage: Cloudflare R2 + KV

---

## 1. Product Goal

Build a reliable publishing pipeline with:
- Unified article editor and content generation
- Unified account management and credential verification
- Unified publish task orchestration and status tracking
- Unified image pipeline (download external image -> upload platform image host -> replace URL)

---

## 2. Current Status (2026-04-15)

Implemented:
- Zhihu account add / verify flow
- Zhihu draft + publish basic workflow
- ByteMD editor image upload to fixed image hosting endpoint
- Prompt template management UI
- Publish task and step tracking model in D1
- End-to-end publish observability timeline (task progress + step input/output + adapter traces)

P0 baseline still in progress:
- Complete platform-specific image adapters for all targets
- End-to-end retry and resilience strategy for publish failures

---

## 3. Repository Structure

```txt
src/
  react-app/
    components/
    services/
    api.ts
  worker/
    accounts/           # platform adapters, e.g. zhihu.ts
    db/                 # D1 data access layer
    routes/             # Hono API routes
    services/           # publish orchestration and helpers
    schema.sql          # D1 schema bootstrap SQL
migrations/             # D1 migrations
http-docs/              # API docs and request samples
```

---

## 4. Prerequisites

- Node.js 18+
- npm
- Cloudflare account
- Wrangler CLI (installed via project dependencies)

---

## 5. Quick Start

### 5.1 Install

```bash
npm install
```

### 5.2 Initialize D1 schema

Run this first to avoid missing table errors.

Local D1:

```bash
npm run db:init -- --local
```

Remote D1:

```bash
npm run db:init -- --remote
```

Optional migration commands:

```bash
npm run db:status -- --local
npm run db:migrate -- --local
npm run db:migrate -- --remote
```

### 5.3 Run dev server

```bash
npm run dev
```

### 5.4 Build

```bash
npm run build
```

---

## 6. P0 Error Fix Note: `no such table`

If you see errors like:
- `D1_ERROR: no such table: articles`
- `D1_ERROR: no such table: account_statistics`

It means schema was not initialized in the current target database.

Fix:

```bash
npm run db:init -- --local
```

If you are calling deployed APIs against remote D1, also run:

```bash
npm run db:init -- --remote
```

Verify tables:

```bash
npm run db:local -- --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected core tables include:
- `articles`
- `platform_accounts`
- `article_publications`
- `publish_tasks`
- `publish_task_steps`
- `account_statistics`

---

## 7. Core APIs

Accounts:
- `GET /api/accounts`
- `POST /api/accounts`
- `POST /api/accounts/:id/verify`

Articles:
- `GET /api/articles`
- `POST /api/articles`
- `PUT /api/articles/:id`
- `POST /api/articles/:id/transition`

Publishing:
- `POST /api/publish/tasks`
- `GET /api/publish/tasks`
- `GET /api/publish/tasks/:id`
- `GET /api/publish/tasks/:id/steps`
- `POST /api/publish/quick`

---

## 8. Zhihu Image Handling Strategy (Baseline)

The Zhihu adapter should do image normalization before final publish:

1. Parse all images from article content
2. Skip URLs already hosted on Zhihu domains when applicable
3. Try Zhihu URL upload API first
4. If needed, fall back to binary upload flow with signed upload process
5. Replace original image URLs in rendered content with Zhihu-hosted URLs

Reference implementation used for design alignment:
- [Wechatsync Zhihu adapter](https://github.com/wechatsync/Wechatsync/blob/v2/packages/core/src/adapters/platforms/zhihu.ts)

Local implementation path:
- `src/worker/accounts/zhihu.ts`

---

## 9. ByteMD Image Upload (Simplified)

ByteMD editor uploads images directly to the fixed endpoint:
- `https://image-hosting.nurverse.com/api/upload`

### 9.1 Upload request format

- Method: `POST`
- Content-Type: `multipart/form-data`
- Required field:
  - `file` (binary)

### 9.2 Upload response expectation

The frontend accepts response payload in this shape:
- `success: true`
- `url` and/or `urls.*` (will pick the best available public URL)

### 9.3 Test checklist

1. Open article editor and insert image in ByteMD
2. Confirm uploaded image markdown URL is inserted
3. Confirm URL domain is `raw.githubusercontent.com` or configured CDN URL from response
4. Publish to Zhihu and verify image URL replacement works end-to-end

---

## 10. Useful Commands

```bash
npm run lint
npm run build
npm run db:status -- --local
npm run db:local
npm run db:remote
```

---

## 11. Next P0 Steps

1. Extract a shared `ImagePipeline` service for all platforms
2. Implement image adapter for Juejin / CSDN / Xiaohongshu / WeChat
3. Add publish retry policy and idempotent step execution
4. Add end-to-end publish regression tests for Zhihu first
5. Add platform-specific publish diagnostics to task step logs

---

## 12. Notes

- This repository may include local environment differences (proxy, token, account state).
- Prefer validating each platform adapter using a real account in draft mode first.
- Use the same test article with 2-3 remote images to validate image replacement consistency.
