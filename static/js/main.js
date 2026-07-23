document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM principales
    const sliderIds = ['h_min', 'h_max', 's_min', 's_max', 'v_min', 'v_max', 'min_area'];
    const toggleIds = ['draw_box', 'draw_centroid'];
    
    const btnToggleTracking = document.getElementById('btn-toggle-tracking');
    const trackingBtnText = document.getElementById('tracking-btn-text');
    const btnToggleMask = document.getElementById('btn-toggle-mask');
    const maskBtnText = document.getElementById('mask-btn-text');
    const btnReset = document.getElementById('btn-reset');

    const connBadge = document.getElementById('connection-badge');
    const connText = document.getElementById('connection-text');
    const modeBadge = document.getElementById('mode-badge');
    const modeText = document.getElementById('mode-text');

    const metricDetected = document.getElementById('metric-detected');
    const metricCoords = document.getElementById('metric-coords');
    const metricArea = document.getElementById('metric-area');
    const metricBbox = document.getElementById('metric-bbox');
    const hudFps = document.getElementById('hud-fps');
    const hudRes = document.getElementById('hud-res');

    // Botones de Modo
    const btnModeHsv = document.getElementById('btn-mode-hsv');
    const btnModeNn = document.getElementById('btn-mode-nn');

    // Botones Red Neuronal
    const btnNnSample = document.getElementById('btn-nn-sample');
    const btnNnTrain = document.getElementById('btn-nn-train');
    const btnNnReset = document.getElementById('btn-nn-reset');
    
    const nnStatusText = document.getElementById('nn-status-text');
    const nnSampleCount = document.getElementById('nn-sample-count');
    const nnAccuracy = document.getElementById('nn-accuracy');

    let currentSettings = {};
    let isTrackingActive = true;
    let isMaskView = false;
    let updateTimer = null;
    let activeMode = 'hsv';

    // Preajustes de Color HSV
    const COLOR_PRESETS = {
        verde:    { h_min: 35,  h_max: 85,  s_min: 80, s_max: 255, v_min: 80, v_max: 255 },
        azul:     { h_min: 90,  h_max: 130, s_min: 80, s_max: 255, v_min: 80, v_max: 255 },
        rojo:     { h_min: 0,   h_max: 10,  s_min: 120, s_max: 255, v_min: 120, v_max: 255 },
        amarillo: { h_min: 20,  h_max: 35,  s_min: 100, s_max: 255, v_min: 100, v_max: 255 }
    };

    fetchSettings();
    setInterval(fetchStatus, 200);

    // Selección de Modo (Filtro HSV vs Red Neuronal)
    btnModeHsv.addEventListener('click', () => setTrackingMode('hsv'));
    btnModeNn.addEventListener('click', () => setTrackingMode('neural_net'));

    function setTrackingMode(mode) {
        activeMode = mode;
        btnModeHsv.classList.toggle('active', mode === 'hsv');
        btnModeNn.classList.toggle('active', mode === 'neural_net');
        currentSettings['tracking_mode'] = mode;
        saveSettings();
    }

    // Acciones de Red Neuronal
    btnNnSample.addEventListener('click', () => {
        btnNnSample.textContent = '⏳ Capturando...';
        fetch('/api/nn/sample', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                btnNnSample.textContent = '📸 Capturar Muestra de Objeto';
                if (data.nn_info) updateNNInfo(data.nn_info);
            })
            .catch(() => btnNnSample.textContent = '📸 Capturar Muestra de Objeto');
    });

    btnNnTrain.addEventListener('click', () => {
        btnNnTrain.textContent = '🧠 Entrenando...';
        fetch('/api/nn/train', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                btnNnTrain.textContent = '🧠 Entrenar Red Neuronal';
                if (data.status === 'success') {
                    setTrackingMode('neural_net');
                    if (data.nn_info) updateNNInfo(data.nn_info);
                    alert(data.message);
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(() => btnNnTrain.textContent = '🧠 Entrenar Red Neuronal');
    });

    btnNnReset.addEventListener('click', () => {
        if (confirm('¿Restablecer el entrenamiento de la Red Neuronal?')) {
            fetch('/api/nn/reset', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    setTrackingMode('hsv');
                    if (data.nn_info) updateNNInfo(data.nn_info);
                });
        }
    });

    function updateNNInfo(info) {
        if (!info) return;
        nnSampleCount.textContent = `${info.sample_count} muestras (${info.total_vectors} vectores)`;
        nnAccuracy.textContent = `${info.accuracy}%`;
        
        if (info.is_trained) {
            nnStatusText.textContent = '¡Entrenada y Activa!';
            nnStatusText.className = 'status-trained';
        } else {
            nnStatusText.textContent = 'No Entrenada';
            nnStatusText.className = 'status-untrained';
        }
    }

    // Registrar eventos Sliders
    sliderIds.forEach(id => {
        const slider = document.getElementById(id);
        const valSpan = document.getElementById(`val-${id}`);
        if (slider && valSpan) {
            slider.addEventListener('input', (e) => {
                valSpan.textContent = e.target.value;
                currentSettings[id] = parseInt(e.target.value);
                debouncedSaveSettings();
            });
        }
    });

    // Registrar eventos Toggles
    toggleIds.forEach(id => {
        const toggle = document.getElementById(id);
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                currentSettings[id] = e.target.checked;
                saveSettings();
            });
        }
    });

    btnToggleMask.addEventListener('click', () => {
        isMaskView = !isMaskView;
        currentSettings['show_mask'] = isMaskView;
        maskBtnText.textContent = isMaskView ? 'Ver Cámara BGR' : 'Ver Máscara HSV';
        btnToggleMask.classList.toggle('btn-primary', isMaskView);
        btnToggleMask.classList.toggle('btn-outline', !isMaskView);
        saveSettings();
    });

    btnToggleTracking.addEventListener('click', () => {
        fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle_tracking' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                isTrackingActive = data.is_tracking;
                trackingBtnText.textContent = isTrackingActive ? 'Pausar Seguimiento' : 'Reanudar Seguimiento';
                btnToggleTracking.classList.toggle('btn-primary', isTrackingActive);
                btnToggleTracking.classList.toggle('btn-outline', !isTrackingActive);
            }
        });
    });

    btnReset.addEventListener('click', () => {
        fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_defaults' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                updateUIWithSettings(data.settings);
            }
        });
    });

    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const presetName = chip.getAttribute('data-preset');
            if (COLOR_PRESETS[presetName]) {
                Object.assign(currentSettings, COLOR_PRESETS[presetName]);
                updateUIWithSettings(currentSettings);
                saveSettings();
            }
        });
    });

    function fetchSettings() {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                currentSettings = data;
                updateUIWithSettings(data);
            });
    }

    function updateUIWithSettings(settings) {
        sliderIds.forEach(id => {
            if (settings[id] !== undefined) {
                const slider = document.getElementById(id);
                const valSpan = document.getElementById(`val-${id}`);
                if (slider) slider.value = settings[id];
                if (valSpan) valSpan.textContent = settings[id];
            }
        });

        toggleIds.forEach(id => {
            if (settings[id] !== undefined) {
                const toggle = document.getElementById(id);
                if (toggle) toggle.checked = settings[id];
            }
        });

        if (settings.tracking_mode) {
            activeMode = settings.tracking_mode;
            btnModeHsv.classList.toggle('active', activeMode === 'hsv');
            btnModeNn.classList.toggle('active', activeMode === 'neural_net');
        }
    }

    function debouncedSaveSettings() {
        clearTimeout(updateTimer);
        updateTimer = setTimeout(saveSettings, 100);
    }

    function saveSettings() {
        fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentSettings)
        });
    }

    function fetchStatus() {
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                connBadge.classList.add('online');
                connText.textContent = 'En Línea';

                if (data.simulation) {
                    modeBadge.style.display = 'flex';
                    modeText.textContent = 'Modo Simulación';
                } else {
                    modeText.textContent = 'Cámara Pi/USB';
                }

                hudFps.textContent = `FPS: ${data.fps}`;
                hudRes.textContent = `${data.frame_width}x${data.frame_height}`;

                if (data.detected) {
                    metricDetected.textContent = 'DETECTADO';
                    metricDetected.style.color = '#10b981';
                } else {
                    metricDetected.textContent = 'BUSCANDO...';
                    metricDetected.style.color = '#f59e0b';
                }

                metricCoords.textContent = `[${data.target_x}, ${data.target_y}]`;
                metricArea.textContent = data.target_area.toLocaleString();

                if (data.tracking_mode === 'neural_net') {
                    metricBbox.textContent = `IA: ${data.nn_confidence}%`;
                } else {
                    metricBbox.textContent = `${data.bbox[2]} x ${data.bbox[3]} px`;
                }

                if (data.nn_info) {
                    updateNNInfo(data.nn_info);
                }
            })
            .catch(() => {
                connBadge.classList.remove('online');
                connText.textContent = 'Desconectado';
            });
    }
});
