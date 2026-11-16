# CLAUDE.md — Projek Akhir Teknologi Big Data

> File ini dibaca otomatis oleh Claude Code. Baca sampai habis sebelum mengerjakan apa pun.
> Rencana implementasi lengkap ada di **`dashboard/PLAN.md`**. Ini dokumen utama untuk coding.

## 1. Proyek ini apa

**"Arus": sistem pemantauan & prediksi kemacetan lalu lintas kota berbasis IoT + Big Data dengan Lambda Architecture.**
Ini Projek Akhir mata kuliah Teknologi Big Data (Semester 5, D4 TRPL, Sekolah Vokasi IPB), dikerjakan oleh Argy.

**Tujuan akhir:** sebuah dashboard web untuk *city planner* yang:
1. menampilkan kondisi lalu lintas **saat ini** dari 325 sensor jalan (IoT) dan kamera CCTV;
2. **memprediksi** kemacetan **1 jam dan 3 jam ke depan** per sensor;
3. menunjukkan **arsitektur Lambda** secara nyata:
   - **batch layer**: data historis besar, model terlatih;
   - **speed layer**: video → deteksi → klasifikasi real-time;
   - **serving layer**: API + dashboard yang menggabungkan keduanya;
4. **diuji dengan video lalu lintas** (folder `Dataset/`) yang diputar di halaman Kamera.

**Status saat ini:**
- ✅ Semua training selesai di Google Colab (notebook 01–04). Hasilnya ada di `Output IPYNB/`.
- ✅ Desain dashboard selesai: 4 halaman, **tema gelap (default) + tema terang**, peta 3D three.js. Ada di `dashboard/design/`.
- ✅ **Dashboard selesai: Fase 0–6 + perbaikan bug sebelum presentasi** (29 Okt 2026). Fase 7 (opsional) belum dikerjakan.
- ✅ **Diuji ulang 16 Nov 2026**: backend 66 lulus, worker 6 lulus, web 18 lulus. Repo git di GitHub: https://github.com/Argy1/Big-Data.git.
- 📄 **Baca `dashboard/PROGRESS.md` dulu**: status lengkap, cara menjalankan, keputusan teknis, yang belum dikerjakan, dan jebakan lingkungan. Log perubahan sejak 29 Okt ada di §10.
- 🧭 **Panduan menjalankan langkah demi langkah: `AGENTS.md`** (di root). Untuk AI agent apa pun.

## 2. Aturan kerja (wajib)

1. **Jangan pernah mengubah, memindahkan, atau menghapus** isi `Dataset/`, `Notebooks/`, `Output IPYNB/`. Ketiganya read-only. Salin yang dibutuhkan ke `dashboard/data/` (PLAN §6).
2. Semua kode baru ditulis di dalam `dashboard/` saja.
3. Kerjakan **satu fase PLAN per sesi**. Di akhir fase:
   - jalankan test atau kriteria selesai fase itu;
   - laporkan hasilnya;
   - berhenti dan tunggu instruksi.
4. **Bahasa:**
   - Penjelasan untuk Argy dalam **Bahasa Indonesia**, ringkas dan langsung ke inti.
   - Teks UI dashboard juga berbahasa Indonesia.
   - Nama variabel, fungsi, dan komentar kode boleh dalam bahasa Inggris.
5. Argy adalah full-stack developer yang sedang belajar. Kalau ada keputusan teknis penting, jelaskan singkat **kenapa** pilihan itu dibuat.
6. **Angka acuan sudah diverifikasi** (PLAN §12). Kalau hasil API berbeda dari angka itu, cari penyebabnya. Jangan ubah test-nya.
7. Kalau sesuatu di PLAN tidak jelas atau bertentangan dengan data sebenarnya, **tanya dulu**. Jangan menebak.
8. Jangan commit file besar (video, `.pt`, `.joblib`, `.parquet` > 5 MB) ke git. Masukkan `dashboard/data/` ke `.gitignore`.

## 3. Peta isi folder `Projek Akhir/`

