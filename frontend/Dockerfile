# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
RUN npm install --no-save --ignore-scripts @rolldown/binding-linux-x64-musl@1.0.0-rc.9

# Copy source and build
COPY . .

# Build-time env vars must be available at build time for Next.js
# They get inlined into the JS bundle during `next build`.
# Pass them via --build-arg or .env.local copied before build.
RUN npm run build

# ---- Stage 2: Production Runner ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
