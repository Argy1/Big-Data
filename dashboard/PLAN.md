# Arus — Rencana Implementasi Dashboard (handoff untuk Claude Code)

> **Cara pakai:**
> - Buka folder `Projek Akhir/` (atau `Projek Akhir/dashboard/`) di Claude Code, lalu minta:
>   *"Baca CLAUDE.md dan dashboard/PLAN.md. Kerjakan Fase 0 saja, lalu berhenti dan laporkan."*
> - Kerjakan **satu fase per sesi**. Setiap fase punya kriteria selesai (✔) yang bisa dicek. Fase belum selesai sebelum semua kriterianya lolos.
> - Konteks proyek dan isi semua folder ada di `../CLAUDE.md`. Baca itu dulu.

**Daftar isi**
1. Tujuan & scope
2. Halaman & fitur (rinci per komponen)
3. Tech stack
4. Arsitektur
5. Struktur folder
6. Data & model
7. Aturan domain
8. Kontrak API & speed layer
9. **Sistem tema (gelap default + terang)**
10. Design system & komponen
11. **Peta 3D (three.js)**
12. Angka uji (acceptance numbers)
13. Fase pengerjaan
14. Strategi testing
15. Risiko & hal yang sengaja tidak dibuat
16. Skenario demo

---

## 1. Tujuan & scope

**Masalah:** city planner butuh tahu **di mana macet sekarang** dan **di mana akan macet sebentar lagi**, supaya bisa bertindak sebelum kemacetan terjadi.

**Solusi:** dashboard web "Arus" yang menggabungkan tiga lapisan **Lambda Architecture**:

| Lapisan | Sumber | Model | Keluaran di dashboard |
|---|---|---|---|
| **Batch** | PEMS-BAY, 325 sensor × 5 menit × 181 hari (16,9 jt baris) | Spark batch views + **Model B (LightGBM)** | Profil historis, hotspot, heatmap, prediksi +1 jam & +3 jam |
| **Speed** | Video CCTV (`Dataset/*.mp4`) | YOLOv8 + ByteTrack + **Model A (Random Forest)** | Level kemacetan kamera tiap 2,5 detik |
| **Serving** | Gabungan keduanya | — | FastAPI (REST + WebSocket) → Next.js |

### Masuk scope (wajib)
- 4 halaman sesuai desain: Ringkasan Kota, Kamera Live, Prediksi Sensor, Analitik & Model.
- **Tema gelap sebagai default + tema terang**, dengan toggle yang tersimpan (§9).
- **Peta 3D three.js** sebagai tampilan peta default, plus toggle 2D (§11).
- Mode **replay** data Juni 2017 dengan kontrol play/pause/maju/mundur.
- Worker speed layer yang benar-benar memproses video uji dan mengirim hasil lewat WebSocket.
- Upload video baru, yang membuat kamera baru.
- Log keputusan "Catat keputusan" ke SQLite.
- Docker Compose satu perintah, README, test otomatis.

### Di luar scope
- Sensor IoT live sungguhan (diganti replay, dan ini ditulis jujur di UI).
- Login/otentikasi multi-user.
- Retraining model dari dashboard.
- Deploy ke cloud (opsional; boleh disebut di laporan).

---

## 2. Halaman & fitur

Semua halaman memakai **layout sama**:
- **Sidebar kiri** (lebar 232 px, menumpuk di atas pada layar < 900 px). Isinya:
  - logo "Arus" + subjudul "Traffic Ops · Lambda";
  - 4 menu dengan ikon (yang aktif memakai `aria-current="page"`);
  - **tombol "Mode terang / Mode gelap"** dengan ikon matahari/bulan;
  - kotak info kecil (status pipeline di halaman Ringkasan, legenda ambang level di halaman Prediksi);
  - teks atribusi data.
- **Konten kanan:** `padding 28px clamp(16px,3vw,40px) 48px`, kolom flex dengan gap 24 px.
- **Header halaman:**
  - eyebrow uppercase 12/700, H1 30/800;
  - di kanan ada kontrol halaman (replay, pencarian, pilih sensor, upload).

### 2.1 Ringkasan Kota: `/` (desain `Main.dc.html`)

| Komponen | Isi & perilaku | Sumber data |
|---|---|---|
| **ReplayControl** (header) | Badge "● REPLAY", waktu replay (`Rab, 7 Jun 2017 · 16:45`), tombol Mundur 15 mnt / Play-Jeda / Maju 15 mnt | `GET/POST /api/replay`, WS `tick` |
| **SensorSearch** (header) | Input cari nama sensor/ruas. Hasil dropdown, klik membuka `/prediksi/[id]` | `/api/meta/sensors` (filter di client) |
| **KpiCard ×4** | 1) Kecepatan rata-rata jaringan **83,1 km/jam** + selisih vs normal · 2) Sensor padat/macet sekarang **89** · 3) Prediksi padat/macet +1 jam **117** (naik/turun) · 4) Kamera aktif · Model A (level kamera terakhir) | `/api/network/snapshot`, WS `camera` |
| **SensorMap** | Judul "Peta kondisi 325 sensor". Toggle horizon **Sekarang / +1 jam / +3 jam** (`aria-pressed`). Toggle tampilan **3D / 2D**. Legenda level + jumlah sensor. Caption "Kondisi aktual pukul 16:45" / "Prediksi Model B untuk pukul 17:45". Detail di §11 | `snapshot.sensors`, `snapshot.counts` |
| **AlertList** "Peringatan dini · 1 jam" | Maksimal 6 sensor yang **sekarang Lancar/Melambat** tetapi **+1 jam Padat/Macet**. Tiap baris berisi nama, fwy, kecepatan sekarang → prediksi, dan chip level. Klik membuka halaman Prediksi | `/api/alerts?horizon=1h&limit=6` |
| **LevelDistribution** | 3 bar bertumpuk (Sekarang / +1 jam / +3 jam) berisi proporsi 4 level dari 325 sensor + jumlah padat/macet | `snapshot.counts` |
| **NetworkChart** "Kecepatan rata-rata jaringan hari ini" | Garis aktual (sampai "SEKARANG"), prediksi 1 jam, prediksi 3 jam (putus-putus), profil normal (dash abu). Garis vertikal merah "SEKARANG 16:45". Sumbu Y km/jam, X jam 00–24 | `/api/network/series?date=` |
| **HotspotTable** "Hotspot kemacetan historis" | 8 sensor dengan % waktu padat/macet tertinggi (Jan–Jun), bar kecil, % macet berat, kecepatan rata-rata | `/api/analytics/hotspots?limit=8` |
| **CameraCard** "Kamera uji · Speed layer" | Thumbnail stream, level Model A terakhir, tautan "Buka halaman kamera →" | `/api/cameras`, WS `camera` |

### 2.2 Kamera Live: `/kamera` (desain `Kamera.dc.html`)

