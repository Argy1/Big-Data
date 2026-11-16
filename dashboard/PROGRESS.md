# PROGRESS: catatan kerja dashboard "Arus"

> Dokumen ini mencatat **semua yang sudah dan belum dikerjakan**, supaya pekerjaan bisa dilanjutkan
> walau riwayat chat Claude Code hilang. Baca bersama:
> - `../AGENTS.md`: **panduan menjalankan langkah demi langkah** untuk AI agent (dan manusia);
> - `../CLAUDE.md`: aturan kerja;
> - `PLAN.md`: rencana dan kontrak;
> - `README.md`: cara pakai.
>
> Terakhir diperbarui: **16 November 2026**. Perubahan sejak 29 Oktober ada di §10.

---

## 1. Status singkat

| Fase (PLAN §13) | Isi | Status |
|---|---|---|
| 0 | Kerangka, salin data, tema dasar, Docker Compose | ✅ Selesai |
| 1 | API batch (DuckDB) + jam replay + WebSocket | ✅ Selesai |
| 2 | Halaman Ringkasan Kota + peta 3D/2D | ✅ Selesai |
| 3 | Halaman Prediksi Sensor | ✅ Selesai |
| 4 | Halaman Analitik & Model | ✅ Selesai |
| 5 | Speed layer (worker YOLO + Model A) + halaman Kamera | ✅ Selesai |
| 6 | Poles, test E2E, aksesibilitas, README, demo | ✅ Selesai |
| Pasca-6 | Bersih-bersih disk, perkecil image Docker | ✅ Selesai |
| Pasca-6 | Uji menyeluruh + perbaikan 8 bug sebelum presentasi | ✅ Selesai |
| 7 (opsional) | Inferensi Model B langsung di API | ⏸️ Ditunda (Argy: "nanti saja") |

**Kesimpulan:** semua fase wajib selesai dan terverifikasi. Dashboard siap dipresentasikan.

Hasil test (diuji ulang **16 Nov 2026** bila kolom "16 Nov" terisi; lainnya dari 29 Okt):

| Test | 29 Okt | 16 Nov 2026 |
|---|---|---|
| backend pytest | 66 lulus | **66 lulus** |
| worker pytest | 6 lulus | **6 lulus** (CPU, sekitar 2 menit) |
| web Vitest | 18 lulus | **18 lulus** |
| Playwright E2E | 15/15 lulus | belum diuji ulang (Docker Desktop tidak aktif saat verifikasi) |
| Lighthouse aksesibilitas | 100 di 4 halaman × 2 tema | belum diuji ulang |

---

## 2. Cara menjalankan & mengakses localhost

### 2.1 Menyalakan

Prasyarat: **Docker Desktop** menyala (ikon paus di taskbar tidak berkedip).

```bash
cd "D:\Semester 5\Teknologi Big data\Projek Akhir\dashboard"
docker compose up -d                 # menyalakan redis, api, worker, web di background
```

- Panduan lengkap langkah demi langkah (termasuk verifikasi & troubleshooting): `../AGENTS.md` §3.
- Pertama kali, atau setelah kode berubah: `docker compose up -d --build`. Build worker bisa makan ±20–25 menit karena berisi PyTorch + CUDA.
- Semua service memakai `restart: unless-stopped`, jadi **setelah laptop atau Docker Desktop restart, stack hidup lagi sendiri**. Tunggu ±30 detik.
- Folder `data/` (518 MB) harus sudah ada. Kalau hilang, jalankan sekali: `python scripts/copy_data.py`.

### 2.2 Alamat yang bisa dibuka

| Alamat | Isi |
|---|---|
| **http://localhost:3001** | **Dashboard, mode Docker** (`docker-compose.yml`: `"3001:3000"`). Ringkasan · Kamera · Prediksi · Analitik |
| http://localhost:3001/kamera | Kamera live (video beranotasi YOLO + keputusan Model A) |
| http://localhost:3001/prediksi/403225 | Contoh halaman Prediksi (Airport Blvd) |
| http://localhost:3001/analitik | Analitik & kinerja model |
| http://localhost:3000 | Dashboard, mode dev tanpa Docker (`pnpm dev`, lihat `../AGENTS.md` §4). Port 3000 juga dipakai E2E secara default |

