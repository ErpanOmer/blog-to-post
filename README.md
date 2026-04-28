# Blog to Post

AI-assisted multi-platform article publishing system.

Write a technical article once, then generate metadata, normalize images, create platform drafts, publish, and inspect every publish step from one workspace.

Current status: active development, updated on 2026-04-27.

## What It Does

- Generate article titles, markdown content, summaries, tags, and cover prompts through an Ollama-compatible AI provider.
- Edit articles with a React + ByteMD workflow.
- Manage platform accounts and verify credentials.
- Dispatch one article to one or more publishing platforms.
- Create drafts or perform full publish flows depending on platform capability.
- Track publish tasks, step inputs/outputs, adapter traces, errors, timings, and final publication records.
- Normalize remote images by downloading them, detecting actual MIME type, uploading them to the target platform image host, and replacing URLs in the article body.
- Apply platform-specific HTML/code formatting, including WeChat inline code styling and CSDN Prism token output.

## Tech Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, ByteMD, Radix UI, shadcn-style components.
- Worker API: Cloudflare Workers, Hono, TypeScript.
- Data: Cloudflare D1 SQLite.
- Storage: Cloudflare R2 for drafts and Cloudflare KV for prompt/settings data.
- AI: Ollama-compatible `/api/generate` provider, defaulting to `kimi-k2.5:cloud` when no model is configured.
- Syntax highlighting: `highlight.js` for WeChat inline styled HTML and `prismjs` for CSDN tokenized code blocks.

## Repository Map

```txt
src/
  react-app/
    api.ts                    # frontend API client
    components/               # article editor, publish UI, status timelines
  shared/
    types.ts                  # shared frontend/worker types
  worker/
    accounts/                 # platform adapters
    ai/                       # AI provider implementation
    db/                       # D1 data access
    prompts/                  # raw prompt templates
    routes/                   # Hono route modules
    services/                 # publish orchestration, prompt settings, storage
    utils/                    # media, crypto, parsing, logging, highlighting helpers
    schema.sql                # base D1 schema
migrations/                   # D1 migrations
http-docs/                    # API notes
.agents/skills/               # shared AI agent skills
.codex/skills/                # Codex desktop skills
.agent/skills/                # legacy/alternate agent skills
```

## Platform Adapters

| Platform | Adapter | Auth style | Draft | Publish | Notes |
| --- | --- | --- | --- | --- | --- |
| Zhihu | `src/worker/accounts/zhihu.ts` | cookie/session token | yes | yes | Includes image upload token flow and image URL replacement. |
| Juejin | `src/worker/accounts/juejin.ts` | cookie/session token | yes | yes | Baseline official web API flow. |
| WeChat Official Account | `src/worker/accounts/wechat.ts` | `appId` + `appSecret` | yes | yes | Requires official API access and IP whitelist. Uploads content images and `thumb_media_id`. |
| CSDN | `src/worker/accounts/csdn.ts` | cookie/session token | yes | yes | Sends both markdown and HTML content; Prism code tokens; title emoji cleanup. |
| CNBlogs | `src/worker/accounts/cnblogs.ts` | cookie/session token | yes | yes | Uses CNBlogs editor APIs and image replacement flow. |
| SegmentFault | `src/worker/accounts/segmentfault.ts` | cookie/session token | yes | yes | Handles draft/publish and platform image upload. |

Every adapter implements the common `AccountService` contract from `src/worker/accounts/types.ts`.

## Publishing Flow

Publishing is orchestrated by `src/worker/services/publish.ts`.

1. Create a publish task through `/api/publish/tasks` or `/api/publish/quick`.
2. Load article and account records from D1.
3. Resolve the target platform service from the account registry.
4. Validate account status.
5. Create a platform draft.
6. Publish the draft when `draftOnly` is false.
7. Verify the publish result when available.
8. Persist publication records and update account statistics.
9. Store adapter trace events as task steps for debugging.

Task data lives in:

- `publish_tasks`
- `publish_task_steps`
- `article_publications`
- `account_statistics`

## Content Pipeline

Article content is stored as markdown plus optional rendered HTML.

- Markdown comes from the editor or AI generation.
- HTML may be supplied by the editor or generated from markdown with `marked`.
- Images are collected from markdown and HTML.
- External image URLs are normalized and uploaded to platform-specific image hosts.
- Rewritten URLs are applied before publish.
- Platform-specific code-block formatting is applied inside the adapter where needed.

Important utilities:

- `src/worker/utils/media/image.ts`: MIME sniffing, Cloudinary format rewrite helpers.
- `src/worker/utils/media/upload.ts`: reusable image candidate upload flow.
- `src/worker/utils/html-code-highlight.ts`: Highlight.js and Prism HTML code block conversion.

## Platform-Specific Formatting

WeChat:

- Converts markdown/HTML into WeChat-compatible HTML.
- Applies inline styles because the official draft API expects HTML and strips most external CSS.
- Uses GitHub-dark-like code block styling with inline token styles.
- Supports header/footer placeholders:
  - `{{WECHAT_HEADER_SLOT}}`
  - `{{WECHAT_FOOTER_SLOT}}`
- Uses the cover image as the default header slot content.
- Uploads cover image as permanent thumb material and requires `thumb_media_id`.

CSDN:

- Sends both `content` HTML and `markdowncontent`.
- Converts `pre > code` blocks into Prism-compatible token spans.
- Preserves CSDN-friendly classes such as `prism`, `language-xxx`, and `has-numbering`.
- Avoids inline token colors where CSDN CSS is expected to control display.
- Cleans emoji from titles because CSDN titles may reject or mishandle system emoji.

