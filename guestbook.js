/* Guestbook — UI, validasi, dan status.
   Backend tetap functions/api/wishes.js + Supabase + Cloudflare Turnstile.
   Semua teks pengguna dimasukkan lewat textContent (tidak ada innerHTML). */
(() => {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('wishStatus'), list = $('wishList'), form = $('wishForm');
  const send = $('wishSend'), sendLabel = $('wishSendLabel');
  const nameEl = $('wishName'), msgEl = $('wishMessage');
  const nameCount = $('nameCount'), msgCount = $('messageCount');
  const moreBtn = $('wishMore'), refreshBtn = $('wishRefresh'), countEl = $('wishCount');
  if (!statusEl || !list || !form || !send) return;

  const PAGE = 20, MAX_NAME = 60, MAX_MSG = 500;
  let loading = false, sending = false, loaded = 0, hasMore = false, queue = false;

  /* ---------- status & state ---------- */
  function setStatus(text, kind, busy) {
    statusEl.className = 'wg-status' + (kind ? ' ' + kind : '');
    statusEl.replaceChildren();
    if (busy) {
      const sp = document.createElement('span');
      sp.className = 'spinner';
      sp.setAttribute('aria-hidden', 'true');
      statusEl.append(sp);
    }
    if (text) statusEl.append(document.createTextNode(text));
  }

  function listInfo(text) {
    if (countEl) countEl.textContent = text ? '· ' + text : '';
  }

  function note(text, extraClass) {
    const li = document.createElement('li');
    li.className = 'wg-note' + (extraClass ? ' ' + extraClass : '');
    li.textContent = text;
    return li;
  }

  function skeleton() {
    list.replaceChildren();
    for (let i = 0; i < 2; i++) {
      const li = note('', 'wg-skel');
      for (let j = 0; j < 3; j++) li.append(document.createElement('span'));
      list.append(li);
    }
  }

  function errorState() {
    const li = note('');
    li.append(document.createTextNode('Ucapan belum dapat dimuat. '));
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'copy';
    retry.textContent = 'Coba lagi';
    retry.addEventListener('click', () => load({ reset: true }));
    li.append(retry);
    return li;
  }

  /* ---------- kartu ucapan ---------- */
  function card(row) {
    const li = document.createElement('li');
    li.className = 'wish-card';

    const top = document.createElement('div');
    top.className = 'wish-card-top';
    const name = document.createElement('span');
    name.className = 'wish-card-name';
    name.textContent = String(row.name || '');
    const time = document.createElement('time');
    time.className = 'wish-card-time';
    const date = new Date(row.created_at);
    if (!isNaN(date)) {
      time.dateTime = date.toISOString();
      time.textContent = date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    }
    top.append(name, time);

    const body = document.createElement('p');
    body.className = 'wish-card-body';
    body.textContent = String(row.message || '');

    li.append(top, body);
    return li;
  }

  /* ---------- ambil data ---------- */
  async function load(opts) {
    const reset = !!(opts && opts.reset);
    if (loading) { queue = true; return; }
    loading = true;
    if (reset) { loaded = 0; hasMore = false; }
    list.setAttribute('aria-busy', 'true');
    const hadCards = !!list.querySelector('.wish-card');
    if (!hadCards) skeleton();
    listInfo('Memuat…');

    try {
      const { data, error } = await db
        .from('wedding_wishes')
        .select('id,name,message,created_at')
        .order('created_at', { ascending: false })
        .range(loaded, loaded + PAGE - 1);
      if (error) throw error;

      const rows = data || [];
      if (reset || !hadCards) list.replaceChildren();
      rows.forEach((row) => list.append(card(row)));
      loaded += rows.length;
      hasMore = rows.length === PAGE;
      if (moreBtn) moreBtn.hidden = !hasMore;

      if (!loaded) {
        list.replaceChildren(note('Belum ada ucapan. Jadilah yang pertama memberi doa ♡'));
        listInfo('belum ada ucapan');
      } else {
        listInfo(loaded + ' ucapan');
      }
      if (!sending) setStatus('');
    } catch (err) {
      if (!list.querySelector('.wish-card')) list.replaceChildren(errorState());
      if (moreBtn) moreBtn.hidden = true;
      listInfo('gagal dimuat');
    } finally {
      loading = false;
      list.setAttribute('aria-busy', 'false');
      if (queue) { queue = false; load({ reset: true }); }
    }
  }

  /* ---------- penghitung karakter ---------- */
  function counter(input, out, max) {
    if (!input || !out) return;
    const n = input.value.length;
    out.textContent = n + '/' + max;
    out.classList.toggle('is-near', n >= max * 0.9 && n <= max);
    out.classList.toggle('is-over', n > max);
  }
  function syncCounters() {
    counter(nameEl, nameCount, MAX_NAME);
    counter(msgEl, msgCount, MAX_MSG);
  }
  if (nameEl) nameEl.addEventListener('input', syncCounters);
  if (msgEl) msgEl.addEventListener('input', syncCounters);
  syncCounters();

  /* ---------- teks: rapikan spasi berlebih ---------- */
  const clean = (value) => String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  /* ---------- tanpa Supabase: berhenti dengan pesan jelas ---------- */
  if (!window.supabase) {
    setStatus('Buku tamu belum terhubung. Muat ulang halaman untuk mencoba lagi.', 'is-err');
    send.disabled = true;
    list.replaceChildren(note('Ucapan belum dapat dimuat saat ini.'));
    return;
  }

  const db = window.supabase.createClient(
    'https://vzfoxgxpifbypccpcacn.supabase.co',
    'sb_publishable_b99-gKJgxTZDU9Hm1d55Xg_mDH7ra6g',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  /* ---------- kirim ucapan ---------- */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;

    const name = clean(nameEl ? nameEl.value : '');
    const message = clean(msgEl ? msgEl.value : '');
    if (nameEl) nameEl.setAttribute('aria-invalid', 'false');
    if (msgEl) msgEl.setAttribute('aria-invalid', 'false');

    if (name.length < 2) {
      if (nameEl) { nameEl.setAttribute('aria-invalid', 'true'); nameEl.focus(); }
      setStatus('Nama wajib diisi, minimal 2 karakter.', 'is-err');
      return;
    }
    if (name.length > MAX_NAME) {
      if (nameEl) { nameEl.setAttribute('aria-invalid', 'true'); nameEl.focus(); }
      setStatus('Nama maksimal ' + MAX_NAME + ' karakter.', 'is-err');
      return;
    }
    if (message.length < 3) {
      if (msgEl) { msgEl.setAttribute('aria-invalid', 'true'); msgEl.focus(); }
      setStatus('Ucapan wajib diisi, minimal 3 karakter.', 'is-err');
      return;
    }
    if (message.length > MAX_MSG) {
      if (msgEl) { msgEl.setAttribute('aria-invalid', 'true'); msgEl.focus(); }
      setStatus('Ucapan maksimal ' + MAX_MSG + ' karakter.', 'is-err');
      return;
    }

    const tokenField = form.querySelector('[name="cf-turnstile-response"]');
    const token = tokenField ? tokenField.value : '';
    if (!token) {
      setStatus('Selesaikan verifikasi keamanan terlebih dahulu.', 'is-err');
      return;
    }

    sending = true;
    send.disabled = true;
    send.setAttribute('aria-busy', 'true');
    if (sendLabel) sendLabel.textContent = 'Mengirim…';
    setStatus('Mengirim ucapan…', '', true);

    try {
      const response = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message, token })
      });
      let result = {};
      try { result = await response.json(); } catch (_) { /* biarkan kosong */ }
      if (!response.ok) throw new Error(result.message || 'Ucapan belum tersimpan. Silakan coba lagi.');

      const okText = result.message || 'Terima kasih, ucapan Anda sudah tersimpan ♡';
      form.reset();
      syncCounters();
      await load({ reset: true });
      setStatus(okText, 'is-ok');
    } catch (error) {
      /* Isi form sengaja tidak dihapus agar bisa dikirim ulang. */
      setStatus(error && error.message ? error.message : 'Ucapan belum tersimpan. Periksa koneksi lalu coba lagi.', 'is-err');
    } finally {
      sending = false;
      send.disabled = false;
      send.removeAttribute('aria-busy');
      if (sendLabel) sendLabel.textContent = 'Kirim Ucapan';
      if (window.turnstileSetVerified) window.turnstileSetVerified(false);
      if (window.turnstile) window.turnstile.reset();
    }
  });

  /* ---------- kontrol daftar ---------- */
  if (moreBtn) moreBtn.addEventListener('click', () => load({ reset: false }));
  if (refreshBtn) refreshBtn.addEventListener('click', () => load({ reset: true }));

  /* ---------- sinkronisasi ---------- */
  db.channel('public-wishes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wedding_wishes' }, () => load({ reset: true }))
    .subscribe((state) => { if (state === 'SUBSCRIBED') load({ reset: true }); });
  window.addEventListener('online', () => load({ reset: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load({ reset: true }); });
  setInterval(() => { if (!document.hidden && !sending) load({ reset: true }); }, 30000);

  load({ reset: true });
})();
