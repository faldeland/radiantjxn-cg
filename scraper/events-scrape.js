import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const EVENTS_SOURCE_URL = 'https://radiantjxn.churchcenter.com/registrations/events';
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'events.json');

/**
 * Derive ISO startsAt / endsAt from visible date copy. Church Center often omits
 * `datetime` on <time>; listings use short labels like "May 13" or "May 27–31, 2026".
 */
export function parseHumanEventDates(text) {
  if (!text || typeof text !== 'string') return { startsAt: null, endsAt: null, dateLabel: '' };
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return { startsAt: null, endsAt: null, dateLabel: '' };

  const toIso = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null);

  // May 27–31, 2026 (same month day range)
  let m = raw.match(
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s+(\d{1,2})\s*[–—\-]\s*(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (m) {
    const mon = m[1];
    const y = parseInt(m[4], 10);
    const d1 = parseInt(m[2], 10);
    const d2 = parseInt(m[3], 10);
    const s = new Date(`${mon} ${d1}, ${y}`);
    const e = new Date(`${mon} ${d2}, ${y}`);
    const label = m[0];
    return {
      startsAt: toIso(s),
      endsAt: toIso(e),
      dateLabel: label,
    };
  }

  // May 27, 2026 or May 31st, 2026
  m = raw.match(
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i,
  );
  if (m) {
    const mon = m[1];
    const day = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    const s = new Date(`${mon} ${day}, ${y}`);
    return { startsAt: toIso(s), endsAt: null, dateLabel: m[0] };
  }

  // 5/13/2026 or 05/13/2026 (US)
  m = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const mo = parseInt(m[1], 10);
    const da = parseInt(m[2], 10);
    const s = new Date(y, mo - 1, da);
    return { startsAt: toIso(s), endsAt: null, dateLabel: m[0] };
  }

  // May 13 or May 31st (no year): assume this year; if that date is >60 days in the past, use next year
  m = raw.match(
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
  );
  if (m) {
    const mon = m[1];
    const day = parseInt(m[2], 10);
    let y = new Date().getFullYear();
    let s = new Date(`${mon} ${day}, ${y}`);
    if (Number.isNaN(s.getTime())) return { startsAt: null, endsAt: null, dateLabel: m[0] };
    const cutoff = Date.now() - 60 * 86400000;
    if (s.getTime() < cutoff) {
      y += 1;
      s.setFullYear(y);
    }
    return { startsAt: toIso(s), endsAt: null, dateLabel: m[0] };
  }

  return { startsAt: null, endsAt: null, dateLabel: raw.slice(0, 160) };
}

/** Human-readable date / range for tiles (en-US). */
export function dateLabelFromIso(startsAt, endsAt) {
  if (!startsAt || typeof startsAt !== 'string') return '';
  const s = new Date(startsAt);
  if (Number.isNaN(s.getTime())) return '';
  const o = { month: 'short', day: 'numeric', year: 'numeric' };
  if (!endsAt) return s.toLocaleDateString('en-US', o);
  const e = new Date(endsAt);
  if (Number.isNaN(e.getTime())) return s.toLocaleDateString('en-US', o);
  if (s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString('en-US', { weekday: 'short', ...o });
  }
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    const mon = s.toLocaleDateString('en-US', { month: 'short' });
    return `${mon} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString('en-US', o)} – ${e.toLocaleDateString('en-US', o)}`;
}

/** Apply parseHumanEventDates when ISO fields are missing; always backfill dateLabel from ISO when missing. */
function mergeParsedDates(ev) {
  if (!ev) return ev;
  let next = { ...ev };
  const label = String(next.dateLabel || '').trim();

  if (next.startsAt && !label) {
    next.dateLabel = dateLabelFromIso(next.startsAt, next.endsAt);
    return next;
  }

  if (next.startsAt) return next;

  if (label) {
    const p = parseHumanEventDates(label);
    if (p.startsAt) {
      next = {
        ...next,
        startsAt: p.startsAt,
        endsAt: next.endsAt || p.endsAt || null,
        dateLabel: label || p.dateLabel,
      };
      if (!String(next.dateLabel || '').trim()) {
        next.dateLabel = dateLabelFromIso(next.startsAt, next.endsAt);
      }
      return next;
    }
  }
  if (next.summary) {
    const plain = String(next.summary).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const p = parseHumanEventDates(plain);
    if (p.startsAt) {
      next = {
        ...next,
        startsAt: p.startsAt,
        endsAt: next.endsAt || p.endsAt || null,
        dateLabel: next.dateLabel || p.dateLabel,
      };
      if (!String(next.dateLabel || '').trim()) {
        next.dateLabel = dateLabelFromIso(next.startsAt, next.endsAt);
      }
      return next;
    }
  }
  return next;
}