| Komponen | Isi & perilaku | Sumber |
|---|---|---|
| Header | Judul "Kamera live", pilih kamera (dropdown), tombol **Upload video** (aksen) | `/api/cameras`, `POST /api/cameras` |
| **VideoPanel** | Stream MJPEG beranotasi (kotak + ID ByteTrack). Overlay area di luar ROI (35% atas, gelap 50%) + label "Di luar ROI · objek terlalu kecil". Garis hitung di y = 0,70. Chip "jendela 00:15–00:20". Badge level di pojok. **Overlay selalu gelap + teks putih di kedua tema** | `/api/cameras/{id}/stream.mjpg` |
| **DecisionPanel** "Keputusan Model A" | Level besar (LANCAR/PADAT/MACET) berlatar warna level dengan teks `--on-solid`, keyakinan (%), 3 bar probabilitas, deteksi/frame, arus kendaraan/menit | WS `camera` |
| **WindowTimeline** "Jendela waktu" | Tombol per jendela 5 dtk (geser 2,5 dtk), berwarna sesuai level. Klik untuk memilih jendela (yang terpilih diberi border tebal). Jendela baru muncul live | `/api/cameras/{id}/timeline` + WS |
| **FeatureBars** "Fitur lalu lintas" | 3 fitur utama: kecepatan median (panjang kendaraan/detik), kendaraan hampir berhenti (%), okupansi (%). Nilai jendela + **penanda median tiap kelas** (Lancar/Padat/Macet) dari data training | WS `camera` + `model_a_config` + median kelas (§6) |
| **DetectorPicker** "Detektor kendaraan" | Segmen **Otomatis / COCO / Fine-tuned** + penjelasan kenapa detektor itu dipilih (teks sama dengan desain) | `POST /api/cameras/{id}/detector` |
| **PipelineSteps** | 6 langkah: Video 10 fps → YOLOv8 → ByteTrack → Fitur per jendela → Model A → Dashboard | statis |

### 2.3 Prediksi Sensor: `/prediksi/[sensorId]` (desain `Prediksi.dc.html`)

