import cv2
import numpy as np
import time
import threading
from nn_tracker import NeuralNetworkTracker

class ObjectTracker:
    def __init__(self, camera_index=0):
        self.lock = threading.Lock()
        self.camera_index = camera_index
        self.cap = None
        self.is_running = True
        self.is_tracking = True
        self.simulation_mode = False

        # Modo de seguimiento: "hsv" o "neural_net"
        self.mode = "hsv"

        # Instancia de la Red Neuronal
        self.nn_tracker = NeuralNetworkTracker()

        # Configuración de filtrado HSV
        self.settings = {
            "h_min": 35,
            "h_max": 85,
            "s_min": 80,
            "s_max": 255,
            "v_min": 80,
            "v_max": 255,
            "min_area": 500,
            "max_area": 100000,
            "show_mask": False,
            "draw_box": True,
            "draw_centroid": True,
            "tracking_mode": "hsv"  # "hsv" | "neural_net"
        }

        # Estado en tiempo real del objeto detectado
        self.status = {
            "fps": 0.0,
            "detected": False,
            "target_x": 0,
            "target_y": 0,
            "target_area": 0,
            "bbox": [0, 0, 0, 0],
            "frame_width": 640,
            "frame_height": 480,
            "simulation": False,
            "tracking_mode": "hsv",
            "nn_confidence": 0.0
        }

        self._prev_time = time.time()
        self._fps = 0.0
        self._sim_angle = 0.0

        self._init_camera()

    def _init_camera(self):
        try:
            # Intentar abrir con backend V4L2 y fallback a CAP_ANY
            self.cap = cv2.VideoCapture(self.camera_index, cv2.CAP_V4L2)
            if not self.cap.isOpened():
                self.cap = cv2.VideoCapture(self.camera_index)
                
            if self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    print(f"[INFO] Cámara en línea y capturando fotogramas en índice {self.camera_index}.")
                    self.simulation_mode = False
                    self.status["simulation"] = False
                    return

            print(f"[WARN] No se obtuvieron fotogramas de la cámara. MODO SIMULACIÓN activo.")
            self.simulation_mode = True
            self.status["simulation"] = True
        except Exception as e:
            print(f"[ERROR] Error al inicializar la cámara: {e}. MODO SIMULACIÓN activo.")
            self.simulation_mode = True
            self.status["simulation"] = True

    def update_settings(self, new_settings):
        with self.lock:
            for key, val in new_settings.items():
                if key in self.settings:
                    if key.startswith("draw_") or key == "show_mask":
                        self.settings[key] = bool(val)
                    elif key == "tracking_mode":
                        self.settings[key] = str(val)
                        self.mode = str(val)
                    else:
                        self.settings[key] = int(val)

    def get_settings(self):
        with self.lock:
            return self.settings.copy()

    def get_status(self):
        with self.lock:
            st = self.status.copy()
            st["nn_info"] = self.nn_tracker.get_status()
            return st

    def capture_nn_sample(self):
        """Captura el área del objetivo actual como muestra para entrenar la Red Neuronal."""
        with self.lock:
            bbox = self.status["bbox"]
            detected = self.status["detected"]
        
        # Si no hay objeto detectado actualmente, usar el centro de la pantalla
        if not detected or bbox[2] == 0:
            bbox = [240, 180, 160, 120]
        
        frame = self._last_raw_frame if hasattr(self, '_last_raw_frame') and self._last_raw_frame is not None else self._generate_synthetic_frame()
        return self.nn_tracker.add_sample(frame, bbox)

    def train_nn(self):
        """Ejecuta el entrenamiento de la Red Neuronal."""
        success, msg = self.nn_tracker.train()
        if success:
            with self.lock:
                self.mode = "neural_net"
                self.settings["tracking_mode"] = "neural_net"
        return success, msg

    def reset_nn(self):
        """Limpia los datos de entrenamiento de la Red Neuronal."""
        self.nn_tracker.reset()
        with self.lock:
            self.mode = "hsv"
            self.settings["tracking_mode"] = "hsv"

    def _generate_synthetic_frame(self):
        w, h = 640, 480
        frame = np.full((h, w, 3), (25, 20, 20), dtype=np.uint8)
        
        for x in range(0, w, 40):
            cv2.line(frame, (x, 0), (x, h), (40, 35, 35), 1)
        for y in range(0, h, 40):
            cv2.line(frame, (0, y), (w, y), (40, 35, 35), 1)

        self._sim_angle += 0.05
        cx = int(w / 2 + 200 * np.sin(self._sim_angle))
        cy = int(h / 2 + 120 * np.sin(self._sim_angle * 1.5))
        radius = 30

        cv2.circle(frame, (cx, cy), radius, (40, 220, 40), -1)
        cv2.circle(frame, (cx, cy), radius + 2, (100, 255, 100), 2)
        
        cv2.putText(frame, "MODO SIMULACION (Sin Camara)", (15, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 215, 255), 2)
        
        return frame

    def process_frame(self):
        if self.simulation_mode:
            frame = self._generate_synthetic_frame()
        else:
            success, frame = self.cap.read()
            if not success or frame is None:
                frame = self._generate_synthetic_frame()

        self._last_raw_frame = frame.copy()
        h, w, _ = frame.shape
        self.status["frame_width"] = w
        self.status["frame_height"] = h

        # Medición de FPS
        curr_time = time.time()
        time_diff = curr_time - self._prev_time
        if time_diff > 0:
            self._fps = 0.9 * self._fps + 0.1 * (1.0 / time_diff)
        self._prev_time = curr_time

        with self.lock:
            mode = self.mode
            h_min, h_max = self.settings["h_min"], self.settings["h_max"]
            s_min, s_max = self.settings["s_min"], self.settings["s_max"]
            v_min, v_max = self.settings["v_min"], self.settings["v_max"]
            min_area, max_area = self.settings["min_area"], self.settings["max_area"]
            show_mask = self.settings["show_mask"]
            draw_box = self.settings["draw_box"]
            draw_centroid = self.settings["draw_centroid"]

        detected = False
        target_x, target_y, target_area = 0, 0, 0
        bbox = [0, 0, 0, 0]
        nn_conf = 0.0

        mask_frame = None

        if mode == "neural_net" and self.nn_tracker.is_trained:
            # Detección por Red Neuronal
            detected, target_x, target_y, target_area, bbox, nn_conf = self.nn_tracker.detect(frame)
            
            if detected:
                bx, by, bw, bh = bbox
                if draw_box:
                    cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), (255, 0, 255), 2)
                    cv2.putText(frame, f"RED NEURONAL IA ({nn_conf}%)", (bx, max(by - 10, 20)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 2)
                if draw_centroid:
                    cv2.circle(frame, (target_x, target_y), 6, (255, 255, 0), -1)
        else:
            # Detección por Filtro HSV tradicional
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            lower_bound = np.array([h_min, s_min, v_min])
            upper_bound = np.array([h_max, s_max, v_max])
            mask = cv2.inRange(hsv, lower_bound, upper_bound)

            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            mask = cv2.erode(mask, kernel, iterations=1)
            mask = cv2.dilate(mask, kernel, iterations=2)
            mask_frame = mask

            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if contours and self.is_tracking:
                c = max(contours, key=cv2.contourArea)
                area = cv2.contourArea(c)

                if min_area <= area <= max_area:
                    detected = True
                    target_area = int(area)
                    x, y, bw, bh = cv2.boundingRect(c)
                    bbox = [int(x), int(y), int(bw), int(bh)]

                    M = cv2.moments(c)
                    if M["m00"] > 0:
                        target_x = int(M["m10"] / M["m00"])
                        target_y = int(M["m01"] / M["m00"])

                    if draw_box:
                        cv2.rectangle(frame, (x, y), (x + bw, y + bh), (0, 255, 255), 2)
                        cv2.putText(frame, f"TARGET [{target_x}, {target_y}]", (x, max(y - 10, 20)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)

                    if draw_centroid:
                        cv2.circle(frame, (target_x, target_y), 6, (0, 0, 255), -1)
                        cv2.line(frame, (target_x - 12, target_y), (target_x + 12, target_y), (0, 0, 255), 2)
                        cv2.line(frame, (target_x, target_y - 12), (target_x, target_y + 12), (0, 0, 255), 2)

        # Actualizar telemetría
        with self.lock:
            self.status["fps"] = round(self._fps, 1)
            self.status["detected"] = detected
            self.status["target_x"] = target_x
            self.status["target_y"] = target_y
            self.status["target_area"] = target_area
            self.status["bbox"] = bbox
            self.status["tracking_mode"] = mode
            self.status["nn_confidence"] = nn_conf

        # HUD Overlay
        cv2.putText(frame, f"FPS: {round(self._fps, 1)}", (w - 120, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        mode_label = "RED NEURONAL (IA)" if mode == "neural_net" else "FILTRO HSV"
        cv2.putText(frame, f"MODO: {mode_label}", (15, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        status_text = "TRACKING: ONLINE" if detected else "SEARCHING..."
        status_color = (0, 255, 0) if detected else (0, 165, 255)
        cv2.putText(frame, status_text, (15, h - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)

        output_frame = frame
        if show_mask and mask_frame is not None:
            output_frame = cv2.cvtColor(mask_frame, cv2.COLOR_GRAY2BGR)
            cv2.putText(output_frame, "MODO MASCARA HSV", (15, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

        _, jpeg = cv2.imencode('.jpg', output_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return jpeg.tobytes()

    def generate_mjpeg_stream(self):
        while self.is_running:
            frame_bytes = self.process_frame()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.03)

    def release(self):
        self.is_running = False
        if self.cap and self.cap.isOpened():
            self.cap.release()