```
Projek Akhir/
├── CLAUDE.md                ← file ini (aturan kerja)
├── AGENTS.md                ← panduan menjalankan langkah demi langkah untuk AI agent
├── .gitignore               ← repo git (GitHub: Argy1/Big-Data), mengecualikan Dataset/ dan file besar
├── Dataset/                 ← DATA MENTAH (read-only, TIDAK di GitHub)
├── Notebooks/               ← 4 notebook Colab yang sudah dijalankan (read-only, referensi logika)
├── Output IPYNB/            ← HASIL training dari Colab (read-only, sumber data & model dashboard)
├── _check/                  ← file sementara bekas analisis dataset. Abaikan.
├── jurnal/                  ← naskah JATI, daftar pustaka, eksperimen jurnal (lihat AGENTS.md §8)
├── laporan/                 ← laporan akhir (.docx, .pdf)
└── dashboard/               ← TEMPAT KERJA: aplikasi, PLAN.md, PROGRESS.md, README.md, design/
```

### 3.1 `Dataset/`: data mentah

| File / folder | Isi | Dipakai untuk |
|---|---|---|
| `PEMS-BAY.csv` (86 MB) | Kecepatan (mph) 325 sensor jalan tol Bay Area, tiap 5 menit, 1 Jan – 30 Jun 2017. Kolom = sensor_id, baris = waktu | **Batch layer**: notebook 01 & 04 |
| `PEMS-BAY-META.csv` | Metadata sensor: Fwy, Dir, lat/lon, Lanes, Name | Peta, nama sensor |
| `adj_mx_bay.pkl` | Matriks ketetanggaan graf sensor (format DCRNN) | Tidak dipakai (tetangga dihitung dari koordinat) |
| `Traffic Congestion Detection.v2i.yolov8/` | Dataset Roboflow YOLOv8, 9 kelas (Bike, Bus, Car, Cng, Cycle, Mini-Truck, People, Rickshaw, Truck), ±23.760 gambar train/valid/test | Fine-tuning detektor (notebook 02) |
| `traffic_roboflow_yolov8.zip` (1,8 GB) + `.md5.txt` | Arsip asli dataset Roboflow di atas | Cadangan |
| `archive (2)/` + `ucsd_traffic.zip` | **UCSD Traffic Video Database**: 254 klip `.avi` jalan tol I-5 Seattle, berlabel light/medium/heavy + split resmi (`ImageMaster`, `EvalSet`) | Training Model A (notebook 03) |
| `video_uji.mp4` | Video uji 20 dtk, 1280×720, 30 fps (versi 720p yang dibuat saat analisis dataset; dipakai di notebook 03) | **Video demo utama halaman Kamera** |
| `Video Uji Dashboard 3.mp4` | 21 dtk, **2160×3840 (potret)**, 59,94 fps, 174 MB | Video uji tambahan dashboard |
| `14025968_2160_3840_29fps.mp4` | 17 dtk, **2160×3840 (potret)**, 28,6 fps | Video uji tambahan |
| `2103099-uhd_3840_2160_30fps.mp4` | 60 dtk, 3840×2160, 30 fps | Video uji tambahan |
| `smart_city_traffic_mobility.csv` | Dataset sintetis awal dari tugas. **Tidak dipakai** karena tidak realistis untuk prediksi | — |

> Video 4K harus di-resize ke lebar 640 px oleh worker. Video potret harus dijaga rasio aspeknya (PLAN §8.4).

### 3.2 `Notebooks/`: logika yang sudah terbukti jalan

| Notebook | Lapisan | Ringkasan |
|---|---|---|
| `01_EDA_BatchLayer_PEMSBAY.ipynb` | Batch | EDA PEMS-BAY, master dataset Parquet per bulan, **Spark batch views** (profil sensor, hotspot, harian, per jam), definisi level |
| `02_YOLOv8_Finetune.ipynb` | Speed | Fine-tune YOLOv8s ke 7 kelas lalu lintas campuran, demo tracking ByteTrack |
| `03_ModelA_Nowcast.ipynb` | Speed | Ekstraksi fitur video per jendela 5 dtk (YOLO + ByteTrack + optical flow), **Model A = Random Forest** (Lancar/Padat/Macet), uji di `video_uji.mp4`. **Fungsi `extract_features()` di sini wajib disalin persis ke worker** |
| `04_ModelB_Forecast.ipynb` | Batch | **Model B = LightGBM** memprediksi kecepatan +1 jam & +3 jam (target = selisih dari profil historis), fitur lag, profil, tetangga, cuaca Open-Meteo, libur. Menghasilkan prediksi seluruh Juni untuk replay |

