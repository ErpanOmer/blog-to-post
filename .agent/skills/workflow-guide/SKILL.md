---
name: workflow-guide
description: Blog-to-Post daily workflow guide for install, dev server, D1, build, deploy, and common debugging commands.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [workflow, npm, wrangler, vite, debugging]
---

# Workflow Guide

Use this skill for local setup, command selection, D1 debugging, and publish-task investigation.

Commands:

```bash
npm install
npm run dev
npm run lint
npm run build
npm run deploy
npm run db:init -- --local
npm run db:status -- --local
npm run db:migrate -- --local
```

Publish debugging:

```bash
npm run db:local -- --command="SELECT * FROM publish_tasks WHERE id='TASK_ID'"
npm run db:local -- --command="SELECT * FROM publish_task_steps WHERE taskId='TASK_ID' ORDER BY stepNumber"
```

Common issues:

- Missing table: run `npm run db:init -- --local`.
- Vite dependency cache issue: remove `node_modules/.vite` and restart.
- WeChat `40164`: add the outbound IP to the WeChat Official Account whitelist.
- CSDN code mismatch: verify Prism token output before changing styles.
