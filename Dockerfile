# syntax=docker/dockerfile:1
ARG CADDY_IMAGE=caddy:2-alpine
FROM ${CADDY_IMAGE}

# Copying the binary drops inherited file capabilities; all internal ports are >1024.
RUN cp /usr/bin/caddy /tmp/jhoneme-caddy \
    && mv /tmp/jhoneme-caddy /usr/bin/caddy \
    && mkdir -p /data/caddy /config/caddy /srv \
    && chown -R 10001:10001 /data /config /srv

COPY --chown=10001:10001 dist/ /srv/
COPY deploy/Caddyfile /etc/caddy/Caddyfile
ENV XDG_DATA_HOME=/data XDG_CONFIG_HOME=/config
USER 10001:10001
EXPOSE 8080 8443
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:8081/healthz || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
