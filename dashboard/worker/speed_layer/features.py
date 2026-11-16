"""Traffic features per window — COPIED VERBATIM from Notebooks/03_ModelA_Nowcast.ipynb (cells 8 & 13).

Do not edit the two functions below: Model A (model_a.joblib) was trained on exactly these features,
so any change in logic would silently shift its inputs (PLAN §8.4, CLAUDE.md §3.2). Only the module
header (imports + DEVICE) is new; DEVICE was a notebook global, here it is set by speed_layer.device.
tests/test_features_vs_ucsd.py checks the output against Output IPYNB/.../ucsd_features.csv.
"""

import cv2
import numpy as np

from .device import pick_device

DEVICE = pick_device()  # notebook: 0 if GPU else "cpu"


# ---- notebook 03, cell 8 -------------------------------------------------------------------------
def read_clip(path, start=1):
    cap = cv2.VideoCapture(path); frames = []
    while True:
        ok, f = cap.read()
        if not ok: break
        frames.append(f)
    cap.release()
    return frames[start:]            # buang frame pertama yang rusak


# ---- notebook 03, cell 13 ------------------------------------------------------------------------
def reset_tracker(model):
    p = getattr(model, "predictor", None)
    if p is not None and getattr(p, "trackers", None):
        for t in p.trackers: t.reset()                 # tracker baru untuk setiap klip/jendela

def extract_features(frames, model, classes, fps=10, roi_top=0.35, line_y=0.70, imgsz=640, conf=0.2, keep_plots=False):
    '''frames: list gambar BGR berurutan → dict fitur lalu lintas'''
    H, W = frames[0].shape[:2]; y0 = int(roi_top * H); ly = line_y * H; roi_area = (H - y0) * W
    reset_tracker(model)
    tracks, dets, occ, flows, plots, prev = {}, [], [], [], [], None
    for t, f in enumerate(frames):
        r = model.track(f, persist=True, tracker="bytetrack.yaml", imgsz=imgsz, conf=conf,
                        classes=classes, verbose=False, device=DEVICE)[0]
        mask = np.zeros((H, W), np.uint8); n = 0
        if r.boxes is not None and len(r.boxes):
            xyxy = r.boxes.xyxy.cpu().numpy()
            ids = r.boxes.id.int().cpu().numpy() if r.boxes.id is not None else [None] * len(xyxy)
            for (x1, y1, x2, y2), tid in zip(xyxy, ids):
                cx, cy, h = (x1 + x2) / 2, (y1 + y2) / 2, y2 - y1
                if cy < y0: continue                          # abaikan area jauh (kotak terlalu kecil)
                n += 1; mask[int(max(y1, y0)):int(y2), int(x1):int(x2)] = 1
                if tid is not None: tracks.setdefault(int(tid), []).append((t, cx, cy, h))
        dets.append(n); occ.append(mask[y0:].sum() / roi_area)
        gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        if prev is not None:
            fl = cv2.calcOpticalFlowFarneback(prev[y0:], gray[y0:], None, 0.5, 3, 15, 3, 5, 1.2, 0)
            mag = np.linalg.norm(fl, axis=2); veh = mask[y0:] > 0
            flows.append(np.median(mag[veh]) if veh.sum() > 50 else np.nan)
        prev = gray
        if keep_plots: plots.append(r.plot(line_width=1, font_size=6))

    dur = len(frames) / fps; speeds, crossings, lens = [], 0, []
    for pts in tracks.values():
        pts = np.array(pts); lens.append(len(pts))
        if len(pts) >= 5:
            dt = (pts[-1, 0] - pts[0, 0]) / fps
            disp = np.hypot(pts[-1, 1] - pts[0, 1], pts[-1, 2] - pts[0, 2])
            speeds.append(disp / np.median(pts[:, 3]) / dt)          # panjang-kendaraan per detik
        if pts[:, 2].min() < ly <= pts[:, 2].max(): crossings += 1   # melewati garis hitung virtual
    speeds = np.array(speeds) if speeds else np.array([np.nan])
    med_h = np.nanmedian([p[3] for v in tracks.values() for p in v]) if tracks else np.nan
    ok = np.isfinite(speeds).any()
    feats = {
        "speed_bl_med":    float(np.nanmedian(speeds)) if ok else np.nan,
        "speed_bl_p25":    float(np.nanpercentile(speeds, 25)) if ok else np.nan,
        "stopped_ratio":   float(np.mean(speeds[np.isfinite(speeds)] < 0.5)) if ok else np.nan,
        "optflow_bl":      float(np.nanmedian(flows) / med_h * fps) if flows and np.isfinite(med_h) and np.isfinite(flows).any() else np.nan,
        "occupancy":       float(np.mean(occ)),
        "track_len_ratio": float(np.mean(lens) / len(frames)) if lens else 0.0,
        "det_mean":        float(np.mean(dets)),
        "tracks_per_s":    len(tracks) / dur,
        "flow_per_min":    crossings / dur * 60,
    }
    return (feats, plots) if keep_plots else feats
