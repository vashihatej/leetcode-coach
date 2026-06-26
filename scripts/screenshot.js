import { chromium } from 'playwright';

const BASE = 'http://localhost:8765';
const OUT = 'docs/screenshots';
const VIEWPORT = { width: 1440, height: 900 };

async function check() {
  try {
    const r = await fetch(`${BASE}/api/stats`);
    if (!r.ok) throw new Error();
  } catch {
    console.error('Server not running on port 8765. Run `npm start` first.');
    process.exit(1);
  }
}

async function run() {
  await check();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  const shots = [
    { path: `${OUT}/overview.png`,  url: `${BASE}/#/`,         wait: '.heatmap, [class*="heatmap"], [class*="StatsBar"]', delay: 800 },
    { path: `${OUT}/problems.png`,  url: `${BASE}/#/problems`, wait: 'table', delay: 600 },
    { path: `${OUT}/patterns.png`,  url: `${BASE}/#/patterns`, wait: '[class*="PatternCard"], .grid', delay: 600 },
    { path: `${OUT}/review.png`,    url: `${BASE}/#/review`,   wait: 'main', delay: 400 },
    { path: `${OUT}/wishlist.png`,  url: `${BASE}/#/wishlist`, wait: 'main', delay: 400 },
  ];

  for (const { path, url, delay } of shots) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(delay);
    await page.screenshot({ path, fullPage: false });
    console.log(`✓ ${path}`);
  }

  // attempt drawer — click first problem row
  await page.goto(`${BASE}/#/problems`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const firstRow = page.locator('tbody tr').first();
  const rowCount = await firstRow.count();
  if (rowCount > 0) {
    try {
      await firstRow.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/attempt-drawer.png` });
      console.log(`✓ ${OUT}/attempt-drawer.png`);
    } catch {
      console.warn('WARN: attempt-drawer click failed — falling back to problems page screenshot');
      await page.screenshot({ path: `${OUT}/attempt-drawer.png` });
      console.log(`✓ ${OUT}/attempt-drawer.png (fallback: no drawer, problems page)`);
    }
  } else {
    console.warn('WARN: no table rows found — falling back to problems page screenshot for attempt-drawer');
    await page.screenshot({ path: `${OUT}/attempt-drawer.png` });
    console.log(`✓ ${OUT}/attempt-drawer.png (fallback: no rows in table)`);
  }

  // pattern wiki drawer — click book icon on first pattern
  await page.goto(`${BASE}/#/patterns`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const wikiBtn = page.locator('[title="Pattern wiki"]').first();
  const btnCount = await wikiBtn.count();
  if (btnCount > 0) {
    try {
      await wikiBtn.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/pattern-wiki.png` });
      console.log(`✓ ${OUT}/pattern-wiki.png`);
    } catch {
      console.warn('WARN: pattern-wiki click failed — falling back to patterns page screenshot');
      await page.screenshot({ path: `${OUT}/pattern-wiki.png` });
      console.log(`✓ ${OUT}/pattern-wiki.png (fallback: no drawer, patterns page)`);
    }
  } else {
    console.warn('WARN: no [title="Pattern wiki"] button found — falling back to patterns page screenshot');
    await page.screenshot({ path: `${OUT}/pattern-wiki.png` });
    console.log(`✓ ${OUT}/pattern-wiki.png (fallback: no wiki button found)`);
  }

  await browser.close();
  console.log('\nAll screenshots saved to docs/screenshots/');
}

run().catch(e => { console.error(e); process.exit(1); });