## AI Generation

The worker exposes AI-related routes through `/api/ai` and article generation routes through `/api/articles`.

Primary capabilities:

- `/api/articles/generate-title`
- `/api/articles/generate-content`
- `/api/articles/generate-summary`
- `/api/articles/generate-tags`
- `/api/articles/generate-cover`
- `/api/ai/status`
- `/api/ai/models`
- `/api/ai/settings`
- `/api/ai/prompts`

Prompt files live in `src/worker/prompts/`. Runtime prompt and model settings are stored through the prompt/settings services, backed by Cloudflare KV.

Environment variables:

```txt
OLLAMA_BASE_URL   # defaults to http://localhost:11434
OLLAMA_MODEL      # optional fallback model
OLLAMA_API_KEY    # optional bearer token for hosted Ollama-compatible providers
ENCRYPTION_KEY    # optional credential encryption key
ENVIRONMENT       # development or production
```

## Quick Start

Install dependencies:

```bash
npm install
```

Initialize local D1 tables:

```bash
npm run db:init -- --local
```

Start development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Deploy:

```bash
npm run deploy
```

## Database Commands

```bash
npm run db:status -- --local
npm run db:migrate -- --local
npm run db:migrate -- --remote
npm run db:local -- --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
npm run db:remote -- --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected core tables:

- `articles`
- `tasks`
- `platform_accounts`
- `article_publications`
- `publish_tasks`
- `publish_task_steps`
- `account_statistics`

## API Overview

Accounts:

- `GET /api/accounts`
- `POST /api/accounts`
- `POST /api/accounts/:id/verify`

Articles:

- `GET /api/articles`
- `GET /api/articles/search`
- `GET /api/articles/:id`
- `POST /api/articles`
- `PUT /api/articles/:id`
- `DELETE /api/articles/:id`
- `POST /api/articles/:id/transition`
- `GET /api/articles/:id/publications`

Publishing:

- `POST /api/publish/tasks`
- `GET /api/publish/tasks`
- `GET /api/publish/tasks/:id`
- `GET /api/publish/tasks/:id/steps`
- `GET /api/publish/history`
- `POST /api/publish/tasks/:id/cancel`
- `POST /api/publish/quick`

AI:

- `GET /api/ai/status`
- `GET /api/ai/models`
- `GET /api/ai/settings`
- `PUT /api/ai/settings`
- `GET /api/ai/prompts`
- `PUT /api/ai/prompts/:key`

## AI Skills

This repository keeps project-specific AI collaboration instructions in skill folders.

Use these first:

- `.agents/skills/project-overview/SKILL.md`: project map, architecture, module boundaries.
- `.agents/skills/publishing-adapters/SKILL.md`: platform adapter rules, image upload, code formatting, publish traces.
- `.agents/skills/workflow-guide/SKILL.md`: local commands, D1, deploy, troubleshooting workflow.
- `.agents/skills/backend-api/SKILL.md`: Hono routes, service/db boundaries, Worker API conventions.
- `.agents/skills/d1-database/SKILL.md`: D1 schema and migration rules.
- `.agents/skills/frontend-style/SKILL.md`: React, Tailwind, component and UX conventions.

Mirrors are kept under `.codex/skills/` for Codex desktop sessions. When updating project rules, keep `.agents/skills/` and `.codex/skills/` aligned.

Existing general-purpose skills:

- `hono-cloudflare`
- `hono-routing`
- `shadcn-ui`
- `tailwindcss`
- `vercel-react-best-practices`

## Troubleshooting

Missing D1 tables:

```bash
npm run db:init -- --local
```

Vite dependency cache issues after changing syntax-highlighting dependencies:

```powershell
Remove-Item -Recurse -Force node_modules/.vite
npm run dev
```

WeChat `errcode: 40164`:

- The current Worker/dev-machine outbound IP is not in the WeChat Official Account IP whitelist.
- Add the reported IP in the WeChat public platform backend, then retry.
- Without a valid whitelist, token, image upload, cover upload, draft creation, and publish will all fail.

WeChat `thumb_media_id` missing:

- The draft API requires a usable cover thumb material.
- Check adapter traces for `wechat_cover_image_upload_*` and `wechat_cover_fallback_*`.
- The code falls back to a built-in JPEG thumb when cover candidates fail, but the fallback still requires a valid WeChat API token.

Image extension does not match actual file type:

- Do not trust the URL suffix.
- The shared media utility downloads the image and detects MIME from response/blob bytes.
- Cloudinary links may be retried with rewritten formats such as PNG/JPEG.

CSDN code block display looks wrong:

- CSDN expects Prism-style token spans in many editor/rendering paths.
- Check `highlightHtmlPreCodeBlocksWithPrism()` and avoid forcing inline colors unless the platform requires it.

## Development Conventions

- Keep platform-specific publishing behavior inside `src/worker/accounts/*`.
- Put shared media or highlighting logic in `src/worker/utils/*`.
- Prefer adapter traces over silent fallback when a platform API is fragile.
- Treat platform credentials as sensitive; sanitize access tokens, cookies, keys, and secrets in logs.
- Add D1 schema changes through migrations and keep `src/worker/schema.sql` useful for fresh local bootstrap.
- Validate risky publishing changes in draft-only mode first.

## Current Focus

- Keep WeChat and CSDN adapters stable because they have the most platform-specific HTML/image constraints.
- Continue extracting shared utilities only when at least two adapters need the same behavior.
- Add regression coverage around image upload candidate selection and HTML code-block conversion.
- Improve platform diagnostics so task failures point to the exact upstream API failure.
