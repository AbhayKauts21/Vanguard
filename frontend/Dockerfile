ARG NODE_VERSION=22.22.0

# ---- Stage 1: Build ----
FROM node:${NODE_VERSION}-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build
COPY . .

# Match local development by seeding the example env file for builds.
RUN if [ ! -f .env.local ] && [ -f .env.example ]; then cp .env.example .env.local; fi
RUN npm run build

# ---- Stage 2: Production Runner ----
FROM node:${NODE_VERSION}-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
