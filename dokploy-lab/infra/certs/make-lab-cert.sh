#!/usr/bin/env bash
# Makes a self-signed certificate for the lab, to practise Dokploy -> Certificates.
# Usage: ./make-lab-cert.sh demo.192.168.234.128.sslip.io
# For real company domains, use a Cloudflare Origin Certificate instead.
set -euo pipefail
HOST="${1:?Usage: $0 <hostname>}"
openssl req -x509 -nodes -newkey rsa:2048 -days 90 \
  -keyout lab.key -out lab.crt \
  -subj "/CN=${HOST}" -addext "subjectAltName=DNS:${HOST}"
echo "Created lab.crt and lab.key for ${HOST} (valid 90 days)."
echo "Paste both into Dokploy -> Certificates. Browsers will warn, because it is self-signed."
