// Pages Function: /api/wishes
// Meneruskan pengajuan ucapan ke Worker yang memegang secret Turnstile + Supabase.
// Dipakai karena halaman kini disajikan dari Pages (pages.dev tidak diblokir ISP ID,
// sedangkan *.workers.dev diblokir di DNS).
const WORKER_ENDPOINT = 'https://pemberitahuan-nikah.zulfajrisurya30.workers.dev/api/wishes';
const MAX_BYTES = 8192;

const json = (status, message) =>
  Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.arrayBuffer();
  } catch {
    return json(400, 'Data tidak valid.');
  }
  if (body.byteLength === 0) return json(400, 'Data kosong.');
  if (body.byteLength > MAX_BYTES) return json(413, 'Data terlalu besar.');

  const headers = { 'Content-Type': 'application/json' };
  const origin = request.headers.get('Origin');
  if (origin) headers['Origin'] = origin;
  // teruskan IP asli pengunjung supaya rate limit di Worker tetap per-pengunjung
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers['CF-Connecting-IP'] = ip;

  try {
    const res = await fetch(WORKER_ENDPOINT, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return json(503, 'Layanan sedang tidak tersedia. Silakan coba lagi.');
  }
}

export async function onRequestGet() {
  return json(405, 'Metode tidak diizinkan.');
}
