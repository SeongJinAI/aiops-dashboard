# Nova — Design System

> **Working name.** This project was originally drafted as "Hermes Agent" in the source brief. The current brand is **Nova** — the name is still provisional and may change. Anywhere you see "Nova" treat it as a placeholder you can swap later.

**One‑line definition (KO):** AI 바이브코딩으로 만들어진 흩어진 개인 데이터를 자동 수집·자산화·코칭하여 개인 AI 협업 능력을 데이터로 키우는 SaaS 학습 대시보드.

**One‑line definition (EN):** *Nova — AI Collaboration Learning Dashboard.* Track every trace of AI‑assisted coding (prompts, hooks, configs, `.md` assets), wikify them into 3‑perspective project documentation, and coach the developer with data‑driven suggestions.

```
Track  ──►  Wikify  ──►  Coach
수집        자산화          코칭
```

The product is a SaaS dashboard for solo and small‑team developers using Claude Code, Cursor, Windsurf, and similar AI tools. It silently tracks AI activity, organises scattered `.md` artefacts into a 3‑perspective (planner / developer / user) wiki, and — eventually — coaches the developer with data‑driven suggestions.

Reference brands the brief cites:

- **Linear** (sidebar, command palette, density)
- **Vercel Dashboard** (data cards, line charts, typography)
- **Notion** (compact tables, status chips)
- **Mintlify** (wiki body typography)
- **Resend** (BYOK key registration, empty states)

---

## Sources

This design system was generated from a single attached spec document — the *Original Design Brief (working name: Nova)* (last updated 2026‑05‑28, authored by the Nova dev team). No codebase, Figma file, or screenshots were attached. All visual decisions trace back to the brief; where it was silent, we leaned on the reference brands listed above and stayed close to the **Linear + Vercel** lineage so future hand‑offs (Lovable, v0, Cursor, Figma) land in the same neighbourhood.

If you have a Figma file, codebase repo, or running build of Nova, please attach it via the Import menu so we can replace inferred decisions with measured ones.

---

## Index

Root files:

- `README.md` — this file
- `colors_and_type.css` — CSS variables for colour, typography, spacing, radius (Compact/Normal/Roomy density), light + dark mode
- `SKILL.md` — Agent Skill manifest so this folder can be downloaded and re‑used in Claude Code

Folders:

- `assets/` — logo marks and brand visual assets
- `fonts/` — webfont loader (Pretendard via CDN; see file)
- `preview/` — small specimen cards rendered in the Design System tab
- `ui_kits/dashboard/` — Nova dashboard recreation. Open `index.html` for the click‑through.

---

## Content fundamentals

The product ships in **Korean first, English second** — UI strings are Korean, technical terms stay English (Hook, Workflow, Prompt, Agent, Nova). Tone is calm, expert, and slightly understated, in the Linear / Vercel lineage.

**Voice rules**

- **Address the user as "you" (당신/개발자/사용자)** indirectly — most copy is impersonal noun phrases ("프롬프트 기록", "Hook 모니터"), not "Track your prompts!"
- **No marketing exclamation.** No "!", no "🚀", no superlatives. A successful build says "위키 빌드 완료" not "위키 빌드 완료! 🎉"
- **Lowercase English in body, Title Case for proper nouns.** "Nova", "Anthropic", "Claude Code" — but "prompts", "hooks", "workflow".
- **Numbers always have units and locale.** `3,124회`, `5월 28일`, `12분 전`. Never bare numbers in body copy.
- **Empty states explain how to fill them.** "데이터 없음" alone is forbidden — every empty state pairs with a one‑sentence "어떻게 만들 수 있나요" and an action button.
- **Error messages are Korean, debug logs are English.** A toast says "API 키 검증 실패 — 권한을 확인해 주세요." A console log says `verify_key: 401 from anthropic`.

**Casing**

- Page titles: short Korean noun phrases ("홈", "프롬프트", "오해 추적", "에이전트")
- Section headers inside a page: Korean noun phrase + optional English clarifier ("최근 활동 · Recent activity")
- Buttons: verb phrase. "Nova 업데이트", "키 등록", "버전 비교"
- Status chips: single word in source casing — `running`, `success`, `failed`, `idle`

**No emoji in UI.** Status, severity, perspective — all conveyed via colour + lucide icon. Emoji only appears if the user explicitly types it.

**Examples (from the brief, verbatim or adapted)**

