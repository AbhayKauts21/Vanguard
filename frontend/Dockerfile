# ---- Stage 1: Build ----
FROM node:22-slim AS builder

WORKDIR /app
ENV NAPI_RS_FORCE_WASI=1

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --include=optional
RUN node -e "for (const pkg of ['@tailwindcss/oxide', '@next/swc-linux-x64-gnu', '@parcel/watcher', '@rolldown/binding-linux-x64-gnu']) { try { console.log(pkg, '=>', require.resolve(pkg)); } catch (error) { console.log(pkg, '=> MISSING'); console.log(String(error)); process.exitCode = 1; } }"

# Copy source and build
COPY . .

# Build-time env vars must be available at build time for Next.js
# They get inlined into the JS bundle during `next build`.
# Pass them via --build-arg or .env.local copied before build.
RUN npm run build

# ---- Stage 2: Production Runner ----
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NAPI_RS_FORCE_WASI=1

# Copy standalone output + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
