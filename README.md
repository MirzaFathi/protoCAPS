# Kartu Kendaraan Digital — MVP (Q3.04)

Aplikasi web untuk keluar gerbang tanpa mencari STNK. Petugas mengarahkan kamera HP ke QR kartu mahasiswa; kartu yang valid langsung **LEWAT** tanpa menekan tombol. Petugas hanya menekan **Tahan** kalau motornya tidak cocok dengan pelat di layar.

| Halaman | Dipakai oleh | Isi |
| --- | --- | --- |
| `#mahasiswa` | Mahasiswa | Daftar motor; kartu QR langsung aktif dan berganti tiap 30 detik |
| `#petugas` | Petugas gerbang | Pemindai kamera otomatis, statistik waktu per motor |
| `#catatan` | Semua | Riwayat kendaraan lewat, % lewat otomatis, median detik per motor |

Tanpa konfigurasi Firebase, aplikasi berjalan dalam **mode demo lokal**: data hanya tersimpan di browser yang sama. Cocok untuk mencoba di satu laptop, tidak untuk demo antar-HP.

## Setup (sekitar 15 menit)

### 1. Firebase
1. Buka https://console.firebase.google.com, klik **Add project**, beri nama misalnya `kartu-kendaraan`. Google Analytics boleh dimatikan.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save**.
3. **Build → Firestore Database → Create database**. Pilih lokasi `asia-southeast2 (Jakarta)`, mode **production**.
4. Di tab **Rules**, hapus isinya, tempel isi file `firestore.rules`, lalu **Publish**.
5. **Project settings (ikon gerigi) → Your apps → ikon `</>` (Web)**. Beri nama app lalu **Register**. Salin objek `firebaseConfig` yang muncul.
5. Buka `firebase-config.js`, ganti `export const firebaseConfig = null;` dengan konfigurasi tadi.

### 2. GitHub Pages
1. Buat repository baru (public), misalnya `kartu-kendaraan`.
2. **Add file → Upload files**, lalu unggah `index.html`, `app.js`, `store.js`, `firebase-config.js`. **Commit**.
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → main / (root) → Save**.
4. Tunggu 1–2 menit. Alamatnya akan muncul: `https://<username>.github.io/kartu-kendaraan/`.

### 3. Sambungkan domain
Firebase Console → **Authentication → Settings → Authorized domains → Add domain** → `<username>.github.io`.

Buka alamat GitHub Pages. Kotak di atas akan menulis "Tersambung ke Firebase".

## Alur demo (2 HP)
1. **HP A (mahasiswa)**: `#mahasiswa` → daftar motor → kartu QR langsung aktif.
2. **HP B (petugas)**: `#petugas` → Mulai pindai → arahkan ke QR di HP A → hijau **LEWAT**, tanpa tombol.
3. Pindai lagi QR yang sama dari tangkapan layar → merah **Kode sudah dipakai**.
4. Tunggu lebih dari 1 menit, lalu pindai tangkapan layar lama → merah **Kode kedaluwarsa**.
5. Buka `#catatan` → semua kejadian tercatat dengan jeda antar motor.

Kamera hanya bisa dibuka lewat `https` (GitHub Pages sudah https).

## Keterbatasan MVP
- Pendaftaran langsung aktif tanpa verifikasi STNK: siapa pun bisa mendaftarkan pelat apa saja. Pengamannya: petugas melirik pelat di layar hijau, QR berganti dan sekali pakai. Kartu bisa dinonaktifkan pengelola lewat Firebase Console (ubah `status`).
- Belum ada login per peran.
- Kunci QR (`secret`) tersimpan di Firestore dan bisa dibaca pengguna yang masuk. Versi berikutnya perlu verifikasi di server (Cloud Functions).
- Data kendaraan diisi manual sambil menunggu akses MyITSParkir.

Jangan menaruh isi `firebase-config.js` di portofolio. Cukup tautan aplikasinya.
