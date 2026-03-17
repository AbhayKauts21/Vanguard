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
├── app/            # Next.js App Router pages
│   └── [locale]/   # Locale-aware routing
├── components/     # Shared UI components
├── domains/        # Feature-oriented domain logic
├── i18n/           # Internationalization config
├── lib/            # Utilities, API client, constants
├── messages/       # Translation JSON files
├── styles/         # Design tokens & animations
├── test/           # Test setup, mocks, fixtures
└── types/          # Shared TypeScript types
```
