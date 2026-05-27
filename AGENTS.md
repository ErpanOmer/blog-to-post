# AGENTS.md

Guidance for AI coding agents working in this repository.

This project is an active Blog-to-Post publishing dashboard. It combines a React/Vite frontend with a Cloudflare Worker API, Cloudflare D1/KV/R2 storage, AI-assisted article generation, and platform-specific publishing adapters.

## Quick Orientation

- Product: write/edit one technical article, generate metadata, then distribute it to multiple publishing platforms.
- Frontend: React 19, Vite, TypeScript, Tailwind CSS, ByteMD, Radix/shadcn-style local components.
- Backend: Hono routes running on Cloudflare Workers.
- Data: Cloudflare D1 SQLite, KV for settings/prompts, R2 for article draft/published content.
- Publishing: task orchestration in `src/worker/services/publish.ts`; platform behavior in `src/worker/accounts/*`.
- Shared contracts: `src/shared/*` and `src/worker/types/*`.

## Important Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run deploy
```

D1 helpers:

```bash
npm run db:init -- --local
npm run db:status -- --local
npm run db:migrate -- --local
npm run db:migrate -- --remote
npm run db:local -- --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Publish-task debugging:

```bash
npm run db:local -- --command="SELECT * FROM publish_tasks WHERE id='TASK_ID'"
npm run db:local -- --command="SELECT * FROM publish_task_steps WHERE taskId='TASK_ID' ORDER BY stepNumber"
```

Notes:

- `npm run build` runs TypeScript build and Vite production build.
- `npm run lint` may report existing Fast Refresh warnings in component/helper mixed-export files; do not treat those warnings as a blocker unless you introduced new ones.
- For docs-only edits, a full build is usually unnecessary.

## Repository Map

```txt
src/
  components/ui/              shared Radix/shadcn-style primitives
  lib/                        frontend helpers such as cn()
  react-app/
    api.ts                    frontend API client; keep fetch wrappers here
    components/               dashboard, editor, account, publish, status UI
    features/                 feature-specific UI modules
    hooks/                    app state and article hooks
    layout/                   top-level app layout
    pages/                    route page components
    services/                 browser/local services
    types/                    frontend publication types
    utils/                    frontend-only utilities
    views/                    major app route views
  shared/
    types.ts                  shared frontend/worker platform and article types
    platform-settings.ts      publishable platform settings and display names
    markdown-normalize.ts     markdown/html image normalization helpers
  worker/
    accounts/                 platform adapters
    ai/                       AI provider implementation
    db/                       D1 query layer
    platform/                 platform adapter metadata
    prompts/                  prompt templates imported as raw text
    routes/                   Hono route modules
    services/                 orchestration and domain services
    types/                    Worker-side type contracts
    utils/                    crypto, logging, media, highlighting, parsing
    index.ts                  Worker entry and route mounting
    schema.sql                fresh local D1 bootstrap schema
migrations/                   incremental D1 migrations
http-docs/                    API notes
```

Project-specific agent skills are mirrored under `.agents/skills/` and `.codex/skills/`. For broad work, read the relevant skill first:

- `project-overview`
- `publishing-adapters`
- `backend-api`
- `frontend-style`
- `d1-database`
- `workflow-guide`

## Architecture Rules

Keep module boundaries clean:

- Frontend API calls belong in `src/react-app/api.ts`.
- Hono route handlers belong in `src/worker/routes/*` and should stay thin.
- Business orchestration belongs in `src/worker/services/*`.
- SQL belongs in `src/worker/db/*`, `src/worker/schema.sql`, or `migrations/*`.
- Platform-specific publish logic belongs in `src/worker/accounts/*`.
- Cross-runtime types belong in `src/shared/*`.
- Worker-only code must not be imported into frontend modules.
- Browser/localStorage-only code must not be imported into Worker modules.

When changing article or publish data shape, update all layers together:

- shared/worker/frontend types
- D1 schema and migrations
- DB query layer
- Worker routes/services
- frontend API client
- UI state and components

## Worker API Conventions

Entry point: `src/worker/index.ts`.

Route modules use:

```ts
const app = new Hono<{ Bindings: Env }>();
```

Route guidance:

- Parse request bodies once.
- Validate required fields near the top.
- Return JSON with `c.json`.
- Delegate complex logic to services.
- Use typed service errors where available, especially publish errors from `src/worker/services/publish-errors.ts`.
- Preserve `requestId` and logging context in publish flows.

Cloudflare Worker constraints:

- Avoid Node-only APIs in Worker code.
- Prefer Web APIs: `fetch`, `Blob`, `FormData`, `URL`, `crypto.subtle`, `AbortController`.
- Sanitize secrets before logging URLs, headers, cookies, request bodies, upload signatures, or access tokens.

## Database Rules

