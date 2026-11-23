// Pages Function: POST /api/wishes
// Menyimpan ucapan langsung dari Pages (tanpa Worker terpisah).
// Secret dibaca dari environment Pages project:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY
//
// Alur: validasi -> Turnstile siteverify -> Supabase RPC submit_wedding_wish
// (RPC itu yang menangani rate limit 60 detik / 5 per jam dan duplikat.)

const ALLOWED_HOST = /^(?:pemberitahuan-nikah\.pages\.dev|[a-z0-9-]+\.pemberitahuan-nikah\.pages\.dev)$/;
const MAX_BYTES = 8192;
const TURNSTILE_ACTION = 'wedding_wish';

const json = (status, message) =>
  Response.json({ message }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });

const hostOf = (value) => {
  try { return new URL(value).host; } catch { return ''; }
};

const sha256hex = async (text) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
};

export async function onRequestGet() {
  return json(405, 'Metode tidak diizinkan.');
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.TURNSTILE_SECRET_KEY) {
    return json(503, 'Konfigurasi layanan belum lengkap.');
  }

  if (!ALLOWED_HOST.test(hostOf(request.headers.get('Origin') || ''))) {
    return json(403, 'Asal permintaan tidak diizinkan.');
  }

  if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
    return json(415, 'Gunakan JSON.');
  }

  // Batasi ukuran body tanpa mempercayai Content-Length
  const reader = request.body?.getReader();
  if (!reader) return json(400, 'Data kosong.');
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return json(413, 'Data terlalu besar.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }

  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json(400, 'Data tidak valid.'); }

  const { name, message, token } = body || {};
  if (
    typeof name !== 'string' || typeof message !== 'string' ||
    typeof token !== 'string' || !token || token.length > 2048 ||
    name.trim().length < 2 || name.trim().length > 60 ||
    message.trim().length < 3 || message.trim().length > 1000
  ) {
    return json(400, 'Periksa nama, ucapan, dan verifikasi keamanan.');
  }

  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json(403, 'Koneksi tidak valid.');

  try {
    // 1. Verifikasi Turnstile
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await verify.json();
    if (
      !verify.ok || !result.success ||
      !ALLOWED_HOST.test(result.hostname || '') ||
      result.action !== TURNSTILE_ACTION
    ) {
      // DIAGNOSTIK SEMENTARA: tidak pernah mencetak secret/token, hanya bentuknya
      const secret = env.TURNSTILE_SECRET_KEY;
      console.log('TURNSTILE_FAIL ' + JSON.stringify({
        httpOk: verify.ok,
        status: verify.status,
        success: result.success,
        errorCodes: result['error-codes'] || [],
        hostname: result.hostname || null,
        action: result.action || null,
        secretLen: secret.length,
        secretHasSpace: /\s/.test(secret),
        secretStart: secret.slice(0, 4),
        secretEnd: secret.slice(-4),
      }));
      return json(403, 'Verifikasi keamanan gagal. Silakan coba kembali.');
    }

    // 2. Simpan lewat RPC (hash IP & isi supaya tidak menyimpan data mentah)
    const ipHash = await sha256hex(env.TURNSTILE_SECRET_KEY + '|' + ip);
    const contentHash = await sha256hex(name.trim().toLowerCase() + '|' + message.trim().toLowerCase());

    const res = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/submit_wedding_wish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        p_name: name.trim(),
        p_message: message.trim(),
        p_ip_hash: ipHash,
        p_content_hash: contentHash,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text();
      if (text.includes('RATE_LIMIT')) return json(429, 'Tunggu 60 detik. Maksimal 5 ucapan per jam per koneksi.');
      if (text.includes('DUPLICATE')) return json(409, 'Ucapan yang sama sudah terkirim.');
      return json(503, 'Ucapan belum tersimpan. Silakan coba lagi.');
    }

    return json(201, 'Terima kasih, ucapan Anda sudah tersimpan ♡');
  } catch {
    return json(503, 'Layanan sedang tidak tersedia. Silakan coba lagi.');
  }
}
