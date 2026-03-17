# CLEO Frontend Implementation Plan

> Product name: **CLEO** — *Contextual Learning & Enterprise Oracle*
>
> Team name remains: **Vanguard**
>
> Goal: build a production-grade `frontend/` application in **Next.js + React + TypeScript** that preserves the shared visual concept from the provided HTML/JS design, integrates with the current FastAPI backend, supports English/Spanish i18n from day one, and is structured for long-term maintainability.

---

## 1. Scope Clarification

### What changes now
- The **app/product name** changes from `Vanguard` to `CLEO` wherever the product is referenced.
- The **team/repo identity** can stay `Vanguard` where it refers to the team or repository.
- We will create a new top-level `frontend/` folder.
- We will convert the provided stitched HTML/JS concept into a **real Next.js App Router UI**.
- We will introduce **i18n** for all static UI text using translation keys and `t(...)` lookups.
- We will ensure compatibility with the current backend routes:
  - `POST /api/v1/chat/`
  - `POST /api/v1/chat/stream`
  - `GET /api/v1/admin/sync/status`
  - `POST /api/v1/admin/ingest`
  - `POST /api/v1/admin/ingest/{page_id}`
  - `GET /health`

### What does not change yet
- No frontend code is implemented in this planning step.
- No README rewrite happens yet; README update is the final documentation step after implementation.
- No backend API redesign is planned unless integration gaps appear during implementation.

---

## 2. Product Rename Strategy: Vanguard → CLEO

This rename must be done carefully to avoid mixing **product branding** with **team/repo identity**.

### Rename product references to `CLEO`
These should become `CLEO` when they describe the app, assistant, or user-facing product:
- `README.md`
- `backend/app/core/config.py` → `PROJECT_NAME`
- `backend/main.py` log messages and app title if product-facing
- `docs/features.md` title and feature descriptions where app name is used
- Any backend prompt or response text referencing “Vanguard” as the assistant name
- Future frontend metadata (`app/layout.tsx`, HTML title, manifest, OG tags)

### Keep `Vanguard` where it refers to team/repo context
These should remain as-is unless you explicitly want repo rebranding too:
- GitHub repo name `Vanguard`
- Hackathon team references
- Historical architecture notes that name the team

### Rename acceptance rule
- If a user sees it in the app or docs as the **product**, use `CLEO`.
- If it identifies the **team/repository/history**, keep `Vanguard`.

---

## 3. Frontend Technology Decisions

## Core stack
- **Framework**: `Next.js` (App Router)
- **Language**: `TypeScript`
- **Styling**: `Tailwind CSS`
- **UI primitives**: `Radix UI`
- **Reusable UI base**: `shadcn/ui` patterns on top of Radix + Tailwind
- **Animation**: `framer-motion` for declarative UI motion
- **Icons**: `lucide-react`
- **Fonts**: `next/font` for `Inter`
- **Data fetching / server state**: `@tanstack/react-query`
- **Client state**: `zustand` only for app/session/UI state that does not belong in query cache
- **Forms**: `react-hook-form` + `zod`
- **Validation**: `zod`
- **i18n**: `next-intl`
- **Testing**: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
- **Coverage**: `@vitest/coverage-istanbul`
- **Lint/format**: `eslint`, `prettier`, `eslint-config-next`
- **HTTP client**: native `fetch` with typed wrapper; avoid axios unless a clear need appears

## Why this stack
- `Next.js App Router` gives production-ready routing, layouts, metadata, and server/client component composition.
- `next-intl` is the most natural fit for App Router i18n and keeps translations structured.
- `TanStack Query` cleanly handles backend integration and revalidation.
- `Zustand` is lightweight and ideal for transient UI state.
- `Vitest` + Istanbul gives fast unit tests and coverage aligned with modern frontend tooling.
- `Radix UI` + Tailwind + custom components keeps the UI accessible and maintainable while still matching the custom stitched concept.

---

## 4. Frontend Architecture Principles

