# Cairo Art Operations AI — production image.
# Builds the Vite app, then runs the Hono server that serves it and the API.

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Native modules (better-sqlite3, sharp) are used at runtime; keep the toolchain
# available in case a prebuilt binary is unavailable for this platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server
RUN npm run build && npm prune --omit=dev


FROM node:22-bookworm-slim AS runtime
WORKDIR /app
# PORT is injected by the host; 8787 is the local default. DATABASE_URL is
# supplied at runtime (empty keeps SQLite in the mounted volume).
ENV NODE_ENV=production \
    DATA_DIR=/app/data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json

# The SQLite database, uploads and backups all live here; mount a volume.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.API_PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
