// Finik's API only returns a payment page URL; the QR lives on that page, so we photograph it.
let puppeteer;
function loadPuppeteer() {
  if (puppeteer === undefined) {
    try {
      // eslint-disable-next-line global-require
      puppeteer = require('puppeteer');
    } catch {
      console.warn('studentbot: puppeteer не установлен — QR-картинка не отправляется, только ссылка');
      puppeteer = null;
    }
  }
  return puppeteer;
}

// The QR is the biggest square picture on the page.
function findQrBox() {
  let best = null;
  for (const el of document.querySelectorAll('canvas, svg, img')) {
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 120) continue;
    if (Math.abs(r.width - r.height) / Math.max(r.width, r.height) > 0.15) continue;
    if (!best || r.width * r.height > best.width * best.height) {
      best = { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
    }
  }
  return best;
}

async function shoot(url) {
  const lib = loadPuppeteer();
  if (!lib) return null;
  const browser = await lib.launch({
    headless: true,
    // The service user has no sandbox rights; the browser only ever opens Finik's own page.
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    const box = await page.evaluate(findQrBox);
    const pad = 24;
    const shot = await page.screenshot(box
      ? { clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } }
      : {});
    return Buffer.from(shot);
  } finally {
    await browser.close();
  }
}

// One browser at a time keeps memory flat on a small server.
let queue = Promise.resolve();
function snapshotQr(url) {
  const job = queue.then(() => shoot(url));
  queue = job.catch(() => {});
  return job;
}

module.exports = { snapshotQr };