### Engineering principles to follow
- **SOLID**
  - Components have a single responsibility.
  - UI orchestration is separate from API logic.
  - Page shells depend on interfaces/helpers, not concrete networking details.
- **SOC (Separation of Concerns)**
  - Presentation, hooks, API clients, schemas, translations, and animation logic stay separate.
- **DDD-inspired frontend boundaries**
  - `domains/chat`, `domains/avatar`, `domains/knowledge`, `domains/system`
- **Accessibility-first**
  - Keyboard navigation, focus states, semantic HTML, contrast-safe text, reduced motion support.
- **Performance-first**
  - Avoid unnecessary client components.
  - Use server components for static layout shells where possible.
  - Use lazy animation and isolate canvas effects from chat rendering.
- **Progressive enhancement**
  - Core chat works without heavy avatar effects.
  - Ambient effects are layered on top, not required for function.

---

## 5. Recommended Frontend Folder Structure

```text
frontend/
├── public/
│   ├── images/
│   ├── locales/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── api/
│   │   │   ├── chat/route.ts
│   │   │   ├── chat-stream/route.ts
│   │   │   └── health/route.ts
│   │   ├── globals.css
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── chat/
│   │   ├── avatar/
│   │   ├── effects/
│   │   └── i18n/
│   ├── domains/
│   │   ├── chat/
│   │   │   ├── api/
│   │   │   ├── hooks/
│   │   │   ├── model/
│   │   │   └── components/
│   │   ├── avatar/
│   │   ├── knowledge/
│   │   └── system/
│   ├── lib/
│   │   ├── api/
│   │   ├── env/
│   │   ├── utils/
│   │   ├── constants/
│   │   └── telemetry/
│   ├── messages/
│   │   ├── en.json
│   │   └── es.json
│   ├── styles/
│   │   ├── tokens.css
│   │   └── animations.css
│   ├── test/
│   │   ├── setup.ts
│   │   ├── mocks/
│   │   └── fixtures/
│   └── types/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── vitest.config.ts
├── .env.example
└── README.md
```

### Architectural notes
- `src/app/[locale]` enables locale-aware routing from day one.
- `src/app/api/*` route handlers can proxy backend calls, hide backend origin, and normalize errors.
- `domains/*` holds feature logic; `components/*` holds shared presentation.
- Translation JSON lives in `src/messages/` for strict ownership.

---

## 6. UI Conversion Strategy: HTML/JS → Next.js

The provided stitched HTML is visually rich but monolithic. We should preserve the **theme and experience**, not the file structure.

### Keep from the concept
- Dark neural-interface aesthetic
- Glass panels
- Ambient plasma / scanlines / particle system
- Split-screen layout: chat panel + avatar panel
- Futuristic typography and subtle telemetry
- Motion-heavy but premium interaction model

### Refactor into React component boundaries

#### Layout shell
- `AppShell`
- `TopBar`
- `FooterStatusBar`
- `SplitPanelLayout`

#### Chat area
- `ChatPanel`
- `MessageList`
- `MessageBubble`
- `CitationCard`
- `Composer`
- `TypingIndicator`

#### Avatar area
- `AvatarPanel`
- `AvatarCore`
- `AvatarTelemetry`
- `AvatarStatusOverlay`
- `VoiceWaveform`

#### FX / ambient layer
- `ParticleCanvas`
- `HexGridBackground`
- `GhostTerminalOverlay`
- `NeuralLinkOverlay`
- `PlasmaBackground`
- `ScanlineOverlay`

### Refactor JS behavior into hooks
- `useParticleField()`
- `useGhostTerminal()`
- `useNeuralLinks()`
- `useAvatarMotion()`
- `useMagneticMessages()`
- `useShockwave()`
- `useTypingState()`

### Important production rule
The ambient effects must be isolated from business logic.
- Chat still works if effects fail.
- Avatar panel still renders if canvas effects are disabled.
- Reduced-motion users get a safer variant.

---

## 7. Page and Flow Design

## Primary route map
- `/{locale}` → main CLEO experience
- `/{locale}/settings` → language/theme/backend config later
- `/{locale}/archive` → future citations/history view
- `/{locale}/system` → future admin/system status view (optional later)

