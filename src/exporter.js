export async function exportICO(svgStringInput, fontName) {
    // Inject Fonts
    const svgString = await embedFonts(svgStringInput, fontName);

    const sizes = [16, 32, 48, 64, 128, 256];
    const images = [];

    // 1. Render SVG to PNGs for all sizes
    for (const size of sizes) {
        const pngBuffer = await svgToPngBuffer(svgString, size);
        images.push({ size, buffer: pngBuffer });
    }

    // 2. Build ICO Binary
    const icoBuffer = buildIco(images);

    // 3. Download
    const blob = new Blob([icoBuffer], { type: 'image/x-icon' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'icon.ico';
    a.click();
    URL.revokeObjectURL(url);
}

// Helper: Embed Google Fonts as Base64
async function embedFonts(svg, fontName) {
    if (!fontName) return svg;

    const fontUrlMap = {
        'Material Icons': 'https://fonts.googleapis.com/icon?family=Material+Icons',
        'Noto Sans JP': 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap',
        'Noto Serif JP': 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap',
        'Noto Sans Symbols': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols&display=swap',
        'Noto Sans Symbols 2': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2&display=swap',
        'Noto Music': 'https://fonts.googleapis.com/css2?family=Noto+Music&display=swap',
        'Noto Serif Hentaigana': 'https://fonts.googleapis.com/css2?family=Noto+Serif+Hentaigana&display=swap',
        'Noto Sans Egyptian Hieroglyphs': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Egyptian+Hieroglyphs&display=swap',
        'Noto Color Emoji': 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap',
        'Noto Emoji': 'https://fonts.googleapis.com/css2?family=Noto+Emoji:wght@400;700&display=swap'
    };

    const cssUrl = fontUrlMap[fontName];
    if (!cssUrl) return svg;

    try {
        const cssRes = await fetch(cssUrl);
        let cssText = await cssRes.text();

        // Find all font URLs
        const urlRegex = /url\(([^)]+)\)/g;
        let match;
        const replacements = [];

        while ((match = urlRegex.exec(cssText)) !== null) {
            let url = match[1].replace(/['"]/g, ''); // Remove quotes
            replacements.push({ full: match[0], url });
        }

        // Fetch all font binaries and convert to base64
        for (const rep of replacements) {
            try {
                const fontRes = await fetch(rep.url);
                const blob = await fontRes.blob();
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
                // Replace in CSS (Replace all occurrences if identical? Usually unique vars)
                // Use explicit replace
                cssText = cssText.replace(rep.full, `url('${base64}')`);
            } catch (e) {
                console.warn('Failed to fetch font subset:', rep.url, e);
            }
        }

        // Replace the @import line in SVG with the full CSS block
        // Regex to find specific @import or just general <style> block update
        // The renderer inserts: <style>@import url('...');</style>
        // We will replace that whole block with <style>{cssText}</style>
        return svg.replace(/<style>@import url\('[^']+'\);<\/style>/, `<style>${cssText}</style>`);

    } catch (e) {
        console.error('Failed to embed fonts:', e);
        return svg;
    }
}

function svgToPngBuffer(svgString, size) {
    return new Promise((resolve) => {
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, size, size);

            canvas.toBlob(async (blob) => {
                const buffer = await blob.arrayBuffer();
                resolve(new Uint8Array(buffer));
                URL.revokeObjectURL(url);
            }, 'image/png');
        };
        img.src = url;
    });
}

function buildIco(images) {
    const numImages = images.length;
    const headerSize = 6;
    const entrySize = 16;
    const directorySize = numImages * entrySize;
    const offsetBase = headerSize + directorySize;

    let currentOffset = offsetBase;

    // Calculate total size
    let totalSize = offsetBase;
    images.forEach(img => totalSize += img.buffer.length);

    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);

    // Header
    view.setUint16(0, 0, true); // Reserved
    view.setUint16(2, 1, true); // Type (1=ICON)
    view.setUint16(4, numImages, true); // Count

    // Directory Entries
    images.forEach((img, index) => {
        const entryOffset = headerSize + (index * entrySize);
        const size = img.size >= 256 ? 0 : img.size; // 0 means 256

        view.setUint8(entryOffset, size); // Width
        view.setUint8(entryOffset + 1, size); // Height
        view.setUint8(entryOffset + 2, 0); // Colors (0=No palette)
        view.setUint8(entryOffset + 3, 0); // Reserved
        view.setUint16(entryOffset + 4, 1, true); // Planes
        view.setUint16(entryOffset + 6, 32, true); // BPP
        view.setUint32(entryOffset + 8, img.buffer.length, true); // Size
        view.setUint32(entryOffset + 12, currentOffset, true); // Offset

        // Write Image Data
        buffer.set(img.buffer, currentOffset);
        currentOffset += img.buffer.length;
    });

    return buffer;
}
