# -*- coding: utf-8 -*-
"""Ablation Model B (LightGBM) untuk naskah jurnal.
Logika data/fitur/pelatihan/evaluasi disalin dari Notebooks/04_ModelB_Forecast.ipynb (tanpa perubahan),
hanya ditambah: loop varian fitur, gerbang reproduksi, penyimpanan CSV.
Jalankan:  PROJ_BASE=<folder Projek Akhir> python ablation.py   (NB_TEST=1 untuk uji cepat)"""
import os, sys, json, time, glob, warnings
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.metrics import f1_score, recall_score, precision_score
warnings.filterwarnings("ignore")

BASE = os.environ.get("PROJ_BASE", ".")
TEST_MODE = os.environ.get("NB_TEST") == "1"
SUF = "_smoke" if TEST_MODE else ""
OUT = f"{BASE}/jurnal/eksperimen"; os.makedirs(OUT, exist_ok=True)
B01 = f"{BASE}/Output IPYNB/01_batch"
B04 = glob.glob(f"{BASE}/Output IPYNB/04_model_b*/04_model_b")[0]
MASTER_DIR, META_CSV, WEATHER_CSV = f"{B01}/master_pemsbay", f"{B01}/ref_sensor_meta.csv", f"{B04}/weather_open_meteo.csv"
def log(*a): print(time.strftime("%H:%M:%S "), *a, flush=True)

cfg = json.load(open(f"{B04}/model_b_config.json", encoding="utf-8"))
EXPECT = {(m["horizon"], m["subset"]): m["MAE (mph)"] for m in cfg["test_metrics"] if m["metode"] == "Model B"}
log("versi: lightgbm", lgb.__version__, "numpy", np.__version__, "pandas", pd.__version__, "| TEST_MODE", TEST_MODE)

# ---- sel 4: matriks kecepatan ----
m = pd.read_parquet(MASTER_DIR, columns=["timestamp", "sensor_id", "speed"])
S_df = m.pivot(index="timestamp", columns="sensor_id", values="speed").astype("float32")
S_df = S_df.reindex(pd.date_range(S_df.index.min(), S_df.index.max(), freq="5min"))
del m
times, sensors, S = S_df.index, S_df.columns.values, S_df.values
T, N = S.shape
meta = pd.read_csv(META_CSV).set_index("sensor_id").loc[sensors]
log(f"matriks {T:,} x {N} | {times.min()} -> {times.max()}")

