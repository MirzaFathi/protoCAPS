// Lapisan data. Dua mode dengan API yang sama:
//  - Firebase (Firestore + Anonymous Auth) bila firebase-config.js berisi konfigurasi
//  - Demo lokal (localStorage, antar-tab lewat BroadcastChannel) bila belum
import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function openStore() {
  if (firebaseConfig && firebaseConfig.apiKey) {
    try { return await firebaseStore(firebaseConfig); }
    catch (e) { console.error(e); const s = localStore(); s.error = 'Firebase gagal tersambung: ' + e.message; return s; }
  }
  return localStore();
}

/* ---------- Firebase ---------- */
async function firebaseStore(cfg) {
  const { initializeApp } = await import(FB + 'firebase-app.js');
  const { getAuth, signInAnonymously } = await import(FB + 'firebase-auth.js');
  const F = await import(FB + 'firebase-firestore.js');
  const app = initializeApp(cfg);
  await signInAnonymously(getAuth(app));
  const db = F.getFirestore(app);
  const col = n => F.collection(db, n);
  const toObj = d => ({ id: d.id, ...d.data() });
  return {
    mode: 'firebase',
    async addVehicle(v) { const r = await F.addDoc(col('vehicles'), v); return r.id; },
    async plateTaken(key) {
      const s = await F.getDocs(F.query(col('vehicles'), F.where('plateKey', '==', key), F.limit(5)));
      return !s.empty;
    },
    async getVehicle(id) { const s = await F.getDoc(F.doc(db, 'vehicles', id)); return s.exists() ? toObj(s) : null; },
    watchVehicle(id, cb) { return F.onSnapshot(F.doc(db, 'vehicles', id), s => cb(s.exists() ? toObj(s) : null)); },
    watchVehicles(cb) { return F.onSnapshot(F.query(col('vehicles'), F.orderBy('createdAt', 'desc'), F.limit(200)), s => cb(s.docs.map(toObj))); },
    async setStatus(id, status) { await F.updateDoc(F.doc(db, 'vehicles', id), { status, reviewedAt: Date.now() }); },
    async claimUse(key) {
      const ref = F.doc(db, 'uses', key);
      return F.runTransaction(db, async t => { const s = await t.get(ref); if (s.exists()) return false; t.set(ref, { at: Date.now() }); return true; });
    },
    async addPass(p) { const r = await F.addDoc(col('passes'), p); return r.id; },
    async updatePass(id, f) { await F.updateDoc(F.doc(db, 'passes', id), f); },
    watchPasses(cb) { return F.onSnapshot(F.query(col('passes'), F.orderBy('at', 'desc'), F.limit(100)), s => cb(s.docs.map(toObj))); },
  };
}

/* ---------- Demo lokal ---------- */
function localStore() {
  const KEY = 'kkd-demo-db';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { vehicles: {}, uses: {}, passes: {} }; } catch (e) { return { vehicles: {}, uses: {}, passes: {} }; } };
  let mem = read();
  const subs = new Set();
  let bc = null; try { bc = new BroadcastChannel('kkd-demo'); bc.onmessage = () => { mem = read(); fire(); }; } catch (e) {}
  const fire = () => subs.forEach(f => f());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} if (bc) bc.postMessage(1); fire(); };
  const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const watch = fn => { const f = () => fn(); subs.add(f); setTimeout(f, 0); return () => subs.delete(f); };
  window.addEventListener('storage', e => { if (e.key === KEY) { mem = read(); fire(); } });
  return {
    mode: 'demo',
    async addVehicle(v) { const k = id(); mem.vehicles[k] = v; save(); return k; },
    async plateTaken(key) { return Object.values(mem.vehicles).some(v => v.plateKey === key); },
    async getVehicle(k) { const v = mem.vehicles[k]; return v ? { id: k, ...v } : null; },
    watchVehicle(k, cb) { return watch(() => { const v = mem.vehicles[k]; cb(v ? { id: k, ...v } : null); }); },
    watchVehicles(cb) { return watch(() => cb(Object.entries(mem.vehicles).map(([k, v]) => ({ id: k, ...v })).sort((a, b) => b.createdAt - a.createdAt))); },
    async setStatus(k, status) { if (mem.vehicles[k]) { mem.vehicles[k].status = status; mem.vehicles[k].reviewedAt = Date.now(); save(); } },
    async claimUse(key) { mem = read(); if (mem.uses[key]) return false; mem.uses[key] = { at: Date.now() }; save(); return true; },
    async addPass(p) { const k = id(); mem.passes[k] = p; save(); return k; },
    async updatePass(k, f) { if (mem.passes[k]) { Object.assign(mem.passes[k], f); save(); } },
    watchPasses(cb) { return watch(() => cb(Object.entries(mem.passes).map(([k, v]) => ({ id: k, ...v })).sort((a, b) => b.at - a.at).slice(0, 100))); },
    resetDemo() { mem = { vehicles: {}, uses: {}, passes: {} }; save(); },
  };
}
