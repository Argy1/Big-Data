# AGENTS.md: panduan AI agent untuk proyek "Arus"

> **Baca file ini sampai habis sebelum menjalankan perintah apa pun.**
> File ini adalah pintu masuk untuk AI agent apa pun (Claude Code, Codex, Cursor, Copilot, dll.).
> Claude Code juga membaca `CLAUDE.md` di folder yang sama. Isinya aturan kerja yang sejalan dengan file ini.

- **Repo:** https://github.com/Argy1/Big-Data.git
- **Apa ini:** dashboard untuk *city planner* bernama **Arus**. Isinya kondisi lalu lintas 325 sensor jalan tol Bay Area (data PEMS-BAY, diputar ulang sebagai "sekarang" pada Juni 2017), prediksi kemacetan 1 jam dan 3 jam per sensor, serta analisis video kamera secara real-time.
- **Arsitektur Lambda:** batch layer (training di Google Colab, hasilnya di `Output IPYNB/`), speed layer (`dashboard/worker`: YOLOv8 + ByteTrack + Model A), serving layer (`dashboard/backend` FastAPI + `dashboard/web` Next.js).

---

## 0. Aturan wajib

1. **`Dataset/`, `Notebooks/`, `Output IPYNB/` bersifat READ-ONLY.** Jangan ubah, pindah, atau hapus isinya.
2. Semua kode baru ditulis di `dashboard/`. Eksperimen jurnal boleh di `jurnal/eksperimen/` dan `jurnal/gambar/`.
3. **Jangan commit atau push** kecuali diminta. Jangan pernah commit `.env`, `dashboard/data/`, `dashboard/appdata/`, model (`.pt`, `.joblib`, `.parquet`), atau video.
4. **Jangan jalankan `docker compose down -v`** dan **jangan hapus `dashboard/appdata/`**. Folder itu berisi keputusan city planner dan video unggahan. Untuk mengembalikan demo ke kondisi awal, pakai `python scripts/reset_demo.py`.
5. Penjelasan ke pengguna dan teks UI memakai **Bahasa Indonesia**. Nama variabel, fungsi, dan komentar kode boleh Bahasa Inggris.
6. **Angka acuan** (`dashboard/PLAN.md` §12) jangan diubah agar test lulus. Kalau hasil API berbeda, cari penyebabnya.
7. Kalau ada yang tidak jelas di PLAN atau data yang tidak cocok, **tanya dulu**. Jangan menebak.

---

## 1. Peta folder

| Path | Isi | Status |
|---|---|---|
| `CLAUDE.md` | Aturan kerja untuk Claude Code | baca |
| `AGENTS.md` | file ini: panduan menjalankan | baca |
| `Dataset/` | data mentah: PEMS-BAY.csv, dataset YOLO, UCSD, video uji | **read-only, tidak ada di GitHub** |
| `Notebooks/` | 4 notebook Colab (01 EDA batch, 02 YOLO, 03 Model A, 04 Model B) | read-only |
| `Output IPYNB/` | hasil training: model, batch views, forecast | **read-only; versi GitHub hanya file kecil** |
| `dashboard/` | **tempat kerja utama**: aplikasi (backend, worker, web), Docker, skrip | kerja di sini |
| `dashboard/PROGRESS.md` | status, log perubahan, yang belum dikerjakan | baca sebelum mulai |
| `dashboard/PLAN.md` | rencana implementasi, kontrak API, angka acuan | baca bila mengubah kode |
| `dashboard/README.md` | ringkasan untuk manusia: cara jalan, skenario demo | referensi |
| `jurnal/` | naskah jurnal JATI, daftar pustaka, eksperimen tambahan | lihat §8 |
| `laporan/` | laporan akhir (.docx dan .pdf) | referensi |
| `_check/` | file sementara bekas analisis | **abaikan** |

---

## 2. Status singkat

- **Fase 0 sampai 6 selesai.** Fase 7 (inferensi Model B langsung di API) opsional dan ditunda. Detail di `dashboard/PROGRESS.md`.
- Dashboard diuji ulang pada 16 November 2026 (lihat §5). Test backend dan web lulus. Test E2E dan pemeriksaan live Docker belum diuji ulang karena Docker Desktop tidak aktif saat itu.

---

## 3. Menjalankan dashboard, langkah demi langkah

Semua perintah dijalankan dari folder yang ditulis di tiap langkah. Pakai PowerShell atau Git Bash di Windows.

### Langkah 0: cek prasyarat

