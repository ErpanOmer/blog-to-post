---
name: tailwindcss
description: Tailwind CSS guidance for Blog-to-Post React dashboard screens, article editor flows, publish dialogs, and operational UI.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [tailwindcss, react, dashboard, ui]
---

# Tailwind CSS

Use this skill for styling work in `src/react-app`.

## Project Context

Blog-to-Post is an operational publishing dashboard, not a marketing site.

The UI should feel:

- focused
- readable
- stable under repeated use
- clear when scanning publish state
- calm around errors and long-running tasks

## Styling Rules

- Prefer existing Tailwind tokens and local component patterns.
- Keep layouts responsive with explicit `min-*`, `max-*`, grid, and flex constraints.
- Use small, consistent radii for operational panels.
- Avoid one-off decorative backgrounds that make publish data harder to scan.
- Keep typography compact inside tables, dialogs, sidebars, and task timelines.
- Use `lucide-react` icons for icon buttons and action affordances.
- Do not introduce broad visual theme changes while fixing a local interaction.

## Component Rules

- Use cards for repeated entities such as articles, accounts, task rows, or dialog content.
- Avoid cards inside cards.
- Put async feedback close to the action that triggered it.
- Make disabled/loading states obvious.
- Ensure long article titles, URLs, tags, and error messages wrap without breaking layout.

## Common Areas

- Article editor: preserve ByteMD readability and avoid cramped controls around the editor.
- Publish dialogs: prioritize selected accounts, draft/full-publish mode, progress, and failure reason.
- Distribution status: show task/step progress clearly and keep adapter trace details scannable.
- Account management: expose verification state and credential errors without leaking secrets.

## Verification

For meaningful UI changes:

- Run `npm run lint` when TypeScript/TSX changed.
- Start `npm run dev` when visual behavior needs inspection.
- Check desktop and narrow viewport layouts for title/error wrapping.
