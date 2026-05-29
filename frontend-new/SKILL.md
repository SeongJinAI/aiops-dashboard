---
name: nova-design
description: Use this skill to generate well-branded interfaces and assets for Nova, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

# Nova Design — Skill

Read `README.md` first for product context, brand language, and content fundamentals.
Then explore:

- `colors_and_type.css` — design tokens (colour, type, spacing, radius, shadow). Supports `data-theme="light|dark"` and `data-density="compact|normal|roomy"` on `<html>`. Compact is the default.
- `assets/` — logo mark + wordmark.
- `preview/` — small specimen cards demonstrating each design decision.
- `ui_kits/dashboard/` — high-fidelity click-through of the Nova dashboard. Read `ui.css` for component classes and the individual JSX files for React patterns.

## Workflow

If creating a **visual artifact** (slides, mocks, throwaway prototypes), copy the design tokens and assets you need into a self-contained HTML file. Import `colors_and_type.css` and rely on its CSS variables — never hard-code hex codes.

If creating **production code**, lift values directly from `colors_and_type.css` into the target framework's design tokens (Tailwind config, CSS variables, Figma styles). The UI kit's React patterns translate cleanly to shadcn/ui + Tailwind v4.

## Hard rules

- **No emoji in UI surfaces.** Use the Lucide icon registry in `ui_kits/dashboard/Icons.jsx`. The only place emoji can appear is inside user-generated content.
- **Numbers in dashboards always use `font-variant-numeric: tabular-nums`** (the `.t-mono` utility or `.stat-num` class does this). Without it, stat cards jitter as data refreshes.
- **Skeleton loaders, never spinners.** Use the `.skeleton` class.
- **No coloured left-border accent cards.** Use `border + status dot/chip`.
- **No marketing gradients.** Backgrounds are flat `var(--bg)`. The only approved gradient is the optional progress-bar fill.
- **Korean-first copy.** Technical terms (Hook, Workflow, Prompt, Agent) stay English. Errors are calm and direct — no exclamation marks.
- **Working brand name is "Nova" (provisional).** Easy to find-and-replace later — never hard-code it into reusable components.

## Open the skill without context?

If the user invokes this skill without any other guidance, ask them what they want to build, then ask 4–8 focused questions (target audience? screens needed? Korean or bilingual? variations? interactive prototype or static mocks?). Act as an expert designer who outputs HTML artifacts *or* production code, depending on the need.
