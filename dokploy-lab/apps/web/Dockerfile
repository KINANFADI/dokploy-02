FROM nginx:1.27-alpine
ARG BUILD_VERSION=dev
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
COPY 40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh \
 && printf '{"version":"%s","builtAt":"%s"}\n' "$BUILD_VERSION" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > /usr/share/nginx/html/version.json
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/version.json >/dev/null || exit 1
