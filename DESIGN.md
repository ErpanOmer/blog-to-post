# Genesis

## Overview

Blog-to-Post is an editorial precision interface for AI-assisted article creation and multi-platform publishing. The UI should feel quietly confident: professional, modern, content-first, and operationally efficient without becoming sterile.

The product is a publishing workspace, not a marketing site. Prioritize high information density, fast scanning, careful spacing, and calm surfaces. Users should be able to inspect articles, accounts, publish tasks, platform status, and publication links without fighting visual noise.

## Colors

- **Primary** (`#6366F1`): CTAs, active states, links, focus rings, selected controls, and interactive highlights.
- **Primary Hover** (`#4F46E5`): Hover state for primary interactive elements.
- **Secondary** (`#20970B`): Reserved for rare brand highlight moments only. Do not use as a generic accent.
- **Neutral** (`#9C9C9C`): Muted text, placeholders, timestamps, disabled states.
- **Background** (`#FAFAFA`): Page background.
- **Surface** (`#FFFFFF`): Cards, panels, modals, navigation backdrop.
- **Text Primary** (`#0A0A0A`): Headings, body text, primary labels.
- **Text Secondary** (`#6B6B6B`): Descriptions, metadata, secondary labels.
- **Border** (`#E8E8EC`): Card borders, dividers, input borders.
- **Success** (`#10B981`): Published status, confirmations, positive indicators.
- **Warning** (`#F59E0B`): Pending states, caution banners.
- **Error** (`#EF4444`): Destructive actions, validation errors, rejected/failed status.

### Color Rules

- Use indigo only for interactive elements: primary buttons, active nav, selected chips, links, focus rings.
- Do not use indigo as static decoration.
- Do not add decorative gradients, gradient backgrounds, gradient cards, decorative blobs, or bokeh effects.
- Use semantic status colors only for status meaning.
- Keep surfaces white and flat, separated by borders rather than heavy shadows.

## Typography

- **Display Font**: General Sans.
- **Body Font**: DM Sans.
- **Code Font**: JetBrains Mono.

Display and heading text uses General Sans with bold or semibold weight. Body and UI text uses DM Sans at regular or medium weight. Code blocks, API keys, IDs, and CLI commands use JetBrains Mono.

Type scale:

- Display: 72px for rare hero-level moments only.
- Headline: 60px for rare landing-style pages only.
- Section heading: 32px.
- Subhead: 24px.
- Body: 15px.
- Small: 13px.
- Caption: 12px.
- Overline: 11px uppercase.

Product screens should usually avoid hero-scale type. Dashboard cards, modals, sidebars, and tool surfaces need compact headings and readable metadata.

## Elevation

This design uses minimal shadows.

- Static cards: no shadow or a very subtle `0 1px 2px rgba(10, 10, 10, 0.04)`.
- Hover cards: `0 8px 30px rgba(0, 0, 0, 0.08)` with a small upward lift.
- Primary button hover: `0 4px 12px rgba(99, 102, 241, 0.35)`.
- Navigation: backdrop blur plus bottom border, not a heavy shadow.
- Dropdowns, popovers, and dialogs: use stronger elevation because they float above the app.
- Focus: 3px indigo ring, `rgba(99,102,241,0.12)`.

Do not put shadows on static page sections just to make them decorative.

## Components

### Buttons

- Primary: indigo fill, white text, 6px radius, medium weight.
- Secondary: white or transparent background with a 1px border.
- Ghost: no border or background until hover.
- Destructive: red text or red border. Use filled red only when the action is truly destructive and final.
- Hover: primary buttons may shift up 1px and get a tinted glow shadow.
- Sizes: small 32px, medium 38px, large 44px.
- Do not place more than one filled indigo primary button in the same view section.

### Cards and Panels

- Surface: white.
- Border: 1px `#E8E8EC`.
- Radius: 12px for cards, 8px for dense operational panels.
- Static cards should be flat.
- Hoverable cards may lift 1-2px and gain the hover shadow.
- Do not nest decorative cards inside decorative cards.
- Use cards for repeated records, forms, dialogs, and genuinely framed tools. Do not make every page section a floating card.

### Inputs

- 1px subtle border.
- White surface.
- 6px radius.
- Padding: 10px vertical and 14px horizontal.
- Font size: 14px.
- Focus: border turns indigo with a 3px rgba ring.
- Error: border turns red and error text appears near the field or in a blocking dialog when the error would otherwise be missed.

### Chips and Badges

- Tag chips: rounded-full, gray-100 background, gray-600 text.
- Padding: 4px vertical and 12px horizontal.
- Font size: 12px.
- Active chips: indigo background with white text.
- Status chips use semantic colors:
  - green for published/success
  - yellow/orange for pending/draft
  - red for failed/rejected

### Lists

- Use stacked rows with 1px dividers or subtle bordered row cards.
- Row padding: 12px vertical, 16px horizontal.
- Hover: subtle background change.
- Long article titles, links, task IDs, and error messages must truncate or wrap intentionally.

### Checkboxes

- 20px size.
- Rounded-full.
- Gray border unchecked.
- Indigo checked with white checkmark.
- Use checkboxes/toggles for binary choices.

### Tooltips

- Native browser tooltips via `title` are acceptable.
- Use explicit labels for controls where possible.

### Navigation

- Sticky top nav.
- 56px height.
- Backdrop blur with a 1px bottom border.
- Logo left, links center on desktop, primary create action right.
- Nav links: 13-14px medium weight.
- Active nav uses indigo as an interactive state, not decoration.

## Spacing

- Base unit: 4px.
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px.
- Component padding:
  - small: 8x12
  - medium: 10x16
  - large: 12x24
- Section spacing:
  - mobile: 32px
  - tablet: 48px
  - desktop: 64px
- Container max width: 1280px with 24px horizontal padding on desktop.
- Card grid gap: 20-24px.

Avoid arbitrary one-off spacing values unless solving a concrete fit issue.

## Border Radius

- 4px: inline code, compact metadata.
- 6px: buttons, inputs, selects.
- 8px: operational panels, dropdowns, dense controls.
- 12px: cards, dialogs, featured surfaces.
- 9999px: avatars, status dots, pill badges.

## Product-Specific UI Rules

- Article list cards must preserve all article actions and publication links while keeping links readable.
- Publish dialogs must keep account selection, platform settings, draft/full publish choice, and progress feedback intact.
- Dashboard should show current operating state, recent links, publish trends, and platform health without feeling like a marketing hero.
- Distribution/task screens must surface failed steps, adapter traces, durations, and platform errors clearly.
- Account pages must make verification status and token/cookie state visible without exposing secrets.
- Editor pages must keep the writing surface primary; warnings such as image upload failures must be visible enough to prevent silent loss.

## Do's and Don'ts

Do:

- Use `DESIGN.md` and `AGENTS.md` before changing UI.
- Use indigo for interactive states only.
- Maintain the 4px spacing grid.
- Use General Sans for headings, DM Sans for body, JetBrains Mono for code.
- Keep operational screens dense, clear, and calm.
- Preserve all existing product functionality during visual refactors.
- Verify layout on desktop and mobile when changing major screens.

Don't:

- Do not use pure black for text when `#0A0A0A` is available.
- Do not use decorative gradients, illustrations, blobs, or ornamental backgrounds.
- Do not add shadows to static elements.
- Do not use more than two font weights on a single screen.
- Do not add extra product features during a UI-only refactor.
- Do not remove existing controls, publish paths, filters, task details, account actions, or editor safeguards.
