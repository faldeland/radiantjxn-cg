/**
 * Images from Radiant sites (og:image via HTTP), optional site/social URLs (HTTP then Playwright),
 * and direct URLs. Facebook/Instagram may still require login for og tags.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PRIMARY = path.join(__dirname, 'social-sources.json');
const SOURCES_EXAMPLE = path.join(__dirname, 'social-sources.example.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'social-images.json');

/** Canonical network + Jackson sites — fetched every run unless skipBuiltInChurchSites */
const BUILTIN_CHURCH_URLS = {
  radiantChurch: 'https://www.radiant.church/',
  radiantJxn: 'https://radiantjxn.com/',
};

function loadSources() {
  const rawPath = fs.existsSync(SOURCES_PRIMARY) ? SOURCES_PRIMARY : SOURCES_EXAMPLE;
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const posts = Array.isArray(raw.posts) ? raw.posts : [];
  const sitePages = Array.isArray(raw.sitePages) ? raw.sitePages : [];
  const directImages = Array.isArray(raw.directImages) ? raw.directImages : [];
  const skipBuiltInChurchSites = Boolean(raw.skipBuiltInChurchSites);
  return { posts, sitePages, directImages, skipBuiltInChurchSites, fromPath: rawPath };
}

function normalizeImageUrl(u) {
  if (!u) return u;
  return u.replace(/^http:\/\//i, 'https://');
}

async function tryOgImageHttp(url, log) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const secure = html.match(/property=["']og:image:secure_url["']\s+content=["']([^"']+)["']/i);
    const og = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const tw = html.match(/name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
    const raw = (secure && secure[1]) || (og && og[1]) || (tw && tw[1]);
    return raw ? normalizeImageUrl(raw.replace(/&amp;/g, '&')) : null;
  } catch (e) {
    log?.(`  HTTP og:image failed ${url}: ${e.message}`);
    return null;
  }
}

async function fetchBuiltinChurchImages(log) {
  const churchSiteImages = {};
  for (const [key, url] of Object.entries(BUILTIN_CHURCH_URLS)) {
    log(`Church site og:image (HTTP): ${url}`);
    const img = await tryOgImageHttp(url, log);
    churchSiteImages[key] = img || null;
    if (!img) log(`  (no og:image)`);
  }
  const defaultImageUrl =
    churchSiteImages.radiantChurch || churchSiteImages.radiantJxn || null;
  return { churchSiteImages, defaultImageUrl };
}

function assignRowToMaps(row, img, imageByTag, imageById) {
  if (!img) return;
  if (row.id) imageById[row.id] = img;
  if (row.tag) imageByTag[row.tag] = img;
}

function metaOgImageFromDocument() {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    const c = el?.getAttribute('content');
    return c && /^https?:\/\//i.test(c.trim()) ? c.trim() : '';
  };
  return (
    pick('meta[property="og:image:secure_url"]') ||
    pick('meta[property="og:image"]') ||
    pick('meta[name="twitter:image"]') ||
    ''
  );
}

async function extractOgImagePlaywright(page, url, log) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2000);
  const img = await page.evaluate(metaOgImageFromDocument);
  if (!img) log(`  (no og:image) ${url.slice(0, 80)}…`);
  return img ? normalizeImageUrl(img) : null;
}

export async function scrapeSocialImages(log = console.log) {
  const { posts, sitePages, directImages, skipBuiltInChurchSites, fromPath } = loadSources();
  log(`Social sources: ${fromPath}`);

  const imageByTag = {};
  const imageById = {};
  const warnings = [];

  for (const row of directImages) {
    const u = (row.imageUrl || '').trim();
    if (!u || !/^https?:\/\//i.test(u)) continue;
    assignRowToMaps(row, normalizeImageUrl(u), imageByTag, imageById);
  }

  let churchSiteImages = {};
  let defaultImageUrl = null;
  if (!skipBuiltInChurchSites) {
    const built = await fetchBuiltinChurchImages(log);
    churchSiteImages = built.churchSiteImages;
    defaultImageUrl = built.defaultImageUrl;
  }

  const pendingBrowser = [];

  for (const row of sitePages) {
    const url = (row.url || '').trim();
    if (!url) continue;
    log(`Site page og:image (HTTP): ${url}`);
    const httpImg = await tryOgImageHttp(url, log);
    if (httpImg) assignRowToMaps(row, httpImg, imageByTag, imageById);
    else pendingBrowser.push(row);
  }

  for (const row of posts) {
    const url = (row.url || '').trim();
    if (!url) continue;
    log(`Post og:image (HTTP): ${url}`);
    const httpImg = await tryOgImageHttp(url, log);
    if (httpImg) assignRowToMaps(row, httpImg, imageByTag, imageById);
    else pendingBrowser.push(row);
  }

  if (pendingBrowser.length > 0) {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
    } catch (e) {
      warnings.push(`Playwright unavailable: ${e.message}`);
      log(warnings[warnings.length - 1]);
      for (const row of pendingBrowser) {
        warnings.push(`No image (browser needed): ${row.url || ''}`);
      }
    }
    if (browser) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale: 'en-US',
      });
      const page = await context.newPage();
      for (const row of pendingBrowser) {
        const url = (row.url || '').trim();
        if (!url) continue;
        log(`Fetching og:image (browser): ${url}`);
        try {
          const img = await extractOgImagePlaywright(page, url, log);
          if (img) {
            assignRowToMaps(row, img, imageByTag, imageById);
            if (!row.id && !row.tag) warnings.push(`URL has no id or tag: ${url}`);
          } else {
            warnings.push(`No image extracted: ${url}`);
          }
        } catch (err) {
          warnings.push(`${url}: ${err.message}`);
          log(`  error: ${err.message}`);
        }
      }
      await context.close();
      await browser.close();
    }
  }

  return writeOutput(imageByTag, imageById, warnings, log, {
    churchSiteImages,
    defaultImageUrl,
  });
}

function writeOutput(imageByTag, imageById, warnings, log, extras = {}) {
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const payload = {
    lastUpdated: new Date().toISOString(),
    imageByTag,
    imageById,
    churchSiteImages: extras.churchSiteImages || {},
    defaultImageUrl: extras.defaultImageUrl ?? null,
    warnings,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  log(`Wrote ${OUTPUT_PATH} (${Object.keys(imageByTag).length} by tag, ${Object.keys(imageById).length} by id)`);
  if (warnings.length) log(`Warnings: ${warnings.length}`);
  return payload;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  scrapeSocialImages().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