/** Last pass: every event should have dateLabel if we have any parseable date. */
function ensureEventDateFields(ev) {
  if (!ev) return ev;
  const label = String(ev.dateLabel || '').trim();
  if (ev.startsAt && !label) {
    return { ...ev, dateLabel: dateLabelFromIso(ev.startsAt, ev.endsAt) };
  }
  if (!ev.startsAt && label) {
    const p = parseHumanEventDates(label);
    if (p.startsAt) {
      const out = { ...ev, startsAt: p.startsAt, endsAt: ev.endsAt || p.endsAt || null };
      if (!String(out.dateLabel || '').trim()) out.dateLabel = dateLabelFromIso(out.startsAt, out.endsAt);
      return out;
    }
  }
  if (!ev.startsAt && ev.summary) {
    const plain = String(ev.summary).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const p = parseHumanEventDates(plain);
    if (p.startsAt) {
      const out = {
        ...ev,
        startsAt: p.startsAt,
        endsAt: ev.endsAt || p.endsAt || null,
        dateLabel: ev.dateLabel || p.dateLabel,
      };
      if (!String(out.dateLabel || '').trim()) out.dateLabel = dateLabelFromIso(out.startsAt, out.endsAt);
      return out;
    }
  }
  return ev;
}

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

/** Normalize API values to ISO 8601 strings when parseable. */
function coerceIsoString(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  return null;
}

/**
 * Pull start/end from common Planning Center / Church Center / JSON:API shapes.
 */
function pickDatesFromBag(bag) {
  if (!bag || typeof bag !== 'object') return { startsAt: null, endsAt: null, dateLabel: '' };

  let startsAt = coerceIsoString(
    bag.starts_at ||
      bag.startsAt ||
      bag.start_at ||
      bag.start_time ||
      bag.begin_at ||
      bag.scheduled_at ||
      bag.starts_at_in_timezone ||
      bag.first_occurrence_starts_at ||
      bag.event_starts_at ||
      bag.registration_starts_at ||
      bag.opens_at ||
      bag.visible_starts_at ||
      bag.publish_starts_at ||
      null,
  );
  let endsAt = coerceIsoString(
    bag.ends_at ||
      bag.endsAt ||
      bag.end_at ||
      bag.end_time ||
      bag.event_ends_at ||
      bag.closes_at ||
      bag.visible_ends_at ||
      null,
  );

  const tryOcc = (o) => {
    if (!o || typeof o !== 'object') return;
    if (!startsAt) startsAt = coerceIsoString(o.starts_at || o.startsAt || o.start_at || o.start_time);
    if (!endsAt) endsAt = coerceIsoString(o.ends_at || o.endsAt || o.end_at);
  };

  if (!startsAt && Array.isArray(bag.occurrences)) {
    for (const o of bag.occurrences) {
      tryOcc(o);
      if (startsAt) break;
    }
  }
  if (!startsAt && Array.isArray(bag.event_times)) {
    for (const o of bag.event_times) {
      tryOcc(o);
      if (startsAt) break;
    }
  }
  if (!startsAt && bag.schedule && typeof bag.schedule === 'object') {
    tryOcc(bag.schedule);
  }
  if (!startsAt && Array.isArray(bag.times)) {
    for (const o of bag.times) {
      tryOcc(o);
      if (startsAt) break;
    }
  }

  const dateLabel = String(
    bag.date_label ||
      bag.dateLabel ||
      bag.date_range_label ||
      bag.formatted_date ||
      bag.human_readable_date ||
      bag.display_date ||
      '',
  ).trim();

  return { startsAt, endsAt, dateLabel };
}

const MAX_EVENT_SUMMARY_CHARS = 250000;

/** HTML or plain text from API / JSON:API blobs. */
function pickSummaryFromBag(bag) {
  if (!bag || typeof bag !== 'object') return '';
  const raw =
    bag.summary ||
    bag.description ||
    bag.content ||
    bag.body ||
    bag.details ||
    bag.long_description ||
    bag.html_description ||
    bag.html_description_html ||
    bag.about ||
    bag.overview ||
    bag.note ||
    bag.public_description ||
    '';
  const s = String(raw).trim();
  if (!s) return '';
  return s.length > MAX_EVENT_SUMMARY_CHARS ? s.slice(0, MAX_EVENT_SUMMARY_CHARS) : s;
}

