FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV CI=true CLOUDFLARE_CF_FETCH_ENABLED=false WRANGLER_SEND_METRICS=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production CLOUDFLARE_CF_FETCH_ENABLED=false \
    DATA_DIR=/data HOST=0.0.0.0 PORT=18473
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist/client ./dist/client
COPY --from=build /app/dist/blog_to_post/index.js ./dist/blog_to_post/index.js
COPY --from=build /app/dist/blog_to_post/wrangler.json ./dist/blog_to_post/wrangler.json
COPY src/worker/schema.sql ./src/worker/schema.sql
COPY migrations ./migrations
COPY deploy/runtime ./deploy/runtime
USER node
EXPOSE 18473
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:18473/__health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "deploy/runtime/server.mjs"]
