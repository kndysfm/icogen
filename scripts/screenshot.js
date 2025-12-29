import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
    console.log('Starting screenshot capture...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Points to the built dist/index.html
    const filePath = `file://${path.resolve(__dirname, '../dist/index.html')}`;
    console.log(`Taking screenshot of: ${filePath}`);

    if (!fs.existsSync(path.resolve(__dirname, '../dist/index.html'))) {
        console.error('Error: dist/index.html not found. Make sure to run npm run build first.');
        await browser.close();
        process.exit(1);
    }

    await page.goto(filePath, { waitUntil: 'networkidle0' });

    // Wait a bit for any animations or fonts to settle
    await new Promise(r => setTimeout(r, 3000));

    const docsDir = path.resolve(__dirname, '../docs');
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir);
    }

    await page.screenshot({ path: path.join(docsDir, 'preview.png') });
    console.log('Screenshot saved to docs/preview.png');
    await browser.close();
})();
