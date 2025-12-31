import { calculateColorHarmony } from './state.js';

export function renderSVG(state) {
  const size = 256;
  const center = size / 2;
  let defsContent = '';

  // --- Shape Effects Filter ---
  let shapeFilterPrimitives = '';
  // 1. Outer Drop Shadow
  if (state.shapeShadowEnabled) {
    const blurStd = state.shapeShadowBlur ? 4 : 0; // Default 4 for soft, 0 for hard
    const dist = parseInt(state.shapeShadowDistance) || 4;
    const angle = parseInt(state.globalShadowAngle) ?? 45;
    const rad = angle * (Math.PI / 180);

    const dx = dist * Math.cos(rad);
    const dy = dist * Math.sin(rad);
    const op = state.shapeShadowOpacity / 100;

    shapeFilterPrimitives += `
        <feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${blurStd}" flood-color="${state.shapeShadowColor}" flood-opacity="${op}" result="dropShadow"/>
      `;
  }

  // 2. Inner Shadow
  if (state.shapeInnerShadowEnabled) {
    const blurStd = state.shapeInnerShadowBlur ? 4 : 0;
    const dist = parseInt(state.shapeInnerShadowDistance) || 4;
    const angle = parseInt(state.globalShadowAngle) ?? 45;
    const rad = angle * (Math.PI / 180);

    const dx = dist * Math.cos(rad);
    const dy = dist * Math.sin(rad);

    const op = state.shapeInnerShadowOpacity / 100;

    shapeFilterPrimitives += `
        <feComponentTransfer in="SourceAlpha" result="invertedAlpha">
            <feFuncA type="table" tableValues="1 0"/>
        </feComponentTransfer>
        <feGaussianBlur in="invertedAlpha" stdDeviation="${blurStd}" result="blurredInverted"/>
        <feOffset in="blurredInverted" dx="${dx}" dy="${dy}" result="offsetBlurred"/>
        <feComposite in="offsetBlurred" in2="SourceAlpha" operator="in" result="innerShadowAlpha"/>
        <feFlood flood-color="${state.shapeInnerShadowColor}" flood-opacity="${op}" result="innerFlood"/>
        <feComposite in="innerFlood" in2="innerShadowAlpha" operator="in" result="innerShadow"/>
      `;
  }

  // 3. Merge Flow
  // Inputs:
  // - Drop Shadow Result: 'dropShadow' (if enabled)
  // - SourceGraphic
  // - Inner Shadow Result: 'innerShadow' (if enabled)

  let mergeNodes = '';
  if (state.shapeShadowEnabled) {
    mergeNodes += `<feMergeNode in="dropShadow"/>`;
  }
  mergeNodes += `<feMergeNode in="SourceGraphic"/>`;
  if (state.shapeInnerShadowEnabled) {
    mergeNodes += `<feMergeNode in="innerShadow"/>`;
  }

  // If no effects, empty filter.
  // Note: If no effects, we should ideally not apply filter="url(#...)" to avoid overhead?
  // Renderer handles empty?

  const shapeFilter = shapeFilterPrimitives ? `
    <filter id="shape-effects" x="-50%" y="-50%" width="200%" height="200%">
        ${shapeFilterPrimitives}
        <feMerge>
            ${mergeNodes}
        </feMerge>
    </filter>
  ` : '';
  defsContent += shapeFilter;

  // --- Background Shape Logic ---
  const scale = (state.shapeScale || 100) / 100;
  // Scale from center
  const shapeTransform = `translate(${center} ${center}) scale(${scale}) translate(-${center} -${center})`;

  // Define helper to generate shape tag
  // We append our transform to any existing transform logic.
  // Note: Diamond already has a transform. SVG transforms stack if space separated or we need to concat.
  // Best to put the Scale Transform on a GROUP around the shape or append it carefully.
  // Simple approach: Apply Scale Transform to the attributes string.

  let getShapeTag = (attrs) => '';

  // Wrapper to inject scale.
  // If shape is Diamond, it has its own transform.
  // "transform" attribute in SVG replaces previous.
  // So we should handle this.
  // Let's change the pattern: getShapeTag returns the geometry definition (d, points, cx/cy etc).
  // Attributes like fill/filter/transform are passed in.

  // Actually simpler: Wrap the shape in a <g transform="...">?
  // But we need the Shape for ClipPath too.
  // Clipping a Group works.

  // Let's try appending the transform.
  const applyTransform = (existingAttrs) => {
    if (existingAttrs.includes('transform="')) {
      // Prepend the shapeTransform to the existing transform
      return existingAttrs.replace('transform="', `transform="${shapeTransform} `);
    } else {
      return `${existingAttrs} transform="${shapeTransform}"`;
    }
  };

  // Helper to add stroke for rounded polygons
  const addRoundedStroke = (attrs, width = 32) => {
    const fillMatch = attrs.match(/fill="([^"]+)"/);
    const strokeColor = fillMatch ? fillMatch[1] : 'black';
    // If fill is a gradient URL, we need to ensure the stroke uses it too.
    // The regex above captures it correctly.
    return `${attrs} stroke="${strokeColor}" stroke-width="${width}" stroke-linejoin="round"`;
  };

  if (state.shape === 'circle') {
    getShapeTag = (attrs) => `<circle cx="${center}" cy="${center}" r="${center}" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'rounded') {
    getShapeTag = (attrs) => `<rect x="0" y="0" width="${size}" height="${size}" rx="50" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'square') {
    getShapeTag = (attrs) => `<rect x="0" y="0" width="${size}" height="${size}" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'rectangle') {
    getShapeTag = (attrs) => `<rect x="0" y="32" width="${size}" height="192" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'rounded-rectangle') {
    getShapeTag = (attrs) => `<rect x="0" y="32" width="${size}" height="192" rx="32" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'triangle') {
    const pointsCentered = "128,32 239,224 17,224";
    getShapeTag = (attrs) => `<polygon points="${pointsCentered}" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'rounded-triangle') {
    const pointsCentered = "128,48 223,212 33,212";
    getShapeTag = (attrs) => `<polygon points="${pointsCentered}" ${applyTransform(addRoundedStroke(attrs, 32))} />`;
  } else if (state.shape === 'hexagon') {
    const r = center;
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle_deg = 60 * i - 30;
      const angle_rad = Math.PI / 180 * angle_deg;
      points.push(`${center + r * Math.cos(angle_rad)},${center + r * Math.sin(angle_rad)}`);
    }
    getShapeTag = (attrs) => `<polygon points="${points.join(' ')}" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'rounded-hexagon') {
    const r = center - 16;
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle_deg = 60 * i - 30;
      const angle_rad = Math.PI / 180 * angle_deg;
      points.push(`${center + r * Math.cos(angle_rad)},${center + r * Math.sin(angle_rad)}`);
    }
    getShapeTag = (attrs) => `<polygon points="${points.join(' ')}" ${applyTransform(addRoundedStroke(attrs, 32))} />`;
  } else if (state.shape === 'diamond') {
    // Use polygon to avoid rotation transform issues with shadow
    const points = `128,0 256,128 128,256 0,128`;
    getShapeTag = (attrs) => `<polygon points="${points}" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'rounded-diamond') {
    // Use polygon with stroke for rounded corners, inset by 16px (half stroke) to fit in box
    const points = `128,16 240,128 128,240 16,128`;
    getShapeTag = (attrs) => `<polygon points="${points}" ${applyTransform(addRoundedStroke(attrs, 32))} />`;
  }


  // --- Definitions (Filters, Gradients, ClipPaths) ---

  // 0. Font Embedding
  const getFontImportURL = (fontName) => {
    const map = {
      'Material Icons': 'https://fonts.googleapis.com/icon?family=Material+Icons',
      'Noto Sans JP': 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap',
      'Noto Serif JP': 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap',
      'Noto Sans Symbols': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols&display=swap',
      'Noto Sans Symbols 2': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2&display=swap',
      'Noto Music': 'https://fonts.googleapis.com/css2?family=Noto+Music&display=swap',
      'Noto Serif Hentaigana': 'https://fonts.googleapis.com/css2?family=Noto+Serif+Hentaigana&display=swap',
      'Noto Sans Egyptian Hieroglyphs': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Egyptian+Hieroglyphs&display=swap',
      'Noto Color Emoji': 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap',
      'Noto Emoji': 'https://fonts.googleapis.com/css2?family=Noto+Emoji:wght@400&display=swap'
    };
    return map[fontName] || '';
  };

  const fontUrl = getFontImportURL(state.font);
  if (fontUrl) {
    defsContent += `<style>@import url('${fontUrl}');</style>`;
  }

  // 1. Clip Path for Long Shadow
  defsContent += `<clipPath id="shape-clip">${getShapeTag('')}</clipPath>`;

  // Mask for Overlays (ensures rounded corners and strokes are covered uniformly)
  // We use fill="white" to create a solid white silhouette of the shape (including stroke)
  defsContent += `<mask id="shape-mask">${getShapeTag('fill="white"')}</mask>`;

  // 2. Shape Shadow Filter - Removed (Replaced by #shape-effects)

  // 3. Background Gradient
  if (state.bgGradientEnabled) {
    const gradOp = state.bgGradientOpacity / 100;
    // Use global shadow angle for gradient direction
    const angle = parseInt(state.globalShadowAngle) ?? 45;
    const rad = angle * (Math.PI / 180);
    // Calculate gradient vector (perpendicular to light direction for natural look)
    const x1 = 50 - 50 * Math.cos(rad);
    const y1 = 50 - 50 * Math.sin(rad);
    const x2 = 50 + 50 * Math.cos(rad);
    const y2 = 50 + 50 * Math.sin(rad);
    defsContent += `
        <linearGradient id="bg-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
          <stop offset="0%" style="stop-color:${state.bgGradientColor};stop-opacity:0" />
          <stop offset="100%" style="stop-color:${state.bgGradientColor};stop-opacity:${gradOp}" />
        </linearGradient>
      `;
  }

  // 4. Text Gradient
  if (state.textGradientEnabled) {
    const gradOp = state.textGradientOpacity / 100;
    // Use global shadow angle for gradient direction
    const angle = parseInt(state.globalShadowAngle) ?? 45;
    const rad = angle * (Math.PI / 180);
    // Calculate gradient vector
    const x1 = 50 - 50 * Math.cos(rad);
    const y1 = 50 - 50 * Math.sin(rad);
    const x2 = 50 + 50 * Math.cos(rad);
    const y2 = 50 + 50 * Math.sin(rad);
    defsContent += `
        <linearGradient id="text-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
          <stop offset="0%" style="stop-color:${state.textGradientColor};stop-opacity:${gradOp}" />
          <stop offset="100%" style="stop-color:${state.textGradientColor};stop-opacity:0" />
        </linearGradient>
      `;
  }

  // 5. Finish Layer Gradient (Gloss Effect)
  if (state.finishLayer) {
    const angle = parseInt(state.globalShadowAngle) ?? 45;
    const rad = angle * (Math.PI / 180);
    // Center point for radial gradient (light source direction)
    const cx = 50 + 30 * Math.cos(rad);
    const cy = 50 + 30 * Math.sin(rad);
    const op = (state.finishLayerOpacity !== undefined ? state.finishLayerOpacity : 15) / 100;
    defsContent += `
        <radialGradient id="finish-layer" cx="${cx}%" cy="${cy}%" r="60%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:${op}" />
          <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0" />
        </radialGradient>
      `;
  }

  // 6. Calculate tint/shade for edge effects from background color
  let tintColor = '#ffffff';
  let shadeColor = '#000000';
  if (state.autoColorHarmony) {
    const harmony = calculateColorHarmony(state.bgColor);
    tintColor = harmony.tint;
    shadeColor = harmony.shade;
  }

  // 5. Text Drop Shadow Filter
  if (state.shadowEnabled && state.shadowType === 'drop') {
    const shOp = state.shadowOpacity / 100;
    const blurStr = state.shadowBlur ? '6' : '0';
    const angle = parseInt(state.globalShadowAngle) ?? 45;
    const rotate = parseInt(state.rotate) || 0;
    // Compensate for text rotation so shadow follows global light
    const effectiveAngle = angle - rotate;
    const rad = effectiveAngle * (Math.PI / 180);
    const dist = parseInt(state.shadowDistance) || 8;
    const dx = dist * Math.cos(rad);
    const dy = dist * Math.sin(rad);
    defsContent += `
        <filter id="text-shadow-only" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="${blurStr}"/>
            <feOffset dx="${dx}" dy="${dy}" result="offsetblur"/>
            <feFlood flood-color="${state.shadowColor}" flood-opacity="${shOp}"/>
            <feComposite in2="offsetblur" operator="in"/>
        </filter>
      `;
  }

  // --- Element Construction ---

  // Background Element
  const shapeEffectsAttr = shapeFilterPrimitives ? 'filter="url(#shape-effects)"' : '';
  
  // We group the base shape and its overlays so that the Inner Shadow (part of shape-effects)
  // is applied ON TOP of the overlays (Gradient, Finish Layer, etc).
  // This prevents the overlays from washing out the inner shadow.
  let bgContent = getShapeTag(`fill="${state.bgColor}"`);

  if (state.bgGradientEnabled) {
    // Overlay with Mask to ensure gradient applies to the whole shape (fill + stroke) uniformly
    bgContent += `<rect x="0" y="0" width="100%" height="100%" fill="url(#bg-gradient)" mask="url(#shape-mask)" style="pointer-events:none;" />`;
  }

  // Finish Layer (Gloss Effect)
  if (state.finishLayer) {
    bgContent += `<rect x="0" y="0" width="100%" height="100%" fill="url(#finish-layer)" mask="url(#shape-mask)" style="pointer-events:none;" />`;
  }

  // Edge Tint/Shade Effects
  if (state.edgeTintShade) {
    const edgeOp = (state.edgeOpacity !== undefined ? state.edgeOpacity : 20) / 100;
    const edgeW = state.edgeWidth !== undefined ? state.edgeWidth : 2;

    // Top Edge Gradient:
    defsContent += `
      <linearGradient id="edge-tint-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${tintColor};stop-opacity:${edgeOp}" />
        <stop offset="${edgeW}%" style="stop-color:${tintColor};stop-opacity:${edgeOp}" />
        <stop offset="${edgeW}%" style="stop-color:${tintColor};stop-opacity:0" />
      </linearGradient>
      <linearGradient id="edge-shade-grad" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" style="stop-color:${shadeColor};stop-opacity:${edgeOp}" />
        <stop offset="${edgeW}%" style="stop-color:${shadeColor};stop-opacity:${edgeOp}" />
        <stop offset="${edgeW}%" style="stop-color:${shadeColor};stop-opacity:0" />
      </linearGradient>
    `;

    bgContent += `<rect x="0" y="0" width="100%" height="100%" fill="url(#edge-tint-grad)" mask="url(#shape-mask)" style="pointer-events:none;" />`;
    bgContent += `<rect x="0" y="0" width="100%" height="100%" fill="url(#edge-shade-grad)" mask="url(#shape-mask)" style="pointer-events:none;" />`;
  }

  let bgElement = `<g ${shapeEffectsAttr}>${bgContent}</g>`;

  // Text Common Attributes
  const fontFamily = state.font;
  const baseFontSize = state.text.length > 1 ? 120 : 160;
  const fontSize = baseFontSize * (state.fontSizeScale / 100);
  const fontWeight = state.fontWeight ? 'bold' : 'normal';
  const fontStyle = state.fontStyle ? 'italic' : 'normal';

  // Offsets
  const offX = parseInt(state.offsetX) || 0;
  const offY = parseInt(state.offsetY) || 0;
  const rotate = parseInt(state.rotate) || 0;

  const textCommonAttrs = `
        x="50%"
        y="50%"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="${fontFamily}"
        font-size="${fontSize}"
        font-weight="${fontWeight}"
        font-style="${fontStyle}"
        style="user-select: none;"
  `;

  // --- Score Effect Definitions ---
  if (state.scoreEnabled) {
    const scoreAngle = parseInt(state.scoreAngle) || 180;
    const rad = scoreAngle * (Math.PI / 180);
    const x1 = 50 - 50 * Math.cos(rad);
    const y1 = 50 - 50 * Math.sin(rad);
    const x2 = 50 + 50 * Math.cos(rad);
    const y2 = 50 + 50 * Math.sin(rad);
    const scoreOp = (state.scoreOpacity || 15) / 100;

    defsContent += `
        <linearGradient id="score-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
            <stop offset="50%" style="stop-color:#000000;stop-opacity:0" />
            <stop offset="50%" style="stop-color:#000000;stop-opacity:${scoreOp}" />
            <stop offset="100%" style="stop-color:#000000;stop-opacity:${scoreOp}" />
        </linearGradient>
    `;
  }

  // Long Shadow Group
  let longShadowGroup = '';
  if (state.shadowEnabled && state.shadowType === 'long') {
    const len = parseInt(state.shadowDistance) || 64;
    // Unified Blur: Blur Checked = Fade. Blur Unchecked = Solid.
    const solid = !state.shadowBlur;
    const baseOp = state.shadowOpacity / 100;
    const shColor = state.shadowColor;

    // Use global shadow angle for direction
    const angle = parseInt(state.globalShadowAngle) ?? 45;
    const rad = angle * (Math.PI / 180);

    let clones = '';
    for (let i = 1; i <= len; i++) {
      const shiftX = i * Math.cos(rad) + offX;
      const shiftY = i * Math.sin(rad) + offY;
      if (solid) {
        clones += `<text ${textCommonAttrs} stroke="none" fill="${shColor}" transform="translate(${shiftX}, ${shiftY}) rotate(${rotate}, ${center}, ${center})">${state.text}</text>`;
      } else {
        const stepOp = baseOp * (1 - i / len);
        clones += `<text ${textCommonAttrs} stroke="none" fill="${shColor}" fill-opacity="${stepOp}" transform="translate(${shiftX}, ${shiftY}) rotate(${rotate}, ${center}, ${center})">${state.text}</text>`;
      }
    }

    // Apply Clip Path here
    const groupOp = solid ? `opacity="${baseOp}"` : '';
    longShadowGroup = `<g mask="url(#shape-mask)" ${groupOp}>${clones}</g>`;
  }

  // Drop Shadow Group (Clipped)
  let dropShadowGroup = '';
  if (state.shadowEnabled && state.shadowType === 'drop') {
    dropShadowGroup = `
        <g mask="url(#shape-mask)">
            <text ${textCommonAttrs} stroke="none" fill="black" filter="url(#text-shadow-only)" transform="translate(${offX}, ${offY}) rotate(${rotate}, ${center}, ${center})">${state.text}</text>
        </g>
      `;
  }

  // Outline Element
  let outlineElement = '';
  if (state.outlineEnabled) {
    const outOp = state.outlineOpacity / 100;
    outlineElement = `
        <text
            ${textCommonAttrs}
            stroke="${state.outlineColor}"
            stroke-width="${state.outlineWidth * 2}"
            stroke-opacity="${outOp}"
            stroke-linejoin="round"
            fill="none"
            transform="translate(${offX}, ${offY}) rotate(${rotate}, ${center}, ${center})"
        >${state.text}</text>
      `;
  }

  // Main Text
  let mainText = `<text ${textCommonAttrs} stroke="none" fill="${state.textColor}" transform="translate(${offX}, ${offY}) rotate(${rotate}, ${center}, ${center})">${state.text}</text>`;

  if (state.textGradientEnabled) {
    mainText += `<text ${textCommonAttrs} stroke="none" fill="url(#text-gradient)" style="pointer-events:none;" transform="translate(${offX}, ${offY}) rotate(${rotate}, ${center}, ${center})">${state.text}</text>`;
  }

  // Score Effect Overlay
  let scoreElement = '';
  if (state.scoreEnabled) {
    scoreElement = `<rect x="0" y="0" width="${size}" height="${size}" fill="url(#score-gradient)" mask="url(#shape-mask)" style="pointer-events:none;" />`;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>${defsContent}</defs>
      ${bgElement}
      ${scoreElement}
      ${longShadowGroup}
      ${dropShadowGroup}
      ${outlineElement}
      ${mainText}
    </svg>
  `;
}
