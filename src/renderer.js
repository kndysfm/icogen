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

  if (state.shape === 'circle') {
    getShapeTag = (attrs) => `<circle cx="${center}" cy="${center}" r="${center}" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'rounded') {
    getShapeTag = (attrs) => `<rect x="0" y="0" width="${size}" height="${size}" rx="50" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'square') {
    getShapeTag = (attrs) => `<rect x="0" y="0" width="${size}" height="${size}" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'hexagon') {
    const r = center;
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle_deg = 60 * i - 30;
      const angle_rad = Math.PI / 180 * angle_deg;
      points.push(`${center + r * Math.cos(angle_rad)},${center + r * Math.sin(angle_rad)}`);
    }
    getShapeTag = (attrs) => `<polygon points="${points.join(' ')}" ${applyTransform(attrs)} />`;
  } else if (state.shape === 'diamond') {
    // Diamond has specific transform.
    // Base transform: translate(-offset, -offset) rotate(45 center center)
    // We want to Scale the whole thing.
    // If we prepend scale transform, it scales the coordinate system THEN draws.
    // Because Diamond uses `transform="..."` hardcoded, we need to inject.
    // Modified helper below.
    getShapeTag = (attrs) => {
      const baseDiamondTransform = `translate(-${size * 0.3535}, -${size * 0.3535}) rotate(45 ${center} ${center})`;
      // Combine: Scale then Place? Or Place then Scale?
      // We want to scale the resulting diamond.
      // `transform="ScaleTransform BaseTransform"` 
      // The applyTransform helper will prepend the shapeTransform to the baseDiamondTransform.
      return `<rect x="${center}" y="${center}" width="${size * 0.707}" height="${size * 0.707}" ${applyTransform(`transform="${baseDiamondTransform}" ${attrs}`)} />`;
    };
  } else if (state.shape === 'shield') {
    getShapeTag = (attrs) => `<path d="M${center},0 L${size},${size * 0.25} V${size * 0.5} C${size},${size * 0.8} ${center},${size} ${center},${size} C${center},${size} 0,${size * 0.8} 0,${size * 0.5} V${size * 0.25} Z" ${applyTransform(attrs)} />`;
  }


  // --- Definitions (Filters, Gradients, ClipPaths) ---

  // 0. Font Embedding
  const getFontImportURL = (fontName) => {
    const map = {
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

  // 5. Text Drop Shadow Filter
  let textFilterAttr = '';
  if (state.shadowEnabled && state.shadowType === 'drop') {
    const shOp = state.shadowOpacity / 100;
    const blurStr = state.shadowBlur ? '6' : '0';
    const angle = parseInt(state.globalShadowAngle) ?? 45;
    const rad = angle * (Math.PI / 180);
    const dist = 8;
    const dx = dist * Math.cos(rad);
    const dy = dist * Math.sin(rad);
    defsContent += `
        <filter id="text-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${blurStr}" flood-color="${state.shadowColor}" flood-opacity="${shOp}"/>
        </filter>
      `;
    textFilterAttr = 'filter="url(#text-shadow)"';
  }

  // --- Element Construction ---

  // Background Element
  const shapeEffectsAttr = shapeFilterPrimitives ? 'filter="url(#shape-effects)"' : '';
  let bgElement = getShapeTag(`fill="${state.bgColor}" ${shapeEffectsAttr}`);

  if (state.bgGradientEnabled) {
    // Overlay
    bgElement += getShapeTag(`fill="url(#bg-gradient)" style="pointer-events:none;"`);
  }

  // Text Common Attributes
  const fontFamily = state.font;
  const baseFontSize = state.text.length > 1 ? 120 : 160;
  const fontSize = baseFontSize * (state.fontSizeScale / 100);
  const fontWeight = state.fontWeight ? 'bold' : 'normal';
  const fontStyle = state.fontStyle ? 'italic' : 'normal';

  // Offsets
  const offX = parseInt(state.offsetX) || 0;
  const offY = parseInt(state.offsetY) || 0;

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

  // Long Shadow Group
  let longShadowGroup = '';
  if (state.shadowEnabled && state.shadowType === 'long') {
    const len = parseInt(state.shadowLength) || 64;
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
        clones += `<text ${textCommonAttrs} stroke="none" fill="${shColor}" transform="translate(${shiftX}, ${shiftY})">${state.text}</text>`;
      } else {
        const stepOp = baseOp * (1 - i / len);
        clones += `<text ${textCommonAttrs} stroke="none" fill="${shColor}" fill-opacity="${stepOp}" transform="translate(${shiftX}, ${shiftY})">${state.text}</text>`;
      }
    }

    // Apply Clip Path here
    const groupOp = solid ? `opacity="${baseOp}"` : '';
    longShadowGroup = `<g clip-path="url(#shape-clip)" ${groupOp}>${clones}</g>`;
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
            transform="translate(${offX}, ${offY})"
        >${state.text}</text>
      `;
  }

  // Main Text
  // Apply Drop Shadow Filter here if needed. 
  // Wait, filter is applied to the element. If element is translated, shadow (filter) moves with it? Yes.
  let mainText = `<text ${textCommonAttrs} stroke="none" fill="${state.textColor}" ${textFilterAttr} transform="translate(${offX}, ${offY})">${state.text}</text>`;

  if (state.textGradientEnabled) {
    mainText += `<text ${textCommonAttrs} stroke="none" fill="url(#text-gradient)" style="pointer-events:none;" transform="translate(${offX}, ${offY})">${state.text}</text>`;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>${defsContent}</defs>
      ${bgElement}
      ${longShadowGroup}
      ${outlineElement}
      ${mainText}
    </svg>
  `;
}
