# Referensi desain — Arus Dashboard

Folder ini berisi **referensi visual** dashboard. Isinya bukan kode produksi. Jangan disalin mentah dan jangan diedit. Bangun ulang dengan komponen React sesuai `../PLAN.md`.

| File | Halaman | Route produksi |
|---|---|---|
| `Main.dc.html` | Ringkasan Kota (KPI, **peta 3D three.js**, peringatan, grafik, hotspot) | `/` |
| `Kamera.dc.html` | Kamera Live (video beranotasi, keputusan Model A, timeline jendela) | `/kamera` |
| `Prediksi.dc.html` | Prediksi Sensor (sekarang / +1 jam / +3 jam, alasan, tindakan, kinerja) | `/prediksi/[sensorId]` |
| `Analitik.dc.html` | Analitik & Model (heatmap, tren 181 hari, 3 model, diagram Lambda) | `/analitik` |
| `tokens.css` | **Semua token warna tema gelap & terang**, siap disalin ke `web/styles/tokens.css` | — |
| `kamera_frame.jpg` | Frame dari `video_uji.mp4` yang dipakai di desain halaman Kamera | — |

Referensi aset di dalam file desain:

| Di dalam file | File aslinya |
|---|---|
| `/_blob/5d0eeb296ff9e2c28b9db1ca766831a9` | `kamera_frame.jpg` di folder ini |
| `/_blob/47495f910378b87ceba8b14f1203c142` | `three.min.js` r149. Di produksi pakai paket npm `three` |

## Dua tema dalam satu file

Setiap file `.dc.html` berisi **dua tema sekaligus**:

- **Gelap = default.**
- **Terang** muncul lewat tombol **"Mode terang / Mode gelap"** di sidebar, tepat di bawah menu.

Cara kerjanya sama persis dengan implementasi produksi yang diminta:

1. Elemen akar memakai `class="arus" data-theme="dark|light"`.
2. Semua warna di markup ditulis sebagai `var(--nama-token)`.
3. Di dalam `<helmet><style>` ada dua blok: `.arus { …gelap… }` dan `.arus[data-theme="light"] { …terang… }`. Isi kedua blok sama dengan `tokens.css`.
4. Bagian yang dihitung di JavaScript punya tabel per tema:
   - **Peta 3D:** konstanta `SCENE` dan `hexD`/`hex` di `Main.dc.html`.
   - **Heatmap:** `STOPS_D`/`STOPS_L` di `Analitik.dc.html`.
   - **Aksen:** `DARK_ACCENT`.

## Cara melihat

- **Tampilan visual:** buka kanvas desain "Arus" di claude.ai (tautannya ada di percakapan; hanya pemilik akun yang bisa membuka sampai dibagikan). Tekan tombol Play pada artboard untuk mencoba interaksi: toggle tema, horizon, 3D/2D, jendela kamera, dan pilihan detektor.
- **Offline:** file `.dc.html` butuh runtime kanvas (`support.js`), jadi kalau dibuka langsung di browser hasilnya tidak tampil benar. **Baca source-nya** untuk nilai pasti: warna, ukuran, jarak, teks, dan data contoh.

## Cara membaca source untuk implementasi

- `{{nama}}` = nilai dari `renderVals()` di blok `<script type="text/x-dc">` bagian bawah file.
- `<sc-for list=…>` = perulangan (`.map()` di React). `<sc-if value=…>` = kondisi (`&&` di React).
- Data contoh di desain (array `SENS`, `ALERTS`, `HOT`, `WINS`, `HEAT`, `DAILY`, `PERF`) berasal dari output notebook 01–04 (replay Rab, 7 Jun 2017 16:45). Di produksi semua data ini **diambil dari API**, bukan di-hardcode. Angkanya tetap berguna sebagai nilai uji (lihat PLAN §12).
- Teks UI berbahasa Indonesia. Pakai kalimatnya apa adanya.
