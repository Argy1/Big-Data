# -*- coding: utf-8 -*-
"""Membuat gambar naskah JATI dari CSV hasil eksperimen. Jalankan: PROJ_BASE=<folder Projek Akhir> python buat_gambar.py
Lebar: 1 kolom = 7,6 cm, penuh = 15,9 cm. PNG 300 dpi, latar putih, tanpa judul di dalam gambar."""
import os, glob, shutil
import numpy as np, pandas as pd
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
BASE = os.environ.get("PROJ_BASE", "."); EXP = f"{BASE}/jurnal/eksperimen"; OUT = f"{BASE}/jurnal/gambar"; os.makedirs(OUT, exist_ok=True)
CM = 1 / 2.54; W1, WF = 7.6 * CM, 15.9 * CM; MPH = 1.609344
plt.rcParams.update({"font.family": "Liberation Serif", "font.size": 7.5, "axes.labelsize": 7.5, "xtick.labelsize": 7, "ytick.labelsize": 7,
                     "legend.fontsize": 6.8, "axes.linewidth": 0.6, "savefig.dpi": 300, "figure.dpi": 150, "axes.spines.top": False, "axes.spines.right": False})
C = {"Persistence": "#8C8C8C", "Profil historis": "#E69F00", "Model B": "#0072B2"}
def save(fig, name): fig.savefig(f"{OUT}/{name}", bbox_inches="tight", pad_inches=0.03, facecolor="white"); plt.close(fig); print("OK", name)
def need(p):
    if os.path.exists(p): return True
    print("lewati (belum ada):", os.path.basename(p)); return False

# ---- g1: arsitektur Lambda (Batch atas, Serving tengah, Speed bawah: panah model->serving tidak bersilangan) ----
def g1():
    fig, ax = plt.subplots(figsize=(WF, 6.6 * CM)); ax.set_xlim(0, 100); ax.set_ylim(0, 64); ax.axis("off")
    def box(x, y, w, h, t, fc="#FFFFFF", bold=False, fs=6.3):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.25,rounding_size=1.2", fc=fc, ec="#333333", lw=0.7))
        ax.text(x + w / 2, y + h / 2, t, ha="center", va="center", fontsize=fs, fontweight="bold" if bold else "normal", linespacing=1.15)
    def arr(x1, y1, x2, y2): ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=6, lw=0.7, color="#333333"))
    def lane(y, name, fc): 
        ax.add_patch(FancyBboxPatch((0.5, y), 99, 17, boxstyle="round,pad=0.2,rounding_size=1.5", fc=fc, ec="none"))
        ax.text(5.4, y + 8.5, name, ha="center", va="center", fontsize=6.8, fontweight="bold", linespacing=1.1)
    xs, bw = [11, 28.5, 46, 63.5], 14.5
    lane(45, "Batch\nlayer", "#F1F1F1"); lane(24, "Serving\nlayer", "#EFEAF6"); lane(3, "Speed\nlayer", "#E3EEF8")
    for y, items in [(48, ["PEMS-BAY\n325 sensor\n(5 menit)", "Master dataset\n(Parquet)", "Spark batch\nviews", "Model B\nLightGBM\n+1 j dan +3 j"]),
                     (6, ["Video lalu lintas\n10 fps, 640 px", "YOLOv8 +\nByteTrack", "Fitur jendela\n5 dtk / 2,5 dtk", "Model A\nRandom Forest"])]:
        for i, (x, t) in enumerate(zip(xs, items)):
            box(x, y, bw, 11, t, bold=(i == 3))
            if i: arr(xs[i - 1] + bw + 0.4, y + 5.5, x - 0.4, y + 5.5)
    box(58, 27, 25.5, 11, "FastAPI, DuckDB, SQLite,\nRedis Streams\n(REST, WebSocket, MJPEG)")
    box(86, 27, 12.5, 11, "Dashboard\nweb\n(Next.js)", bold=True)
    arr(83.9, 32.5, 85.6, 32.5)
    arr(70.75, 47.6, 70.75, 38.4); arr(70.75, 17.4, 70.75, 26.6)
    ax.text(12, 32.5, "Model B: kecepatan per sensor\n(+1 jam, +3 jam)\nModel A: level kepadatan dari video\n(lancar / padat / macet)", ha="left", va="center", fontsize=6.2, color="#444444", linespacing=1.25)
    save(fig, "g1_arsitektur_lambda.png")

# ---- g2: perbandingan MAE ----
def g2():
    p = f"{EXP}/hasil_ablation.csv"
    if not need(p): return
    d = pd.read_csv(p); d = d[d.varian.isin(["Persistence", "Profil historis", "Penuh"])].replace({"Penuh": "Model B"})
    cats = [("1h", "Semua", "+1 jam\nsemua"), ("1h", "Tidak rutin", "+1 jam\ntidak rutin"), ("3h", "Semua", "+3 jam\nsemua"), ("3h", "Tidak rutin", "+3 jam\ntidak rutin")]
    fig, ax = plt.subplots(figsize=(W1, 5.2 * CM)); w = 0.26
    for j, m in enumerate(C):
        v = [d[(d.horizon == h) & (d.subset == s) & (d.varian == m)]["MAE (km/jam)"].iloc[0] for h, s, _ in cats]
        b = ax.bar(np.arange(4) + (j - 1) * w, v, w, color=C[m], label=m, edgecolor="white", lw=0.3)
        for r, x in zip(b, v): ax.text(r.get_x() + r.get_width() / 2, x + 0.4, f"{x:.1f}", ha="center", fontsize=5.6)
    ax.set_xticks(range(4), [c[2] for c in cats]); ax.set_ylabel("MAE (km/jam)"); ax.legend(frameon=False, loc="upper left"); ax.grid(axis="y", lw=0.3, alpha=0.5); ax.set_axisbelow(True)
    save(fig, "g2_mae_perbandingan.png")

