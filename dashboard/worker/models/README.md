Model worker tidak disimpan di sini. Worker membacanya dari `dashboard/data/` (disalin oleh `scripts/copy_data.py`):

- `data/yolo/yolov8s.pt`: YOLOv8s COCO, diunduh otomatis oleh `check_env.py` / Ultralytics
- `data/yolo/yolov8s_traffic7.pt`: detektor fine-tuned (notebook 02)
- `data/model_a/model_a.joblib`: Model A Random Forest (notebook 03)
