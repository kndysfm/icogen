export const state = {
    // Text & Text Effects
    text: 'M',
    font: 'Noto Sans JP',
    fontSizeScale: 100,
    offsetX: 0,
    offsetY: 0,
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
    shadowLength: 64, // For Long Shadow
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