- Sidebar groups: `Dashboard`, `Insights`, `Nova`
- Stat card label / value: `프롬프트 (24h)` / `3,124회` with delta chip `+12%`
- Build progress stages: `catalog → planner → developer → user → complete`
- Toast on key save: `API 키가 안전하게 저장되었습니다.`
- Empty Hook monitor: `Hook 활동이 없습니다. 첫 실행을 시도하려면 Hook 설치 가이드를 확인하세요.` + `Hook 설치 가이드 보기` button

---

## Visual foundations

### Colour

`oklch()` colour space. **Light mode is the default**; dark mode mirrors it one stop brighter at accents. Greys are a single zinc‑family ramp (`zinc-50` → `zinc-950`) — no warm/cool split.

| Role | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` | Page background |
| `--surface` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Card surface |
| `--surface-alt` | `oklch(0.96 0 0)` | `oklch(0.27 0 0)` | Hover, disabled, inset rows |
| `--border` | `oklch(0.92 0 0)` | `oklch(0.27 0 0)` | Card border, divider |
| `--border-active` | `oklch(0.80 0 0)` | `oklch(0.50 0 0)` | Focus ring, active row |
| `--text` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Body |
| `--text-dim` | `oklch(0.55 0 0)` | `oklch(0.70 0 0)` | Labels, meta |
| `--accent` | `oklch(0.50 0.20 270)` | `oklch(0.62 0.20 270)` | Indigo‑600 / 500. Actions, active tab |
| `--success` | `oklch(0.60 0.16 145)` | one stop up | Emerald‑600 |
| `--warning` | `oklch(0.70 0.17 75)` | one stop up | Amber‑600 |
| `--danger` | `oklch(0.58 0.20 25)` | one stop up | Rose‑600 |
| `--info` | `oklch(0.65 0.16 235)` | one stop up | Sky‑600 |
| `--purple` | `oklch(0.55 0.22 295)` | one stop up | Violet‑600 — planner perspective |
| `--cyan` | `oklch(0.65 0.13 215)` | one stop up | Cyan‑600 — secondary differentiation |

Status colour is **never decorative**. Indigo means "interactive / accent". Green/amber/rose/sky mean "state of a real thing". Don't tint a card border indigo to "make it pop" — use border + a status dot.

### Type

- **Body:** Pretendard (Korean + Latin both native‑feeling).
- **Numbers & code:** system monospace — `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace`.
- **Numbers in dashboards always use `font-variant-numeric: tabular-nums`.** This is non‑negotiable — without it, stat cards jitter as data refreshes.

Type scale is **dense**. Page H1 is 18px, not 32px. Big stat numbers are 18–22px, not 48px. This is a working dashboard, not a marketing page.

| Token | Size / line / weight | Use |
|---|---|---|
| `--t-h1` | `18 / 1.3 / 700` | Page header |
| `--t-h2` | `15 / 1.3 / 700` | Section header |
| `--t-h3` | `13 / 1.4 / 600` | Card header |
| `--t-body` | `12 / 1.5 / 400` | Body |
| `--t-sm` | `11 / 1.5 / 400` | Label, meta |
| `--t-xs` | `10 / 1.4 / 400` | Chip, badge |
| `--t-bignum` | `22 / 1.2 / 700` tabular | Stat card large number |

### Spacing — density‑aware

Three density modes via the `[data-density]` attribute on `<html>`. The default is `compact`. CSS variables (not Tailwind classes) drive spacing so toggling is one DOM mutation.

| Token | Compact | Normal | Roomy |
|---|---|---|---|
| `--s-xs` | 3 | 4 | 5 |
| `--s-sm` | 6 | 8 | 10 |
| `--s-md` | 9 | 12 | 15 |
| `--s-lg` | 12 | 16 | 20 |
| `--s-xl` | 18 | 24 | 30 |
| `--s-xxl` | 24 | 32 | 40 |

### Radius

- `--r-sm` 4px — chips, badges, dense buttons
- `--r-md` 6px — **default** card, button, input
- `--r-lg` 8px — modal, large card

Cards are **never pill‑shaped**. Tabs and segmented controls use `--r-sm`. Avatars are the only fully‑round elements.

### Elevation

Border first, shadow second. A card at rest is a 1px border with no shadow. On hover it adds a barely‑there `0 1px 2px rgb(0 0 0 / 0.04)`. Dark mode shadows are almost invisible — hierarchy is conveyed by `--border` + `--surface-alt` instead.

- `--shadow-none` — default
- `--shadow-sm` — hover
- `--shadow-md` — dropdown, popover
- `--shadow-lg` — modal, command palette

### Background, imagery, illustration

- **Page background is flat** — `var(--bg)` only. No gradients, no patterns, no hand‑drawn illustrations.
- **No full‑bleed imagery anywhere** — this is a tool, not a website.
- The **only** approved gradient is a 1‑stop indigo wash on the brand mark (very subtle, < 6% opacity) and the optional progress‑bar fill.
- Photography is forbidden. Avatars are initials.

### Animation

- **Tab / page transitions:** 150ms ease‑out, opacity + translate‑y 4px (Framer Motion).
- **Card hover:** 120ms, `scale(1.005)` + border to `--border-active`. No translate.
- **Button press:** 80ms, `scale(0.98)`.
- **Loading:** Skeleton with a 1.4s shimmer. **No spinners.**
- **Real‑time event arrival:** new row slides in 12px from the top, holds an indigo‑tinted background for 800ms, then fades to neutral.
- **Count‑up numbers:** optional, 500ms ease‑out from previous value.
- **No bouncy easings.** No overshoot. Everything decelerates.

### Hover & press states

- Buttons: background goes one stop darker; border tightens to `--border-active`. Primary buttons darken the indigo (≈ −6% L in oklch).
- Rows in a table: background `--surface-alt` on hover, full surface again on leave.
- Cards: 1px border colour shift only. No lift, no shadow growth (except very subtle on the dashboard's stat cards).
- Press: `scale(0.98)` for buttons, no scale change for rows or cards (we just darken the bg).

### Transparency and blur

- Used only in two places: (1) the modal scrim — `rgb(0 0 0 / 0.40)` plus `backdrop-filter: blur(4px)`; (2) the command palette which sits on the same scrim.
- Nothing else uses transparency. Sidebars, popovers, toasts are all opaque.

### Layout rules

- **Sidebar 220px** (collapsed 56px). Content area `max-w-screen-2xl` with `--s-lg` padding. Top bar 48px fixed.
- Grid is 12 cols at desktop, 4 cols at tablet. Stat card grid uses `repeat(auto-fit, minmax(180px, 1fr))`.
- Tables breathe inside cards — no full‑bleed tables.

### Borders & rules

- 1px solid `--border` everywhere. Never 2px. Never dashed. Dividers between sidebar groups are a 1px rule with `--s-sm` vertical margin.

### Cards

A card is a `<div>` with `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: var(--r-md)`, padding `var(--s-md) var(--s-lg)`. Header inside: H3 + optional action row right‑aligned. No internal shadow. No coloured left border.

---

## Iconography

**Library:** [`lucide-react`](https://lucide.dev) — copy‑and‑pasteable SVGs with consistent 1.5px stroke. The brief mandates this and we follow it.

**Sizes:** `12 / 14 / 16 / 20` px. Sidebar item icon 16px. Inline button icon 14px. Hero icon (empty state) 24px. Inside small chips 12px.

**Colour:** always `currentColor`. Icons inherit text colour — never pre‑coloured, never multi‑colour.

**Stroke:** 1.5 (Lucide default). Don't change it.

**Usage:**
- Nav, buttons, inline labels → Lucide.
- Status, severity, perspective → coloured dot + Lucide. Never coloured icon alone.
- Planner perspective: `Lightbulb` (violet). Developer perspective: `Code` (zinc / accent). User perspective: `User` (cyan).

**No emoji** in any UI surface — including empty states. The only place emoji can appear is inside user‑generated content (a prompt the user wrote that happened to contain one).

**No Unicode glyph icons** (★, ✓, ⚙). Tempting because they're free, but they don't match the lucide stroke and look broken at small sizes.

**Implementation in this design system:** the UI kit pulls lucide via the official CDN (`https://unpkg.com/lucide@…/dist/umd/lucide.js`) and stamps icons by name. The brand mark in `assets/` is the only custom SVG.

---

## Notes & caveats

- No codebase or Figma was provided. The dashboard recreation is an *inferred* interpretation of the brief — pixel positions, exact paddings, and component micro‑interactions will need a real source‑of‑truth pass.
- Pretendard is loaded from the official Pretendard CDN (cdn.jsdelivr.net/gh/orioncactus/pretendard). If you need to ship offline, please attach the woff2 files and we'll move them to `fonts/`.
- The dark‑mode "one stop brighter" status colours are interpolated from the brief; please confirm or override.