> **Catatan port (16 Nov 2026):** dokumen lama menulis `localhost:3000` untuk mode Docker. Yang berlaku sekarang adalah **3001** untuk Docker (sejak `docker-compose.yml` diubah 3 Nov 2026). CORS API sudah mengizinkan keduanya. Alasan perubahan itu belum tercatat; lihat §10.
| **http://localhost:8000/docs** | **Backend FastAPI**: dokumentasi API interaktif (Swagger), bisa dicoba langsung |
| http://localhost:8000/api/health | Status lengkap: data, Redis, 5 model, worker (GPU/CPU) |
| `ws://localhost:8000/ws/live` | WebSocket (dipakai dashboard, tidak dibuka manual) |
| `localhost:6379` | Redis |

### 2.3 "Database"-nya ada di mana?

Ada tiga penyimpanan, dan semuanya ikut menyala otomatis dengan `docker compose up`:

| Penyimpanan | Lokasi | Isi | Cara melihat |
|---|---|---|---|
| **DuckDB** (in-memory, read-only) | dibaca dari `data/` (Parquet/CSV hasil notebook) | batch layer: master dataset 16,9 jt baris, batch view, prediksi Juni | lewat API, mis. `/api/analytics/summary` |
| **SQLite** | `appdata/arus.sqlite` | keputusan city planner + daftar kamera | `/api/decisions`, `/api/cameras`, atau buka file dengan DB Browser for SQLite |
| **Redis** | container `arus-redis-1` (port 6379) | speed layer: stream jendela kamera, frame JPEG, status worker | `docker exec -it arus-redis-1 redis-cli` lalu `KEYS *` |

Video unggahan disimpan di `appdata/uploads/`.

### 2.4 Perintah sehari-hari

```bash
docker compose ps                    # status keempat service
docker compose logs -f worker        # log (ganti worker dengan api / web / redis)
docker compose restart api           # restart satu service
docker compose stop                  # matikan semua (tidak hidup sendiri sampai di-up lagi)
python scripts/reset_demo.py         # kembalikan ke kondisi awal demo (lihat §6)
```

---

## 3. Arsitektur & stack (ringkas)

```
BATCH (selesai di Colab)                     SPEED (worker, GPU)
PEMS-BAY -> Parquet -> Spark batch views     video -> 10 fps/640 px -> YOLOv8 + ByteTrack
         -> Model B LightGBM -> forecasts       -> fitur jendela 5 dtk -> Model A (Random Forest)
                    |                                       -> Redis
                    v                                          |
SERVING   FastAPI + DuckDB + SQLite  <---------- Redis --------+
          REST /api/* · WebSocket · MJPEG
                    |
                    v
          Next.js 15 (4 halaman, tema gelap/terang, peta 3D three.js + 2D MapLibre)
```

| Bagian | Folder | Teknologi utama (versi dipin) |
|---|---|---|
| Serving/API | `backend/` | Python 3.13, uv, FastAPI, DuckDB `<2`, SQLModel/SQLite, redis.asyncio, scikit-learn 1.6.1, lightgbm 4.6.0 |
| Speed layer | `worker/` | torch 2.11.0+cu128 (RTX 5050), ultralytics 8.4.191, OpenCV, scikit-learn 1.6.1 |
| Frontend | `web/` | Next.js 15.5 (Turbopack), React 19, Tailwind v4, next-themes, React Three Fiber, MapLibre v6, ECharts 6, TanStack Query, Zustand |
| Data | `data/` (gitignored) | salinan `Output IPYNB/` + video `Dataset/`, dicek MD5 oleh `scripts/copy_data.py` |
| Orkestrasi | `docker-compose.yml` | redis, api, worker (GPU), web |

---

## 4. Detail yang sudah dikerjakan per fase

