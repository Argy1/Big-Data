# Arus: pemantauan & prediksi kemacetan (Lambda Architecture)

Dashboard untuk *city planner*: kondisi lalu lintas **saat ini** dari 325 sensor jalan tol Bay Area, **prediksi 1 jam dan 3 jam** per sensor, dan **kamera** yang dianalisis real-time. Proyek Akhir Teknologi Big Data (D4 TRPL, Sekolah Vokasi IPB). Rencana lengkap ada di [PLAN.md](PLAN.md).

> **Status & progres lengkap** (yang sudah/belum, keputusan teknis, checklist presentasi, log perubahan): lihat [PROGRESS.md](PROGRESS.md).
>
> **Panduan langkah demi langkah untuk AI agent** (dan untuk yang baru pertama kali menjalankan proyek): lihat [../AGENTS.md](../AGENTS.md).

> **Mode replay.** Tidak ada sensor IoT live. Data Juni 2017 diputar ulang sebagai "sekarang" (default Rab, 7 Jun 2017 16:45). Badge **REPLAY** di dashboard menandai hal ini.

## Menjalankan

Prasyarat: Docker Desktop (WSL 2), Python 3.x (hanya untuk menyalin data). GPU NVIDIA opsional: tanpa GPU worker otomatis memakai CPU.

```bash
# 1. Salin data & model dari ../Output IPYNB dan ../Dataset ke data/ (sekali saja, ±500 MB, dicek MD5)
#    ../Dataset dan file besar di ../Output IPYNB TIDAK ada di GitHub: minta ke pemilik proyek.
python scripts/copy_data.py

# 2. Semua layanan: redis, api, worker, web
docker compose up --build
```

| Alamat | Isi |
|---|---|
| http://localhost:3001 | Dashboard, mode Docker (tema gelap default; tombol **Mode terang** di sidebar) |
| http://localhost:3000 | Dashboard, mode dev tanpa Docker (`pnpm dev`) |
| http://localhost:8000/docs | Dokumentasi API interaktif |
| http://localhost:8000/api/health | Status data, Redis, model, dan worker (perangkat GPU/CPU) |

Langkah verifikasi lengkap dan cara mengatasi masalah umum ada di [../AGENTS.md](../AGENTS.md) §3 dan §6.

Build pertama lama karena image worker berisi PyTorch + CUDA (±8,8 GB). Setelah itu `docker compose up` cukup beberapa detik.

### Worker di luar Docker (cadangan)

Kalau dukungan GPU di Docker bermasalah, jalankan worker langsung di Windows; redis/api/web tetap di Docker:

```bash
docker compose up -d --build redis api web
cd worker
uv sync                          # torch/torchvision dari index cu128 (wajib untuk RTX seri 50)
uv run python check_env.py       # cek CUDA, Model A, kedua detektor YOLO
uv run python -m speed_layer.main
```

Video unggahan dan SQLite ada di `appdata/` (folder biasa, dibaca API di Docker maupun worker di Windows).

## Arsitektur

```
        BATCH (selesai di Colab: notebook 01, 02, 04)              SPEED (worker, real-time)
PEMS-BAY ─► master Parquet ─► Spark batch views           video ─► 10 fps / 640 px ─► YOLOv8 + ByteTrack
                 └─► Model B (LightGBM) ─► forecasts_june       ─► fitur per jendela 5 dtk ─► Model A (RF)
                              │                                  ─► Redis: stream camera:{id}, frame:{id}
                              ▼                                              │
        SERVING  api (FastAPI) ◄─────────── DuckDB atas data/ ───────────────┘
                 · REST /api/*  · WebSocket /ws/live (tick replay + jendela kamera)  · MJPEG
                              │
                              ▼
                 web (Next.js 15): Ringkasan · Kamera · Prediksi · Analitik
```

| Lapisan | Folder | Isi |
|---|---|---|
| Batch | `data/` (salinan `Output IPYNB/`) | master dataset 16,9 jt baris, 4 batch view Spark, Model B + prediksi Juni |
| Speed | `worker/` | `speed_layer/features.py` = salinan persis `extract_features()` notebook 03; detektor dipilih otomatis per kamera |
| Serving | `backend/` | FastAPI + DuckDB (read-only atas Parquet/CSV), jam replay, SQLite (keputusan, kamera), penerus Redis → WebSocket |
| UI | `web/` | Next.js 15, Tailwind v4 + token tema, peta 3D three.js (React Three Fiber) + 2D MapLibre, ECharts |

Prinsip: batch view tidak pernah ditulis ulang; worker tidak bicara ke browser (semua lewat Redis lalu API); satu sumber logika level (`backend/app/levels.py` = `web/lib/levels.ts`, diuji dengan tabel kasus yang sama).

### Fakta domain

- Level = kecepatan / kecepatan arus bebas sensor: **Lancar** ≥ 0,8 · **Melambat** 0,6–0,8 · **Padat** 0,4–0,6 · **Macet** < 0,4.
- Kamera (Model A): light = Lancar, medium = Padat, heavy = Macet.
- Data mentah dalam mph, UI selalu km/jam. Waktu = waktu lokal California (tidak dikonversi ke WIB).
- Detektor fine-tuned (lalu lintas Asia Selatan) hampir buta di jalan tol Barat, jadi worker menguji kedua detektor pada 6 frame dan memakai yang mendeteksi lebih banyak (bisa diganti manual di halaman Kamera).

## API ringkas

Semua kecepatan km/jam. `ts` default = waktu replay.

