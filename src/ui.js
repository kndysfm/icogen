import { state } from './state.js';
import { renderSVG } from './renderer.js';
import { exportICO } from './exporter.js';

export function initUI() {
    const inputs = {
        text: document.getElementById('input-text'),
        font: document.getElementById('input-font'),
        fontSizeScale: document.getElementById('input-font-size'),
        offsetX: document.getElementById('input-offset-x'),
        offsetY: document.getElementById('input-offset-y'),
        rotate: document.getElementById('input-rotate'),
        fontWeight: document.getElementById('input-bold'),
        fontStyle: document.getElementById('input-italic'),
        shape: document.getElementById('design-shape'),
        shapeScale: document.getElementById('input-shape-scale'),
        bgColor: document.getElementById('design-color'),

        // Global Shadow Angle
        globalShadowAngle: document.getElementById('input-global-shadow-angle'),

        // Shape Shadow
        shapeShadowEnabled: document.getElementById('effect-shape-shadow-enabled'),
        shapeShadowColor: document.getElementById('effect-shape-shadow-color'),
        shapeShadowOpacity: document.getElementById('effect-shape-shadow-opacity'),
        shapeShadowBlur: document.getElementById('effect-shape-shadow-blur'),
        shapeShadowDistance: document.getElementById('effect-shape-shadow-dist'),

        // Shape Inner Shadow
        shapeInnerShadowEnabled: document.getElementById('effect-shape-inner-shadow-enabled'),
        shapeInnerShadowColor: document.getElementById('effect-shape-inner-shadow-color'),
        shapeInnerShadowOpacity: document.getElementById('effect-shape-inner-shadow-opacity'),
        shapeInnerShadowBlur: document.getElementById('effect-shape-inner-shadow-blur'),
        shapeInnerShadowDistance: document.getElementById('effect-shape-inner-shadow-dist'),

        // BG Gradient
        bgGradientEnabled: document.getElementById('effect-bg-gradient-enabled'),
        bgGradientColor: document.getElementById('effect-bg-gradient-color'),
        bgGradientOpacity: document.getElementById('effect-bg-gradient-opacity'),

        // Text
        textColor: document.getElementById('design-text-color'),
        textGradientEnabled: document.getElementById('effect-text-gradient-enabled'),
        textGradientColor: document.getElementById('effect-text-gradient-color'),
        textGradientOpacity: document.getElementById('effect-text-gradient-opacity'),

        // Shadow (Text)
        shadowEnabled: document.getElementById('effect-shadow-enabled'),
        shadowType: document.getElementById('effect-shadow-type'),
        shadowColor: document.getElementById('effect-shadow-color'),
        shadowOpacity: document.getElementById('effect-shadow-opacity'),
        shadowDistance: document.getElementById('effect-shadow-dist'),
        // Unified Blur (Drop = Blur/Sharp, Long = Fade/Solid)
        shadowBlur: document.getElementById('effect-shadow-blur'),

        // Outline
        outlineEnabled: document.getElementById('effect-outline-enabled'),
        outlineColor: document.getElementById('effect-outline-color'),
        outlineOpacity: document.getElementById('effect-outline-opacity'),
        outlineWidth: document.getElementById('effect-outline-width'),

        // Material Design Features
        finishLayer: document.getElementById('effect-finish-layer-enabled'),
        finishLayerOpacity: document.getElementById('effect-finish-layer-opacity'),
        edgeTintShade: document.getElementById('effect-edge-tint-shade-enabled'),
        edgeOpacity: document.getElementById('effect-edge-opacity'),
        edgeWidth: document.getElementById('effect-edge-width'),
        autoColorHarmony: document.getElementById('effect-auto-color-harmony-enabled'),

        // Score Effect
        scoreEnabled: document.getElementById('effect-score-enabled'),
        scoreOpacity: document.getElementById('effect-score-opacity'),
        scoreAngle: document.getElementById('effect-score-angle')
    };

    const previewContainer = document.getElementById('preview-container');
    const btnExport = document.getElementById('btn-export');

    // Input Listeners
    Object.keys(inputs).forEach(key => {
        const el = inputs[key];
        if (el) {
            el.addEventListener('input', (e) => {
                const val = el.type === 'checkbox' ? el.checked : e.target.value;
                state.update({ [key]: val });

                // Update Hex Display with safety check
                if (el.type === 'color') {
                    const span = el.nextElementSibling;
                    if (span && span.classList.contains('color-value')) {
                        span.textContent = e.target.value;
                    }
                }
            });
        }
    });

    // --- Save / Load Logic ---
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');
    const fileInput = document.getElementById('input-load-file');

    // Save
    btnSave.addEventListener('click', () => {
        // Create a Clean Copy of State if needed (removing internal flags if any, but our state is clean)
        const json = JSON.stringify(state, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'icon_settings.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Load Trigger
    btnLoad.addEventListener('click', () => {
        fileInput.click();
    });

    // Load File Handler
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const loadedState = JSON.parse(ev.target.result);
                // Update State
                state.update(loadedState);
                // Sync UI
                syncUI();
            } catch (err) {
                alert('Failed to load settings: ' + err.message);
                console.error(err);
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be loaded again
        e.target.value = '';
    });

    // Sync UI Function
    const syncUI = () => {
        Object.keys(inputs).forEach(key => {
            const el = inputs[key];
            if (el && state[key] !== undefined) {
                if (el.type === 'checkbox') {
                    el.checked = state[key];
                } else {
                    el.value = state[key];
                }

                // Trigger events to update displays (Hex, Sliders text)
                // We manually update displays to avoid firing 'input' event which might loop back (though loop back is safe as state matches)
                // But displays are updated via 'oninput' inline handlers in HTML usually.
                // We'll dispatch event.
                el.dispatchEvent(new Event('input'));
            }
        });

        // Ensure visibility is correct
        updateVisibility();
    };

    // State Subscription for Preview
    state.subscribe((currentState) => {
        const svgString = renderSVG(currentState);
        previewContainer.innerHTML = svgString;
    });

    // Export Button
    btnExport.addEventListener('click', () => {
        // Current SVG is in previewContainer.firstChild
        const svgElement = previewContainer.querySelector('svg');
        if (svgElement) {
            // We can pass the state or the svg string.
            // Passing SVG string to exporter is cleaner.
            exportICO(svgElement.outerHTML, state.font);
        }
    });
}
