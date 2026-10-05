#!/usr/bin/env bash
# Steady traffic: reads plus some orders. Use it to fill Monitoring, Requests and Logs.
# Usage: ./scripts/traffic.sh http://api-staging.192.168.234.128.sslip.io 200
set -u
API="${1:?Usage: $0 <api-url> [requests]}"
N="${2:-100}"
declare -A codes
for i in $(seq 1 "$N"); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$API/api/info")
  codes[$code]=$(( ${codes[$code]:-0} + 1 ))
  if (( i % 5 == 0 )); then
    curl -s -o /dev/null --max-time 10 -X POST -H 'Content-Type: application/json' \
      -d "{\"item\":\"load-test-$i\"}" "$API/api/orders"
  fi
  printf '.'
done
echo
for c in "${!codes[@]}"; do echo "HTTP $c: ${codes[$c]}"; done
