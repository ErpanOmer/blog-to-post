---
name: frontend-style
description: Blog-to-Post frontend guide for React, Tailwind, ByteMD, Radix/shadcn patterns, and dashboard UI conventions.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [react, tailwindcss, bytemd, shadcn-ui, frontend]
---

# Frontend Style

Use this skill when changing `src/react-app`, article editor UI, publish dialogs, account management, or dashboard views.

## Stack

- React 19.
- TypeScript.
- Tailwind CSS.
- ByteMD for markdown editing.
- Radix primitives and shadcn-style local components.
- `lucide-react` for icons.

## Boundaries

- API calls belong in `src/react-app/api.ts`.
- Shared data contracts should use `src/shared/types.ts`.
- UI components live under `src/react-app/components`.
- Do not put Worker-only code in frontend modules.

## UI Rules

- Keep operational screens dense, scannable, and calm.
- Prefer clear controls over decorative layouts.
- Use existing UI primitives and Tailwind tokens before adding new patterns.
- Keep cards for repeated records or dialogs, not every page section.
- Show loading and error states for async operations.
- Publish progress and adapter traces should be easy to scan.

## Article Workflow

The editor supports:

- markdown content
- optional rendered HTML
- summary
- tags
- cover image
- publication status

When changing article data shape, update frontend API calls, Worker routes, DB layer, and shared types together.

