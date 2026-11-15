// Screenshot driver for Cinderworks: serves game/, opens each ?shot= URL in
// headless Chromium with SwiftShader WebGL, waits for window.__shotReady,
// saves a JPEG into screenshots/. Usage: node take-shots.mjs [port]
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const shots = JSON.parse(readFileSync(new URL('./shots.json', import.meta.url), 'utf8'));
const port = Number(process.argv[2] || 8091);
const server = spawn(process.execPath, ['serve.ts', '--port', String(port)], {
  cwd: new URL('.', import.meta.url).pathname, stdio: 'inherit',
});
await new Promise((r) => setTimeout(r, 1200));
let code = 0;
try {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
  for (const shot of shots) {
    await page.goto(`http://127.0.0.1:${port}/${shot.query}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
    } catch {
      console.log('TIMEOUT waiting for shotReady:', shot.name);
      code = 1;
    }
    await page.screenshot({ path: `screenshots/${shot.name}`, type: 'jpeg', quality: 82 });
    console.log('saved', shot.name);
  }
  await browser.close();
} catch (e) {
  console.log('DRIVER ERROR:', String(e));
  code = 1;
} finally {
  server.kill();
}
process.exit(code);