| Alat | Cara cek | Dipakai untuk |
|---|---|---|
| Docker Desktop (WSL 2) | `docker info` harus menampilkan info server, bukan error | menjalankan semua layanan (cara utama) |
| Python 3.x | `python --version` | menyalin data (`copy_data.py`, hanya library standar) |
| uv | `uv --version` | test backend/worker, mode tanpa Docker |
| Node.js 24 dan pnpm | `node --version`, `pnpm --version` | test web, mode tanpa Docker |
| GPU NVIDIA (opsional) | `nvidia-smi` | worker lebih cepat. Tanpa GPU, worker memakai CPU (lihat §6) |

### Langkah 1: ambil kode

```bash
git clone https://github.com/Argy1/Big-Data.git
cd Big-Data
```

### Langkah 2: siapkan dua folder sumber yang TIDAK ada di GitHub

Folder `Dataset/` dan file besar di `Output IPYNB/` (`.parquet`, `.pt`, `.joblib`, video) tidak ikut git karena melebihi batas ukuran. Minta folder ini dari pemilik proyek, lalu letakkan di root repo:

```
Big-Data/
├── Dataset/          ← WAJIB (PEMS-BAY.csv + video uji)
├── Output IPYNB/     ← WAJIB, versi lengkap (termasuk .parquet, .pt, .joblib)
├── Notebooks/        ← opsional (referensi)
└── dashboard/
```

`copy_data.py` berhenti dengan daftar "missing" kalau file sumbernya belum lengkap.

### Langkah 3: salin data dan model ke `dashboard/data/`

```bash
cd dashboard
python scripts/copy_data.py
```

- Membuat `dashboard/data/` (sekitar 518 MB) dan memverifikasi tiap file dengan ukuran dan MD5.
- Aman dijalankan ulang: file yang sudah cocok dilewati.
- `--no-video` melewati video uji, tetapi video dipakai di halaman Kamera dan skenario demo, jadi biasanya jangan dipakai.

### Langkah 4: nyalakan Docker Desktop

```bash
docker info
```

Kalau muncul `failed to connect to the docker API`, buka Docker Desktop dan tunggu ikon paus di taskbar berhenti berkedip. Lalu ulangi `docker info`.

### Langkah 5: jalankan semua layanan

```bash
cd dashboard
docker compose up -d --build
```

- Layanan yang dijalankan: `redis` (port 6379), `api` (port 8000), `worker`, dan `web` (port **3001**).
- **Build pertama memakan waktu sekitar 20 sampai 25 menit** (image worker berisi PyTorch + CUDA). Jangan dibatalkan walaupun terlihat diam.
- Build berikutnya: `docker compose up -d` (hitungan detik).
- Semua layanan memakai `restart: unless-stopped`, jadi hidup lagi sendiri setelah Docker atau laptop restart.

### Langkah 6: verifikasi layanan

Tunggu sekitar 30 detik, lalu:

```bash
docker compose ps
curl http://localhost:8000/api/health
```

Di PowerShell, pakai `Invoke-RestMethod http://localhost:8000/api/health`.

**Hasil yang benar:**
- `docker compose ps`: keempat layanan `running`.
- `"status": "ok"`
- `"data_ok": true` dan `"missing": []`
- `"redis_ok": true`
- `"models"`: `model_a`, `model_b_1h`, `model_b_3h`, `yolo_ft`, dan `yolo_coco` bernilai `true`.
- `"worker": {"cameras_live": 1, ...}` setelah worker berjalan sekitar 30 detik. Kalau 0, lihat §6.

### Langkah 7: buka dashboard

| Alamat | Isi |
|---|---|
| **http://localhost:3001** | **Dashboard** (mode Docker): Ringkasan, Kamera, Prediksi, Analitik |
| http://localhost:3001/kamera | Kamera live (video beranotasi YOLO + keputusan Model A) |
| http://localhost:3001/prediksi/403225 | Contoh Prediksi (Airport Blvd) |
| http://localhost:3001/analitik | Analitik dan kinerja model |
| http://localhost:8000/docs | Dokumentasi API interaktif (Swagger) |

Halaman Ringkasan harus menampilkan waktu replay **Rab, 7 Jun 2017 16:45** dan badge **REPLAY**. Tema gelap adalah default. Tombol **Mode terang** ada di sidebar.

### Langkah 8: kembalikan ke kondisi demo (wajib sebelum demo)

```bash
cd dashboard
python scripts/reset_demo.py
```

Hasil yang benar: pesan **"Siap demo."** (0 keputusan, hanya CAM-01, replay dijeda di Rab 7 Jun 2017 16:45). Jalankan lagi setelah setiap `pnpm e2e` atau setelah mengunggah video, karena keduanya meninggalkan data uji.

### Menghentikan layanan

```bash
cd dashboard
docker compose stop        # mematikan, data tetap aman
```

