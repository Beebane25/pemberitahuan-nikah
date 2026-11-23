#!/usr/bin/env bash
# Deploy manual halaman ke Cloudflare Pages (cadangan).
#   bash deploy-pages.sh
#
# Normalnya halaman sudah otomatis ter-deploy lewat Cloudflare Pages
# "Connect Git" saat push ke main. Script ini untuk kondisi darurat
# (misal build di Cloudflare gagal dan kamu mau upload langsung).
set -euo pipefail

cd "$(dirname "$0")"

echo "== build public/ =="
node build.mjs

echo "== deploy ke Pages =="
npx wrangler pages deploy public \
  --project-name=pemberitahuan-nikah \
  --branch=main \
  --commit-dirty=true

echo "== cek =="
curl -s -o /dev/null -w 'live: HTTP %{http_code}\n' https://pemberitahuan-nikah.pages.dev/
