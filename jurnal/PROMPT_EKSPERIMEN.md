# Tugas: Eksperimen & gambar untuk naskah jurnal JATI (fase "jurnal-1")

Baca dulu `CLAUDE.md` dan `dashboard/PLAN.md` (§6 data, §7 domain, §12 angka acuan).
**Pengecualian aturan CLAUDE.md untuk tugas ini saja:** kamu BOLEH menulis kode & file baru di folder `jurnal/` (khusus `jurnal/eksperimen/` dan `jurnal/gambar/`).
Aturan lain tetap berlaku: jangan ubah/pindah/hapus isi `Dataset/`, `Notebooks/`, `Output IPYNB/`, dan jangan ubah apa pun di `dashboard/` (kode dashboard, data, container Docker yang sedang jalan jangan disentuh).

## Tujuan
Naskah jurnal (JATI) tentang sistem "Arus" butuh bukti tambahan untuk bagian Hasil & Pembahasan. Semua angka harus **hasil eksekusi nyata**, tidak boleh diperkirakan atau dikarang.

## Lingkungan
- Buat venv terpisah di `jurnal/eksperimen/.venv` (jangan pakai/ubah env dashboard). Pin: python 3.13 bila ada (boleh 3.12), lightgbm==4.6.0, scikit-learn==1.6.1, numpy==2.1.3, pandas==2.2.3, pyarrow==23.0.1, joblib==1.6.0, matplotlib. CPU saja (GPU tidak perlu). Set seed tetap di semua tempat.
- Ingat jebakan lingkungan di `dashboard/PROGRESS.md` (UV_PYTHON, BOM PowerShell, dll).

## E1. Ablation Model B (LightGBM)
Ikuti **persis** pipeline `Notebooks/04_ModelB_Forecast.ipynb` (split kronologis train Jan–Apr / val Mei / test Juni 2017, target = speed(t+h) − profile(t+h), 23 fitur, parameter LightGBM, early stopping di val, subset "Semua" dan "Tidak rutin", level & ambang dari `model_b_config.json`). Data masukan dibaca dari `Output IPYNB/` (master parquet, `profile_train.parquet`, `vff_train.csv`, `weather_open_meteo.csv`), tanpa internet.

1. **Reproduksi dulu**: latih varian PENUH untuk horizon 1h dan 3h. MAE harus sama dengan `model_b_config.json` (test_metrics) dalam toleransi 0,02 mph:
   1h semua 1,9931 · 1h tidak rutin 7,0849 · 3h semua 2,2134 · 3h tidak rutin 4,5062.
   Jika meleset lebih dari toleransi: **berhenti, laporkan penyebabnya, jangan lanjut.**
2. Latih ulang (parameter & seed sama) varian berikut, tiap horizon:
   - tanpa cuaca: `rain_now_mm`, `rain_3h_mm`
   - tanpa tetangga: `nb_ratio_now`
   - tanpa lag & rolling: `v_lag5m`, `v_lag15m`, `v_lag30m`, `v_lag60m`, `v_roll30m`, `v_roll60m`, `v_std60m`
   - tanpa kalender: `hour_target`, `dow_target`, `weekend_target`, `holiday_target`
   - tanpa riwayat hari/minggu lalu: `v_yesterday`, `v_lastweek`
3. Metrik tiap varian × horizon × subset (Semua / Tidak rutin): MAE (mph), RMSE (mph), macro-F1 level, recall macet, precision macet. Simpan juga MAE dalam km/jam (× 1,609344).
   Tulis ke `jurnal/eksperimen/hasil_ablation.csv`.
4. Feature importance (gain, ternormalisasi) varian penuh → `jurnal/eksperimen/importance_1h.csv`, `importance_3h.csv`.

## E2. Kesalahan menurut jam (baseline vs Model B)
Dari prediksi uji Juni: MAE per jam-dalam-hari (0–23) untuk persistence, profil historis, dan Model B, horizon 1h dan 3h, subset Semua → `jurnal/eksperimen/mae_per_jam.csv`.

## E3. Model A (Random Forest, UCSD)
Baca `Output IPYNB/03_model_a-*/…/model_a_config.json` dan `Notebooks/03_ModelA_Nowcast.ipynb`. Dari `ucsd_features.csv`, reproduksi skema validasi silang yang dipakai notebook (pakai skema yang sama, termasuk pengelompokan/pemisahan data bila ada) dan hasilkan:
- akurasi, macro-F1, precision/recall/F1 per kelas, confusion matrix (angka), plus baseline "kelas mayoritas" → `jurnal/eksperimen/hasil_model_a.csv` dan `confusion_model_a.csv`.
- Cocokkan angka CV dengan yang tercatat di config. Bila beda, laporkan, jangan disamarkan.
- Jangan klaim Model A akurat di video uji: `timeline_video_uji.csv` hanya 7 jendela, semuanya Macet.

## E4. Gambar untuk naskah (folder `jurnal/gambar/`)
Format PNG 300 dpi, latar putih, font serif (Times New Roman bila tersedia, ukuran 8–9 pt), label berbahasa Indonesia, **tanpa judul di dalam gambar** (judul dibuat di naskah), palet aman buta warna dan tetap terbaca bila dicetak hitam-putih.
Lebar satu kolom = 7,6 cm; lebar penuh = 15,9 cm.
1. `g1_arsitektur_lambda.png` (15,9 cm): diagram batch layer / speed layer / serving layer sesuai `dashboard/PLAN.md` §4 (sumber data, Spark/Parquet, Model B, YOLOv8+ByteTrack, Model A, FastAPI/DuckDB/SQLite/Redis, Next.js).
2. `g2_mae_perbandingan.png` (7,6 cm): MAE persistence vs profil historis vs Model B, horizon 1h & 3h, subset Semua dan Tidak rutin.
3. `g3_mae_per_jam.png` (15,9 cm): dari E2.
4. `g4_ablation.png` (7,6 cm): kenaikan MAE tiap varian ablation terhadap varian penuh.
5. `g5_importance.png` (7,6 cm): 10 fitur teratas (gain).
6. `g6_confusion_model_a.png` (7,6 cm): dari E3.
7. `g7_dashboard_ringkasan.png`: salin screenshot halaman Ringkasan (tema terang) dari `dashboard/web/` hasil Playwright (jangan jalankan ulang e2e; jangan jalankan `reset_demo.py`). Sebutkan path sumbernya.
Buat satu skrip `jurnal/eksperimen/buat_gambar.py` yang menghasilkan g2–g6 dari CSV di atas, agar bisa diulang.

## E5. Catatan & laporan
- `jurnal/eksperimen/LOG.md`: perintah yang dijalankan, versi paket, seed, waktu jalan, jumlah baris train/val/test per horizon.
- Berhenti setelah selesai. Laporan akhir (Bahasa Indonesia, ringkas): hasil reproduksi, tabel ablation (varian mana yang paling berpengaruh), temuan MAE per jam, angka CV Model A, daftar file yang dibuat, dan hal yang tidak bisa direproduksi atau janggal.
- Jangan jalankan fase 7 dashboard atau ubah rencana lain.