---

## 4. Mode pengembangan tanpa Docker (untuk menulis kode)

Pakai empat terminal. Redis tetap dari Docker.

```bash
# Terminal A: Redis
cd dashboard
docker compose up -d redis

# Terminal B: API (port 8000)
cd dashboard/backend
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal C: worker (opsional; GPU bila ada)
cd dashboard/worker
uv sync                      # torch cu128, wajib untuk GPU RTX 50xx
uv run python check_env.py   # cek CUDA, model A, dan kedua detektor YOLO
uv run python -m speed_layer.main

# Terminal D: web (port 3000)
cd dashboard/web
pnpm install
pnpm dev
```

Default setting sudah cocok untuk mode ini: API memakai `dashboard/data`, CORS mengizinkan `http://localhost:3000`, dan web memanggil `http://localhost:8000`. Untuk Python 3.13 di Windows, lihat §7.

---

## 5. Test

| Perintah | Dari folder | Hasil yang diharapkan | Status 16 Nov 2026 |
|---|---|---|---|
| `uv run pytest` | `dashboard/backend` | 66 lulus | **66 lulus** |
| `uv run pytest` | `dashboard/worker` | 6 lulus (butuh CPU, beberapa menit) | lihat catatan di PROGRESS |
| `pnpm test` | `dashboard/web` | 18 lulus | **18 lulus** |
| `pnpm e2e` | `dashboard/web` | 15 dari 15 lulus. **Stack harus sudah berjalan.** | belum diuji ulang |
| `pnpm lighthouse` | `dashboard/web` | skor aksesibilitas ≥ 90 di 4 halaman × 2 tema | belum diuji ulang |

Catatan untuk `pnpm e2e` dan `pnpm lighthouse`:
- Default alamatnya `http://localhost:3000`. Kalau memakai Docker, set alamat ke port 3001:
  - PowerShell: `$env:E2E_BASE_URL="http://localhost:3001"; pnpm e2e`
  - Git Bash: `E2E_BASE_URL=http://localhost:3001 pnpm e2e`
- Setelah `pnpm e2e`, **wajib** jalankan `python scripts/reset_demo.py`, karena tes alur demo mencatat keputusan sungguhan.

---

## 6. Masalah umum

| Gejala | Penyebab dan solusi |
|---|---|
| `failed to connect to the docker API` | Docker Desktop belum jalan. Buka aplikasinya, tunggu, ulangi langkah 4. |
| Skrip `copy_data.py` menyebut file *missing* | `Dataset/` atau `Output IPYNB/` belum lengkap. Lihat langkah 2. |
| Banner merah "Tidak terhubung ke API" | Cek `docker compose ps`, lalu `docker compose logs api`. |
| `/api/health` → `"data_ok": false` | `data/` belum disalin. Jalankan `python scripts/copy_data.py`. |
| `worker.cameras_live` tetap 0 | `docker compose logs worker`. Pastikan Redis sehat. |
| Chip device menunjukkan `CPU`, padahal ada GPU | Driver NVIDIA atau integrasi GPU di Docker Desktop belum aktif. Perbarui driver, atau jalankan worker di luar Docker (§4). |
| `docker compose up` gagal dengan `could not select device driver "nvidia"` | PC tanpa GPU NVIDIA yang terhubung ke Docker. Jalankan worker di luar Docker (§4). Mengubah `docker-compose.yml` belum diuji. |
| Halaman Kamera menampilkan "HASIL ACUAN" | Worker belum live. Hasil notebook 03 yang ditampilkan. Cek `docker compose logs worker`. |
| Kamera unggahan berstatus `error` | Video unggahan rusak. Hapus dengan `python scripts/reset_demo.py`. |
| Peta 2D tampil skematis, tanpa jalan | Normal bila tidak ada internet. Basemap CARTO butuh internet. Peta 3D tetap jalan. |
| Port 3000 atau 3001 sudah dipakai | `netstat -ano \| findstr :3001`, lalu hentikan proses yang memakai port itu. |

---

## 7. Jebakan lingkungan (Windows)

- **uv tidak menemukan Python 3.13:** junction `cpython-3.13` di komputer pengembang bisa rusak. Set ini sebelum `uv sync` atau `uv run`:
  ```powershell
  $env:UV_PYTHON = "<path-ke-python-3.13>\python.exe"   # hasil dari: uv python find 3.13
  $env:UV_CACHE_DIR = "<folder-cache-uv>"                # opsional, bila drive C: hampir penuh
  ```
  `uv python find 3.13` menampilkan lokasi Python 3.13 yang terpasang. Kalau perintah itu sudah bisa dijalankan, `UV_PYTHON` tidak perlu diset.