### 3.3 `Output IPYNB/`: hasil training (sumber data dashboard)

| Folder | Isi penting |
|---|---|
| `01_batch/` | `master_pemsbay/month=1..6/*.parquet` (master dataset immutable), `batch_views/bv_*` (Parquet dari Spark), `bv_hotspots.csv`, `bv_network_daily.csv`, `bv_sensor_profile.csv`, `ref_sensor_meta.csv`, `ref_free_flow_speed.csv`, `figures/` |
| `02_yolo-Quick Test False/02_yolo/` | **`yolov8s_traffic7.pt`** (detektor fine-tuned, mAP50 0,879), `yolov8s_traffic7_info.json` (metrik per kelas), `runs/` (kurva training), `demo_tracking.mp4` |
| `03_model_a-…/03_model_a/` | **`model_a.joblib`**, **`model_a_config.json`** (fitur, parameter jendela, detektor, hasil CV), `timeline_video_uji.csv` (hasil Model A pada video uji: 7 jendela, semua Macet), `ucsd_features.csv` (fitur 254 klip, untuk test), `demo_model_a.mp4`, `figures/` |
| `04_model_b-…/04_model_b/` | **`forecasts_june.parquet`** (inti replay: prediksi per sensor sepanjang Juni), `profile_train.parquet`, `vff_train.csv`, `model_b_1h.joblib`, `model_b_3h.joblib`, **`model_b_config.json`** (fitur, ambang level, metrik uji), `latest_forecast.csv`, `weather_open_meteo.csv`, `figures/` |

Nama folder `03_model_a-20261028T112404Z-1-001` dan `04_model_b-20261028T122005Z-1-001` berasal dari unduhan Google Drive. Pakai path lengkapnya apa adanya. Hanya folder `Quick Test False` yang dipakai, karena itu hasil training penuh.

### 3.4 `dashboard/`: tempat kerja

| Path | Isi |
|---|---|
| `PLAN.md` | **Rencana implementasi lengkap**: scope, stack, arsitektur, struktur folder, pemetaan data, kontrak API, sistem tema, peta 3D, fase + kriteria selesai, angka uji, risiko, demo |
| `design/*.dc.html` | Referensi visual 4 halaman (dua tema per file). Cara membacanya ada di `design/README.md` |
| `design/tokens.css` | Token warna gelap & terang (sumber kebenaran) |
| `design/kamera_frame.jpg` | Frame contoh halaman Kamera |

## 4. Fakta domain yang harus selalu benar

- **Level sensor** (rasio = kecepatan / kecepatan arus bebas v_ff sensor):
  - Lancar ≥ 0,8
  - Melambat 0,6–0,8
  - Padat 0,4–0,6
  - Macet < 0,4
  - Kode di data: `Low`, `Moderate`, `High`, `Severe`.
- **Level kamera (Model A):** `light` = Lancar, `medium` = Padat, `heavy` = Macet.
- **Unit:** data mentah dalam **mph**. Di API & UI selalu tampil **km/jam** (× 1,609344).
- **Waktu:** waktu lokal California (naive timestamp). Jangan dikonversi ke WIB.
- **Mode replay:** tidak ada sensor live sungguhan. Dashboard memutar ulang Juni 2017. Default mulai **Rabu, 7 Juni 2017 16:45**.
- **Domain shift:** detektor fine-tuned (lalu lintas Asia Selatan) hampir buta di jalan tol Barat. Di `video_uji.mp4` hasilnya 1,0 deteksi per frame, sedangkan YOLOv8s COCO 23,7. Karena itu **detektor dipilih otomatis per kamera**.
- Format angka Indonesia: koma desimal (`83,1`), `16,9 jt`.

## 5. Mulai dari mana

Fase 0–6 sudah selesai. Untuk sesi baru:

```
Baca CLAUDE.md, AGENTS.md, dashboard/PROGRESS.md, dan dashboard/PLAN.md. Lanjutkan dari bagian "Yang BELUM dikerjakan" di PROGRESS.md.
```

Untuk menjalankan dashboard dari nol, ikuti `AGENTS.md` §3. Jangan memulai dari ingatan.