- Replay: `GET/POST /api/replay` (`play` · `pause` · `seek` · `step`). Batas data 1 Jun 00:00 – 30 Jun 22:45 (origin terakhir di `forecasts_june.parquet`).
- Jaringan: `/api/network/snapshot`, `/api/network/series`, `/api/alerts` (urut penurunan kecepatan, lalu `sensor_id`).
- Sensor: `/api/meta/sensors`, `/api/sensors/{id}`, `/api/sensors/{id}/series`.
- Analitik & model: `/api/analytics/{summary,heatmap,daily,hotspots}`, `/api/models/metrics`.
- Keputusan: `GET/POST /api/decisions` (SQLite; `created_at` dalam UTC, `ts` = waktu replay).
- Kamera: `GET /api/cameras`, `/timeline`, `/stream.mjpg`, `POST /{id}/detector`, `POST /api/cameras` (unggah .mp4 ≤ 300 MB), `DELETE /{id}`.
- WebSocket `ws://localhost:8000/ws/live`: `{"type":"tick"}` saat waktu replay berubah, `{"type":"replay"}` saat play/jeda, `{"type":"camera"}` tiap jendela 2,5 dtk.

## Test

```bash
cd backend && uv run pytest     # 66 test: angka PLAN §12, replay + WebSocket, kamera (fake Redis)
cd worker  && uv run pytest     # fitur vs ucsd_features.csv (3 klip UCSD) + video_uji.mp4, di CPU
cd web     && pnpm test         # Vitest: levels.ts (tabel kasus = levels.py), format id-ID, ramp heatmap
cd web     && pnpm e2e          # Playwright (stack harus jalan): alur demo, tema, aria, 390 px,
                                # screenshot 4 halaman × 2 tema + axe WCAG 2.1 AA
cd web     && pnpm lighthouse   # skor aksesibilitas Lighthouse, kedua tema (target ≥ 90)
```

`pnpm e2e` dan `pnpm lighthouse` default ke `http://localhost:3000`. Untuk stack Docker, set `E2E_BASE_URL=http://localhost:3001`. Setelah `pnpm e2e`, jalankan `python scripts/reset_demo.py`.

Screenshot hasil E2E tersimpan di `web/tests/e2e/__screenshots__/`.

## Skenario demo (±5 menit)

1. **Ringkasan** (tema gelap), Rab 16:45: 89 sensor padat/macet. Putar peta 3D (drag), lalu klik **+1 jam**: kolom merah menjulang, 117 sensor. *"Inilah gunanya prediksi."*
2. Klik peringatan **Airport Blvd** → halaman Prediksi: sekarang 99 km/jam, 1 jam lagi 46 km/jam. Jelaskan `dev_now` dan profil normal Rabu 17:00 (48,6 km/jam). Centang tindakan → **Catat keputusan** (toast muncul).
3. **Kamera Live**: video berjalan, Model A menyatakan **Macet**. Tunjukkan fitur vs median kelas. Ganti detektor ke **Fine-tuned** untuk menjelaskan domain shift (deteksi turun ke ±1–2/frame), lalu kembali ke **Otomatis**. Klik **Unggah video** dan pilih `data/video/extra/14025968_2160_3840_29fps.mp4` (4K potret): kamera baru muncul dan berjalan dalam beberapa detik.
4. **Analitik**: heatmap jam sibuk (puncak Kamis 17:00, 33,1%), pola gigi gergaji 181 hari, kartu 3 model, diagram Lambda.
5. Tekan **Mode terang** (cocok untuk proyektor), kembali ke Ringkasan, tekan **Putar**: tiap 5 detik maju 15 menit; sekitar 19:45 kemacetan mereda seperti prediksi +3 jam.

**Reset sebelum demo** (wajib setelah menjalankan `pnpm e2e`, karena test alur demo mencatat keputusan sungguhan):

```bash
python scripts/reset_demo.py    # hapus keputusan & kamera unggahan, replay dijeda di Rab 16:45
```

Semua service memakai `restart: unless-stopped`, jadi setelah Docker Desktop atau laptop restart stack hidup lagi sendiri. Cukup tunggu ±30 detik, lalu cek http://localhost:8000/api/health.

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| Banner merah "Tidak terhubung ke API" | API belum jalan: `docker compose up`, lalu cek http://localhost:8000/api/health |
| `/api/health` → `data_ok: false` | `data/` belum disalin: `python scripts/copy_data.py` |
| Halaman Kamera "HASIL ACUAN" | Worker belum jalan; CAM-01 menampilkan hasil notebook 03. Cek `docker compose logs worker` |
| Chip perangkat `CPU`, padahal ada GPU | Docker Desktop belum mengekspos GPU: perbarui driver NVIDIA Windows, atau jalankan worker di luar Docker |
| Peta 2D tampil skematis (tanpa jalan) | Basemap CARTO butuh internet; peta skematis dan 3D tetap jalan offline |

## Versi library (harus sama dengan Colab)

| Paket | Versi | Sumber |
|---|---|---|
| scikit-learn | 1.6.1 | `_sklearn_version` di dalam `model_a.joblib` |
| ultralytics | 8.4.191 | metadata `version` di `yolov8s_traffic7.pt` |
| lightgbm | 4.6.0 | struktur pickle `model_b_*.joblib` cocok dengan 4.5/4.6 (bukan 4.7) |
| torch | ≥ 2.7, wheel `cu128` | wajib untuk GPU Blackwell (RTX 50xx) |

## Atribusi & lisensi

- **PEMS-BAY**: Caltrans Performance Measurement System (PeMS), via DCRNN / Zenodo.
- **UCSD Traffic Video Database**: A. B. Chan & N. Vasconcelos; video WSDOT.
- **Roboflow "Traffic Congestion Detection"**: CC BY 4.0.
- **Ultralytics YOLOv8**: AGPL-3.0 (penggunaan akademik).
- **Open-Meteo**: data cuaca, CC BY 4.0.
- **Peta**: © CARTO, © OpenStreetMap contributors.
- **Video uji**: Pexels.
