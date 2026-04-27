---
name: d1-database
description: Blog-to-Post D1 database guide for schema, migrations, local/remote commands, and publish task tables.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [cloudflare-d1, sqlite, migrations, database]
---

# D1 Database

Use this skill when changing schema, migrations, D1 queries, or publish task persistence.

Commands:

```bash
npm run db:init -- --local
npm run db:status -- --local
npm run db:migrate -- --local
npm run db:migrate -- --remote
npm run db:local -- --command="SELECT name FROM sqlite_master WHERE type='table'"
```

Core tables:

- `articles`
- `tasks`
- `platform_accounts`
- `article_publications`
- `publish_tasks`
- `publish_task_steps`
- `account_statistics`

Rules:

- Add migrations under `migrations/`.
- Use sequential names like `0012_add_example_column.sql`.
- Do not edit migrations already applied remotely.
- Keep `src/worker/schema.sql` aligned for fresh local bootstrap.
- Use prepared statements and `.bind(...)`.
- Inspect `publish_task_steps` for adapter traces.