### Fase 0: Kerangka & data
- Struktur folder sesuai PLAN §5, `.gitignore` (data/, appdata/, model, video, node_modules), `.env.example`.
- `scripts/copy_data.py`: salin dari `Output IPYNB/` & `Dataset/` ke `data/` dengan verifikasi ukuran + MD5, dan menulis `data/manifest.json`. Folder sumber tidak pernah diubah.
- FastAPI `/api/health`, Next.js + Tailwind v4 + shadcn + next-themes (default **gelap**, `storageKey` `arus-theme`), Sidebar + ThemeToggle, Docker Compose.
- Terverifikasi: torch `+cu128` mendeteksi RTX 5050, `.joblib` dimuat tanpa warning versi.

### Fase 1: API batch & replay
- DuckDB views di atas Parquet/CSV.
- `levels.py`: ambang 0,4 / 0,6 / 0,8, mph → km/jam ×1,609344.
- Router: meta, replay, network (snapshot/series/alerts), sensors, analytics, models, decisions.
- `ReplayClock`: 1 tick = +15 menit tiap 5 dtk, berhenti sendiri di akhir data, dan **data aktual tidak bocor ke masa depan**.
- WebSocket `tick` / `replay` / `camera`.
- Angka PLAN §12 dijadikan test.

### Fase 2: Ringkasan Kota
- 4 KPI, peta **3D three.js** (kolom = tingkat kemacetan, putar dengan drag, klik → Prediksi), peta 2D MapLibre + basemap CARTO (fallback peta skematis saat offline).
- Toggle Sekarang / +1 jam / +3 jam, panel Peringatan dini, pencarian sensor, kontrol replay.
- Semua grafik ikut tema.

