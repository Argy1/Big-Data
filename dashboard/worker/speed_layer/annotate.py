"""Frame -> JPEG for the MJPEG stream. Boxes and ByteTrack IDs are already drawn by
extract_features(keep_plots=True) (r.plot, as in notebook 03); ROI shading, the count line and the
level chips are HTML overlays on the Kamera page, so they stay crisp and follow PLAN §10.3.
"""

import cv2
import numpy as np

JPEG_QUALITY = 70


def to_jpeg(frame: np.ndarray, quality: int = JPEG_QUALITY) -> bytes:
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("JPEG encoding failed")
    return buf.tobytes()
