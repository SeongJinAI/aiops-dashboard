# Nova — Dashboard UI Kit

A click-through recreation of the Nova dashboard, the only product in the brief. Open `index.html` to use it.

## Surface coverage

- **Shell** — Sidebar (3 groups · 10 items · collapsible) + TopBar (breadcrumb · density · theme · user)
- **Home** — system status, 5 stat cards, recent activity timeline
- **Hook Monitor** — realtime table with sliding-in row animation
- **Prompts** — line chart, time-of-day heatmap, log list
- **Misunderstandings** — pattern distribution + detection log
- **Agent (Nova)** — wiki body, perspective tabs, progress bar, provider dropdown, version timeline
- **Connections** — API key issue + BYOK cards (Anthropic / OpenAI / Gemini)

Other items in the sidebar (RepoMap, ProjectSwap, Workflow, Claude Config) route to a polite "not in this kit" empty state — the brief deprioritises them ("보조") and a placeholder is more honest than a fabricated screen.

## Interactive bits

- **⌘K** — Command palette (works inside the kit)
- **⌘B** — Sidebar collapse
- **⌘D** — Dark/Light toggle
- **Density toggle** in TopBar — Compact/Normal/Roomy, persists to `localStorage`
- **[Nova 업데이트]** on Agent page — animates the progress bar through `catalog → planner → developer → user → complete` and appends a new version to the timeline
- Hook Monitor — new rows slide in every ~3s while you're watching

## Files

- `index.html` — entry. React 18.3 + Babel standalone, all components loaded.
- `app.jsx` — top-level `<App>` and routing.
- `AppShell.jsx`, `Sidebar.jsx`, `TopBar.jsx` — chrome.
- `primitives.jsx` — `Box`, `StatCard`, `Chip`, `Btn`, `EmptyState`, `KbdChip`, icon stamping.
- `Icons.jsx` — Lucide SVG paths inlined as a small registry.
- `pages/*.jsx` — one file per page.
- `data.js` — fake data and config; pure JS, no React.

## Caveats

This is a **visual + interaction** recreation, not a working app. Charts are pre-computed SVG. WebSocket "events" are a `setInterval`. The wiki body is a small static markdown snippet rendered as plain HTML — no real markdown parser to keep the kit dependency-light.
