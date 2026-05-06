# Replit IDE Workspace Clone

A mobile-first Replit clone with two apps: **App Builder** (mobile UI matching the Replit app) and **Replit IDE** (full workspace with editor, projects, and extensions store).

## Run & Operate

- `pnpm install` — install all dependencies
- `pnpm run typecheck` — typecheck all packages
- `pnpm run build` — build all packages
- API Server: `PORT=8080 pnpm --filter @workspace/api-server run dev`
- App Builder: `PORT=20311 BASE_PATH=/ pnpm --filter @workspace/app-builder run dev`
- DB push: `pnpm --filter @workspace/db run push`
- Required env vars: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (auto-provisioned via Replit AI integration), `DATABASE_URL`

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24, **TypeScript**: 5.9
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4
- **Routing**: Wouter
- **Animations**: Framer Motion
- **API**: Express 5 + Drizzle ORM + PostgreSQL
- **AI**: Anthropic Claude (streaming)
- **Syntax Highlighting**: react-syntax-highlighter (atomOneDark theme)

## Where Things Live

- `artifacts/replit-ide/` — Full IDE workspace (home, editor, projects, profile, extensions store)
- `artifacts/app-builder/src/pages/chat.tsx` — All chat logic + all panels (~4200 lines)
- `artifacts/api-server/` — Express API with Anthropic AI streaming
- `lib/api-zod/`, `lib/api-spec/`, `lib/db/` — shared libs

## Architecture Decisions

- Both frontend apps share the same pnpm workspace catalog for version-locked dependencies
- Editor uses in-browser Babel + React UMD for live preview without a build step
- AI chat streams via SSE (`data: {...}` lines) from the Express API
- Extensions Store is fully client-side with install/uninstall state (no backend needed)
- All chat panels are self-contained components defined above the `Chat` default export

## Product

- **App Builder**: Mobile Replit-like UI — create projects via AI chat, browse projects, account page
  - **AI Chat**: Streaming responses, AbortController stop button, Plan mode, language detection
  - **Code blocks**: Syntax highlighted (react-syntax-highlighter), line numbers, copy button, macOS-style window chrome
  - **File Reader**: Real FileReader API — attach code/text/image files, contents injected as fenced code blocks in AI context
  - **Empty state**: Quick-starter prompts (Landing page, REST API, AI chat, Dashboard, Portfolio, Real-time)
  - **Share/More**: Working share-URL button with toast, More menu (New chat, Clear, History)
  - **Files Panel**: Real code editor — file tree with create/rename/delete (right-click context menu), syntax-highlighted viewer, textarea edit mode, open tabs
  - **Shell Panel**: Interactive terminal with command history (↑↓), `npm run dev/build`, `ls`, `pwd`, `clear`, `help`
  - **Packages Panel**: Browse/install npm packages by category, custom install input, animated install state
  - **Toolbar panels**: Secrets, Database, Auth, Git, Shell, Deploy, Webview, Files, Packages
  - **Git panel**: GitHub token auth, repo browser, Pull/Push, file staging, commit author editor
  - **Import from GitHub**: Animated importing screen → chat navigation
- **Replit IDE**: Desktop IDE — code editor, file tree, AI agent, live preview, extensions store, projects, profile
- **Extensions Store**: Browse/install Themes, Linters, Keymaps, AI tools, UI Libraries, State Management, Animation packages

## User Preferences

- Dark GitHub-inspired color palette (`#0d1117`, `#161b22`, `#21262d`)
- Mobile-first design for app-builder
- AI must respond in the user's language (Arabic when user writes Arabic)

## Gotchas

- Both frontend apps run on different ports (replit-ide: 25212, app-builder: 20311)
- Preview at `/` shows app-builder; use the artifact dropdown to switch to Replit IDE
- The "API Server" workflow conflicts with "artifacts/api-server: API Server" on port 8080 — the artifact one wins
- `react-syntax-highlighter` is in app-builder's package.json (not the workspace catalog)

## Pointers

- See `pnpm-workspace` skill for monorepo structure
- See `react-vite` skill for Vite + React setup conventions