# ---- g3: MAE per jam ----
def g3():
    p = f"{EXP}/mae_per_jam.csv"
    if not need(p): return
    d = pd.read_csv(p); fig, axes = plt.subplots(1, 2, figsize=(WF, 5.0 * CM), sharey=True)
    for ax, h, t in zip(axes, ["1h", "3h"], ["Horizon +1 jam", "Horizon +3 jam"]):
        for m in C:
            s = d[(d.horizon == h) & (d.metode == m)].sort_values("jam"); ax.plot(s.jam, s["MAE (mph)"] * MPH, color=C[m], lw=1.1, label=m, ls="--" if m == "Persistence" else "-")
        ax.set_xlabel(f"Jam target (waktu setempat)  ·  {t}"); ax.set_xticks(range(0, 24, 3)); ax.grid(lw=0.3, alpha=0.5)
    axes[0].set_ylabel("MAE (km/jam)"); axes[0].legend(frameon=False, loc="upper left"); save(fig, "g3_mae_per_jam.png")

# ---- g4: ablation ----
def g4():
    p = f"{EXP}/hasil_ablation.csv"
    if not need(p): return
    d = pd.read_csv(p); v = [x for x in d.varian.unique() if x.startswith("Tanpa")]
    fig, axes = plt.subplots(2, 1, figsize=(W1, 8.2 * CM), sharex=True)
    for ax, sub in zip(axes, ["Semua", "Tidak rutin"]):
        for k, (h, col) in enumerate([("1h", "#0072B2"), ("3h", "#56B4E9")]):
            base = d[(d.horizon == h) & (d.subset == sub) & (d.varian == "Penuh")]["MAE (km/jam)"].iloc[0]
            delta = [d[(d.horizon == h) & (d.subset == sub) & (d.varian == x)]["MAE (km/jam)"].iloc[0] - base for x in v]
            ax.barh(np.arange(len(v)) + (k - 0.5) * 0.36, delta, 0.36, color=col, label="+1 jam" if h == "1h" else "+3 jam")
        ax.axvline(0, color="k", lw=0.5); ax.set_yticks(range(len(v)), [x.replace("Tanpa ", "tanpa ") for x in v]); ax.invert_yaxis(); ax.grid(axis="x", lw=0.3, alpha=0.5)
        ax.set_title(f"Subset: {sub.lower()}", fontsize=7, loc="left")
    axes[0].legend(frameon=False, loc="lower right"); axes[1].set_xlabel("Kenaikan MAE terhadap model penuh (km/jam)"); save(fig, "g4_ablation.png")

# ---- g5: importance ----
def g5():
    a, b = f"{EXP}/importance_1h.csv", f"{EXP}/importance_3h.csv"
    if not (need(a) and need(b)): return
    i1, i3 = pd.read_csv(a), pd.read_csv(b); top = i1.head(10).fitur.tolist()[::-1]
    fig, ax = plt.subplots(figsize=(W1, 5.8 * CM))
    for k, (df, col, lab) in enumerate([(i3, "#56B4E9", "+3 jam"), (i1, "#0072B2", "+1 jam")]):
        s = df.set_index("fitur").gain_norm.reindex(top).fillna(0) * 100; ax.barh(np.arange(len(top)) + (k - 0.5) * 0.38, s.values, 0.38, color=col, label=lab)
    ax.set_yticks(range(len(top)), top); ax.set_xlabel("Kontribusi gain (%)"); ax.grid(axis="x", lw=0.3, alpha=0.5); h, l = ax.get_legend_handles_labels(); ax.legend(h[::-1], l[::-1], frameon=False, loc="lower right"); save(fig, "g5_importance.png")

# ---- g6: confusion Model A ----
def g6():
    p = f"{EXP}/confusion_model_a.csv"
    if not need(p): return
    cm = pd.read_csv(p, index_col=0); fig, ax = plt.subplots(figsize=(W1, 6.0 * CM)); ax.imshow(cm.values, cmap="Blues"); ax.grid(False)
    ax.set_xticks(range(3), cm.columns); ax.set_yticks(range(3), cm.index); ax.set_xlabel("Prediksi"); ax.set_ylabel("Label asli")
    for i in range(3):
        for j in range(3): ax.text(j, i, int(cm.values[i, j]), ha="center", va="center", fontsize=8, color="white" if cm.values[i, j] > cm.values.max() / 2 else "black")
    for s in ax.spines.values(): s.set_visible(True)
    save(fig, "g6_confusion_model_a.png")

# ---- g7: tangkapan dashboard (bagian atas halaman Ringkasan, tema terang) ----
def g7():
    from PIL import Image
    src = f"{BASE}/dashboard/web/tests/e2e/__screenshots__/ringkasan-light.png"
    if not need(src): return
    im = Image.open(src).convert("RGB"); im.crop((0, 0, im.width, 1075)).save(f"{OUT}/g7_dashboard_ringkasan.png", dpi=(300, 300)); print("OK g7_dashboard_ringkasan.png (sumber:", os.path.relpath(src, BASE), ")")

if __name__ == "__main__":
    for f in (g1, g2, g3, g4, g5, g6, g7): f()
