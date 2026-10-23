# syntax=docker/dockerfile:1
ARG CADDY_IMAGE=caddy:2-alpine
FROM ${CADDY_IMAGE} AS caddy
FROM node:24-alpine AS dependencies
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
FROM node:24-alpine
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy

# Copying the binary drops inherited file capabilities; all internal ports are >1024.
RUN apk add --no-cache ca-certificates \
    && cp /usr/bin/caddy /tmp/jhoneme-caddy \
    && mv /tmp/jhoneme-caddy /usr/bin/caddy \
    && mkdir -p /data/caddy /config/caddy /srv /agency /app \
    && chmod 700 /agency \
    && chown -R 10001:10001 /data /config /srv /agency /app

COPY --chown=10001:10001 public/ /srv/
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --chown=10001:10001 server/ /app/
COPY --from=dependencies --chown=10001:10001 /app/node_modules /app/node_modules
ENV XDG_DATA_HOME=/data XDG_CONFIG_HOME=/config
USER 10001:10001
EXPOSE 8080 8443
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:8081/healthz || exit 1
CMD ["node", "/app/start.mjs"]
