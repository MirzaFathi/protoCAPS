import { openStore } from './store.js';

const $ = id => document.getElementById(id);
const WIN = 30000;                       // QR berganti tiap 30 detik
const PLATE_RE = /^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plateKey = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
const canonPlate = s => { const m = plateKey(s).match(PLATE_RE); return m ? [m[1], m[2], m[3]].filter(Boolean).join(' ') : null; };
const show = (el, msg) => { el.textContent = msg || ''; el.hidden = !msg; };
const win = (t = Date.now()) => Math.floor(t / WIN);
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmtSec = ms => ms == null ? '–' : (ms / 1000).toFixed(1).replace('.', ',');
const fmtTime = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

/* ---------- tanda tangan kode QR (HMAC-SHA256) ---------- */
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const keyCache = new Map();
async function hmac(secretHex, msg) {
  let k = keyCache.get(secretHex);
  if (!k) { k = await crypto.subtle.importKey('raw', unhex(secretHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); keyCache.set(secretHex, k); }
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))).slice(0, 16);
}
const payload = async (vid, secret, w) => `KKD1:${vid}:${w}:${await hmac(secret, vid + ':' + w)}`;

let store, view = '';

/* ---------- routing ---------- */
const VIEWS = ['beranda', 'mahasiswa', 'petugas', 'catatan'];
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'beranda';
  if (v === view) return;
  if (view === 'petugas') stopCamera();
  view = v;
  document.querySelectorAll('section[data-view]').forEach(s => s.hidden = s.dataset.view !== v);
  document.querySelectorAll('nav a').forEach(a => { if (a.hash === '#' + v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}

/* ---------- MAHASISWA ---------- */
let cardUnsub = null, qrTimer = null, lastWin = -1;
function drawQR(canvas, text) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), q = 4, s = canvas.width, cell = s / (n + q * 2), x = canvas.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect(Math.floor((c + q) * cell), Math.floor((r + q) * cell), Math.ceil(cell), Math.ceil(cell));
}
function renderStudent() {
  const card = LS.get('kkd-card');
  if (cardUnsub) { cardUnsub(); cardUnsub = null; }
  clearInterval(qrTimer); lastWin = -1;
  $('m-form').hidden = !!card; $('m-card').hidden = !card;
  if (!card) return;
  cardUnsub = store.watchVehicle(card.vid, v => {
    if (!v) { $('m-status').innerHTML = '<span class="tag t-no">Data tidak ditemukan</span>'; $('m-qrwrap').hidden = true; return; }
    $('m-plate').textContent = v.plate; $('m-meta').textContent = v.brand + ' · ' + v.color;
    const st = v.status === 'verified' ? ['t-ok', 'Aktif: tunjukkan QR ke petugas'] : ['t-no', 'Kartu dinonaktifkan pengelola'];
    $('m-status').innerHTML = `<span class="tag ${st[0]}">${esc(st[1])}</span>`;
    const active = v.status === 'verified';
    $('m-qrwrap').hidden = !active;
    clearInterval(qrTimer);
    if (active) { const tick = async () => { const now = Date.now(), w = win(now); const left = WIN - (now % WIN);
        $('m-sec').textContent = Math.ceil(left / 1000); $('m-bar').style.width = (left / WIN * 100) + '%';
        if (w !== lastWin) { lastWin = w; drawQR($('m-qr'), await payload(card.vid, card.secret, w)); } };
      tick(); qrTimer = setInterval(tick, 1000); }
  });
}
$('reg').addEventListener('submit', async e => {
  e.preventDefault(); const err = $('m-err'); show(err, '');
  const raw = $('f-plate').value, brand = $('f-brand').value.trim(), color = $('f-color').value.trim();
  if (!raw.trim() || !brand || !color) return show(err, 'Isi nomor pelat, merek, dan warna.');
  const plate = canonPlate(raw); if (!plate) return show(err, 'Format pelat tidak dikenali. Contoh: L 1234 AB.');
  $('m-submit').disabled = true;
  try {
    if (await store.plateTaken(plateKey(plate))) return show(err, `Pelat ${plate} sudah terdaftar.`);
    const secret = hex(crypto.getRandomValues(new Uint8Array(16)));
    const vid = await store.addVehicle({ plate, plateKey: plateKey(plate), brand, color, status: 'verified', secret, createdAt: Date.now() });
    LS.set('kkd-card', { vid, secret }); $('reg').reset(); renderStudent();
  } catch (x) { show(err, 'Gagal menyimpan: ' + x.message); }
  finally { $('m-submit').disabled = false; }
});
$('m-forget').addEventListener('click', () => { LS.del('kkd-card'); renderStudent(); });

