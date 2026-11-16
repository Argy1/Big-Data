# LOG eksperimen jurnal (2 Nov 2026)

Dijalankan di lingkungan komputasi cloud (2 vCPU, RAM 8 GB, CPU saja) dari salinan data di folder proyek. Data sumber tidak diubah.

## Lingkungan (pin sama dengan Colab, PLAN §3)
Python 3.13 · numpy 2.1.3 · pandas 2.2.3 · scikit-learn 1.6.1 · lightgbm 4.6.0 · pyarrow 26.0.0 · matplotlib (font Liberation Serif)

## Seed & parameter
LightGBM: n_estimators=2000, learning_rate=0.05, num_leaves=63, min_child_samples=200, subsample=0.8, subsample_freq=1, colsample_bytree=0.8, reg_lambda=1.0, random_state=42, early stopping 50 pada validasi (L1).
Sampel latih: default_rng(42), maksimum 2.500.000 baris. Model A: RandomForest n_estimators=400, min_samples_leaf=2, class_weight=balanced, random_state=42.
Hanya satu seed dan satu pembagian waktu: tidak ada interval kepercayaan.

## Perintah
- Ablation Model B + MAE per jam + importance: `PROJ_BASE=<folder> python jurnal/eksperimen/ablation.py` (uji cepat: NB_TEST=1 NB_ITERS=60)
- Model A (4 split resmi UCSD): `python jurnal/eksperimen/model_a_cv.py`
- Gambar: `python jurnal/eksperimen/buat_gambar.py`
Waktu jalan ablation penuh: 15.57 → 16.22 (±25 menit, 12 model).

## Gerbang reproduksi (batas 0,02 mph) — LOLOS
| horizon | subset | hasil | model_b_config.json | selisih |
|---|---|---|---|---|
| 1 jam | Semua | 1,9931 | 1,9931 | 0,0000 |
| 1 jam | Tidak rutin | 7,0849 | 7,0849 | 0,0000 |
| 3 jam | Semua | 2,2134 | 2,2134 | 0,0000 |
| 3 jam | Tidak rutin | 4,5062 | 4,5062 | 0,0000 |
Jumlah pohon model penuh: 718 (1 jam), 738 (3 jam), sama dengan best_iteration di config.
Model A: akurasi/macro-F1 semua model sama dengan cv_results di model_a_config.json (RF 0,945 / 0,910).

## Jumlah baris
```
15:57:02  versi: lightgbm 4.6.0 numpy 2.1.3 pandas 2.2.3 | TEST_MODE False
15:57:11  matriks 52,128 x 325 | 2017-01-01 00:00:00 -> 2017-06-30 23:55:00
15:57:17  cuaca 4344 jam, total hujan 594 mm
15:57:21  1h train: 2,500,000 baris
15:57:22  1h val  :   965,900 baris
15:57:22  1h test :   934,700 baris
16:00:53  1h | Tanpa cuaca                      |  726 pohon |   107 dtk | MAE semua 1.9994 | tidak rutin 7.09
16:08:57  3h train: 2,500,000 baris
16:08:57  3h val  :   963,300 baris
16:08:57  3h test :   932,100 baris
16:12:46  3h | Tanpa cuaca                      |  717 pohon |   112 dtk | MAE semua 2.2285 | tidak rutin 4.54
```

## Catatan definisi
- "Tidak rutin": |dev_now| > 10 mph. "Macet" pada recall/precision = level Padat atau Macet (rasio kecepatan/v_ff < 0,6).
- MAE per jam: dikelompokkan menurut jam waktu target (waktu setempat California, tanpa konversi).
- Gambar memakai km/jam (mph x 1,609344); CSV menyimpan keduanya.
- Pada varian "tanpa riwayat hari/minggu lalu" model memakai lebih banyak pohon (1202 dan 1636) sebelum early stopping.
