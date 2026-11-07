# Serata Quiz: Next.js custom server + Socket.io, for Google Cloud Run.
# The custom server cannot use Next's "standalone" output, so the runtime image
# keeps production node_modules and the TypeScript sources loaded by tsx.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_ADSENSE_CLIENT_ID=""
ARG NEXT_PUBLIC_ADSENSE_SLOT_ID=""
ENV NEXT_PUBLIC_ADSENSE_CLIENT_ID=$NEXT_PUBLIC_ADSENSE_CLIENT_ID \
    NEXT_PUBLIC_ADSENSE_SLOT_ID=$NEXT_PUBLIC_ADSENSE_SLOT_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The runtime image is Debian (glibc): drop the musl builds of native packages (~140 MB).
RUN npm run build \
 && npm prune --omit=dev --no-audit --no-fund \
 && rm -rf .next/cache node_modules/@next/swc-*-musl node_modules/@img/*-linuxmusl-*

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080
COPY --from=build --chown=node:node /app/package.json /app/server.ts /app/tsconfig.json /app/next.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src ./src
USER node
EXPOSE 8080
# Plain node (no wrapper process) so SIGTERM from Cloud Run reaches the graceful shutdown handler.
CMD ["node", "--import", "tsx", "server.ts"]