## v1 screen composition
### Left column
- Session status strip
- Scrollable message list
- Citations embedded in assistant messages
- Input composer with send action
- Optional language switcher in header

### Right column
- Avatar hero shell
- Placeholder neural avatar visuals now
- Future HeyGen stream mount target
- Metrics badges: sync, latency, state

### Header
- CLEO brand mark
- Navigation placeholders from concept (`Neural Link`, `Archive`, `Nexus`)
- Locale toggle
- Future settings button

### Footer
- System/environment status
- Build/version text
- Optional backend health indicator

---

## 8. Backend Integration Plan

## Integration approach
We should not call the backend directly from every client component. Use a layered approach:

```text
UI Component
  -> Domain Hook
  -> Frontend API Client / Route Handler
  -> FastAPI Backend
```

## Backend routes already available
### Chat
- `POST /api/v1/chat/`
  - request: `{ message, conversation_id? }`
  - response: `{ answer, citations, conversation_id? }`

### Streaming chat
- `POST /api/v1/chat/stream`
  - SSE stream of tokens, then final citations payload

### Health
- `GET /health`

### Admin sync
- `GET /api/v1/admin/sync/status`
- `POST /api/v1/admin/ingest`
- `POST /api/v1/admin/ingest/{page_id}`

## Frontend networking decisions
- Add `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.example`
- Use route handlers under `src/app/api/*` as optional proxy layer
- Normalize RFC 7807 backend errors into typed frontend error objects
- Use `AbortController` for streaming cancellation

## Chat integration milestones
1. **Phase A**: non-streaming message send using `/api/v1/chat/`
2. **Phase B**: SSE streaming using `/api/v1/chat/stream`
3. **Phase C**: citations rendering
4. **Phase D**: backend health and sync status badges

---

## 9. i18n Plan

## Library
- Use **`next-intl`**

## Locales
- Default locale: `en`
- Secondary locale: `es`

## File layout
```text
frontend/src/messages/en.json
frontend/src/messages/es.json
```

## Translation rules
- Every static string in UI must come from translations.
- No hard-coded English in components.
- Use namespaced keys.

## Example translation structure
```json
{
  "common": {
    "appName": "CLEO",
    "loading": "Loading",
    "send": "Send",
    "settings": "Settings"
  },
  "header": {
    "neuralLink": "Neural Link",
    "archive": "Archive",
    "nexus": "Nexus"
  },
  "chat": {
    "sessionStable": "Uplink Stable",
    "inputPlaceholder": "Address CLEO...",
    "emptyState": "How can I help you today?"
  },
  "avatar": {
    "coreSync": "CORE_SYNC: ACTIVE",
    "meshEngaged": "NEURAL_MESH: ENGAGED"
  }
}
```

## Usage rule
- Use `const t = useTranslations('chat')`
- Keep namespaces small and feature-oriented
- Add any new static copy to both locale files in the same commit as the UI change

## i18n acceptance criteria
- Locale can be switched without code changes.
- All static UI text has English and Spanish coverage.
- Missing key detection is enabled in development.

---

## 10. State Management Plan

## Use TanStack Query for
- Chat request mutation
- Sync status polling
- Health status checks
- Any knowledge/admin data later

## Use Zustand for
- Active locale/UI preferences if needed client-side
- Chat panel transient state (composer drafts, typing FX state)
- Avatar visual state
- Modal visibility and layout toggles

## Do not use Zustand for
- Server-fetched business data that belongs in React Query cache
- Forms better handled by `react-hook-form`

---

## 11. Styling and Design System Plan

## Design tokens
Create shared tokens for:
- background layers
- text opacity hierarchy
- border alpha scale
- glass blur levels
- spacing scale
- font scale
- radius scale
- z-index layers
- animation durations/easing

## Tailwind approach
- Use Tailwind utilities for layout
- Use CSS variables for theme tokens
- Move custom animations into `styles/animations.css`
- Avoid giant inline class strings where components can encapsulate patterns

