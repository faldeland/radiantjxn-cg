import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const EVENTS_SOURCE_URL = 'https://radiantjxn.churchcenter.com/registrations/events';
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'events.json');

/** Normalize to a single event registration URL (drops query/hash). */
export function canonicalEventUrl(href) {
  if (!href || typeof href !== 'string') return null;
  try {
    const u = new URL(href, 'https://radiantjxn.churchcenter.com');
    if (!u.hostname.includes('churchcenter.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const evIdx = parts.indexOf('events');
    if (evIdx === -1 || evIdx >= parts.length - 1) return null;
    const id = parts[evIdx + 1];
    if (!id || !/^\w/.test(id)) return null;
    u.search = '';
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

function collectFromJsonNode(node, out, depth = 0) {
  if (depth > 14 || node == null) return;
  if (Array.isArray(node)) {
    node.forEach((x) => collectFromJsonNode(x, out, depth + 1));
    return;
  }
  if (typeof node !== 'object') return;

  const attrs = node.attributes && typeof node.attributes === 'object' ? node.attributes : null;
  const bag = { ...node, ...(attrs || {}) };

  const rawUrl =
    bag.public_church_center_web_url ||
    bag.public_url ||
    bag.html_url ||
    bag.url ||
    (typeof bag.links?.self === 'string' ? bag.links.self : null);

  if (typeof rawUrl === 'string' && rawUrl.includes('/registrations/events/')) {
    const url = canonicalEventUrl(rawUrl);
    if (url) {
      const title = (bag.name || bag.title || '').trim();
      const startsAt = bag.starts_at || bag.startsAt || bag.start_at || bag.start_time || null;
      const endsAt = bag.ends_at || bag.endsAt || null;
      const imageUrl = (bag.image_url || bag.image || bag.avatar_url || '').trim() || '';
      const summary = (bag.summary || bag.description || '').trim().slice(0, 500) || '';
      out.push({
        id: url,
        title: title || 'Event',
        url,
        startsAt: typeof startsAt === 'string' ? startsAt : null,
        endsAt: typeof endsAt === 'string' ? endsAt : null,
        dateLabel: '',
        imageUrl,
        summary,
      });
    }
  }

  for (const k of Object.keys(node)) {
    if (k === 'attributes' && attrs) continue;
    collectFromJsonNode(node[k], out, depth + 1);
  }
}

function mergeByUrl(events) {
  const map = new Map();
  for (const e of events) {
    const url = canonicalEventUrl(e.url);
    if (!url) continue;
    const prev = map.get(url);
    if (!prev) {
      map.set(url, { ...e, url });
      continue;
    }
    map.set(url, {
      ...prev,
      ...e,
      title: e.title && e.title !== 'Event' ? e.title : prev.title,
      startsAt: e.startsAt || prev.startsAt,
      imageUrl: e.imageUrl || prev.imageUrl,
      summary: e.summary || prev.summary,
    });
  }
  return [...map.values()];
}

function parseTimeMs(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Drop events that clearly ended (when endsAt is known). */
export function filterLikelyUpcoming(events, nowMs = Date.now()) {
  return events.filter((e) => {
    const end = parseTimeMs(e.endsAt);
    if (end != null) return end >= nowMs;
    return true;
  });
}

/** Soonest first; unknown dates sort last. */
export function sortUpcomingEvents(events) {
  return [...events].sort((a, b) => {
    const ta = parseTimeMs(a.startsAt) ?? parseTimeMs(a.endsAt);
    const tb = parseTimeMs(b.startsAt) ?? parseTimeMs(b.endsAt);
    const aKey = ta ?? Number.MAX_SAFE_INTEGER;
    const bKey = tb ?? Number.MAX_SAFE_INTEGER;
    return aKey - bKey;
  });
}

export function buildEventsPayload(domEvents, apiEvents) {
  const merged = mergeByUrl([...(apiEvents || []), ...(domEvents || [])]);
  const filtered = filterLikelyUpcoming(merged);
  const sorted = sortUpcomingEvents(filtered);
  return {
    sourceUrl: EVENTS_SOURCE_URL,
    lastUpdated: new Date().toISOString(),
    events: sorted,
  };
}

export async function scrapeEvents(log = console.log) {
  let browser;
  const apiEvents = [];

  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    log(`Playwright unavailable (${e.message}); using empty events snapshot.`);
    return buildEventsPayload([], []);
  }

  let context;
  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    const page = await context.newPage();

    page.on('response', async (response) => {
      if (!response.ok()) return;
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const u = response.url();
      if (!/registrations|events|churchcenter|planningcenter/i.test(u)) return;
      try {
        const json = await response.json();
        const found = [];
        collectFromJsonNode(json, found);
        for (const ev of found) apiEvents.push(ev);
      } catch {
        /* not JSON */
      }
    });

    await page.goto(EVENTS_SOURCE_URL, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);

    let prev = 0;
    for (let i = 0; i < 24; i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await page.waitForTimeout(350);
      const h = await page.evaluate(() => document.body.scrollHeight);
      if (h === prev) break;
      prev = h;
    }
    await page.waitForTimeout(1200);

    const domEvents = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const anchors = document.querySelectorAll('a[href*="/registrations/events/"]');

      anchors.forEach((a) => {
        const href = a.getAttribute('href');
        if (!href) return;
        let abs = href;
        try {
          abs = new URL(href, window.location.origin).href;
        } catch {
          return;
        }
        const path = new URL(abs).pathname.split('/').filter(Boolean);
        const ei = path.indexOf('events');
        if (ei === -1 || ei >= path.length - 1) return;
        const id = path[ei + 1];
        if (!id) return;
        abs = abs.split('?')[0].split('#')[0];
        if (seen.has(abs)) return;
        seen.add(abs);

        const card =
          a.closest('[class*="card"], [class*="Card"], article, li, [data-testid]') ||
          a.parentElement?.parentElement ||
          a.parentElement;
        const heading = card?.querySelector('h1,h2,h3,h4,h5');
        let title = (heading?.textContent || a.textContent || '').trim();
        title = title.replace(/\s+/g, ' ');
        if (title.length > 200) title = title.slice(0, 197) + '…';

        const img = card?.querySelector('img[src]');
        const imageUrl = img?.src?.startsWith('http') ? img.src : '';

        let dateLabel = '';
        const timeEl = card?.querySelector('time[datetime]');
        if (timeEl) {
          dateLabel = (timeEl.textContent || '').trim() || timeEl.getAttribute('datetime') || '';
        }
        if (!dateLabel) {
          const text = (card?.textContent || '').replace(/\s+/g, ' ');
          const m = text.match(
            /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
          );
          if (m) dateLabel = m[1].trim();
        }

        results.push({
          id: abs,
          title: title || 'Event',
          url: abs,
          startsAt: null,
          endsAt: null,
          dateLabel,
          imageUrl,
          summary: '',
        });
      });

      return results;
    });

    await context.close();
    await browser.close();
    browser = null;

    const payload = buildEventsPayload(domEvents, apiEvents);
    log(`Events scrape: ${payload.events.length} from DOM/API merge`);
    return payload;
  } catch (err) {
    log(`Events scrape error: ${err.message}`);
    if (context) await context.close().catch(() => {});
    return buildEventsPayload([], []);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export function saveEventsData(data, outputPath) {
  const dest = outputPath || OUTPUT_PATH;
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(data, null, 2));
  return dest;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  scrapeEvents().then((data) => {
    const dest = saveEventsData(data);
    console.log(`Wrote ${data.events.length} events to ${dest}`);
  });
}
