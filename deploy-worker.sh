#!/usr/bin/env bash
# Deploy manual (cadangan kalau tidak lewat GitHub Actions).
#   bash deploy-worker.sh
#
# CATATAN: halaman (Pages) di-deploy otomatis oleh Cloudflare via Connect Git.
# Script ini hanya untuk Worker API (worker.mjs). Pakai deploy-pages.sh kalau
# Pages belum tersambung ke Git.
set -euo pipefail

cd "$(dirname "$0")"

echo "== deploy Worker API =="
npx wrangler deploy

echo "== cek =="
curl -s -o /dev/null -w 'GET /api/wishes -> HTTP %{http_code} (harus 405)\n' \
  https://pemberitahuan-nikah.pages.dev/api/wishes
