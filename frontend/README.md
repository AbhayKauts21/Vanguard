# 🧠 CLEO Frontend

> **Contextual Learning & Enterprise Oracle** — Next.js neural interface

## Quick Start

```bash
# Install dependencies
npm install

# Copy env and configure
cp .env.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report (Istanbul) |

## Stack

- **Next.js 16** — App Router, server/client components
- **TypeScript** — strict mode
- **Tailwind CSS** — utility-first styling
- **Radix UI** — accessible primitives
- **next-intl** — i18n (English + Spanish)
- **TanStack Query** — server state management
- **Zustand** — lightweight client state
- **Vitest + Istanbul** — testing & coverage

## Folder Structure

```
src/
├── app/                  # Next.js App Router pages
│   └── [locale]/         # Locale-aware routing (en, es)
├── components/
│   ├── avatar/           # AvatarPanel, AvatarTelemetry
│   ├── chat/             # ChatPanel, MessageBubble, Composer, etc.
│   ├── effects/          # ParticleCanvas, ScanlineOverlay, HexGrid
│   ├── i18n/             # LanguageSwitcher
│   ├── layout/           # AppShell, TopBar, FooterStatusBar, CleoInterface
│   └── ui/               # Button, GlassCard, Skeleton, StatusBadge
├── domains/
│   ├── chat/             # API, hooks (useChat, useChatStream), Zustand store
│   └── system/           # useHealthStatus, useSyncStatus hooks
├── i18n/                 # next-intl routing, request, navigation
├── lib/
│   ├── api/              # Typed fetch client, SSE parser
│   ├── constants/        # App-wide constant values
│   ├── env/              # Type-safe env access
│   └── utils/            # cn() and general helpers
├── messages/             # en.json, es.json translation files
├── styles/               # tokens.css, animations.css
├── test/                 # Vitest setup & fixtures
└── types/                # Shared TypeScript interfaces
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend API URL |
| `NEXT_PUBLIC_ENABLE_STREAMING` | `false` | Toggle SSE streaming |
| `NEXT_PUBLIC_ENABLE_AMBIENT_EFFECTS` | `true` | Toggle particle/scanline effects |
