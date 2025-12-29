import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
    const targetUrl = process.argv[2] || `file://${path.resolve(__dirname, '../dist/index.html')}`;
    console.log(`Target URL: ${targetUrl}`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        // Wait for network to be idle
        console.log(`Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        // Wait for any final renders, CSS animations, or fonts to settle
        console.log('Waiting for content to settle...');
        await new Promise(r => setTimeout(r, 5000));

        const docsDir = path.resolve(__dirname, '../docs');
        if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir);
        }

        const screenshotPath = path.join(docsDir, 'preview.png');
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);
    } catch (err) {
        console.error(`Failed to capture screenshot: ${err.message}`);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
