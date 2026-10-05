#!/usr/bin/env bash
# Sends many requests at once. Use it to test the Traefik rate limit (expect some HTTP 429).
# Usage: ./scripts/burst.sh http://api-staging.192.168.234.128.sslip.io 60
set -u
API="${1:?Usage: $0 <api-url> [requests]}"
N="${2:-60}"
seq 1 "$N" | xargs -P 20 -I{} curl -s -o /dev/null -w '%{http_code}\n' --max-time 10 "$API/api/info" \
  | sort | uniq -c | awk '{print "HTTP " $2 ": " $1}'
