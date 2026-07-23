document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM
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

    let currentSettings = {};
    let isTrackingActive = true;
    let isMaskView = false;
    let updateTimer = null;

    // Preajustes de Color HSV
    const COLOR_PRESETS = {
        verde:    { h_min: 35,  h_max: 85,  s_min: 80, s_max: 255, v_min: 80, v_max: 255 },
        azul:     { h_min: 90,  h_max: 130, s_min: 80, s_max: 255, v_min: 80, v_max: 255 },
        rojo:     { h_min: 0,   h_max: 10,  s_min: 120, s_max: 255, v_min: 120, v_max: 255 },
        amarillo: { h_min: 20,  h_max: 35,  s_min: 100, s_max: 255, v_min: 100, v_max: 255 }
    };

    // Cargar configuración inicial del backend
    fetchSettings();

    // Iniciar bucle de actualización de telemetría (cada 200ms)
    setInterval(fetchStatus, 200);

    // Registrar eventos para Sliders
    sliderIds.forEach(id => {
        const slider = document.getElementById(id);
        const valSpan = document.getElementById(`val-${id}`);

        if (slider && valSpan) {
            slider.addEventListener('input', (e) => {
                valSpan.textContent = e.target.value;
                currentSettings[id] = parseInt(e.target.value);
                
                // Validación para evitar que H_Min > H_Max, etc.
                if (id === 'h_min' && parseInt(slider.value) > currentSettings['h_max']) {
                    document.getElementById('h_max').value = slider.value;
                    document.getElementById('val-h_max').textContent = slider.value;
                    currentSettings['h_max'] = parseInt(slider.value);
                }
                
                debouncedSaveSettings();
            });
        }
    });

    // Registrar eventos para Toggles
    toggleIds.forEach(id => {
        const toggle = document.getElementById(id);
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                currentSettings[id] = e.target.checked;
                saveSettings();
            });
        }
    });

    // Botón de alternar máscara HSV
    btnToggleMask.addEventListener('click', () => {
        isMaskView = !isMaskView;
        currentSettings['show_mask'] = isMaskView;
        maskBtnText.textContent = isMaskView ? 'Ver Cámara BGR' : 'Ver Máscara HSV';
        btnToggleMask.classList.toggle('btn-primary', isMaskView);
        btnToggleMask.classList.toggle('btn-outline', !isMaskView);
        saveSettings();
    });

    // Botón de pausar/reanudar seguimiento
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

    // Botón de Restablecer
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

    // Preajustes de color
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const presetName = chip.getAttribute('data-preset');
            if (COLOR_PRESETS[presetName]) {
                const preset = COLOR_PRESETS[presetName];
                Object.assign(currentSettings, preset);
                updateUIWithSettings(currentSettings);
                saveSettings();
            }
        });
    });

    // Funciones Auxiliares API
    function fetchSettings() {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                currentSettings = data;
                updateUIWithSettings(data);
            })
            .catch(err => console.error("Error al obtener configuración:", err));
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

        if (settings.show_mask !== undefined) {
            isMaskView = settings.show_mask;
            maskBtnText.textContent = isMaskView ? 'Ver Cámara BGR' : 'Ver Máscara HSV';
            btnToggleMask.classList.toggle('btn-primary', isMaskView);
            btnToggleMask.classList.toggle('btn-outline', !isMaskView);
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
        }).catch(err => console.error("Error al guardar configuración:", err));
    }

    function fetchStatus() {
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                // Actualizar estado de conexión
                connBadge.classList.add('online');
                connText.textContent = 'En Línea';

                // Modo de cámara (Simulación o Hardware)
                if (data.simulation) {
                    modeBadge.style.display = 'flex';
                    modeText.textContent = 'Modo Simulación';
                } else {
                    modeText.textContent = 'Cámara Pi/USB';
                }

                // Actualizar métricas HUD
                hudFps.textContent = `FPS: ${data.fps}`;
                hudRes.textContent = `${data.frame_width}x${data.frame_height}`;

                // Actualizar métricas del dashboard
                if (data.detected) {
                    metricDetected.textContent = 'DETECTADO';
                    metricDetected.style.color = '#10b981';
                } else {
                    metricDetected.textContent = 'BUSCANDO...';
                    metricDetected.style.color = '#f59e0b';
                }

                metricCoords.textContent = `[${data.target_x}, ${data.target_y}]`;
                metricArea.textContent = data.target_area.toLocaleString();
                metricBbox.textContent = `${data.bbox[2]} x ${data.bbox[3]} px`;
            })
            .catch(() => {
                connBadge.classList.remove('online');
                connText.textContent = 'Desconectado';
            });
    }
});