- Use D1 bindings through `Env.DB`.
- Use `.bind(...)` for every dynamic SQL value.
- Prefer typed `.first<T>()` and `.all<T>()`.
- Add migration files for schema changes.
- Keep `src/worker/schema.sql` useful for fresh local bootstrap.
- Do not hide schema drift in runtime code unless it is an intentional compatibility shim.

Important tables:

- `articles`
- `platform_accounts`
- `publish_tasks`
- `publish_task_steps`
- `article_publications`
- `account_statistics`
- website/D1 blog tables managed through website services/routes

## Publishing Flow

The publishing flow is centered in `src/worker/services/publish.ts`.

Typical flow:

1. Create a publish task with `/api/publish/tasks` or `/api/publish/quick`.
2. Load article and account records from D1.
3. Validate account status and auth token.
4. Resolve the platform service through the account registry.
5. Create a platform draft with `articleDraft`.
6. Publish with `articlePublish` when `draftOnly` is false.
7. Verify and persist results.
8. Update account statistics.
9. Store detailed task steps and adapter traces.

Operational details:

- Adapter draft/publish calls are guarded by timeout logic. Do not remove this protection.
- Processing tasks that do not advance for too long are marked failed by stale-task checks. Keep task `updatedAt`, `progressData`, and step updates meaningful.
- Publish diagnostics must be visible in `publish_task_steps`, not only console logs.
- Use draft-only testing first for risky adapter changes.

## Platform Adapter Rules

All platform adapters implement `AccountService` from `src/worker/accounts/types.ts`.

Required methods:

- `verify`
- `status`
- `info`
- `articleDraft`
- `articlePublish`
- `articleDelete`
- `articleList`
- `articleDetail`
- `articleTags`
- `imageUpload`

Current publishable platforms include:

- `juejin`
- `zhihu`
- `wechat`
- `csdn`
- `cnblogs`
- `segmentfault`
- `51cto`
- `website`

Adapter registration:

- Register new adapters in `src/worker/accounts/index.ts` or the registry import path already used by existing adapters.
- Add the platform to shared platform lists and display-name maps when introducing a new platform.
- Update UI platform branding if the platform should appear in filters, account screens, or publish dialogs.

Adapter implementation rules:

- Extend `AbstractAccountService` when possible.
- Use `this.request(...)` or `this.fetchPlatform(...)` for platform API calls so delay, tracing, timeout, and sanitized logging behavior stays consistent.
- Do not call platform APIs repeatedly without delay; existing platform request delay intentionally mimics human pacing and reduces rate-limit/account risk.
- Use `tracePublish(...)` for image scans, upload start/done/failure, request failures, fallbacks, and final draft/publish output.
- Never trace or log raw cookies, bearer tokens, app secrets, upload signatures, or access tokens.

Image handling:

- Do not trust file extensions in URLs.
- Use shared media helpers for MIME detection and upload candidates.
- Collect images from both markdown syntax and raw HTML `<img>` tags.
- If markdown contains raw HTML image blocks, normalize them to markdown when the target platform does not support HTML in markdown.
- Make sure the number of scanned content images matches the number of rewritten content images unless a trace explains a deliberate skip.

Platform notes:

- WeChat requires official API access, IP whitelist, cover `thumb_media_id`, and content image upload through WeChat APIs.
- CSDN sends both markdown and rendered HTML and uses Prism-like code block output.
- 51CTO supports a full draft-to-publish flow; keep publish URL shape aligned with the platform's final article URL.
- Website adapter publishes to the app's D1-backed website/blog flow rather than an external platform.

## Frontend Rules

Frontend code lives under `src/react-app` plus shared primitives in `src/components/ui`.

`DESIGN.md` is the mandatory UI benchmark for this repository. Every code agent must read and follow both `AGENTS.md` and `DESIGN.md` before changing frontend UI. When these two files mention UI, treat them as hard constraints unless the user explicitly asks for a different visual direction.

Design-system requirements:

- Use `DESIGN.md` colors as the source of truth: primary `#6366F1`, primary hover `#4F46E5`, neutral text `#6B6B6B`/`#9C9C9C`, page background `#FAFAFA`, surface `#FFFFFF`, border `#E8E8EC`, success `#10B981`, warning `#F59E0B`, error `#EF4444`.
- Use indigo only for interactive elements: primary buttons, active states, links, focus rings, and selected controls. Do not use indigo as static decoration.
- Keep the interface editorial, precise, calm, and high-density with breathing room. It should feel like a serious publishing workspace, not a marketing page.
- Do not add decorative gradients, decorative illustrations, bokeh/orb backgrounds, or gratuitous shadows.
- Cards are flat white surfaces with a subtle `1px` border. Use shadow primarily for hover/focus elevation and popovers/dialogs.
- Buttons and inputs use `6px` radius; operational panels and metadata cards use `8px`; feature cards/dialog surfaces may use `12px`.
- Follow the 4px spacing grid. Avoid arbitrary one-off spacing values unless needed to solve a concrete fit issue.
- Keep text readable and contained. Do not allow card titles, tags, URLs, or button labels to overflow their parent.
- Do not place more than one filled indigo primary button in the same view section.
- Preserve all existing functionality. UI refactors must not add, remove, or alter product behavior unless the user explicitly asks.