## Theming strategy
- Start with dark-first neural theme
- Keep color tokens abstract enough to support future theme variants
- Use `prefers-reduced-motion` fallbacks for heavy motion elements

---

## 12. Accessibility and UX Requirements

## Must-have accessibility rules
- Semantic buttons and inputs
- Focus-visible states
- Keyboard-navigable language switcher and composer
- Announce streaming assistant response via accessible live region
- Do not rely on color alone for status indicators
- Motion reduction support for particle field and pulsing effects
- Reasonable contrast on glass backgrounds

## UX rules
- Sending a message must feel instant
- Show optimistic “thinking” state while the stream begins
- Citations must be clickable and readable
- Empty state should guide first interaction
- Errors should be friendly and localized

---

## 13. Testing Strategy

## Unit testing stack
- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `@vitest/coverage-istanbul`
- `jsdom`

## What to test
### Utilities
- translation helpers
- API error normalization
- stream parsing helpers
- className helpers

### Hooks
- SSE stream hook
- locale hook
- typing state hook
- health polling hook

### Components
- `Composer`
- `MessageBubble`
- `CitationCard`
- `LanguageSwitcher`
- `TopBar`
- `AvatarTelemetry`

### Domain tests
- chat mutation flow
- stream token accumulation
- citation mapping
- backend error mapping

## Coverage policy
- Use Istanbul coverage output
- Target:
  - `80%+` statements
  - `80%+` branches for utilities/hooks
  - `70%+` branches initially for UI-heavy components

## Test file layout
```text
src/components/chat/Composer.test.tsx
src/domains/chat/hooks/useChatStream.test.ts
src/lib/api/errors.test.ts
```

---

## 14. Frontend Environment Variables

Planned `frontend/.env.example`:

```env
NEXT_PUBLIC_APP_NAME=CLEO
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_SUPPORTED_LOCALES=en,es
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_ENABLE_AVATAR=true
NEXT_PUBLIC_ENABLE_AMBIENT_EFFECTS=true
NEXT_PUBLIC_ENABLE_STREAMING=true
```

Future optional vars:

```env
NEXT_PUBLIC_HEYGEN_AVATAR_ID=
NEXT_PUBLIC_HEYGEN_VOICE_ID=
HEYGEN_API_KEY=
```

---

## 15. Phased Execution Plan

## Phase 0 — Branding alignment
- Rename product-facing references from `Vanguard` to `CLEO`
- Leave team/repo references as `Vanguard`
- Update backend `PROJECT_NAME`
- Update prompts and user-facing strings
- Mark in `docs/features.md`

### Commit
- `refactor(branding): rename product references from vanguard to cleo`

## Phase 1 — Frontend scaffolding
- Create `frontend/` Next.js app
- Configure TypeScript, Tailwind, ESLint, Prettier
- Add `next-intl`, React Query, Zustand, Vitest, Istanbul
- Add root providers and app shell
- Add `frontend/README.md`

### Commit
- `feat(frontend): scaffold nextjs application with core tooling`

## Phase 2 — Design system foundation
- Add design tokens, glass theme, typography, animation utilities
- Build core layout primitives
- Build shared UI wrappers
- Add locale files `en.json` and `es.json`

### Commit
- `feat(frontend-ui): add design system, tokens, and locale foundation`

## Phase 3 — Static CLEO layout conversion
- Convert the stitched HTML into componentized React layout
- Keep the same concept/theme
- Replace raw DOM manipulation with hooks and motion-safe components
- Stub static data with typed fixtures

### Commit
- `feat(frontend-ui): implement cleo neural interface layout`

## Phase 4 — Chat integration
- Implement composer, message list, citations
- Integrate `/api/v1/chat/` first
- Add loading/error states
- Add localized strings throughout

### Commit
- `feat(chat): integrate cleo chat ui with backend response flow`

## Phase 5 — Streaming integration
- Parse SSE from `/api/v1/chat/stream`
- Stream tokens live into assistant message
- Send citations after `done` event
- Add cancellation handling

