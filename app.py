#!/usr/bin/env python3
import os
import argparse
from flask import Flask, render_template, Response, jsonify, request
from tracker import ObjectTracker

app = Flask(__name__)

# Instancia global del rastreador
tracker = ObjectTracker(camera_index=0)

@app.route('/')
def index():
    """Renderiza el panel principal de control."""
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    """Streaming de vídeo MJPEG en directo."""
    return Response(tracker.generate_mjpeg_stream(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    """Obtiene o actualiza la configuración de filtrado HSV y overlays."""
    if request.method == 'POST':
        data = request.get_json(force=True)
        tracker.update_settings(data)
        return jsonify({"status": "success", "settings": tracker.get_settings()})
    return jsonify(tracker.get_settings())

@app.route('/api/status', methods=['GET'])
def get_status():
    """Devuelve las métricas de seguimiento en tiempo real (FPS, posición X/Y, área)."""
    return jsonify(tracker.get_status())

@app.route('/api/control', methods=['POST'])
def handle_control():
    """Permite alternar el estado del seguimiento o la cámara."""
    data = request.get_json(force=True)
    action = data.get("action")
    
    if action == "toggle_tracking":
        tracker.is_tracking = not tracker.is_tracking
        return jsonify({"status": "success", "is_tracking": tracker.is_tracking})
    elif action == "reset_defaults":
        defaults = {
            "h_min": 35, "h_max": 85,
            "s_min": 80, "s_max": 255,
            "v_min": 80, "v_max": 255,
            "min_area": 500, "max_area": 100000,
            "show_mask": False, "draw_box": True, "draw_centroid": True
        }
        tracker.update_settings(defaults)
        return jsonify({"status": "success", "settings": tracker.get_settings()})
    
    return jsonify({"status": "error", "message": "Acción desconocida"}), 400

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Servidor de Seguimiento de Objetos Raspberry Pi")
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host IP (por defecto 0.0.0.0)')
    parser.add_argument('--port', type=int, default=5000, help='Puerto web (por defecto 5000)')
    parser.add_argument('--cam', type=int, default=0, help='Índice de la cámara (por defecto 0)')
    args = parser.parse_args()

    print(f"=========================================================")
    print(f"  Servidor de Seguimiento de Objetos Iniciado")
    print(f"  Accede al panel web en: http://{args.host}:{args.port}")
    print(f"=========================================================")
    
    try:
        app.run(host=args.host, port=args.port, debug=False, threaded=True)
    finally:
        tracker.release()
