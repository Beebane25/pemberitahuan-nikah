#!/usr/bin/env bash
# Deploy manual (tanpa GitHub Actions). Jalankan dari folder proyek.
#   bash deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "== 1/3 build public/ =="
node build.mjs

echo "== 2/3 deploy halaman ke Pages =="
npx wrangler pages deploy public \
  --project-name=pemberitahuan-nikah \
  --branch=main \
  --commit-dirty=true

echo "== 3/3 deploy Worker API =="
npx wrangler deploy

echo "== selesai =="
curl -s -o /dev/null -w 'live: HTTP %{http_code}\n' https://pemberitahuan-nikah.pages.dev/