# ---- sel 6: split, v_ff, profil ----
TRAIN_END, VAL_END = pd.Timestamp("2017-05-01"), pd.Timestamp("2017-06-01")
is_train = np.asarray(times < TRAIN_END)
night = is_train & np.asarray((times.hour >= 22) | (times.hour < 5))
vff = np.nanquantile(S[night], 0.85, axis=0).astype("float32")
def slot_of(ts): return np.asarray(ts.dayofweek * 96 + ts.hour * 4 + ts.minute // 15)
SLOT = slot_of(times)
PROFILE = pd.DataFrame(S[is_train]).groupby(SLOT[is_train]).mean().reindex(range(672)).values.astype("float32")
P = PROFILE[SLOT]

# ---- sel 8: rolling, tetangga, libur ----
S_pd = pd.DataFrame(S)
ROLL6  = S_pd.rolling(6,  min_periods=4).mean().values.astype("float32")
ROLL12 = S_pd.rolling(12, min_periods=8).mean().values.astype("float32")
STD12  = S_pd.rolling(12, min_periods=8).std().values.astype("float32")
R = (S / vff).astype("float32")
lat, lon = meta.latitude.values, meta.longitude.values
D = np.hypot((lat[:, None] - lat[None]) * 111, (lon[:, None] - lon[None]) * 88)
same = (meta.fwy.values[:, None] == meta.fwy.values[None]) & (meta.dir.values[:, None] == meta.dir.values[None])
np.fill_diagonal(D, np.inf)
NB = np.array([np.argsort(np.where(same[i], D[i], D[i] + 1e3))[:5] for i in range(N)])
R_NB = np.nanmean(R[:, NB], axis=2).astype("float32")
HOLIDAYS = pd.to_datetime(["2017-01-02", "2017-01-16", "2017-02-20", "2017-05-29"])

# ---- sel 10: cuaca (dari CSV, tanpa internet) ----
weather = pd.read_csv(WEATHER_CSV, parse_dates=["time"])
w = weather.set_index("time")["precipitation"]; w = w[~w.index.duplicated()]
RAIN = w.reindex(times.floor("h")).fillna(0).values.astype("float32")
RAIN3 = pd.Series(w.rolling(3, min_periods=1).sum()).reindex(times.floor("h")).fillna(0).values.astype("float32")
log(f"cuaca {len(weather)} jam, total hujan {w.sum():.0f} mm")

# ---- sel 11: make_rows ----
LANES, FWY = meta.lanes.values.astype("float32"), meta.fwy.values.astype("float32")
STEP_MIN = 5
def make_rows(O, h):
    O = np.asarray(O); O = O[O >= 2016]
    n = len(O)
    t_target = times[O] + pd.Timedelta(minutes=STEP_MIN * h)
    tgt = O + h
    g  = lambda A, idx: A[idx].ravel()
    rep = lambda a: np.repeat(np.asarray(a, dtype="float32"), N)
    X = pd.DataFrame({
        "v_now": g(S, O), "v_lag5m": g(S, O - 1), "v_lag15m": g(S, O - 3), "v_lag30m": g(S, O - 6), "v_lag60m": g(S, O - 12),
        "v_roll30m": g(ROLL6, O), "v_roll60m": g(ROLL12, O), "v_std60m": g(STD12, O),
        "v_yesterday": g(S, tgt - 288), "v_lastweek": g(S, tgt - 2016),
        "prof_target": PROFILE[slot_of(t_target)].ravel(),
        "dev_now": g(S, O) - g(P, O), "ratio_now": g(R, O), "nb_ratio_now": g(R_NB, O),
        "hour_target": rep(t_target.hour + t_target.minute / 60), "dow_target": rep(t_target.dayofweek),
        "weekend_target": rep(t_target.dayofweek >= 5), "holiday_target": rep(t_target.normalize().isin(HOLIDAYS)),
        "lanes": np.tile(LANES, n), "vff": np.tile(vff, n), "fwy": np.tile(FWY, n),
    })
    X["rain_now_mm"], X["rain_3h_mm"] = rep(RAIN[O]), rep(RAIN3[O])
    y = np.where((tgt < T)[:, None], S[np.minimum(tgt, T - 1)], np.nan).ravel() if n else np.array([])
    info = pd.DataFrame({"t_idx": np.repeat(O, N), "sensor_idx": np.tile(np.arange(N), n)})
    return X, y, info

# ---- evaluasi (sel 17) ----
LEVELS = ["Low", "Moderate", "High", "Severe"]
def to_level(speed, vff_rows):
    r = speed / vff_rows
    return np.select([r < 0.4, r < 0.6, r < 0.8], ["Severe", "High", "Moderate"], "Low")
def evaluate(hname, varian, X, y, p):
    out = []
    true_lvl = to_level(y, X["vff"].values); true_cong = np.isin(true_lvl, ["High", "Severe"])
    pl = to_level(p, X["vff"].values)
    for subset, mask in [("Semua", np.ones(len(y), bool)), ("Tidak rutin", np.abs(X["dev_now"].values) > 10)]:
        mae = float(np.mean(np.abs(p[mask] - y[mask])))
        out.append({"horizon": hname, "subset": subset, "varian": varian, "n": int(mask.sum()),
                    "MAE (mph)": mae, "MAE (km/jam)": mae * 1.609344,
                    "RMSE (mph)": float(np.sqrt(np.mean((p[mask] - y[mask]) ** 2))),
                    "macro-F1 level": f1_score(true_lvl[mask], pl[mask], average="macro", labels=LEVELS, zero_division=0),
                    "recall macet": recall_score(true_cong[mask], np.isin(pl[mask], ["High", "Severe"]), zero_division=0),
                    "precision macet": precision_score(true_cong[mask], np.isin(pl[mask], ["High", "Severe"]), zero_division=0)})
    return out

VARIAN = {
 "Penuh": [],
 "Tanpa cuaca": ["rain_now_mm", "rain_3h_mm"],
 "Tanpa tetangga": ["nb_ratio_now"],
 "Tanpa lag & rolling": ["v_lag5m", "v_lag15m", "v_lag30m", "v_lag60m", "v_roll30m", "v_roll60m", "v_std60m"],
 "Tanpa kalender": ["hour_target", "dow_target", "weekend_target", "holiday_target"],
 "Tanpa riwayat hari/minggu lalu": ["v_yesterday", "v_lastweek"],
}
HORIZONS = {"1h": 12, "3h": 36}
MAX_TRAIN_ROWS = 300_000 if TEST_MODE else 2_500_000
N_EST = int(os.environ.get("NB_ITERS", 2000))
if TEST_MODE: HORIZONS = {"1h": 12}; VARIAN = dict(list(VARIAN.items())[:2])

rows, hourly = [], []
_prev = f"{OUT}/hasil_ablation{SUF}.csv"
if os.path.exists(_prev):                      # lanjutkan bila run sebelumnya terpotong
    rows = pd.read_csv(_prev).to_dict("records"); log("lanjut dari hasil sebelumnya:", len(rows), "baris")
    if os.path.exists(f"{OUT}/mae_per_jam{SUF}.csv"): hourly = [pd.read_csv(f"{OUT}/mae_per_jam{SUF}.csv")]
DONE = {(r["horizon"], r["varian"]) for r in rows}
for hname, h in HORIZONS.items():
    t_all = times[np.arange(0, T, 3)]; O_all = np.arange(0, T, 3)
    tgt_time = t_all + pd.Timedelta(minutes=STEP_MIN * h)
    parts = {"train": O_all[np.asarray(tgt_time < TRAIN_END)],
             "val":   O_all[np.asarray((t_all >= TRAIN_END) & (tgt_time < VAL_END))],
             "test":  O_all[np.asarray(t_all >= VAL_END) & (O_all + h < T)]}
    ds = {}
    for part, O in parts.items():
        X, y, info = make_rows(O, h)
        ok = ~np.isnan(y) & ~np.isnan(X["v_now"].values) & ~np.isnan(X["prof_target"].values)
        X, y, info = X[ok].reset_index(drop=True), y[ok], info[ok].reset_index(drop=True)
        if part == "train" and len(X) > MAX_TRAIN_ROWS:
            idx = np.random.default_rng(42).choice(len(X), MAX_TRAIN_ROWS, replace=False)
            X, y, info = X.iloc[idx].reset_index(drop=True), y[idx], info.iloc[idx].reset_index(drop=True)
        ds[part] = (X, y); log(f"{hname} {part:5s}: {len(X):>9,} baris")
    (Xtr, ytr), (Xva, yva), (Xte, yte) = ds["train"], ds["val"], ds["test"]
    ALL = list(Xtr.columns)

    # baseline (sama dengan notebook)
    if (hname, "Persistence") not in DONE:
        rows += evaluate(hname, "Persistence", Xte, yte, Xte["v_now"].values)
        rows += evaluate(hname, "Profil historis", Xte, yte, Xte["prof_target"].values)
    jam = np.floor(Xte["hour_target"].values).astype(int)

    for vname, drop in VARIAN.items():
        if (hname, vname) in DONE: log(f"{hname} | {vname}: sudah ada, dilewati"); continue
        cols = [c for c in ALL if c not in drop]
        cat = [c for c in ["fwy", "dow_target"] if c in cols]
        t0 = time.time()
        mdl = lgb.LGBMRegressor(n_estimators=N_EST, learning_rate=0.05, num_leaves=63, min_child_samples=200,
                                subsample=0.8, subsample_freq=1, colsample_bytree=0.8, reg_lambda=1.0,
                                random_state=42, n_jobs=-1, verbose=-1)
        mdl.fit(Xtr[cols], ytr - Xtr["prof_target"], eval_set=[(Xva[cols], yva - Xva["prof_target"])], eval_metric="l1",
                categorical_feature=cat, callbacks=[lgb.early_stopping(50, verbose=False)])
        p = Xte["prof_target"].values + mdl.predict(Xte[cols])
        res = evaluate(hname, vname, Xte, yte, p); rows += res
        log(f"{hname} | {vname:32s} | {mdl.best_iteration_:4d} pohon | {time.time()-t0:5.0f} dtk | "
            f"MAE semua {res[0]['MAE (mph)']:.4f} | tidak rutin {res[1]['MAE (mph)']:.4f}")
        if vname == "Penuh":
            for sub in ["Semua", "Tidak rutin"]:
                got = [r for r in res if r["subset"] == sub][0]["MAE (mph)"]; exp = EXPECT[(hname, sub)]
                log(f"   REPRO {hname} {sub}: hasil {got:.4f} vs config {exp:.4f} (selisih {abs(got-exp):.4f})")
                if abs(got - exp) > 0.02 and not TEST_MODE:
                    open(f"{OUT}/REPRO_GAGAL.txt", "w").write(f"{hname} {sub}: {got:.4f} vs {exp:.4f}\n")
                    log("   REPRO GAGAL -> berhenti"); sys.exit(2)
            imp = pd.DataFrame({"fitur": cols, "gain": mdl.booster_.feature_importance("gain")})
            imp["gain_norm"] = imp.gain / imp.gain.sum(); imp.sort_values("gain", ascending=False).to_csv(f"{OUT}/importance_{hname}{SUF}.csv", index=False)
            for mname, pp in [("Persistence", Xte["v_now"].values), ("Profil historis", Xte["prof_target"].values), ("Model B", p)]:
                d = pd.DataFrame({"jam": jam, "ae": np.abs(pp - yte)}).groupby("jam").ae.agg(["mean", "size"]).reset_index()
                d.columns = ["jam", "MAE (mph)", "n"]; d.insert(0, "metode", mname); d.insert(0, "horizon", hname); hourly.append(d)
            pd.concat(hourly).to_csv(f"{OUT}/mae_per_jam{SUF}.csv", index=False)
        pd.DataFrame(rows).to_csv(f"{OUT}/hasil_ablation{SUF}.csv", index=False, encoding="utf-8")
        del mdl
    del ds, Xtr, Xva, Xte
log("SELESAI")
