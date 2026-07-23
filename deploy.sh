#!/bin/bash
# ==============================================================================
# Script de Despliegue de Seguimiento de Objetos en Raspberry Pi (192.168.1.75)
# ==============================================================================

TARGET_HOST="192.168.1.75"
TARGET_USER="${1:-amalia}"
REMOTE_DIR="/home/${TARGET_USER}/Rasp-Seg-Objetos"

echo "======================================================================"
echo " Desplegando Rasp-Seg-Objetos a ${TARGET_USER}@${TARGET_HOST}:${REMOTE_DIR}"
echo "======================================================================"

# 1. Crear directorio remoto si no existe
ssh -o StrictHostKeyChecking=no "${TARGET_USER}@${TARGET_HOST}" "mkdir -p ${REMOTE_DIR}"

# 2. Sincronizar archivos usando rsync / scp
echo "[1/3] Sincronizando archivos del proyecto..."
rsync -avz --exclude='.git' --exclude='__pycache__' --exclude='venv' \
    ./ "${TARGET_USER}@${TARGET_HOST}:${REMOTE_DIR}/"

# 3. Configurar entorno virtual e instalar dependencias en la Raspberry Pi
echo "[2/3] Instalando dependencias de Python y OpenCV en la Raspberry Pi..."
ssh -o StrictHostKeyChecking=no "${TARGET_USER}@${TARGET_HOST}" << EOF
    cd ${REMOTE_DIR}
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
EOF

# 4. Iniciar o reiniciar el servidor web
echo "[3/3] Iniciando el servicio en http://${TARGET_HOST}:5050 ..."
ssh -o StrictHostKeyChecking=no "${TARGET_USER}@${TARGET_HOST}" << EOF
    cd ${REMOTE_DIR}
    rm -rf __pycache__ */__pycache__
    fuser -k 5050/tcp || pkill -9 -f "python3 app.py" || true
    source venv/bin/activate
    nohup python3 app.py --host 0.0.0.0 --port 5050 > app.log 2>&1 &
    echo "Servicio iniciado correctamente PID: \$!"
EOF

echo "======================================================================"
echo " ¡Despliegue Completado!"
echo " Abre tu navegador en: http://${TARGET_HOST}:5050"
echo "======================================================================"