- **Jangan tulis `package.json` dengan `Set-Content -Encoding utf8` di PowerShell 5.1.** Itu menambahkan BOM dan merusak file. Tulis JSON lewat `node` atau editor.
- **pnpm** membutuhkan `allowBuilds` di `dashboard/web/pnpm-workspace.yaml`. File ini sudah berisi pengaturan itu.
- **Build worker memakan 20 sampai 25 menit.** Tunggu sampai proses selesai. Jangan berhenti hanya karena image belum muncul.
- **Pane browser di aplikasi Claude:** canvas 3D bisa tertahan di 300×150. Untuk memverifikasi peta 3D, pakai Playwright Chromium.

---

## 8. Jurnal dan laporan (tidak diperlukan untuk menjalankan dashboard)

| Path | Isi |
|---|---|
| `jurnal/naskah/` | draf naskah JATI (.docx dan .pdf), versi terbaru 15 Nov 2026 |
| `jurnal/referensi/` | `referensi.bib` (37 entri) dan daftar pustaka terverifikasi |
| `jurnal/eksperimen/` | ablation Model B, MAE per jam, validasi silang Model A, dan `LOG.md` |
| `jurnal/gambar/` | gambar untuk naskah (PNG 300 dpi) |
| `laporan/` | laporan akhir (.docx dan .pdf) |

Menjalankan eksperimen. `PROJ_BASE` harus berisi path folder `Projek Akhir` (yang berisi `Output IPYNB/`). Lingkungan dan seed ada di `jurnal/eksperimen/LOG.md`:

```bash
# dari folder Projek Akhir (root repo, tempat Output IPYNB/ berada)
PROJ_BASE="<path-ke-Projek-Akhir>" python jurnal/eksperimen/ablation.py   # uji cepat: NB_TEST=1 NB_ITERS=60
python jurnal/eksperimen/model_a_cv.py
python jurnal/eksperimen/buat_gambar.py
```

Pakai lingkungan Python terpisah (lihat `jurnal/PROMPT_EKSPERIMEN.md`), bukan venv dashboard.

Ablation penuh butuh sekitar 25 menit di CPU. Hasil reproduksi sudah cocok dengan `model_b_config.json` dalam toleransi 0,02 mph.

---

## 9. Prompt siap pakai untuk AI agent

Salin salah satu prompt di bawah ke AI agent. Prompt ini sudah mengarahkan agent ke file ini.

**Menjalankan dashboard dari nol:**
> Baca `AGENTS.md` di root repo ini, lalu jalankan dashboard Arus dengan Docker sesuai §3, langkah 0 sampai 7. Jangan ubah `Dataset/`, `Notebooks/`, atau `Output IPYNB/`. Setelah itu cek `http://localhost:8000/api/health` dan laporkan hasilnya dalam Bahasa Indonesia, termasuk langkah mana yang gagal bila ada.

**Menyiapkan demo:**
> Baca `AGENTS.md` §3 langkah 8 dan `dashboard/PROGRESS.md` §6. Jalankan `python scripts/reset_demo.py` dari folder `dashboard` dan pastikan hasilnya "Siap demo.".

**Menjalankan tes:**
> Baca `AGENTS.md` §5. Jalankan tes backend, worker, dan web. Untuk E2E, pastikan stack Docker berjalan dan set `E2E_BASE_URL=http://localhost:3001`. Laporkan jumlah yang lulus dan yang gagal, beserta output-nya bila ada yang gagal. Setelah E2E, jalankan `reset_demo.py`.

**Melanjutkan pekerjaan:**
> Baca `CLAUDE.md`, `dashboard/PROGRESS.md`, dan `dashboard/PLAN.md`. Lanjutkan dari bagian "Yang BELUM dikerjakan" di PROGRESS. Kerjakan satu item saja, jalankan verifikasinya, lalu berhenti dan laporkan.

**Mode pengembangan tanpa Docker:**
> Baca `AGENTS.md` §4. Jalankan Redis lewat Docker, lalu API, worker, dan web di terminal terpisah. Pastikan `/api/health` dan halaman `http://localhost:3000` berfungsi sebelum mengubah kode.

---

## 10. Sumber kebenaran

Kalau ada yang bertentangan, ikuti urutan ini:
1. `CLAUDE.md`: aturan kerja.
2. `dashboard/PLAN.md`: kontrak dan angka acuan.
3. `dashboard/PROGRESS.md`: status terbaru dan keputusan yang sudah disetujui.
4. `AGENTS.md` (file ini): langkah menjalankan.
5. `dashboard/README.md`: ringkasan untuk manusia.
