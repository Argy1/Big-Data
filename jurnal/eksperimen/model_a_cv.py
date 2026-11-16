# -*- coding: utf-8 -*-
"""Reproduksi validasi Model A (Random Forest, UCSD) dengan skema yang sama persis dengan Notebooks/03 (sel 20-21):
4 split resmi EvalSet_train/EvalSet_test, hasil per split lalu rata-rata; confusion matrix dari gabungan prediksi 4 split test."""
import os, json, glob, warnings
import numpy as np, pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, precision_recall_fscore_support
warnings.filterwarnings("ignore")
BASE = os.environ.get("PROJ_BASE", "."); OUT = f"{BASE}/jurnal/eksperimen"
UCSD_DIR = f"{BASE}/Dataset/archive (2)"
B03 = glob.glob(f"{BASE}/Output IPYNB/03_model_a*/03_model_a")[0]
LABELS = ["light", "medium", "heavy"]; DISPLAY = {"light": "Lancar", "medium": "Padat", "heavy": "Macet"}
read_split = lambda p: [list(map(int, l.split(","))) for l in open(p).read().strip().splitlines()]
SPLITS = list(zip(read_split(f"{UCSD_DIR}/EvalSet_train"), read_split(f"{UCSD_DIR}/EvalSet_test")))
feats = pd.read_csv(f"{B03}/ucsd_features.csv"); data = feats.set_index("idx")
cfg = json.load(open(f"{B03}/model_a_config.json", encoding="utf-8"))
FEATURES = "speed_bl_med,speed_bl_p25,stopped_ratio,occupancy,track_len_ratio,optflow_bl".split(",")
assert FEATURES == cfg["features"]
def make_models():
    imp = lambda: SimpleImputer(strategy="median")
    return {
        "Baseline mayoritas": (DummyClassifier(strategy="most_frequent"), FEATURES),
        "Baseline 1 fitur (kecepatan)": (make_pipeline(imp(), StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=2000)), ["speed_bl_med"]),
        "Logistic Regression": (make_pipeline(imp(), StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=2000, C=1.0)), FEATURES),
        "Random Forest": (make_pipeline(imp(), RandomForestClassifier(n_estimators=400, min_samples_leaf=2, class_weight="balanced", random_state=42)), FEATURES),
        "Gradient Boosting": (make_pipeline(imp(), HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300, class_weight="balanced", random_state=42)), FEATURES),
    }
results, all_preds = [], {}
for name, (model, cols_) in make_models().items():
    yt, yp = [], []
    for k, (tr, te) in enumerate(SPLITS):
        tr = [i for i in tr if i in data.index]; te = [i for i in te if i in data.index]
        model.fit(data.loc[tr, cols_], data.loc[tr, "label"]); pred = model.predict(data.loc[te, cols_])
        results.append({"model": name, "split": k + 1, "n_train": len(tr), "n_test": len(te),
                        "accuracy": accuracy_score(data.loc[te, "label"], pred),
                        "macro_f1": f1_score(data.loc[te, "label"], pred, average="macro", labels=LABELS, zero_division=0)})
        yt += list(data.loc[te, "label"]); yp += list(pred)
    all_preds[name] = (yt, yp)
res = pd.DataFrame(results); res.to_csv(f"{OUT}/hasil_model_a_per_split.csv", index=False)
summ = res.groupby("model")[["accuracy", "macro_f1"]].agg(["mean", "std"]); summ.columns = ["akurasi_rata2", "akurasi_std", "macroF1_rata2", "macroF1_std"]
summ["akurasi_config"] = [cfg["cv_results"][m]["accuracy"] for m in summ.index]; summ["macroF1_config"] = [cfg["cv_results"][m]["macro_f1"] for m in summ.index]
summ = summ.sort_values("macroF1_rata2", ascending=False); summ.round(4).to_csv(f"{OUT}/hasil_model_a.csv"); print(summ.round(3).to_string())
yt, yp = all_preds["Random Forest"]
cm = confusion_matrix(yt, yp, labels=LABELS)
pd.DataFrame(cm, index=[DISPLAY[l] for l in LABELS], columns=[DISPLAY[l] for l in LABELS]).to_csv(f"{OUT}/confusion_model_a.csv")
p, r, f, s = precision_recall_fscore_support(yt, yp, labels=LABELS, zero_division=0)
pd.DataFrame({"kelas": [DISPLAY[l] for l in LABELS], "precision": p, "recall": r, "f1": f, "support": s}).round(4).to_csv(f"{OUT}/hasil_model_a_per_kelas.csv", index=False)
print("\nConfusion matrix RF (baris=asli, kolom=prediksi: Lancar, Padat, Macet):\n", cm); print("per kelas P/R/F1:", np.round(p, 3), np.round(r, 3), np.round(f, 3), s)
print("n split:", [(len(a), len(b)) for a, b in SPLITS])