function textLenRough(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

/** Keep the richer description when merging API + DOM + detail passes. */
function pickRicherSummary(a, b) {
  const as = String(a || '').trim();
  const bs = String(b || '').trim();
  if (!bs) return as;
  if (!as) return bs;
  const al = textLenRough(as);
  const bl = textLenRough(bs);
  if (bl > al) return bs;
  if (al > bl) return as;
  return as.length >= bs.length ? as : bs;
}

function hasMeaningfulSummary(ev) {
  return textLenRough(ev?.summary) >= 25;
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
      const { startsAt, endsAt, dateLabel: dlFromApi } = pickDatesFromBag(bag);
      const imageUrl = (bag.image_url || bag.image || bag.avatar_url || '').trim() || '';
      const summary = pickSummaryFromBag(bag);
      out.push({
        id: url,
        title: title || 'Event',
        url,
        startsAt,
        endsAt,
        dateLabel: dlFromApi,
        imageUrl,
        summary,
        showEventTime: false,
      });
    }
  }

  for (const k of Object.keys(node)) {
    if (k === 'attributes' && attrs) continue;
    collectFromJsonNode(node[k], out, depth + 1);
  }
}

/** True when visible <time> copy includes a clock time (site explicitly shows event time). */
function timeTextsShowClock(timeTexts) {
  if (!timeTexts?.length) return false;
  return timeTexts.some((t) => {
    const s = String(t);
    if (/registration\s+closes/i.test(s)) return false;
    return (
      /\b\d{1,2}:\d{2}\b/.test(s) ||
      /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(s) ||
      /\b(?:noon|midnight)\b/i.test(s)
    );
  });
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
      endsAt: e.endsAt || prev.endsAt,
      dateLabel: e.dateLabel || prev.dateLabel,
      imageUrl: e.imageUrl || prev.imageUrl,
      summary: pickRicherSummary(e.summary, prev.summary),
      showEventTime: e.showEventTime !== undefined ? e.showEventTime : prev.showEventTime,
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

/** Soonest first; unknown dates sort last; tie-break for stable, serialized order. */
export function sortUpcomingEvents(events) {
  return [...events].sort((a, b) => {
    const ta = parseTimeMs(a.startsAt) ?? parseTimeMs(a.endsAt);
    const tb = parseTimeMs(b.startsAt) ?? parseTimeMs(b.endsAt);
    const aKey = ta ?? Number.MAX_SAFE_INTEGER;
    const bKey = tb ?? Number.MAX_SAFE_INTEGER;
    if (aKey !== bKey) return aKey - bKey;
    const byTitle = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    if (byTitle !== 0) return byTitle;
    return (a.url || '').localeCompare(b.url || '');
  });
}

export function buildEventsPayload(domEvents, apiEvents) {
  const merged = mergeByUrl([...(apiEvents || []), ...(domEvents || [])])
    .map(mergeParsedDates)
    .map(ensureEventDateFields);
  const filtered = filterLikelyUpcoming(merged);
  const sorted = sortUpcomingEvents(filtered);
  return {
    sourceUrl: EVENTS_SOURCE_URL,
    lastUpdated: new Date().toISOString(),
    events: sorted,
  };
}

/**
 * Visit each event registration page for dates, times visibility, and HTML description.
 * Descriptions often exist only on the detail page, so we also visit when summary is empty/short.
 */
async function enrichEventsFromDetailPages(page, events, log) {
  if (!events?.length) return events;
  const maxVisits = 200;
  let visits = 0;
  const out = events.map((e) => ({ ...e }));

  for (let i = 0; i < out.length; i++) {
    const ev = out[i];
    const hasLabel = String(ev.dateLabel || '').trim();
    const needDetail = !ev.startsAt || !hasLabel || !hasMeaningfulSummary(ev);
    if (!needDetail) continue;
    if (!ev.url) continue;
    if (visits >= maxVisits) break;
    visits++;

    try {
      await page.goto(ev.url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(800);

      const extracted = await page.evaluate(() => {
        const isoOk = (s) => {
          if (!s || typeof s !== 'string') return null;
          const t = Date.parse(s);
          return Number.isFinite(t) ? new Date(t).toISOString() : null;
        };

        let startsAt = null;
        let endsAt = null;
        let summaryFromLd = '';

        const withDt = [...document.querySelectorAll('time[datetime]')];
        const dts = withDt.map((t) => t.getAttribute('datetime')).filter(Boolean);
        const parsed = dts
          .map((d) => ({ d, ms: Date.parse(d) }))
          .filter((x) => !Number.isNaN(x.ms))
          .sort((a, b) => a.ms - b.ms);
        if (parsed.length) {
          startsAt = isoOk(parsed[0].d);
          if (parsed.length > 1) endsAt = isoOk(parsed[parsed.length - 1].d);
        }

        for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
          try {
            const j = JSON.parse(s.textContent);
            const stack = [Array.isArray(j) ? j : [j]];
            while (stack.length) {
              const cur = stack.pop();
              if (Array.isArray(cur)) {
                cur.forEach((x) => stack.push(x));
                continue;
              }
              if (!cur || typeof cur !== 'object') continue;
              const typ = cur['@type'];
              const isEvent =
                typ === 'Event' ||
                typ === 'EventSeries' ||
                (Array.isArray(typ) && (typ.includes('Event') || typ.includes('EventSeries')));
              if (isEvent) {
                const sd = cur.startDate || cur.startdate;
                const ed = cur.endDate || cur.enddate;
                if (sd && !startsAt) startsAt = isoOk(sd) || isoOk(String(sd));
                if (ed && !endsAt) endsAt = isoOk(ed) || isoOk(String(ed));
                if (!summaryFromLd && cur.description != null) {
                  const d = cur.description;
                  if (typeof d === 'string') summaryFromLd = d.trim();
                  else if (typeof d === 'object' && d !== null) {
                    summaryFromLd = String(d.text || d.value || '').trim();
                  }
                }
              }
              for (const k of Object.keys(cur)) {
                if (k === '@context') continue;
                const v = cur[k];
                if (v && typeof v === 'object') stack.push(v);
              }
            }
          } catch {
            /* ignore */
          }
        }

        const timeTexts = [...document.querySelectorAll('time')]
          .map((t) => (t.textContent || '').trim())
          .filter(Boolean);

        // Infer start/end from multiple bare <time> text values (e.g. Bloom/Awaken use
        // separate <time> elements with text like "May 13, 2026" and "May 17, 2026").
        if (!startsAt) {
          const parsedFromText = timeTexts
            .filter((t) => !/registration|closes|deadline/i.test(t))
            .map((t) => {
              const ms = Date.parse(t);
              return Number.isFinite(ms) ? ms : null;
            })
            .filter((ms) => ms !== null)
            .sort((a, b) => a - b);
          if (parsedFromText.length >= 1) {
            startsAt = isoOk(new Date(parsedFromText[0]).toISOString());
            if (parsedFromText.length >= 2) {
              const lastMs = parsedFromText[parsedFromText.length - 1];
              if (lastMs !== parsedFromText[0]) {
                endsAt = isoOk(new Date(lastMs).toISOString());
              }
            }
          }
        }

        const main = document.querySelector('main') || document.body;
        const mainSample = (main.innerText || '').replace(/\s+/g, ' ').slice(0, 4000);

        const plainLen = (html) =>
          (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;

        function domDescriptionHtml() {
          const selectors = [
            '[class*="EventDescription"]',
            '[class*="event-description"]',
            '[class*="Description"]',
            '[data-testid*="description"]',
            'main [class*="prose"]',
            'main [class*="RichText"]',
            'main [class*="rich-text"]',
            '[class*="RegistrationEvent"] [class*="content"]',
          ];
          for (const sel of selectors) {
            try {
              const el = document.querySelector(sel);
              if (el && plainLen(el.innerHTML) > 35) return el.innerHTML.trim();
            } catch (e) {
              /* ignore */
            }
          }
          const m = document.querySelector('main');
          if (m) {
            for (const h of m.querySelectorAll('h2, h3, h4')) {
              if (!/details|about|description/i.test(h.textContent || '')) continue;
              let sib = h.nextElementSibling;
              while (sib) {
                if (plainLen(sib.innerHTML) > 40) return sib.innerHTML.trim();
                sib = sib.nextElementSibling;
              }
            }
          }
          return '';
        }

        let summaryHtml = domDescriptionHtml();
        if (plainLen(summaryHtml) < 25 && summaryFromLd) {
          summaryHtml = summaryFromLd;
        }

        return { startsAt, endsAt, timeTexts, mainSample, summaryHtml };
      });

      let startsAt = extracted.startsAt;
      let endsAt = extracted.endsAt;
      let dateLabel = out[i].dateLabel;

      const blob = [...extracted.timeTexts, extracted.mainSample].join(' | ');
      const p = parseHumanEventDates(blob);
      if (!startsAt && p.startsAt) startsAt = p.startsAt;
      if (!endsAt && p.endsAt) endsAt = p.endsAt;

      // Prefer richer dateLabel: prefer if detail has year, range, or longer text
      const existing = String(dateLabel || '').trim();
      const candidate = String(p.dateLabel || '').trim();
      if (candidate && candidate !== existing) {
        const existingHasYear = /\b20\d{2}\b/.test(existing);
        const existingHasRange = /[–—\-]/.test(existing);
        const candidateHasYear = /\b20\d{2}\b/.test(candidate);
        const candidateHasRange = /[–—\-]/.test(candidate);
        const preferCandidate =
          !existing ||
          (!existingHasYear && candidateHasYear) ||
          (!existingHasRange && candidateHasRange) ||
          (candidateHasYear && candidateHasRange && !(existingHasYear && existingHasRange));
        if (preferCandidate) dateLabel = candidate;
      }

      if (startsAt) out[i].startsAt = startsAt;
      if (endsAt) out[i].endsAt = endsAt;
      if (dateLabel) out[i].dateLabel = dateLabel;
      out[i].showEventTime = timeTextsShowClock(extracted.timeTexts);
      if (extracted.summaryHtml) {
        let s = pickRicherSummary(extracted.summaryHtml, out[i].summary);
        if (s.length > MAX_EVENT_SUMMARY_CHARS) s = s.slice(0, MAX_EVENT_SUMMARY_CHARS);
        out[i].summary = s;
      }
    } catch (err) {
      log?.(`Event detail scrape skipped (${ev.url}): ${err.message}`);
    }
  }

  return out;
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

    let domEvents = await page.evaluate(() => {
      const isoOk = (s) => {
        if (!s || typeof s !== 'string') return null;
        const t = Date.parse(s);
        return Number.isFinite(t) ? new Date(t).toISOString() : null;
      };

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

        let startsAt = null;
        let endsAt = null;
        let dateLabel = '';

        const timeEls = card ? card.querySelectorAll('time[datetime]') : [];
        const dts = [...timeEls].map((t) => t.getAttribute('datetime')).filter(Boolean);
        const parsed = dts
          .map((d) => ({ d, ms: Date.parse(d) }))
          .filter((x) => !Number.isNaN(x.ms))
          .sort((a, b) => a.ms - b.ms);
        if (parsed.length) {
          startsAt = isoOk(parsed[0].d);
          if (parsed.length > 1) endsAt = isoOk(parsed[parsed.length - 1].d);
        }

        if (timeEls.length && !dateLabel) {
          dateLabel = [...timeEls]
            .map((t) => (t.textContent || '').trim())
            .filter(Boolean)
            .join(' · ');
        }
        if (!dateLabel) {
          const text = (card?.textContent || '').replace(/\s+/g, ' ');
          const m = text.match(
            /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?(?:\s*(?:[–—-]|through|to)\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}))?)/i,
          );
          if (m) dateLabel = m[1].trim();
        }
        if (!dateLabel) {
          const text = (card?.textContent || '').replace(/\s+/g, ' ');
          const m2 = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*(?:[–—-]|through|to)\s*\d{1,2}\/\d{1,2}\/\d{2,4})?)\b/);
          if (m2) dateLabel = m2[1].trim();
        }

        const cardTimeTexts = card
          ? [...card.querySelectorAll('time')].map((t) => (t.textContent || '').trim()).filter(Boolean)
          : [];
        const timeTextsShowClockLocal = (txts) => {
          if (!txts?.length) return false;
          return txts.some((t) => {
            const s = String(t);
            if (/registration\s+closes/i.test(s)) return false;
            return (
              /\b\d{1,2}:\d{2}\b/.test(s) ||
              /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(s) ||
              /\b(?:noon|midnight)\b/i.test(s)
            );
          });
        };
        const showEventTime = timeTextsShowClockLocal(cardTimeTexts);

        results.push({
          id: abs,
          title: title || 'Event',
          url: abs,
          startsAt,
          endsAt,
          dateLabel,
          imageUrl,
          summary: '',
          showEventTime,
        });
      });

      return results;
    });

    log(`Events listing DOM: ${domEvents.length} cards; enriching detail pages (dates + time visibility)…`);
    domEvents = await enrichEventsFromDetailPages(page, domEvents, log);

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