/* ---------- PETUGAS ---------- */
let stream = null, raf = 0, busy = false, vehicles = new Map();
let session = { ok: 0, man: 0, gaps: [], lastAt: 0, lastPass: null, seen: new Map() };
const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });

async function startCamera() {
  show($('p-err'), '');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
    const v = $('p-video'); v.srcObject = stream; await v.play();
    $('p-start').textContent = 'Hentikan pindai'; $('p-hint').textContent = 'Arahkan QR ke dalam bingkai';
    session.lastAt = 0; loop();
  } catch (x) { show($('p-err'), 'Kamera tidak bisa dibuka (' + x.name + '). Izinkan akses kamera dan buka aplikasi lewat https.'); }
}
function stopCamera() { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; $('p-start').textContent = 'Mulai pindai'; $('p-hint').textContent = 'Kamera belum aktif'; }
$('p-start').addEventListener('click', () => stream ? stopCamera() : startCamera());

function loop() {
  raf = requestAnimationFrame(loop);
  const v = $('p-video'); if (busy || v.readyState < 2) return;
  const W = 480, H = Math.round(v.videoHeight / v.videoWidth * W) || 640;
  canvas.width = W; canvas.height = H; ctx.drawImage(v, 0, 0, W, H);
  const r = jsQR(ctx.getImageData(0, 0, W, H).data, W, H, { inversionAttempts: 'dontInvert' });
  if (r && r.data) {
    const t = performance.now(), prev = session.seen.get(r.data);
    if (prev && t - prev < 6000) return;            // QR yang sama masih di depan kamera
    session.seen.set(r.data, t); decide(r.data, t);
  }
}

async function check(data) {
  const m = /^KKD1:([A-Za-z0-9]{6,40}):(\d+):([0-9a-f]{16})$/.exec(data);
  if (!m) return { ok: false, reason: 'QR bukan kartu kendaraan' };
  const [, vid, wStr, sig] = m, w = +wStr, now = win();
  const v = vehicles.get(vid) || await store.getVehicle(vid);
  if (!v) return { ok: false, reason: 'Kendaraan tidak terdaftar' };
  const base = { vid, plate: v.plate, brand: v.brand, color: v.color };
  if (v.status !== 'verified') return { ...base, ok: false, reason: 'Kartu dinonaktifkan' };
  if (w < now - 1 || w > now + 1) return { ...base, ok: false, reason: 'Kode kedaluwarsa (kemungkinan tangkapan layar)' };
  if (await hmac(v.secret, vid + ':' + w) !== sig) return { ...base, ok: false, reason: 'Kode tidak sah' };
  if (!await store.claimUse(vid + '_' + w)) return { ...base, ok: false, reason: 'Kode sudah dipakai' };
  return { ...base, ok: true };
}

