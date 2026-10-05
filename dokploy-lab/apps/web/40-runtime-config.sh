#!/bin/sh
# Runs at container start (nginx image runs /docker-entrypoint.d/*.sh).
# Turns runtime environment variables into config.js for the browser.
set -e
cat > /usr/share/nginx/html/config.js <<CONFIG
window.APP_CONFIG = {
  apiUrl: "${API_URL:-}",
  env: "${APP_ENV:-local}",
  banner: "${BANNER:-}"
};
CONFIG
echo "[web] runtime config: API_URL=${API_URL:-unset} APP_ENV=${APP_ENV:-local}"