| Komponen | Isi & perilaku | Sumber |
|---|---|---|
| Header | Eyebrow "Model B · prediksi per sensor", H1 nama + fwy, info mono (sensor #, lajur, v_ff, waktu replay). Select pilih sensor, tombol "Lihat di peta" | `/api/sensors/{id}` |
| **ForecastCards ×3** | Sekarang 16:45 / +1 jam 17:45 / +3 jam 19:45: kecepatan km/jam, chip level, rasio. Kartu ≥ Padat memakai `--warn-bg`/`--warn-line` | `/api/sensors/{id}?ts=` |
| **SensorChart** | 4 pita zona level (Lancar/Melambat/Padat/Macet, opasitas 7–10%), garis v_ff, profil normal hari itu, aktual, prediksi 1 jam, prediksi 3 jam. Toggle **1 jam / 3 jam / Keduanya**. Label "SEKARANG" dan label nilai prediksi | `/api/sensors/{id}/series` |
| **ReasonPanel** "Kenapa diprediksi padat?" | Kalimat penjelasan (profil normal di jam target) + 5 fitur terpenting (gain) **diambil dinamis dari `importance_1h`** (saat ini: `dev_now`, `prof_target`, `hour_target`, `v_yesterday`, `ratio_now`), dengan deskripsi Indonesia | `model_b_config.json` + importance (§6) |
| **ActionPanel** "Tindakan yang disarankan" | Muncul bila level +1 jam ≥ Padat. 3 checkbox (peringatan petugas, pesan VMS `[LOKASI VMS]`, tinjau siklus lampu `[NAMA SIMPANG]`), tombol **Catat keputusan** → toast sukses | `POST /api/decisions` |
| **PerfTable** "Seberapa bisa dipercaya? Uji Juni 2017" | 6 baris (1 jam & 3 jam × Persistence / Profil historis / Model B): MAE km/jam, Macro-F1, Recall & Precision macet. Baris Model B memakai `--row-hl` | `/api/models/metrics` |

### 2.4 Analitik & Model: `/analitik` (desain `Analitik.dc.html`)

| Komponen | Isi | Sumber |
|---|---|---|
| **StatCards ×4** | 16,9 jt pembacaan · 181 hari · 5,1% pembacaan padat/macet · 28 MB master dataset | `/api/analytics/summary` |
| **Heatmap** hari × jam | 7 × 24 sel `% padat/macet`. Ramp berbeda per tema (§9.5). Tooltip "Kam 17:00 · 33,1%". Kalimat puncak | `/api/analytics/heatmap` |
| **DailyTrend** | 181 batang `% padat/macet per hari` (pola gigi gergaji), label bulan. Teks libur nasional AS | `/api/analytics/daily` |
| **ModelCards ×3** | YOLOv8s fine-tuned (mAP50 0,879, recall 0,800) · Model A RF (akurasi 94,5%, Macro-F1 0,910) · Model B LightGBM (MAE 1 jam 3,21 km/j, recall macet 0,701). Garis atas berwarna per model | `/api/models/metrics` (**bukan hardcode**) |
| **LambdaDiagram** | 3 baris (BATCH / SPEED / SERVING) × 4 langkah dengan panah | statis |

---

## 3. Tech stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Frontend | **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict) | routing per halaman, ekosistem yang dikuasai |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix) | token sebagai CSS variables (§9), komponen aksesibel |
| **Tema** | **`next-themes`** (`attribute="data-theme"`, `defaultTheme="dark"`) | toggle tanpa kedip (FOUC), tersimpan di `localStorage` |
| Peta 3D (default) | **three.js** + **React Three Fiber** (`@react-three/fiber`) + **drei** | 325 kolom dalam satu `InstancedMesh` (§11) |
| Peta 2D (toggle) | **MapLibre GL JS** via `react-map-gl/maplibre` | gratis, tanpa API key. Basemap **CARTO Dark Matter** (gelap) / **Positron** (terang). Fallback offline: peta skematis titik |
| Grafik | **Apache ECharts** (`echarts-for-react`) | line, heatmap, dan bar dalam satu library; tema bisa diganti saat runtime |
| Data fetching | **TanStack Query v5** | cache, refetch saat tick replay |
| State UI | **Zustand** | horizon peta, mode 3D/2D, jendela kamera terpilih |
| Realtime | WebSocket native + hook `useLiveSocket` | tick replay, hasil kamera |
| Toast | `sonner` (bawaan shadcn) | konfirmasi "Catat keputusan" |
| Font | `next/font/google`: **Plus Jakarta Sans** (400–800) + **JetBrains Mono** (400–600) | sesuai desain |
| Backend | **Python 3.13 + FastAPI** + Uvicorn + Pydantic v2 | sama dengan Python di Colab; model joblib/LightGBM/YOLO dimuat langsung |
| Query batch | **DuckDB** (read-only atas Parquet/CSV) | tanpa ETL ulang |
| Event bus | **Redis 7** (Streams + Pub/Sub) | speed → serving. Di laporan, sebut Kafka/Redpanda sebagai opsi skala produksi |
| Data aplikasi | **SQLite** via SQLModel | log keputusan, daftar kamera |
| Speed worker | **OpenCV**, **Ultralytics YOLOv8**, **ByteTrack** (`lap`), scikit-learn, joblib | identik dengan notebook 03 |
| Paket | **uv** (Python), **pnpm** (web) | cepat, ada lockfile |
| Orkestrasi | **Docker Compose**: `redis`, `api`, `worker`, `web` | satu perintah demo |
| Test | **pytest** + httpx · **Vitest** (util TS) · **Playwright** (E2E + screenshot kedua tema) | §14 |

> ⚠️ **Wajib di Fase 0:** semua `.joblib` dibuat di Colab, jadi versi **scikit-learn** dan **lightgbm** di backend dan worker **harus sama persis** dengan versi Colab.
> 1. Minta Argy menjalankan `import sklearn, lightgbm, ultralytics; print(sklearn.__version__, lightgbm.__version__, ultralytics.__version__)` di Colab.
> 2. Pin versi itu di `pyproject.toml`.
> 3. Pastikan model dimuat tanpa `InconsistentVersionWarning`.

### 3.1 Target mesin: laptop Argy (semua berjalan lokal)

| Komponen | Spesifikasi | Dampak |
|---|---|---|
| CPU | Intel Core Ultra 7 255HX (20 core) | API, DuckDB, dan build Next.js cepat |
| GPU | **NVIDIA RTX 5050 Mobile** (arsitektur Blackwell, 8 GB VRAM) | YOLO + ByteTrack di GPU (≫ 30 fps di 640 px). Upload video 4K tetap lancar, dan beberapa kamera bisa jalan bersamaan |
| RAM | 32 GB DDR5 | cukup untuk semua container sekaligus |
| OS | Windows + Docker Desktop (WSL 2) | GPU bisa dipakai dari container lewat dukungan GPU Docker Desktop |

**Aturan GPU (wajib, karena GPU seri RTX 50 / Blackwell):**
- Butuh **PyTorch ≥ 2.7 dengan CUDA 12.8** (wheel `cu128`). Wheel lama (cu121/cu124) **tidak mendukung** GPU ini dan akan error `no kernel image is available` atau diam-diam jatuh ke CPU.
- Pasang di worker dengan:
  ```
  uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
  ```
  Lalu pasang `ultralytics` yang versinya dipin sama dengan di Colab.
- **Driver NVIDIA Windows** harus terbaru (Game Ready/Studio). Driver CUDA **jangan** dipasang di dalam WSL.
- `docker-compose.yml` untuk worker:
  ```yaml
  worker:
    deploy:
      resources:
        reservations:
          devices: [{ driver: nvidia, count: 1, capabilities: [gpu] }]
  ```
- Worker memilih perangkat otomatis: `DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"`. Bisa dipaksa lewat env `WORKER_DEVICE`. Tampilkan perangkat aktif di `/api/health` dan di halaman Kamera (chip kecil "GPU · RTX 5050" / "CPU").
- Inferensi YOLO pakai `half=True` (FP16) bila memakai GPU.
- **CPU tetap harus jalan.** Semua test worker di CI/pytest memakai CPU, supaya proyek juga bisa dijalankan di laptop penguji tanpa GPU.
- Karena GPU-nya kuat, **pengaturan bawaan tetap sama dengan notebook** (10 fps, lebar 640, `imgsz` 640). **Jangan** menaikkan fps atau resolusi, karena fitur Model A dilatih pada 10 fps dan lebar 640. Mengubahnya membuat hasil tidak sesuai dengan training.
- Kalau dukungan GPU Docker bermasalah, jalankan worker **di luar Docker** (langsung di Windows atau WSL dengan `uv run`), sementara `redis`, `api`, dan `web` tetap di Docker. Tulis cara ini di README.

---

## 4. Arsitektur

```
                 BATCH LAYER (selesai di Colab: notebook 01 & 04)
 PEMS-BAY ─► master_pemsbay/*.parquet ─► Spark batch views ─┐
                                        └► Model B (LightGBM) ─► forecasts_june.parquet
                                                                 │  (salin ke dashboard/data/, read-only)
                                                                 ▼
 ┌──────────── api (FastAPI) ─────────────────────────────────────────────────┐
 │ DuckDB views ◄── data/                     SQLite (decisions, cameras)     │
 │ ReplayClock (asyncio) ── tick 15 mnt ──► WS broadcast {"type":"tick"}      │
 │ Redis XREAD camera:* ──────────────────► WS broadcast {"type":"camera"}    │
 │ REST /api/*  ·  /api/cameras/{id}/stream.mjpg (proxy frame dari Redis)     │
 └───────────────▲──────────────────────────────────────────┬─────────────────┘
                 │ Redis Streams + key frame terakhir        │ REST + WebSocket
 ┌──── worker (speed layer) ────┐                    ┌──────▼──────── web (Next.js) ┐
 │ video ─► 10 fps ─► YOLOv8    │                    │ 4 halaman · tema gelap/terang│
 │ ─► ByteTrack ─► fitur 5 dtk  │                    │ peta 3D R3F · ECharts        │
 │ ─► Model A ─► XADD camera:id │                    └──────────────────────────────┘
 │ ─► SET frame:{id} (JPEG)     │
 └──────────────────────────────┘
```

Prinsip:
- **Batch view read-only.** API tidak pernah menulis ke `data/`.
- **Worker tidak bicara langsung ke browser.** Semua lewat Redis lalu API.
- **Satu sumber logika level:** `backend/app/levels.py` dan `web/lib/levels.ts` harus identik dan masing-masing punya test.

---

## 5. Struktur folder

```
Projek Akhir/dashboard/
├── PLAN.md · README.md · .gitignore · .env.example · docker-compose.yml
├── design/                       # referensi (jangan diedit) — lihat design/README.md
├── data/                         # salinan output notebook (§6), di-.gitignore
├── scripts/
│   └── copy_data.py              # salin dari ../Output IPYNB & ../Dataset → data/ + cek MD5/ukuran
├── backend/
│   ├── pyproject.toml            # versi sklearn/lightgbm dipin (§3)
│   ├── app/
│   │   ├── main.py               # FastAPI, CORS (http://localhost:3000), lifespan (DuckDB, Redis, replay)
│   │   ├── config.py             # DATA_DIR, REPLAY_START=2017-06-07T16:45, TICK_SECONDS=5, REDIS_URL
│   │   ├── db.py                 # DuckDB views + SQLite engine
│   │   ├── levels.py             # rasio→level, mph→km/jam, label Indonesia
│   │   ├── replay.py             # ReplayClock: play/pause/seek/step, batas 2017-06-01..2017-06-30 23:45
│   │   ├── ws.py                 # ConnectionManager + task Redis subscriber
│   │   ├── schemas.py            # Pydantic (kontrak §8)
│   │   └── routers/              # meta, replay, network, sensors, alerts, analytics, models, cameras, decisions
│   └── tests/                    # test_levels, test_snapshot_numbers, test_alerts, test_series, test_analytics, test_ws
├── worker/
│   ├── pyproject.toml
│   ├── speed_layer/
│   │   ├── features.py           # SALIN PERSIS extract_features() + helper dari notebook 03
│   │   ├── detector.py           # muat COCO & fine-tuned; auto-pick per kamera
│   │   ├── video_source.py       # baca file, resize lebar 640 (jaga rasio, dukung potret), 10 fps, loop
│   │   ├── run_camera.py         # loop: frame → deteksi+track → buffer jendela → Model A → publish
│   │   ├── annotate.py           # gambar kotak, ID, ROI, garis hitung → JPEG
│   │   └── publisher.py          # XADD camera:{id}, SET frame:{id}
│   ├── models/                   # yolov8s.pt (unduh otomatis Ultralytics), yolov8s_traffic7.pt, model_a.joblib
│   └── tests/                    # test_features_vs_ucsd.py
└── web/
    ├── app/
    │   ├── layout.tsx            # font, ThemeProvider, QueryProvider, Sidebar
    │   ├── page.tsx              # Ringkasan Kota
    │   ├── kamera/page.tsx
    │   ├── prediksi/[sensorId]/page.tsx
    │   └── analitik/page.tsx
    ├── components/
    │   ├── layout/               # Sidebar, ThemeToggle, PageHeader
    │   ├── ui/                   # shadcn (button, select, toggle-group, tooltip, sonner, …)
    │   ├── common/               # Panel, KpiCard, LevelChip, SegmentedToggle, StatCard, Legend
    │   ├── map/                  # SensorMap (wrapper), SensorMap3D (R3F), SensorMap2D (MapLibre + skematis)
    │   ├── charts/               # NetworkChart, SensorChart, Heatmap, DailyTrend, useEchartsTheme
    │   ├── ringkasan/ kamera/ prediksi/ analitik/   # komponen khusus halaman (§2)
    ├── lib/                      # api.ts, ws.ts, levels.ts, format.ts (id-ID), theme-colors.ts
    ├── store/                    # useUiStore (Zustand)
    ├── styles/
    │   ├── tokens.css            # SALIN dari design/tokens.css
    │   └── globals.css           # @import tailwind + tokens + @theme mapping (§9.3)
    └── tests/e2e/                # Playwright
```

---

## 6. Data & model

`scripts/copy_data.py` menyalin file berikut. **Sumber read-only**, semua path relatif terhadap `Projek Akhir/`:

| Tujuan `dashboard/data/` | Sumber | Isi / kolom |
|---|---|---|
| `batch/master/month=*/…parquet` | `Output IPYNB/01_batch/master_pemsbay/` | master dataset (untuk statistik ringkasan & Fase 7) |
| `batch/bv_sensor_hourly/*.parquet` | `Output IPYNB/01_batch/batch_views/bv_sensor_hourly/` | agregasi per sensor per jam |
| `batch/bv_hotspots.csv` | `Output IPYNB/01_batch/` | `sensor_id, pct_congested, pct_severe, avg_speed(mph), v_ff, fwy, dir, county, latitude, longitude, lanes, type, name, rank` |
| `batch/bv_network_daily.csv` | idem | `date, avg_speed, pct_congested, n_sensor_severe, dow` (181 baris) |
| `batch/bv_sensor_profile.csv` | idem | `sensor_id, dow(0=Sen), hour, mean_speed, p15_speed, prob_congested, prob_severe, n_obs` |
| `batch/ref_sensor_meta.csv` | idem | `sensor_id, fwy, dir, county, latitude, longitude, lanes, type, name` |
| `batch/ref_free_flow_speed.csv` | idem | `sensor_id, v_ff` (mph) |
| `model_b/forecasts_june.parquet` | `Output IPYNB/04_model_b-20261028T122005Z-1-001/04_model_b/` | **inti replay**, per 15 menit × sensor: `timestamp, sensor_id, speed_now, level_now, pred_1h, level_1h, actual_1h, pred_3h, level_3h, actual_3h` (mph). **Cek nama kolom saat Fase 1** dengan `DESCRIBE`. Kalau berbeda, sesuaikan view; jangan ubah file |
| `model_b/profile_train.parquet` | idem | profil 15-menit per sensor × hari-minggu (mph) |
| `model_b/vff_train.csv` | idem | `sensor_id, v_ff` (dipakai untuk level Model B) |
| `model_b/model_b_config.json` | idem | fitur, horizon, ambang, **test_metrics** (dipakai PerfTable) |
| `model_b/latest_forecast.csv` | idem | prediksi dari titik terakhir 30 Jun 23:55 (opsional) |
| `model_b/weather_open_meteo.csv` | idem | `time, precipitation, temperature_2m` (opsional: badge cuaca) |
| `model_b/model_b_1h.joblib`, `model_b_3h.joblib` | idem | hanya untuk Fase 7 |
| `model_a/model_a.joblib`, `model_a_config.json` | `Output IPYNB/03_model_a-20261028T112404Z-1-001/03_model_a/` | RF + parameter jendela/detektor + `cv_results` |
| `model_a/timeline_video_uji.csv` | idem | hasil acuan untuk `video_uji.mp4` (test & fallback) |
| `model_a/ucsd_features.csv` | idem | fitur 254 klip berlabel → **median per kelas** untuk FeatureBars + test |
| `yolo/yolov8s_traffic7.pt`, `yolov8s_traffic7_info.json` | `Output IPYNB/02_yolo-Quick Test False/02_yolo/` | detektor fine-tuned + metrik |
| `video/video_uji.mp4` | `Dataset/video_uji.mp4` | kamera default "CAM-01" |
| `video/extra/*.mp4` | `Dataset/Video Uji Dashboard 3.mp4`, `Dataset/14025968_2160_3840_29fps.mp4`, `Dataset/2103099-uhd_3840_2160_30fps.mp4` | kamera tambahan (4K; dua di antaranya potret) |

**Nilai yang dihitung sekali saat startup API (cache di memori):**
- Median fitur per kelas dari `ucsd_features.csv`. Acuan desain: kecepatan median light/medium/heavy = 2,21 / 1,01 / 0,54 bl/s, stopped 0 / 0,10 / 0,46, okupansi 0,02 / 0,11 / 0,16.
- Feature importance Model B. Kalau tidak ada di config, baca dari `model_b_1h.joblib` (`booster_.feature_importance('gain')`, dinormalisasi). Acuan (diverifikasi di Fase 1 terhadap `model_b_1h.joblib` dan `04_model_b/figures/03_feature_importance.png`): dev_now 0,422 · prof_target 0,107 · hour_target 0,046 · v_yesterday 0,045 · ratio_now 0,043 · v_std60m 0,037 · nb_ratio_now 0,032. Angka lama di desain (dev_now 0,49) berasal dari run sebelumnya dan **tidak dipakai**.
- Posisi skematis sensor `x%, y%` dari lat/lon (normalisasi min–max, y dibalik) untuk peta 3D & 2D skematis.

---

## 7. Aturan domain (satu sumber: `levels.py` & `lib/levels.ts`)

- **Unit:** API & UI dalam **km/jam** = mph × 1,609344, dibulatkan 1 desimal (kartu besar 0 desimal). Data mentah tetap mph.
- **Level sensor** (rasio = v / v_ff):

  | Index | Kode data | Label | Rasio | Ukuran titik 2D | Tinggi kolom 3D |
  |---|---|---|---|---|---|
  | 0 | Low | Lancar | ≥ 0,8 | 6 px | 0,08 |
  | 1 | Moderate | Melambat | 0,6–0,8 | 8 px | 0,50 |
  | 2 | High | Padat | 0,4–0,6 | 10 px | 1,05 |
  | 3 | Severe | Macet | < 0,4 | 12 px | 1,80 |

- **Level kamera:** `light → Lancar (0)`, `medium → Padat (2)`, `heavy → Macet (3)`. Urutan kelas di `model_a.joblib` adalah `["heavy","light","medium"]`, jadi **petakan dengan nama, bukan index**.
- **"Padat/macet"** di KPI = level 2 + 3.
- **Waktu:** naive, waktu lokal California. Format: `Rab, 7 Jun 2017 · 16:45` (hari & bulan Indonesia).
- **Angka:** `Intl.NumberFormat('id-ID')`, contohnya `83,1`, `16,9 jt`, `33,1%`.
- **Prediksi digambar di jam target:** prediksi 1 jam dari origin 16:45 ditempatkan di 17:45.

---

## 8. Kontrak API & speed layer

### 8.1 REST

Semua respons JSON dalam km/jam. Parameter `ts` default = jam replay saat ini. Error mengikuti format `{detail}` FastAPI.

| Method & path | Respons |
|---|---|
| `GET /api/health` | `{status:"ok", data_ok, redis_ok, models:{model_a, yolo_ft, yolo_coco}}` |
| `GET /api/meta/sensors` | `[{sensor_id, name, fwy, dir, lanes, lat, lon, x, y, vff_kmh}]` |
| `GET /api/replay` | `{ts, running, tick_seconds, min_ts, max_ts}` |
| `POST /api/replay` | body `{action:"play"|"pause"|"seek"|"step", ts?, steps?, tick_seconds?}` → state baru, dan broadcast `tick` |
| `GET /api/network/snapshot?ts=` | lihat contoh di bawah |
| `GET /api/network/series?date=2017-06-07` | `{actual:[[h,v]], pred_1h:[[h,v]], pred_3h:[[h,v]], profile:[[h,v]], now:h}`, dengan `h` = jam desimal |
| `GET /api/alerts?ts=&horizon=1h&limit=6` | `[{sensor_id, name, fwy, dir, speed_now, pred, level_now, level_pred, drop}]`, urut `drop` menurun |
| `GET /api/sensors/{id}?ts=` | `{sensor_id, name, fwy, dir, lanes, vff_kmh, now:{ts,speed,ratio,level}, h1:{…}, h3:{…}}` |
| `GET /api/sensors/{id}/series?date=` | seperti network/series + `vff` |
| `GET /api/analytics/summary` | `{n_readings, n_days, pct_congested_mean, pct_congested_max, master_mb}` |
| `GET /api/analytics/heatmap` | `{days:["Sen",…], hours:[0..23], values:[[…24]×7]}`, nilai % padat/macet rata-rata sensor |
| `GET /api/analytics/daily` | `[{date, pct_congested, avg_speed}]` |
| `GET /api/analytics/hotspots?limit=8` | `[{rank, sensor_id, name, fwy, dir, pct_congested, pct_severe, avg_speed}]` |
| `GET /api/models/metrics` | `{yolo:{map50, recall, per_class}, model_a:{cv_results, features}, model_b:{test_metrics (km/jam), best_iteration}, importance_1h:[…]}` |
| `GET /api/cameras` | `[{id, name, source, detector_mode, detector_active, status, last:{level, conf, ts}}]` |
| `POST /api/cameras` | multipart `file` (.mp4 ≤ 300 MB), `name` → kamera baru + job worker |
| `POST /api/cameras/{id}/detector` | `{mode:"auto"|"coco"|"finetuned"}` |
| `GET /api/cameras/{id}/timeline?limit=20` | `[{t0, t1, level, probs:{light,medium,heavy}, features:{…}, det_mean, flow_per_min}]` |
| `GET /api/cameras/{id}/stream.mjpg` | `multipart/x-mixed-replace` dari key Redis `frame:{id}` (±10 fps) |
| `POST /api/decisions` | `{sensor_id, ts, actions:[string], note?}` → `{id, created_at}` |
| `GET /api/decisions?sensor_id=` | riwayat |
| `WS /ws/live` | pesan: `{"type":"tick", ts, kpi}` · `{"type":"camera", camera_id, window, level, probs, features}` · `{"type":"replay", running}` |

Contoh `GET /api/network/snapshot?ts=2017-06-07T16:45`:
```json
{ "ts": "2017-06-07T16:45:00",
  "kpi": { "avg_speed": 83.1, "normal_speed": 0.0, "congested_now": 89, "congested_1h": 117, "congested_3h": 7 },
  "counts": { "now": [198,38,44,45], "h1": [159,49,57,60], "h3": [302,16,2,5] },
  "sensors": [ { "sensor_id": 403225, "speed_now": 99.0, "level_now": 0, "pred_1h": 46.0, "level_1h": 2, "pred_3h": 100.0, "level_3h": 0 } ] }
```
(`normal_speed` = rata-rata profil di jam yang sama, dihitung dari data.)

### 8.2 Replay
- `ReplayClock` adalah asyncio task. Satu tick memajukan **15 menit**, default tiap **5 detik**, dan nilainya bisa diubah.
- Batas waktunya Juni 2017. Saat mencapai akhir, replay berhenti.
- Setiap tick: broadcast `{"type":"tick"}`, lalu frontend meng-invalidate query `snapshot`, `alerts`, `series`, dan `sensor`.
- Mundur/maju = `step` ±1.

### 8.3 Pesan WebSocket di frontend
`useLiveSocket()`:
- reconnect otomatis dengan backoff 1→10 dtk;
- status koneksi ditampilkan sebagai titik kecil di badge REPLAY;
- event `camera` disimpan di store, maksimal 40 jendela terakhir per kamera.

### 8.4 Speed layer worker
- Parameter dari `model_a_config.json`:
  - `target_fps 10`, `frame_width 640`, `window_s 5`, `step_s 2.5`;
  - `roi_top 0.35`, `count_line_y 0.70`;
  - `det_conf 0.2`, `imgsz 640`.
- **Video potret** (2160×3840): resize **lebar** ke 640 dengan rasio aspek tetap. ROI dan garis hitung tetap relatif terhadap tinggi. Kalau inferensi terlalu lambat, batasi tinggi maksimum 640 lalu tambahkan letterbox.
- **Auto-pick detektor:**
  - Jalankan kedua model pada 6 frame awal, lalu pilih yang rata-rata deteksinya lebih banyak.
  - Simpan alasannya (`"COCO 23,7 vs fine-tuned 1,0 deteksi/frame"`).
  - Kelas yang dipakai:
    - COCO memakai kelas `[2,3,5,7]`;
    - fine-tuned memakai semua kelas **kecuali person**.
- Setiap 2,5 dtk: hitung fitur jendela → `model_a.predict_proba` → `XADD camera:{id} * json`.
- Setiap frame: anotasi → JPEG kualitas 70 → `SET frame:{id}`.
- Video di-loop. Saat loop ulang, reset tracker.
- Kamera dari upload: API menyimpan file ke `data/video/uploads/`, menulis ke SQLite, lalu `XADD jobs`. Worker membaca `jobs` dan menjalankan kamera baru di proses/thread terpisah (maksimal 3 kamera bersamaan).

---

## 9. Sistem tema: gelap (default) + terang

### 9.1 Perilaku
- **Default: GELAP** untuk setiap pengunjung baru. Sistem operasi **tidak** diikuti otomatis (`enableSystem={false}`), karena tema gelap adalah identitas "ruang kontrol".
- Toggle ada di **sidebar** (di bawah menu), sesuai desain:
  - tampil "☀ Mode terang" saat gelap, dan "☾ Mode gelap" saat terang;
  - berupa `<button>` biasa dengan teks, jadi tidak perlu `aria-label`.
- Pilihan tersimpan di `localStorage` (key `arus-theme`) dan berlaku di semua halaman.
- **Tidak boleh ada kedipan** saat load. Pakai `next-themes`, `suppressHydrationWarning` di `<html>`, dan skrip inline bawaan next-themes.
- Pergantian tema **tidak memuat ulang** data, peta 3D, maupun koneksi WebSocket.

### 9.2 Implementasi

```tsx
// app/layout.tsx
<html lang="id" suppressHydrationWarning>
  <body>
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}
                   themes={["dark","light"]} storageKey="arus-theme" disableTransitionOnChange>
      …
```
- `styles/tokens.css` = **salinan persis `design/tokens.css`**. Selektornya `:root, [data-theme="dark"]` dan `[data-theme="light"]`.
- Semua warna komponen **wajib** lewat token. Tidak boleh ada hex langsung di komponen. Pengecualian hanya overlay video (§10.3).

### 9.3 Tailwind v4 mapping (`globals.css`)
```css
@import "tailwindcss";
@import "./tokens.css";
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
@theme inline {
  --color-bg: var(--bg); --color-nav: var(--nav); --color-panel: var(--panel); --color-inset: var(--inset);
  --color-raised: var(--raised); --color-border: var(--border); --color-border-strong: var(--border-strong);
  --color-text: var(--text); --color-text-2: var(--text-2); --color-muted: var(--muted); --color-nav-text: var(--nav-text);
  --color-accent: var(--accent); --color-link: var(--link); --color-accent-soft: var(--accent-soft);
  --color-accent-strong: var(--accent-strong); --color-on-accent: var(--on-accent); --color-on-solid: var(--on-solid);
  --color-lv-0: var(--lv-0); --color-lv-1: var(--lv-1); --color-lv-2: var(--lv-2); --color-lv-3: var(--lv-3);
  /* …tint/text level, warn, alert, chart: daftarkan semua token di tokens.css */
  --font-sans: var(--font-jakarta); --font-mono: var(--font-jetbrains);
  --radius-panel: 16px;
}
```
Contoh pemakaian: `bg-panel border border-border text-text`, `text-muted`, `bg-lv-3-tint text-lv-3-text`.
shadcn/ui: petakan `--background`, `--foreground`, `--card`, `--primary`, `--ring`, dan seterusnya ke token di atas, di kedua blok tema.

### 9.4 Token per tema (ringkas, lengkapnya di `design/tokens.css`)

| Token | Gelap (default) | Terang | Dipakai untuk |
|---|---|---|---|
| `--bg` | #0B0F14 | #F3F5F8 | latar halaman |
| `--nav` / `--panel` | #0D1218 / #121821 | #FFFFFF / #FFFFFF | sidebar / kartu |
| `--inset` / `--raised` | #0D1218 / #18222F | #F6F8FB / #FFFFFF | grup toggle / segmen aktif |
| `--border` / `--border-strong` | #1E2733 / #263243 | #E3E8EF / #D5DCE6 | garis |
| `--text` / `--text-2` / `--muted` | #E7ECF3 / #C9D2DE / #93A0B4 | #0F1722 / #3A4556 / #5E6878 | teks |
| `--accent` / `--on-accent` | #7AA2FF / #0B0F14 | #3B5BDB / #FFFFFF | tombol aktif, prediksi 1 jam |
| `--link` | #9DB8FF | #3B5BDB | tautan, outline fokus |
| `--lv-0..3` | #43C59E #E8C547 #F39A4A #EE5A5A | #22A06B #E0B000 #F08A24 #E5484D | titik, kolom 3D, garis, zona |
| `--lv-*-tint` / `--lv-*-text` | rgba level 16–18% / teks level terang | tint pastel / teks level gelap | chip level |
| `--pred-3h` / `--profile` | #C08BFF / #7D8BA0 | #7C3AED / #94A3B8 | grafik |

**Warna aksen yang bisa diganti** (opsional, di pengaturan): biru / teal / ungu. Nilai terang → gelap: `#3B5BDB→#7AA2FF`, `#0E7490→#3CC6DC`, `#6D28D9→#B794FF`.

### 9.5 Bagian yang dirender di JavaScript (wajib ikut tema)
`lib/theme-colors.ts` membaca token dengan `getComputedStyle(document.documentElement)` dan memberikan objek warna. Hook `useThemeColors()` menghitung ulang saat `resolvedTheme` berubah.

| Bagian | Cara ikut tema |
|---|---|
| **ECharts** | Opsi grafik dibangun dari `useThemeColors()` (warna garis, grid `--grid`, teks `--muted`, tooltip `--panel`). Teruskan `key={resolvedTheme}` atau `setOption(opt, true)` agar ter-render ulang |
| **Heatmap ramp** | Gelap: `0 #16202B · 4 #2A4A60 · 12 #E8C547 · 22 #F39A4A · 33,1 #EE5A5A`. Terang: `0 #EDF1F6 · 4 #FCEFC0 · 12 #F7C548 · 22 #F08A24 · 33,1 #E5484D` (`visualMap.inRange` piecewise linear) |
| **Tren harian** | Batang bernilai < 1,5% memakai `--bar-low`, selebihnya warna dari ramp (nilai × 3) |
| **MapLibre 2D** | Ganti style: gelap `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`, terang `…/positron-gl-style/style.json`. Pakai `map.setStyle()` lalu tambahkan ulang layer sensor di event `style.load` |
| **Peta 3D** | Palet scene per tema (§11.3). Ubah warna material, jangan membuat ulang renderer |
| **Video kamera** | **Tidak** ikut tema: overlay selalu `rgba(15,23,34,.85)` dengan teks `#FFF` |

### 9.6 Kriteria tema (dicek di Fase 2 & 6)
- Load pertama tanpa `localStorage` → gelap. Toggle → terang. Reload → tetap terang.
- Tidak ada elemen yang "tertinggal" warna tema lama. Cek grep: tidak ada `#` hex di `web/components/**`, kecuali `lib/theme-colors.ts` untuk three.js/heatmap.
- Kontras teks ≥ 4,5:1 di kedua tema (axe di Playwright, untuk kedua tema).
- Screenshot Playwright 4 halaman × 2 tema tersimpan di `web/tests/e2e/__screenshots__/`.

---

## 10. Design system & komponen

### 10.1 Tipografi & spasi
- **Font:** Plus Jakarta Sans (UI) dan JetBrains Mono (semua angka; `font-variant-numeric: tabular-nums`, kelas `.mono`).
- **Skala teks:**

  | Elemen | Ukuran / tebal | Catatan |
  |---|---|---|
  | Eyebrow | 12/700 | uppercase, tracking .08em |
  | H1 | 30/800 | tracking −.025em |
  | H2 panel | 17/700 | |
  | Label | 13/500 | `--muted` |
  | Angka KPI | 38 mono/600 | |
  | Angka kartu | 30 mono/600 | |
  | Body | 14 | |
  | Caption | 12–11 | |

- **Spasi:** gap antar panel 16, padding panel 20, radius panel 16, radius dalam 10–12, pill 999. Bayangan panel `--shadow-panel`.
- **Target sentuh ≥ 44 px.** Pengecualian: tombol bulat replay 32 px berada di dalam grup 44 px.

### 10.2 Komponen dasar (`components/common`)

| Komponen | Spesifikasi |
|---|---|
| `Panel` | `bg-panel border-border rounded-panel p-5 shadow`. Prop `tone="default"|"warn"|"alert"` |
| `LevelChip` | pill 4×12 px, 12/800, latar `--lv-n-tint`, teks `--lv-n-text`. Varian `solid`: latar `--lv-n`, teks `--on-solid` |
| `SegmentedToggle` | wadah `bg-inset border` p-1. Tombol aktif `bg-accent text-on-accent` (horizon) atau `bg-raised text-text shadow` (3D/2D). Atribut `aria-pressed` |
| `KpiCard` | label 13/500 muted, angka 38 mono, satuan 14 muted, baris delta (chip/teks berwarna level) |
| `ThemeToggle` | §9.1. Ikon lucide `Sun`/`Moon` 18 px, `bg-inset border`, min-h 44 |
| `Legend` | titik berukuran sesuai level (6/8/10/12) + label + jumlah |
| `EmptyState` / `ErrorState` / `Skeleton` | untuk semua panel data (loading pertama, API gagal, kamera offline) |

### 10.3 Pengecualian warna
- Overlay di atas video memakai `--overlay-chip`/`--overlay-roi` dengan teks `#FFF` di kedua tema.
- Chip level di atas video atau warna pekat memakai `--on-solid`.

### 10.4 Aksesibilitas (wajib, dua tema)
- Level **tidak hanya dibedakan lewat warna**: selalu ada label teks, ukuran titik berbeda, dan tinggi kolom berbeda.
- Semua kontrol berupa `<button>`, `<a>`, atau `<input>` sungguhan. Toggle memakai `aria-pressed`. Halaman aktif memakai `aria-current`.
- Fokus terlihat: `outline: 2px solid var(--link); outline-offset: 2px`.
- Setiap grafik dan canvas punya `aria-label` berisi ringkasan isinya (contoh kalimatnya ada di desain).
- `prefers-reduced-motion`: auto-rotate 3D mati dan animasi lerp langsung ke nilai akhir.

### 10.5 Responsif
- **< 900 px:** sidebar menumpuk di atas, menu jadi baris horizontal yang bisa digulir.
- Panel baris memakai `flex-wrap`. Tabel berada di dalam `overflow-x-auto`.
- **Layar 390 px** harus tetap rapi tanpa scroll horizontal di level halaman.

---

## 11. Peta 3D (three.js): `SensorMap3D`

Prototipe yang berjalan ada di `design/Main.dc.html` (vanilla three.js r149: `tryInit`, `applyTheme`, `applyColors`, loop). Di produksi, tulis ulang dengan React Three Fiber.

### 11.1 Setup
- Paket: `three`, `@react-three/fiber`, `@react-three/drei` (`OrbitControls`, `Html`).
- File dimulai dengan `"use client"` dan di-load via `next/dynamic(() => import(...), { ssr: false })`.
- `<Canvas dpr={[1,2]} gl={{ antialias:true, alpha:true }} camera={{ fov:32, position:[…] }}>`. Latar transparan sehingga warna panel (`--map-a`) terlihat.
- Tinggi panel peta 460 px di desktop dan 360 px di ponsel.

### 11.2 Scene
- **Posisi sensor:**
  - `x3d = (x/100 − 0.5) × 10.7`, `z3d = (y/100 − 0.5) × 10`;
  - `x`, `y` (0–100) berasal dari `/api/meta/sensors`.
- **Kolom:** satu `InstancedMesh` dengan `BoxGeometry(0.12, 1, 0.12)` yang di-`translate(0, 0.5, 0)`, dan material `MeshStandardMaterial({ roughness: .55, metalness: .05 })`.
  - Skala Y per instance = tinggi level (§7).
  - Warna per instance memakai `setColorAt`.
  - 325 kolom digambar dalam 1 draw call.
- **Alas:** `InstancedMesh` `CylinderGeometry(0.1, 0.1, 0.01, 12)` `MeshBasicMaterial`, sehingga sensor Lancar tetap terlihat.
- **Lantai:** plane `(10.7+1.2) × (10+1.2)` + `GridHelper(12, 24)`.
- **Kamera orbit:**
  - radius 14,5, tinggi 9,2, `lookAt(0, 0.2, 0.4)`, sudut awal −0,35 rad;
  - `OrbitControls` dengan `enablePan={false}`, polar 0,6–1,2 rad, zoom 10–22.

### 11.3 Palet per tema (dari `SCENE` di desain)

| | Gelap (default) | Terang |
|---|---|---|
| Lantai | `0x111923` | `0xFFFFFF` |
| Grid (garis utama / sekunder) | `0x2A3646` / `0x18222F` | `0xDBE2EB` / `0xE9EEF4` |
| Alas sensor | `0x2A3646` | `0xC5CFDC` |
| HemisphereLight (langit / tanah / intensitas) | `0xC9D6E8` / `0x0B0F14` / 0,85 | `0xFFFFFF` / `0xD9E1EC` / 1,0 |
| DirectionalLight (5, 10, 6), intensitas | 0,9 | 0,75 |
| Kolom Lancar / Melambat / Padat / Macet | `0x43C59E` `0xE8C547` `0xF39A4A` `0xEE5A5A` | `0x22A06B` `0xE0B000` `0xF08A24` `0xE5484D` |

Saat tema berubah:
- set warna material dan lampu;
- **buat ulang hanya `GridHelper`**, karena warnanya ada di vertex;
- panggil ulang `setColorAt` untuk semua kolom.

**Jangan** membuat ulang `Canvas`.

### 11.4 Animasi & interaksi
- Saat horizon atau tick berubah, tinggi kolom di-**lerp** dengan faktor 0,12 per frame.
  - Setelah update: `instanceMatrix.needsUpdate = true` dan `instanceColor.needsUpdate = true`.
  - Kalau `prefers-reduced-motion`, nilai langsung diset ke akhir.
- **Auto-rotate:** 0,0018 rad per frame (OrbitControls `autoRotateSpeed ≈ 0.4`).
  - Berhenti saat pengguna drag, lalu lanjut 3 detik setelah dilepas.
  - Mati jika `prefers-reduced-motion`.
- **Hover:** `onPointerMove` → `e.instanceId` → tooltip `<Html>` (nama, fwy, kecepatan sekarang → prediksi, chip level). Kursor berubah jadi pointer.
- **Klik:** `router.push('/prediksi/' + id)`.
- **Label jalan tol** (SR 17, SR 85, SR 87, US 101, SR 237, I-280, I-680, I-880) memakai `<Html>`. Bisa dimatikan; posisinya ada di `FWY` di desain atau dihitung dari median koordinat sensor per fwy.
- **Overlay** (kiri atas: caption; kanan bawah: legenda) adalah elemen HTML di atas canvas dengan latar `--glass`.
- **Fallback:** kalau WebGL tidak tersedia atau init gagal, otomatis pindah ke 2D dan tampilkan toast "Peta 3D tidak didukung perangkat ini".

### 11.5 Performa
- Pakai `frameloop="demand"` saat tidak ada animasi atau rotasi, dan `invalidate()` saat data/lerp/tema berubah.
- Dispose geometry/material saat unmount.
- Target **≥ 55 fps** di laptop dengan GPU terintegrasi (cek dengan `r3f-perf` saat development saja).

---

## 12. Angka uji (sudah diverifikasi dari data; jadikan test)

| Kasus | Nilai yang harus keluar |
|---|---|
| `snapshot` pada `2017-06-07T16:45` | rata-rata **83,1 km/jam**; padat/macet **89** sekarang, **117** (+1 jam), **7** (+3 jam); counts now `[198,38,44,45]`, h1 `[159,49,57,60]`, h3 `[302,16,2,5]` |
| `alerts` 1 jam pada ts yang sama (6 teratas) | 403225 Airport Blvd (99→46, Padat), 403265 Coleman Ave (94→41, Macet), 404585 Fair Oaks Ave (102→51, Padat), 400869 Moffett Blvd (94→44, Macet), 401351 WB 237 ke NB 101 (101→52, Padat), 400792 Bascom Ave (93→46, Padat). Urutan boleh berbeda kalau kriteria urutnya didokumentasikan |
| `sensors/403225` | 99 → 46 → 100 km/jam; rasio 0,91 / 0,42 / 0,92; Lancar → Padat → Lancar; v_ff ≈ 109 km/jam; profil Rabu 17:00 = 48,6 km/jam |
| `analytics/heatmap` | puncak **Kamis 17:00 = 33,1%**; Sabtu & Minggu semuanya < 2% |
| `analytics/daily` | 181 baris; maksimum 10,2% |
| `analytics/hotspots` | #1 De La Cruz Blvd (US 101 S) 18,6% / berat 15,3% |
| `models/metrics` | YOLO mAP50 0,879, recall 0,800 · Model A akurasi 0,945, macro-F1 0,910 · Model B 1 jam MAE 1,9931 mph = **3,21 km/jam**, recall macet 0,701; 3 jam MAE **3,56 km/jam**, recall 0,678 |
| Worker pada `video_uji.mp4` | auto-pick = **COCO**; 7 jendela (0–20 dtk) semuanya **heavy/Macet**, p_heavy ≈ 0,998 (toleransi ±0,05); fitur jendela pertama speed_bl_med ≈ 0,334, stopped_ratio ≈ 0,95 |
| `features.py` vs `ucsd_features.csv` | selisih fitur ≤ 1e-3 pada minimal 3 klip UCSD |

---

## 13. Fase pengerjaan (satu fase = satu sesi Claude Code)

**Fase 0: Kerangka, data, tema dasar**
- Buat struktur §5, `.gitignore`, `.env.example`, dan `scripts/copy_data.py` (salin §6 dan cetak ringkasan ukuran).
- Backend: `pyproject.toml` (uv, versi dipin), FastAPI `/api/health`.
- Web:
  - Next.js + Tailwind v4 + shadcn + `next-themes`;
  - `tokens.css` disalin dari `design/tokens.css`, dan `globals.css` berisi mapping §9.3;
  - layout + **Sidebar + ThemeToggle** + 4 halaman kosong berjudul.
- Docker Compose (`redis`, `api`, `web`; `worker` menyusul).
- ✔ `docker compose up` jalan.
- ✔ `GET /api/health` → `data_ok: true`.
- ✔ Kedua `.joblib` dimuat tanpa warning versi.
- ✔ Di worker, `python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"` mencetak versi `+cu128`, `True`, dan `RTX 5050` (§3.1).
- ✔ Buka `localhost:3000`: tampil **gelap**, toggle ke terang bekerja, dan reload mempertahankan pilihan tanpa kedip.
- ✔ Navigasi 4 halaman bekerja.

**Fase 1: API batch & replay**
- DuckDB views, `levels.py` (+ test), router meta/replay/network/sensors/alerts/analytics/models/decisions, `ReplayClock` + WebSocket `tick`.
- ✔ Semua angka §12 (kecuali worker) lolos di pytest.
- ✔ `POST /api/replay {action:"step"}` memajukan 15 menit dan klien WS menerima `tick`.

**Fase 2: Ringkasan Kota + peta 3D**
- Komponen §2.1, `SensorMap3D` (§11), `SensorMap2D` (MapLibre + skematis), dan semua ECharts ikut tema (§9.5).
- ✔ Tampilan cocok dengan `design/Main.dc.html` di **kedua tema**.
- ✔ Peta 3D tampil sebagai default.
- ✔ Toggle horizon membuat kolom tumbuh/menyusut halus. 3D/2D bekerja. Drag memutar peta. Klik kolom membuka halaman Prediksi.
- ✔ Ganti tema saat peta 3D tampil langsung mengubah lantai/grid/kolom tanpa reload.
- ✔ Replay play/step mengubah semua panel.
- ✔ Rapi di 390 px.

**Fase 3: Prediksi Sensor**
- ✔ `/prediksi/403225` menampilkan 99 → 46 → 100 km/jam (Lancar → Padat → Lancar).
- ✔ Toggle 1 jam / 3 jam / Keduanya bekerja.
- ✔ Pita zona level ada di grafik.
- ✔ "Catat keputusan" tersimpan di SQLite dan muncul toast.
- ✔ PerfTable diambil dari API.
- ✔ Kedua tema sesuai desain.

**Fase 4: Analitik & Model**
- ✔ Heatmap puncak Kamis 17:00 (33,1%) dengan ramp per tema.
- ✔ Ada 181 batang tren.
- ✔ 3 kartu model berisi angka dari API.
- ✔ Diagram Lambda tampil.

**Fase 5: Speed layer + halaman Kamera**
- Worker (§8.4); `features.py` **disalin persis** dari notebook 03.
- Endpoint kamera + MJPEG + upload. Halaman §2.2.
- ✔ `video_uji.mp4` tampil sebagai stream beranotasi (kotak + ID).
- ✔ Jendela baru muncul tiap 2,5 dtk lewat WS.
- ✔ Hasil sesuai §12. Test `features.py` lolos.
- ✔ Ganti detektor bekerja, dan teks alasan auto-pick tampil.
- ✔ Upload salah satu video 4K (termasuk yang potret) membuat kamera baru yang berjalan.
- ✔ Overlay video tetap gelap di tema terang.

**Fase 6: Poles, test, demo**
- Skeleton/empty/error state, README (cara menjalankan, arsitektur, atribusi), Playwright E2E, screenshot 2 tema, axe.
- ✔ E2E "Ringkasan → klik peringatan → Prediksi → Catat keputusan → Kamera → Analitik → ganti tema" lolos.
- ✔ Lighthouse aksesibilitas ≥ 90 di kedua tema.
- ✔ Skenario demo §16 lancar dari `docker compose up` yang bersih.

**Fase 7 (opsional): inferensi Model B on-the-fly**
- Port `make_rows()` dari notebook 04 untuk memprediksi dari master dataset.
- ✔ Hasilnya cocok dengan `forecasts_june.parquet` (selisih < 0,1 mph) pada 3 timestamp acak.

---

## 14. Strategi testing

| Level | Alat | Yang diuji |
|---|---|---|
| Unit Python | pytest | `levels.py` (batas 0,4/0,6/0,8 inklusif–eksklusif), konversi unit, `ReplayClock` (batas, step), `features.py` vs UCSD |
| API | pytest + httpx `AsyncClient` | semua endpoint + angka §12 + skema Pydantic |
| WebSocket | pytest + `websockets` | tick setelah `step`; pesan kamera dari Redis palsu (`fakeredis`) |
| Unit TS | Vitest | `levels.ts` identik dengan Python (tabel kasus yang sama), `format.ts` id-ID |
| E2E | Playwright | alur Fase 6, toggle tema + persistensi, `aria-pressed`, screenshot 4 halaman × 2 tema, axe kontras |
| Manual | checklist | 60 fps peta 3D, reduced-motion, 390 px, video potret |

---

## 15. Risiko & hal yang sengaja tidak dibuat

- **Tidak ada sensor live.** Semua data sensor berasal dari replay Juni 2017. Badge "REPLAY" wajib tampil, dan ini ditulis jujur di laporan.
- **Inferensi YOLO.** Di laptop Argy, YOLO berjalan di GPU RTX 5050, jadi aman (§3.1). Di mesin tanpa GPU, YOLO di CPU hanya ±5–10 fps pada 640 px. Video 4K/60 fps **selalu** diturunkan ke 10 fps dan lebar 640. Cadangan kalau tetap patah-patah:
  - proses video di muka (pre-compute) lalu putar hasilnya;
  - atau turunkan `imgsz` ke 480, dengan catatan akurasi bisa turun.
- **Risiko GPU Blackwell:** wheel PyTorch yang salah (bukan cu128) membuat worker gagal atau diam-diam pindah ke CPU. Cek di Fase 0, dan perhatikan chip perangkat di halaman Kamera.
- **Domain shift:** detektor fine-tuned gagal di jalan tol Barat. Karena itu auto-pick wajib, dan alasannya ditampilkan di UI.
- **Probabilitas Model A terlalu yakin** (sering > 99%). Tampilkan dengan catatan kecil, bukan sebagai kepastian.
- **Versi library** harus sama dengan Colab (§3). Inilah risiko teknis terbesar.
- **Basemap CARTO butuh internet.** Kalau offline, pakai peta skematis (2D) dan 3D, yang tidak butuh internet.
- **Lisensi & atribusi** (footer + README):
  - PEMS-BAY (Caltrans PeMS, via DCRNN/Zenodo);
  - UCSD Traffic Video Database (Chan & Vasconcelos; video WSDOT);
  - Roboflow "Traffic Congestion Detection" (CC BY 4.0);
  - Ultralytics YOLOv8 (AGPL-3.0, aman untuk akademik);
  - Open-Meteo (CC BY 4.0);
  - CARTO / OpenStreetMap;
  - video uji (Pexels).

---

## 16. Skenario demo (±5 menit)

1. **Ringkasan** (tema gelap) pukul 16:45:
   - 89 sensor padat/macet;
   - putar peta 3D, lalu toggle **+1 jam** → kolom merah menjulang, 117 sensor. *"Inilah gunanya prediksi."*
2. Klik peringatan **Airport Blvd** untuk masuk ke halaman Prediksi:
   - sekarang 99 km/jam, 1 jam lagi 46 km/jam;
   - jelaskan fitur `dev_now` dan profil normal;
   - centang tindakan, lalu klik **Catat keputusan**.
3. **Kamera Live:**
   - video berjalan, Model A menyatakan **Macet**;
   - tunjukkan fitur dibanding median kelas;
   - ganti detektor ke Fine-tuned untuk menjelaskan domain shift;
   - upload satu video 4K untuk menunjukkan kamera baru.
4. **Analitik:** heatmap jam sibuk, pola gigi gergaji, kartu 3 model, diagram Lambda.
5. Tekan **Mode terang** (cocok untuk proyektor), lalu **play replay** sampai 19:45: kemacetan reda sesuai prediksi +3 jam.
