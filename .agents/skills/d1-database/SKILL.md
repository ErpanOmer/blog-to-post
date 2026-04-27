---
name: d1-database
description: Blog-to-Post D1 database guide for schema, migrations, local/remote commands, and publish task tables.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [cloudflare-d1, sqlite, migrations, database]
---

# D1 Database

Use this skill when changing schema, migrations, D1 queries, or publish task persistence.

## Core Commands

```bash
npm run db:init -- --local
npm run db:status -- --local
npm run db:migrate -- --local
npm run db:migrate -- --remote
npm run db:local -- --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Tables

Core tables:

- `articles`
- `tasks`
- `platform_accounts`
- `article_publications`
- `publish_tasks`
- `publish_task_steps`
- `account_statistics`

## Migration Rules

- Add new migration files under `migrations/`.
- Use sequential names like `0012_add_example_column.sql`.
- Do not edit migrations already applied to remote environments.
- Use `ALTER TABLE ... ADD COLUMN` carefully; check existing schema first.
- Keep fresh-bootstrap schema in `src/worker/schema.sql` aligned with migrations.

## Query Rules

- Use prepared statements and `.bind(...)`.
- Avoid building SQL with interpolated user input.
- Add indexes for fields used in `WHERE`, joins, or frequent ordering.
- Keep row shape types close to the query.

## Publish Diagnostics

When debugging publish failures, inspect:

```sql
SELECT * FROM publish_tasks WHERE id = ?;
SELECT * FROM publish_task_steps WHERE taskId = ? ORDER BY stepNumber;
SELECT * FROM article_publications WHERE articleId = ?;
```

Adapter traces are stored as `publish_task_steps.stepType = 'adapter_trace'`.

