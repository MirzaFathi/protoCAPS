# Kartu Kendaraan Digital — konteks proyek

MVP tugas SI Capstone (Q3.04). Aplikasi web statis tanpa build step: `index.html`, `app.js`, `store.js` (ES module), `firebase-config.js`, `firestore.rules`. Detail fitur dan alur demo ada di README.md.

## Cara kerja singkat
- `#mahasiswa`: daftar motor → kartu QR langsung aktif. QR berisi `KKD1:<vehicleId>:<jendela30detik>:<HMAC>` dan berganti tiap 30 detik.
- `#petugas`: kamera membaca QR terus-menerus (jsQR). Kartu sah → LEWAT otomatis; selain itu → CEK STNK. Kode hanya bisa dipakai sekali (koleksi `uses`).
- `#catatan`: riwayat dan median detik per motor.
- `store.js` memakai Firestore + Anonymous Auth bila `firebase-config.js` berisi konfigurasi; jika `null`, berjalan dalam mode demo lokal (localStorage).

## Tugas setup yang diminta pemilik
1. Firebase: buat project (atau pakai yang ada) dengan Firebase CLI (`npx firebase-tools`), aktifkan Firestore (lokasi `asia-southeast2`), deploy `firestore.rules`, buat Web App, tulis konfigurasinya ke `firebase-config.js`. Anonymous Auth harus diaktifkan di Console (Authentication → Sign-in method) — CLI tidak bisa; minta pemilik melakukannya bila perlu.
2. GitHub Pages: buat repo public dengan `gh`, push file, aktifkan Pages dari branch `main` root, laporkan URL-nya.
3. Tambahkan `<username>.github.io` ke Firebase Authentication → Authorized domains (Console).
4. Buka URL dan pastikan kotak status menulis "Tersambung ke Firebase".

## Aturan
- Jangan ubah perilaku inti (lewat otomatis, QR berganti 30 detik, sekali pakai) tanpa bertanya.
- Jangan commit kredensial lain selain konfigurasi web Firebase (memang publik).
- Tanyakan dulu sebelum login, membuat project berbayar, atau mengubah repo yang sudah ada.
