# ─── CodeRacer · production image ───────────────────────────────
# Custom Next.js + Socket.io server. Needs a persistent Node process
# (Render / Railway / Fly.io / VPS) — NOT serverless.

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# 1) Full deps (build needs dev deps)
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2) Build the Next app
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# 3) Production-only deps (slim runtime)
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# 4) Runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY package.json ./package.json
COPY server.js ./server.js
# server.js requires these CommonJS modules at runtime:
COPY src/lib ./src/lib
EXPOSE 3000
CMD ["node", "server.js"]