### Commit
- `feat(chat): add streaming response pipeline with citations`

## Phase 6 — Ambient effects migration
- Move particle field, hex grid, scanline, ghost terminal, and neural links into isolated client components
- Add reduced motion handling
- Optimize re-renders and cleanup logic

### Commit
- `feat(frontend-effects): add ambient neural motion system`

## Phase 7 — Avatar shell readiness
- Build avatar display shell compatible with future HeyGen stream mount
- Add telemetry badges tied to backend health/sync status
- Keep current avatar visual as placeholder until real avatar integration

### Commit
- `feat(avatar): add cleo avatar shell and telemetry panel`

## Phase 8 — Test hardening
- Add Vitest coverage config
- Add unit tests for components/hooks/utils
- Add CI-ready test scripts

### Commit
- `test(frontend): add vitest suites and istanbul coverage`

## Phase 9 — Documentation finalization
- Update root `README.md`
- Add frontend run/setup instructions
- Update architecture notes to name `CLEO`
- Update `docs/features.md`

### Commit
- `docs: update readme for cleo frontend and integration flow`

---

## 16. Backend Compatibility Checklist

Before frontend implementation starts, confirm:
- `backend` responds on a known local URL, likely `http://localhost:8000`
- CORS remains permissive enough for local frontend dev
- `/api/v1/chat/` and `/api/v1/chat/stream` are stable
- SSE event payload shape stays:
  - `{ type: 'token', content: string }`
  - `{ type: 'done', citations: Citation[] }`
- `Citation` shape remains compatible with UI card rendering

Potential improvement later:
- Add OpenAPI contract snapshot or shared frontend types from backend schema

---

## 17. Risks and Mitigations

## Risk: visual code is too monolithic
- **Mitigation**: extract by concern into layout, domain, and effects components

## Risk: ambient effects hurt performance
- **Mitigation**: isolate effects in client-only components and add feature flags

## Risk: i18n becomes inconsistent
- **Mitigation**: fail PRs when new static text is hard-coded outside locale files

## Risk: backend streaming changes shape
- **Mitigation**: add a dedicated SSE parser utility and mock tests

## Risk: avatar integration delays UI delivery
- **Mitigation**: ship the avatar shell and telemetry first, then plug in HeyGen later

---

## 18. Definition of Done for Frontend v1

Frontend v1 is done when all of the following are true:
- `frontend/` exists as a working Next.js app
- product branding is `CLEO`
- main split-screen neural interface is implemented in React/TypeScript
- all static text uses `t(...)` and exists in both `en.json` and `es.json`
- chat works against current backend routes
- streaming mode works with SSE and renders citations
- unit tests run with Vitest and Istanbul coverage
- `docs/features.md` is updated with frontend features
- root `README.md` is updated with frontend setup and architecture notes
- commits are organized in small conventional-commit slices

---

## 19. Immediate Next Execution Order

When we start implementation, the order should be:
1. **Brand rename pass** (`Vanguard` product references → `CLEO`)
2. **Create `frontend/` scaffold**
3. **Install and configure i18n + testing + Tailwind**
4. **Build design tokens and layout shell**
5. **Convert static stitched UI into React components**
6. **Wire chat to backend**
7. **Add streaming + citations**
8. **Add ambient effects carefully**
9. **Add tests**
10. **Update README**

---

## 20. Required User Inputs Before Implementation

You will need to provide or confirm these while I implement:
- Whether you want the frontend on **Next.js 14** or **Next.js 15**
- Whether `shadcn/ui` is acceptable as the reusable component baseline
- Whether the first milestone should include **real HeyGen integration** or just the avatar shell
- The desired default backend URL for local dev if not `http://localhost:8000`

If you do not specify otherwise, I will default to:
- **Next.js 15**
- **App Router**
- **TypeScript**
- **shadcn/ui + Radix + Tailwind**
- **next-intl**
- **TanStack Query**
- **Zustand**
- **Vitest + Istanbul**
- **avatar shell first, HeyGen integration next phase**
