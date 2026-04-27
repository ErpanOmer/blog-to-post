---
name: tailwindcss
description: Tailwind CSS guidance for Blog-to-Post React dashboard screens, article editor flows, publish dialogs, and operational UI.
skill_version: 2.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [tailwindcss, react, dashboard, ui]
---

# Tailwind CSS

Use this skill for styling work in `src/react-app`.

Blog-to-Post is an operational publishing dashboard, not a marketing site.

The UI should feel:

- focused
- readable
- stable under repeated use
- clear when scanning publish state
- calm around errors and long-running tasks

Rules:

- Prefer existing Tailwind tokens and local component patterns.
- Keep layouts responsive with explicit constraints.
- Use small, consistent radii for operational panels.
- Avoid decorative backgrounds that make publish data harder to scan.
- Use `lucide-react` icons for icon buttons and action affordances.
- Keep long article titles, URLs, tags, and error messages wrapping cleanly.