Rules:

- Use existing UI primitives before adding a new component abstraction.
- Use `lucide-react` icons for buttons and controls.
- Keep operational screens dense, calm, and scannable.
- Prefer real controls and useful state over decorative cards.
- Show visible loading, empty, and error states for async operations.
- Avoid layouts that depend on a single desktop width; verify mobile when changing major views.
- Keep text inside buttons/cards from overflowing. Use wrapping, truncation, or layout changes deliberately.

Routing:

- Main route composition is in `src/react-app/App.tsx`.
- Shared app state and article operations live in `src/react-app/hooks/useAppController.ts`.
- Article list/detail/editor route views live in `src/react-app/views` and `src/react-app/pages`.

Article editor:

- ByteMD editing is in `ArticleEditor`.
- Content may be markdown plus optional rendered HTML.
- Keep markdown image normalization behavior in `src/shared/markdown-normalize.ts` when it must be shared between frontend and Worker.
- Upload validation should be visible to users, not only console output.
- Autosave/local recovery logic belongs in frontend utilities/hooks, not Worker code.

## AI, Prompts, and Settings

AI routes live under `/api/ai` and article generation routes under `/api/articles`.

Prompt templates live in `src/worker/prompts/` and are served/overridden through prompt services backed by KV.

Environment variables commonly used:

```txt
OLLAMA_BASE_URL
OLLAMA_MODEL
OLLAMA_API_KEY
ENCRYPTION_KEY
ENVIRONMENT
```

Rules:

- Keep provider settings and prompt settings in their existing services.
- Do not hard-code model names in UI unless there is already a fallback path.
- Prompt changes can affect generated output substantially; keep them scoped and explain them.

## Website/D1 Blog Flow

Website routes and services are separate from external platform adapters:

- `src/worker/routes/website.ts`
- `src/worker/accounts/website.ts`
- `src/worker/services/website-slug.ts`
- `src/worker/services/website-slug-settings.ts`
- frontend views under `src/react-app/views/Website*.tsx`

When changing website slug or publish behavior, update both direct website routes and the `website` platform adapter path if both are affected.

## Code Style and Editing

- TypeScript first; keep types explicit at API/service boundaries.
- Prefer existing patterns over new abstractions.
- Keep edits scoped; do not refactor unrelated modules during a feature fix.
- Use comments sparingly, only where code is not self-explanatory.
- Preserve user changes in a dirty worktree. Do not reset or revert unrelated files.
- Be careful with encoding. Some files have existing non-ASCII UI strings; preserve UTF-8 and avoid accidental mojibake.
- Use `rg`/`rg --files` for search.

## Testing and Verification

Use the lightest verification that proves the change:

- Docs-only: inspect the markdown; no build required unless commands or architecture claims may be stale.
- Frontend UI: run `npm run build` when feasible, and use browser screenshots for layout-sensitive changes.
- Worker/API: run `npm run build`; run `npm run lint` when changing TypeScript broadly.
- D1/schema: test local migration/init commands when schema changes.
- Adapter changes: prefer draft-only publish first, then full publish only when credentials and a safe test article are available.

Useful local URLs:

- Vite dev server: `http://localhost:5173/`
- Health check: `http://localhost:5173/api/health`

## Safety and Secrets

Never expose or commit:

- cookies
- access tokens
- bearer tokens
- app secrets
- upload signatures
- account auth payloads
- `.env` values

When adding logs/traces:

- Redact secrets in URLs and payloads.
- Keep adapter traces high-signal and compact.
- Prefer structured metadata over long raw response dumps.

## Common Pitfalls

- Adding a platform only in the adapter but forgetting `src/shared/platform-settings.ts`, `PlatformBrand`, allowed route platform lists, or publish dialog UI.
- Updating article data shape without updating frontend API types and D1 persistence.
- Uploading images based only on URL suffix instead of actual MIME.
- Publishing WeChat content without ensuring cover image material exists.
- Losing platform image replacements when content contains raw HTML `<img>` tags inside markdown.
- Letting publish tasks remain `processing` without step/progress updates.
- Hiding errors in console logs instead of surfacing them in the UI or task steps.

## Before You Finish

Check the relevant items:

- Did the changed route/service/db/frontend layers stay aligned?
- Did you preserve existing platform-specific behavior?
- Did you avoid logging secrets?
- Did you add adapter traces for publish-visible behavior?
- Did you run an appropriate verification command?
- Did you avoid reverting unrelated user work?
