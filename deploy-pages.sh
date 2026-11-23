#!/usr/bin/env bash
# Deploy manual halaman ke Cloudflare Pages (cadangan).
#   bash deploy-pages.sh
#
# Normalnya halaman sudah otomatis ter-deploy lewat Cloudflare Pages
# "Connect Git" saat push ke main. Script ini untuk kondisi darurat
# (misal build di Cloudflare gagal dan kamu mau upload langsung).
#
# API guestbook ada di functions/api/wishes.js dan ikut ter-deploy di sini.
# Secret-nya tersimpan di project Pages (SUPABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY).
set -euo pipefail

cd "$(dirname "$0")"

export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-129c0648f957bd84a82642a46882d243}"

echo "== build public/ =="
node build.mjs

echo "== deploy ke Pages =="
npx wrangler pages deploy public \
  --project-name=pemberitahuan-nikah \
  --branch=main \
  --commit-dirty=true

echo "== cek =="
curl -s -o /dev/null -w 'halaman: HTTP %{http_code}\n' https://pemberitahuan-nikah.pages.dev/
curl -s -o /dev/null -w 'API GET: HTTP %{http_code} (harus 405)\n' https://pemberitahuan-nikah.pages.dev/api/wishes