async function decide(data, tDetect) {
  busy = true;
  const res = await check(data).catch(x => ({ ok: false, reason: 'Gagal memeriksa: ' + x.message }));
  const now = Date.now(), gap = session.lastAt ? now - session.lastAt : null;
  session.lastAt = now; if (gap != null) session.gaps.push(gap);
  const rec = { at: now, vehicleId: res.vid || null, plate: res.plate || '—', result: res.ok ? 'lewat' : 'cek-stnk', reason: res.ok ? '' : res.reason, gapMs: gap, decideMs: Math.round(performance.now() - tDetect) };
  const pid = await store.addPass(rec).catch(() => null);
  const box = $('p-verdict');
  if (res.ok) {
    session.ok++; session.lastPass = pid; $('p-hold').disabled = !pid;
    box.className = 'verdict ok show';
    box.innerHTML = `<b>LEWAT</b><div class="plate">${esc(res.plate)}</div><p>${esc(res.brand)} · ${esc(res.color)}</p>`;
    setTimeout(() => { box.className = 'verdict'; busy = false; }, 1600);
  } else {
    session.man++;
    box.className = 'verdict no show';
    box.innerHTML = `<b>CEK STNK</b>${res.plate ? `<div class="plate">${esc(res.plate)}</div>` : ''}<p>${esc(res.reason)}</p>
      <div class="row"><button class="good" data-r="lewat-manual">Sesuai STNK, lewat</button><button class="ghost" style="color:#fff;border-color:#fff" data-r="ditahan">Tahan</button></div>`;
    box.querySelectorAll('button').forEach(b => b.onclick = async () => { if (pid) await store.updatePass(pid, { result: b.dataset.r }); box.className = 'verdict'; busy = false; });
  }
  renderSession();
}
function renderSession() { $('s-ok').textContent = session.ok; $('s-man').textContent = session.man; $('s-gap').textContent = fmtSec(median(session.gaps)); }
$('p-hold').addEventListener('click', async () => { if (!session.lastPass) return; await store.updatePass(session.lastPass, { result: 'ditahan', reason: 'Motor tidak cocok dengan pelat' }); session.lastPass = null; $('p-hold').disabled = true; session.ok--; session.man++; renderSession(); });
$('p-nocard').addEventListener('click', async () => {
  const now = Date.now(), gap = session.lastAt ? now - session.lastAt : null; session.lastAt = now; if (gap != null) session.gaps.push(gap);
  await store.addPass({ at: now, vehicleId: null, plate: '—', result: 'lewat-manual', reason: 'Tanpa kartu, cek STNK', gapMs: gap, decideMs: null }); session.man++; renderSession();
});

/* ---------- CATATAN ---------- */
const RES = { 'lewat': ['Lewat otomatis', 't-ok'], 'lewat-manual': ['Lewat, cek STNK', 't-wait'], 'cek-stnk': ['Cek STNK', 't-wait'], 'ditahan': ['Ditahan', 't-no'] };
function renderLog(passes) {
  $('c-total').textContent = passes.length;
  const auto = passes.filter(p => p.result === 'lewat').length;
  $('c-auto').textContent = passes.length ? Math.round(auto / passes.length * 100) + '%' : '–';
  $('c-gap').textContent = fmtSec(median(passes.map(p => p.gapMs).filter(g => g != null && g < 120000)));
  $('c-rows').innerHTML = passes.map(p => { const r = RES[p.result] || [p.result, 't-wait'];
    return `<tr><td>${fmtTime(p.at)}</td><td class="m">${esc(p.plate)}</td><td><span class="tag ${r[1]}">${r[0]}</span>${p.reason ? `<div class="muted" style="font-size:12px">${esc(p.reason)}</div>` : ''}</td><td class="n">${p.gapMs != null ? fmtSec(p.gapMs) + ' d' : '–'}</td></tr>`; }).join('')
    || '<tr><td colspan="4" class="muted">Belum ada kendaraan yang dipindai.</td></tr>';
}

/* ---------- start ---------- */
(async () => {
  route(); window.addEventListener('hashchange', route);
  store = await openStore();
  const mode = $('mode');
  if (store.mode === 'firebase') mode.textContent = 'Tersambung ke Firebase. Data tersimpan di server dan terlihat di semua HP.';
  else { mode.textContent = store.error || 'Mode demo lokal: data hanya tersimpan di browser ini. Isi firebase-config.js untuk dipakai bersama.'; mode.className = 'warn'; $('c-reset').hidden = false; $('c-reset').onclick = () => store.resetDemo(); }
  store.watchVehicles(list => { vehicles = new Map(list.map(v => [v.id, v])); });
  store.watchPasses(renderLog);
  renderStudent();
})();
