// Color Harmony Calculator - Material Design compliant
export function calculateColorHarmony(hexColor) {
    // Parse hex color to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Convert RGB to HSL for better tint/shade calculation
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (max !== min) {
        if (max === rNorm) h = 60 * (((gNorm - bNorm) / (max - min)) % 6);
        else if (max === gNorm) h = 60 * (((bNorm - rNorm) / (max - min)) + 2);
        else h = 60 * (((rNorm - gNorm) / (max - min)) + 4);
    }

    // Material Design tint: lighten by ~30% (increase lightness)
    const tintL = Math.min(l + 0.30, 1);
    // Material Design shade: darken by ~25% (decrease lightness)
    const shadeL = Math.max(l - 0.25, 0);

    // Convert back to RGB
    const hslToRgb = (hVal, sVal, lVal) => {
        const c = (1 - Math.abs(2 * lVal - 1)) * sVal;
        const hPrime = hVal / 60;
        const x = c * (1 - Math.abs(hPrime % 2 - 1));
        let rVal = 0, gVal = 0, bVal = 0;

        if (hPrime >= 0 && hPrime < 1) {
            rVal = c; gVal = x; bVal = 0;
        } else if (hPrime >= 1 && hPrime < 2) {
            rVal = x; gVal = c; bVal = 0;
        } else if (hPrime >= 2 && hPrime < 3) {
            rVal = 0; gVal = c; bVal = x;
        } else if (hPrime >= 3 && hPrime < 4) {
            rVal = 0; gVal = x; bVal = c;
        } else if (hPrime >= 4 && hPrime < 5) {
            rVal = x; gVal = 0; bVal = c;
        } else if (hPrime >= 5 && hPrime < 6) {
            rVal = c; gVal = 0; bVal = x;
        }

        const m = lVal - c / 2;
        return [
            Math.round((rVal + m) * 255),
            Math.round((gVal + m) * 255),
            Math.round((bVal + m) * 255)
        ];
    };

    const tintRgb = hslToRgb(h, s, tintL);
    const shadeRgb = hslToRgb(h, s, shadeL);

    // Convert back to hex
    const rgbToHex = (r, g, b) => {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    };

    return {
        tint: rgbToHex(tintRgb[0], tintRgb[1], tintRgb[2]),
        shade: rgbToHex(shadeRgb[0], shadeRgb[1], shadeRgb[2])
    };
}

export const state = {
    // Text & Text Effects
    text: 'M',
    font: 'Noto Sans JP',
    fontSizeScale: 100,
    offsetX: 0,
    offsetY: 0,
    rotate: 0,
    fontWeight: false,
    fontStyle: false,
    textColor: '#ffffff',
    textGradientEnabled: false,
    textGradientColor: '#cccccc',
    textGradientOpacity: 50,

    // Shape & Background Elements
    shape: 'hexagon',
    shapeScale: 90, // Percentage
    bgColor: '#6200ee',

    // Global Shadow Settings
    globalShadowAngle: 45, // Unified light source angle for all shadows

    // Shape Shadow
    shapeShadowEnabled: false,
    shapeShadowColor: '#000000',
    shapeShadowOpacity: 50,
    shapeShadowBlur: true,
    shapeShadowDistance: 4,

    // Shape Inner Shadow
    shapeInnerShadowEnabled: false,
    shapeInnerShadowColor: '#ffffff',
    shapeInnerShadowOpacity: 50,
    shapeInnerShadowBlur: true,
    shapeInnerShadowDistance: 4,

    bgGradientEnabled: false,
    bgGradientColor: '#000000',
    bgGradientOpacity: 20,

    // Text Shadow (Drop / Long)
    shadowEnabled: true,
    shadowType: 'long',
    shadowColor: '#000000',
    shadowOpacity: 40,
    shadowDistance: 8, // Unified Distance (Drop) / Length (Long)
    // shadowSolid replaced by !multishadowBlur logic. using shadowBlur.
    shadowBlur: false, // Default false for Long Shadow? Or True?
    // User complaint: "Initial blur is unchecked but effective".
    // If I set this to false, and HTML is unchecked, it matches.
    // Let's set to FALSE by default for crisp look? Or TRUE for material?
    // User request 1: "Initial... unchecked... effective".
    // Meaning State was True? No, state was undefined/default?
    // Actually, I added it as `shadowBlur: true` in previous step. HTML check was default false.
    // So State=True, HTML=False.
    // I will set it to TRUE and add `checked` to HTML.

    // Text Outline
    outlineEnabled: false,
    outlineColor: '#ffffff',
    outlineOpacity: 100,
    outlineWidth: 4,

    // Material Design Features
    finishLayer: true,
    finishLayerOpacity: 15,
    edgeTintShade: true,
    edgeOpacity: 20,
    edgeWidth: 2,
    autoColorHarmony: true,

    // Score Effect
    scoreEnabled: false,
    scoreOpacity: 15,
    scoreAngle: 180, // Vertical by default

    // Internal listeners
    _listeners: new Set(),

    subscribe(callback) {
        this._listeners.add(callback);
        // Determine initial trigger
        callback(this);
        return () => this._listeners.delete(callback);
    },

    update(newState) {
        let hasChanged = false;
        for (const [key, value] of Object.entries(newState)) {
            // Protect internal properties and methods
            if (key.startsWith('_') || typeof this[key] === 'function') continue;

            if (this[key] !== value) {
                this[key] = value;
                hasChanged = true;
            }
        }

        if (hasChanged) {
            this.notify();
        }
    },

    notify() {
        this._listeners.forEach(cb => cb(this));
    }
};