### Fase 3: Prediksi Sensor
- Contoh Airport Blvd (#403225): 99 → 46 → 100 km/jam (Lancar → Padat → Lancar).
- Grafik aktual vs prediksi 1 jam/3 jam + profil normal + pita zona level.
- Panel "Kenapa diprediksi padat?" + feature importance Model B (dev_now 0,42).
- Tindakan disarankan → "Catat keputusan" (SQLite + toast).
- Tabel uji Juni 2017.

### Fase 4: Analitik & Model
- Heatmap jam sibuk (puncak **Kamis 17:00, 33,1%**), tren 181 hari (pola gigi gergaji), 3 kartu model, diagram Lambda.
- R² profil rutin 0,733 dihitung saat API start.

### Fase 5: Speed layer + Kamera
- Worker: `speed_layer/features.py` = **salinan persis** `extract_features()` notebook 03.
  - Video diturunkan ke 10 fps / lebar 640, jendela 5 dtk, geser 2,5 dtk.
  - Model A memberi label Lancar/Padat/Macet.
- **Auto-pick detektor** per kamera: COCO vs fine-tuned diuji di 6 frame, lalu dipilih yang mendeteksi lebih banyak. Di `video_uji.mp4`: COCO 24,2 vs fine-tuned 1,0 deteksi/frame, karena domain shift.
- Halaman Kamera:
  - stream MJPEG beranotasi (kotak + ID ByteTrack);
  - timeline jendela;
  - fitur vs median kelas UCSD;
  - ganti detektor live;
  - **unggah video** (≤ 300 MB, termasuk 4K potret);
  - maksimal 3 kamera bersamaan.

### Fase 6: Poles & test
- Skeleton/empty/error state dan banner "Tidak terhubung ke API".
- Playwright E2E (alur demo, tema, aria, 390 px, screenshot 4 halaman × 2 tema di `web/tests/e2e/__screenshots__/`, axe WCAG 2.1 AA).
- Lighthouse a11y, README lengkap.
- Demo diuji dari `docker compose up --build` yang bersih.

### Pasca-Fase 6 (a): bersih-bersih disk C:
- C: tadinya hanya kosong 16 GB.
- **Cache uv** dipindah ke `D:\dev-cache\uv`. Environment variable User `UV_CACHE_DIR` diset.
- **Dockerfile worker & backend** memakai `uv sync --no-cache`. Sebelumnya cache 7,4 GB ikut masuk image: worker turun dari 25 GB → 12,9 GB, api dari 1,9 GB → 1,2 GB.
- Argy memindahkan **disk Docker Desktop** ke `D:\Docker\DockerDesktopWSL`.
- Cache yang bisa dibuat ulang di C: dihapus (npm, pip, pnpm, shader NVIDIA, temp lama, Playwright lama), ±25,8 GB.
- Hasil: C: kosong **±164 GB**.

### Pasca-Fase 6 (b): uji menyeluruh & perbaikan bug sebelum presentasi

| # | Bug | Perbaikan | Bukti uji |
|---|---|---|---|
| 1 | Worker mati permanen kalau Redis putus | `worker/speed_layer/main.py` menyambung ulang. `run_camera.py`: player yang crash mengakhiri kamera, lalu manager me-restart. | Redis di-restart → kamera live lagi dalam 16 dtk, proses worker tidak mati |
| 2 | Container tidak hidup setelah Docker restart | `restart: unless-stopped` di `docker-compose.yml` | policy aktif di 4 container |
| 3 | Data basi setelah API restart | `web/lib/ws.ts`: refetch semua query saat WebSocket tersambung ulang | API di-restart → halaman sinkron dalam 14 dtk tanpa reload |
| 4 | Sisa keputusan dari test E2E muncul saat demo | skrip baru `scripts/reset_demo.py` | "Siap demo.", 0 keputusan |
| 5 | Jam keputusan (waktu nyata) bisa tertukar dengan jam replay | label "waktu nyata, bukan waktu replay" | E2E lulus |
| 6 | Sidebar Kamera butuh scrollbar di layar 720–768 px | keterangan kecil disembunyikan + jarak dirapatkan saat tinggi ≤ 820 px | overflow 0 px di 1280×720 & 1366×768, 4 halaman |
| 7 | Status kamera terpotong di dropdown | format `CAM-01 · live · nama` | dicek |
| 8 | Peta 2D hitam saat tile dimuat | overlay "Memuat peta…" | dicek |

Yang diuji dan **tidak** bermasalah:
- 31 request API normal & kasus tepi;
- pencarian sensor dan keempat halaman;
- resolusi 1024×768, 1280×720, 1920×1080 (tanpa scroll horizontal);
- console bebas error.

---

## 5. Keputusan teknis & penyimpangan dari PLAN (sudah disetujui)

| Hal | Keputusan | Alasan |
|---|---|---|
| Feature importance Model B | Pakai angka model asli (dev_now **0,422**, top-5 dev_now, prof_target, hour_target, v_yesterday, ratio_now), bukan 0,49 dari desain | angka desain berasal dari run lama; Argy memilih angka model. PLAN §6 sudah diperbarui |
| Akhir data replay | `30 Jun 2017 22:45`, bukan 23:45 | origin terakhir di `forecasts_june.parquet` |
| DuckDB | dipin `<2` | DuckDB 2.0 mengubah API Python |
| Toleransi fitur video_uji | 0,05 (level & probabilitas identik dengan notebook) | perbedaan decoder video Windows/Linux, bukan kode kita |
| `created_at` keputusan | disimpan UTC, ditampilkan di jam lokal penonton | waktu nyata; `ts` keputusan = waktu replay |
| Angka UI | pembulatan `halfEven` | menyamakan dengan `round()` Python & test §12 |
| Worker | `features.py` disalin persis dari notebook 03 | wajib menurut CLAUDE.md |

---

## 6. Checklist sebelum presentasi

1. Docker Desktop menyala, lalu cek http://localhost:8000/api/health:
   - `"status":"ok"`;
   - `"worker":{"cameras_live":1,"device":"GPU · RTX 5050"}`.
2. Jalankan `python scripts/reset_demo.py`. Hasilnya harus "Siap demo." (0 keputusan, hanya CAM-01, replay dijeda di Rab 7 Jun 2017 16:45).
   **Wajib setelah `pnpm e2e`**, karena test alur demo mencatat keputusan sungguhan.
   Per 3 Nov 2026, `appdata/uploads/` masih berisi dua video unggahan (`cam-02-…`, `cam-03-…`) dari sesi uji. Jalankan reset ini sebelum demo.
3. Buka http://localhost:3001 (mode Docker; tema gelap). Untuk proyektor, tombol **Mode terang** ada di sidebar.
4. Ikuti skenario demo ±5 menit di `README.md` (bagian "Skenario demo").
5. Kalau internet mati: peta 2D otomatis memakai peta skematis, dan peta 3D tetap jalan.

Angka yang akan muncul saat demo (Rab 7 Jun 2017 16:45):
- Ringkasan: 89 sensor padat/macet, +1 jam 117, +3 jam 7, kecepatan rata-rata 83,1 km/jam.
- Airport Blvd: 99 → 46 km/jam, profil normal Rabu 17:00 48,6 km/jam.
- Kamera: CAM-01 **Macet**, detektor otomatis COCO 24,2 vs fine-tuned 1,0 deteksi/frame.
- Analitik: puncak Kamis 17:00 (33,1%).
- Model:
  - YOLO mAP50 0,879;
  - Model A akurasi 94,5% (macro-F1 0,910);
  - Model B MAE 1 jam 3,21 km/jam (recall macet 0,701).

---

## 7. Yang BELUM dikerjakan / masih terbuka

| Item | Status | Catatan |
|---|---|---|
| **Fase 7**: inferensi Model B on-the-fly | Ditunda | Port `make_rows()` notebook 04 ke API. Kriteria: selisih < 0,1 mph dengan `forecasts_june.parquet` di 3 timestamp acak. Tampilan UI tidak berubah, nilainya untuk arsitektur/presentasi |
| Konfirmasi versi lightgbm di Colab | ✅ Terkonfirmasi | Dicek langsung di runtime Colab 28 Okt 2026: lightgbm **4.6.0**, scikit-learn 1.6.1, ultralytics 8.4.191 — sama dengan pin |
| Uji restart Docker Desktop sungguhan | Belum dicoba | Restart policy sudah aktif. Restart Docker Desktop sekali lalu cek `/api/health` setelah ±30 dtk |
| Hapus kamera unggahan dari UI | Tidak ada tombol | Lewat `python scripts/reset_demo.py` atau `DELETE /api/cameras/{id}` |
| Video unggahan rusak | Kamera berstatus "error" dan worker mencoba ulang tiap 10 dtk | Hapus dengan cara di atas |
| Git | **Sudah** repo git sejak 16 Nov 2026 di root `Projek Akhir/`, di-push ke https://github.com/Argy1/Big-Data.git (branch `main`, commit awal `2eb662b`) | Dataset dan file besar sengaja tidak di-commit (lihat §10) |
| Port Docker `3001` | `docker-compose.yml` memetakan web ke 3001, sedangkan dokumen lama menulis 3000 | Konfirmasi apakah perubahan ini disengaja. Tidak ada catatan alasannya |
| Verifikasi live stack Docker | Belum diulang sejak 29 Okt. Docker Desktop tidak aktif saat verifikasi 16 Nov | Jalankan §3 `AGENTS.md`, lalu `pnpm e2e` (dengan `E2E_BASE_URL=http://localhost:3001`) dan `pnpm lighthouse` |
| Dukungan GPU di `docker-compose.yml` | Blok `deploy` GPU di service worker belum diuji di mesin tanpa GPU NVIDIA | Lihat `../AGENTS.md` §6 |

Keterbatasan yang disengaja (PLAN §15, jelaskan jujur saat presentasi):
- **tidak ada sensor live**, data Juni 2017 diputar ulang (badge REPLAY);
- probabilitas Model A sering > 99% (terlalu yakin, ada catatannya di UI);
- basemap butuh internet;
- maksimal 3 kamera bersamaan.

---

## 8. Jebakan lingkungan (penting untuk sesi Claude Code berikutnya)

- **uv Python di app Claude:** junction `cpython-3.13` rusak. Sebelum `uv sync` / `uv run` di `backend/` atau `worker/`, set:
  ```powershell
  $env:UV_PYTHON = "C:\Users\argyf\AppData\Roaming\uv\python\cpython-3.13.16-windows-x86_64-none\python.exe"
  $env:UV_CACHE_DIR = "D:\dev-cache\uv"
  ```
- **PowerShell 5.1** `Set-Content -Encoding utf8` menulis BOM yang merusak `package.json`. Tulis JSON lewat node.
- **pnpm** butuh `allowBuilds` di `web/pnpm-workspace.yaml`.
- **Pane browser Claude:** canvas 3D bisa tertahan 300×150 karena pane tidak menggambar. Verifikasi peta 3D dengan Playwright Chromium, bukan pane.
- **Rebuild worker** ±20–25 menit (ekspor image besar). Tunggu prosesnya selesai, jangan hanya menunggu image muncul.
- Test:
  - `cd backend && uv run pytest`
  - `cd worker && uv run pytest`
  - `cd web && pnpm test`
  - `pnpm e2e` (stack harus jalan, lalu jalankan `reset_demo.py`)
  - `pnpm lighthouse`
- Jangan pernah mengubah `../Dataset`, `../Notebooks`, `../Output IPYNB` (read-only).
- **Docker Desktop harus aktif** sebelum `docker compose`. Kalau belum, muncul `failed to connect to the docker API`.
- **`../Dataset` dan file besar di `../Output IPYNB` tidak ada di GitHub.** Clone baru tidak bisa menjalankan `copy_data.py` sampai dua folder itu disalin manual dari pemilik proyek (lihat `../AGENTS.md` §3 langkah 2).
- Tes E2E dan Lighthouse default ke `localhost:3000`. Untuk stack Docker, set `E2E_BASE_URL=http://localhost:3001`.

## 9. Cara melanjutkan dengan Claude Code atau AI agent lain

Contoh prompt untuk sesi baru:

```
Baca CLAUDE.md, AGENTS.md, dashboard/PROGRESS.md, dan dashboard/PLAN.md. Semua fase 0–6 sudah selesai.
Kerjakan Fase 7 saja, lalu berhenti dan laporkan.
```

Prompt siap pakai lainnya (menjalankan, tes, reset demo) ada di `../AGENTS.md` §9.

---

## 10. Log perubahan sejak 29 Oktober 2026

Urutan dari yang terbaru. Setiap entri menyebut bukti yang bisa dicek di file.

| Tanggal | Perubahan | Bukti / catatan |
|---|---|---|
| **16 Nov 2026** | Dokumentasi diperbarui: `PROGRESS.md` (ini), `README.md`, `CLAUDE.md`, dan panduan baru `AGENTS.md` di root | `AGENTS.md` berisi langkah 0–8 untuk menjalankan dan verifikasi |
| **16 Nov 2026** | Folder root `Projek Akhir/` menjadi repo git dengan `.gitignore` root. Di-push ke `https://github.com/Argy1/Big-Data.git` (branch `main`, commit `2eb662b`, 279 file, ±33 MB) | Dikecualikan: `Dataset/`, `_check/`, `dashboard/data/`, dan `.zip`, `.mp4`, `.avi`, `.pt`, `.joblib`, `.parquet` (CLAUDE.md §2.8) |
| **16 Nov 2026** | Verifikasi ulang: backend 66 lulus, worker 6 lulus, web 18 lulus. E2E dan Lighthouse belum diulang (Docker tidak aktif) | Perintah ada di `AGENTS.md` §5 |
| **15 Nov 2026** | Naskah JATI direvisi. Daftar pustaka menjadi 37 entri (26 terbit 2021–2026). Laporan akhir (.docx dan .pdf) dibuat | `jurnal/referensi/daftar_referensi_terverifikasi.md`, `jurnal/naskah/`, `laporan/` |
| **3 Nov 2026** | `docker-compose.yml` terakhir diubah. Isinya sekarang memetakan web ke port host **3001** dan CORS mengizinkan 3001. Alasan perubahan belum tercatat | Lihat catatan port di §2.2 |
| **3 Nov 2026** | `appdata/uploads/` berisi dua video unggahan dari sesi uji. Belum dihapus (`reset_demo.py` belum dijalankan) | Lihat §6 checklist |
| **2 Nov 2026** | Eksperimen jurnal selesai di `jurnal/eksperimen/`: ablation Model B, MAE per jam, validasi silang Model A, dan gambar. Reproduksi Model B cocok dengan `model_b_config.json` dalam toleransi 0,02 mph | `jurnal/eksperimen/LOG.md` |
| **29 Okt 2026** | Fase 0–6 dan perbaikan 8 bug sebelum presentasi (§4) | §4 |
