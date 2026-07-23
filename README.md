# Raspberry Pi - Tracking & Control Web de Objetos con OpenCV

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.9%2B-green.svg)
![OpenCV](https://img.shields.io/badge/OpenCV-4.x-orange.svg)
![Flask](https://img.shields.io/badge/Flask-3.x-lightgrey.svg)

Sistema completo de **seguimiento de objetos en tiempo real** procesado en **Raspberry Pi** mediante **OpenCV y Python**, con un panel de control interactivo accesible desde cualquier navegador web.

---

## 🌟 Características Principales

- **Procesamiento de Vídeo en Tiempo Real**: Detección de objetos basada en filtrado de color HSV y momentos de contorno.
- **Transmisión de Vídeo MJPEG**: Stream directo en vivo HD optimizado para navegadores de escritorio y móviles.
- **Calibración Dinámica de Color**: Sliders interactivos para ajustar Hue (H), Saturación (S) y Brillo (V) en tiempo real sin reiniciar el servidor.
- **Preajustes Rápidos**: Botones de acceso directo para rastrear objetos de color **Verde**, **Azul**, **Rojo** o **Amarillo**.
- **HUD y Telemetría en Vivo**: Visualización en pantalla de FPS, centroide \((X, Y)\), área del objeto (px²) y cuadro delimitador.
- **Modo Simulación Integrado**: Si la Raspberry Pi no tiene una cámara física conectada temporalmente, el sistema genera automáticamente un fotograma animado para probar la interfaz web inmediatamente.

---

## 📁 Estructura del Proyecto

```text
Rasp-Seg-Objetos/
├── app.py              # Servidor Flask principal y API REST
├── tracker.py          # Clase ObjectTracker (Motor OpenCV y HUD)
├── requirements.txt    # Dependencias de Python (Flask, OpenCV, NumPy)
├── deploy.sh           # Script de despliegue automatizado por SSH
├── templates/
│   └── index.html      # Panel web del dashboard
└── static/
    ├── css/
    │   └── style.css   # Estilos futuristas modo oscuro
    └── js/
        └── main.js     # Lógica cliente para controles y polling de telemetría
```

---

## 🚀 Instalación y Ejecución Local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/victorfbs/Rasp-Seg-Objetos.git
   cd Rasp-Seg-Objetos
   ```

2. **Crear entorno virtual e instalar dependencias**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Ejecutar el servidor localmente**:
   ```bash
   python3 app.py
   ```
   Accede a la interfaz web en: `http://localhost:5000`

---

## 📡 Despliegue en Raspberry Pi (192.168.1.75)

Para sincronizar y ejecutar el proyecto en la Raspberry Pi conectada en la red local:

1. Dar permisos de ejecución a `deploy.sh`:
   ```bash
   chmod +x deploy.sh
   ```

2. Ejecutar el script indicando el usuario de la Raspberry Pi:
   ```bash
   ./deploy.sh victor
   ```

3. **Acceder desde el navegador**:
   Una vez completado el despliegue, abre tu navegador en:
   ```text
   http://192.168.1.75:5000
   ```

---

## 🎛️ Control desde el Navegador

- **Sliders HSV**: Ajusta los rangos de color superior e inferior para aislar el objeto deseado.
- **Ver Máscara HSV**: Muestra la imagen binaria filtrada para calibrar de forma precisa el ruido de fondo.
- **Pausar / Reanudar**: Detiene o activa el cálculo de contornos en tiempo real.
- **Indicadores HUD**: Muestra las coordenadas de la cámara en tiempo real para integración con robótica o servomotores.
