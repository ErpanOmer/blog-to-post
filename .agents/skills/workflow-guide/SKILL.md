---
name: workflow-guide
description: Blog-to-Post daily workflow guide for install, dev server, D1, build, deploy, and common debugging commands.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [workflow, npm, wrangler, vite, debugging]
---

# Workflow Guide

Use this skill for local setup, command selection, D1 debugging, and publish-task investigation.

## Daily Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run deploy
```

## D1 Commands

```bash
npm run db:init -- --local
npm run db:status -- --local
npm run db:migrate -- --local
npm run db:migrate -- --remote
npm run db:local -- --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Publish Debugging

```bash
npm run db:local -- --command="SELECT * FROM publish_tasks WHERE id='TASK_ID'"
npm run db:local -- --command="SELECT * FROM publish_task_steps WHERE taskId='TASK_ID' ORDER BY stepNumber"
```

Use `/api/publish/quick` for one-off local draft tests.

## Common Issues

- Missing table: run `npm run db:init -- --local`.
- Vite dependency cache issue: remove `node_modules/.vite` and restart dev server.
- WeChat `40164`: add the current outbound IP to the WeChat Official Account IP whitelist.
- WeChat missing `thumb_media_id`: inspect cover image upload and fallback traces.
- CSDN code color mismatch: verify Prism token output before changing inline styles.

## Verification Preference

- For docs-only work, inspect rendered markdown and run no heavy build unless docs mention commands that might be stale.
- For Worker/API code, run focused lint and then `npm run build` when feasible.
- For adapter changes, run draft-only publish against a real test article when credentials are available.

