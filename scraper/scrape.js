import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'groups.json');
const OVERRIDES_PATH = path.join(__dirname, 'overrides.json');

export const SOURCE_PAGES = [
  {
    type: 'Gather',
    url: 'https://radiantjxn.churchcenter.com/groups/gather?enrollment=open_signup%2Crequest_to_join&filter=enrollment',
  },
  {
    type: 'Grow',
    url: 'https://radiantjxn.churchcenter.com/groups/grow',
  },
  {
    type: 'Go',
    url: 'https://radiantjxn.churchcenter.com/groups/go',
  },
  {
    type: 'Gather',
    url: 'https://radiantjxn.churchcenter.com/groups/team-radiant',
  },
];

const CATEGORY_RULES = {
  age: [
    { match: /\b(student|middle\s*school|high\s*school|teen|youth|jr\.?\s*high|sr\.?\s*high)\b/i, value: 'Students' },
    { match: /\b(young\s*adult|college|18[\s-]*25|20s|ya\b|young\s*professional|forge)\b/i, value: 'Young Adult' },
    { match: /.*/, value: 'Adult' },
  ],
  demographic: [
    { match: /\b(women|woman|ladies|moms|mothers|her|she|girls|gals|sisterhood)\b/i, value: "Women's" },
    { match: /\b(men|man|guys|dads|fathers|brothers|brotherhood)\b|\biron[-\s]+sharpens?\b|\bthe\s+forge\b|\bwho\s+is\s+your\b/i, value: "Men's" },
    { match: /.*/, value: 'Co-Ed' },
  ],
};

function classify(group) {
  const text = `${group.name} ${group.description} ${(group.rawTags || []).join(' ')}`;
  let age = 'Adult';
  for (const rule of CATEGORY_RULES.age) {
    if (rule.match.test(text)) { age = rule.value; break; }
  }
  let demographic = 'Co-Ed';
  for (const rule of CATEGORY_RULES.demographic) {
    if (rule.match.test(text)) { demographic = rule.value; break; }
  }
  return { category: age, demographic };
}

function extractMeetingInfo(text) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const dayPattern = new RegExp(`\\b(${days.join('|')})(s?)\\b`, 'i');
  const match = text.match(dayPattern);

  let meetingDay = '';
  let isPlural = false;
  if (match) {
    const day = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    isPlural = match[2].toLowerCase() === 's';
    meetingDay = day + 's';
  } else if (/\bdaily\b/i.test(text)) {
    meetingDay = 'Daily';
  }

  // Extract time: "7-9am", "6:30PM", "10:30am-12:30pm", "9am", etc.
  const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?)\b/i);
  const meetingTime = timeMatch ? timeMatch[1].replace(/\s+/g, '') : '';

  return { meetingDay, meetingTime, isPlural };
}

function extractTag(text, patterns, fallback = '') {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1] || m[0];
  }
  return fallback;
}

function summarizeAbout(aboutText) {
  if (!aboutText || aboutText.trim().length === 0) return '';
  const cleaned = aboutText
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  return sentences.slice(0, 3).join(' ').trim();
}

async function scrapeGroupDetail(page, groupUrl, log = console.log) {
  try {
    await page.goto(groupUrl, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);

    const detail = await page.evaluate(() => {
      let aboutText = '';

      // Look for "About" heading then grab content after it
      const headings = document.querySelectorAll('h2, h3, h4, [class*="heading"], [class*="title"]');
      for (const h of headings) {
        if (/about/i.test(h.textContent?.trim())) {
          let sibling = h.nextElementSibling;
          const parts = [];
          while (sibling && !(/^H[2-4]$/.test(sibling.tagName))) {
            const text = sibling.textContent?.trim();
            if (text) parts.push(text);
            sibling = sibling.nextElementSibling;
          }
          if (parts.length) {
            aboutText = parts.join(' ');
            break;
          }
        }
      }

      // Fallback: look for a description/about section by common patterns
      if (!aboutText) {
        const descEl = document.querySelector('[class*="description"], [class*="about"], [class*="detail"] p');
        if (descEl) aboutText = descEl.textContent?.trim() || '';
      }

      // Grab upcoming events text for schedule info
      let eventsText = '';
      for (const h of document.querySelectorAll('h2, h3, h4')) {
        if (/upcoming|schedule|event/i.test(h.textContent?.trim())) {
          let sibling = h.nextElementSibling;
          const parts = [];
          while (sibling && !(/^H[2-4]$/.test(sibling.tagName))) {
            const text = sibling.textContent?.trim();
            if (text) parts.push(text);
            sibling = sibling.nextElementSibling;
          }
          if (parts.length) {
            eventsText = parts.join(' ');
            break;
          }
        }
      }

      return { aboutText, eventsText };
    });

    return detail;
  } catch (err) {
    log(`  Detail scrape failed for ${groupUrl}: ${err.message}`);
    return { aboutText: '', eventsText: '' };
  }
}

async function scrapePage(browser, sourcePage, log = console.log) {
  const { type, url } = sourcePage;
  log(`Scraping ${type} page: ${url}`);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  // Build a map of group URL -> API attributes (deduplicated by group URL)
  const apiGroupMap = new Map();
  page.on('response', async (response) => {
    const respUrl = response.url();
    if (!response.headers()['content-type']?.includes('json')) return;
    try {
      const json = await response.json();
      if (json?.data && Array.isArray(json.data)) {
        for (const item of json.data) {
          const attrs = item.attributes || item;
          const groupUrl = attrs.public_church_center_web_url;
          if (groupUrl && typeof groupUrl === 'string' && groupUrl.includes('/groups/')) {
            apiGroupMap.set(groupUrl, { id: item.id, attrs });
          }
        }
      }
    } catch { /* ignore non-JSON */ }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Scroll to trigger all lazy-loaded cards
  let previousHeight = 0;
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(400);
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;
  }
  await page.waitForTimeout(1500);

  // Extract the group URLs and card data visible in the DOM — this is the
  // ground truth for which groups are actually on this page
  const domGroups = await page.evaluate(() => {
    const seen = new Set();
    const results = [];
    document.querySelectorAll('a[href*="/groups/"]').forEach((a) => {
      const href = a.href;
      // Must have a slug after the category segment (e.g. /groups/grow/iron-sharpens-east)
      const afterGroups = href.split('/groups/')[1] || '';
      const parts = afterGroups.split('/').filter(Boolean);
      if (parts.length < 2) return;
      if (seen.has(href)) return;
      seen.add(href);

      // Walk up to find the card container
      const card = a.closest('[class*="card"], [class*="group-list"], li, article') || a.parentElement;
      const img = card?.querySelector('img') || a.querySelector('img');
      const heading = card?.querySelector('h2,h3,h4') || a.querySelector('h2,h3,h4');
      const desc = card?.querySelector('p');

      results.push({
        url: href,
        slug: parts[parts.length - 1],
        name: heading?.textContent?.trim() || '',
        imageUrl: img?.src || '',
        description: desc?.textContent?.trim() || '',
      });
    });
    return results;
  });

  log(`DOM found ${domGroups.length} groups, API map has ${apiGroupMap.size} entries`);

  // Merge: prefer API data, fall back to DOM data
  const groups = domGroups.map((dom) => {
    const api = apiGroupMap.get(dom.url);
    const attrs = api?.attrs || {};
    return {
      id: dom.slug,
      name: attrs.name || dom.name || '',
      description: attrs.description || attrs.public_church_center_description || dom.description || '',
      imageUrl: attrs.header_image?.medium || attrs.header_image?.original || dom.imageUrl || '',
      url: dom.url,
      rawTags: attrs.tag_names || attrs.tags || [],
      schedule: attrs.schedule || '',
      location: attrs.location || attrs.virtual_location_url || '',
      sourceType: type,
    };
  }).filter((g) => g.name); // drop any empty-name entries

  await context.close();
  log(`Returning ${groups.length} groups for ${type}`);
  return groups;
}

export async function scrapeAllGroups(pageUrls, log = console.log) {
  const pages = pageUrls || SOURCE_PAGES;
  log('Launching browser...');
  const browser = await chromium.launch({ headless: true });

  let allGroups = [];
  for (const sourcePage of pages) {
    try {
      const groups = await scrapePage(browser, sourcePage, log);
      allGroups = allGroups.concat(groups);
    } catch (err) {
      log(`Error scraping ${sourcePage.type}: ${err.message}`);
    }
  }

  // Visit each group's detail page for About section and schedule info
  log(`Scraping detail pages for ${allGroups.length} groups...`);
  const detailContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  const detailPage = await detailContext.newPage();

  for (const g of allGroups) {
    log(`  Detail: ${g.name} (${g.url})`);
    const detail = await scrapeGroupDetail(detailPage, g.url, log);
    g.aboutText = detail.aboutText || '';
    g.eventsText = detail.eventsText || '';
  }

  await detailContext.close();
  await browser.close();

  let overrides = {};
  if (fs.existsSync(OVERRIDES_PATH)) {
    overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8'));
  }

  const classified = allGroups.map((g) => {
    const override = overrides[g.id] || {};
    const auto = classify(g);
    const tagText = `${g.name} ${g.description} ${g.aboutText} ${g.eventsText} ${g.schedule} ${(g.rawTags || []).join(' ')}`;

    const meeting = extractMeetingInfo(tagText);
    const autoRegularity = extractTag(tagText, [/\b(Weekly|Bi-Weekly|Monthly|Daily|Varied|As Needed)\b/i], '');
    const regularity = override.regularity || autoRegularity || (meeting.isPlural ? 'Weekly' : 'Varies');

    const aboutSummary = summarizeAbout(g.aboutText);

    return {
      id: g.id,
      name: g.name,
      description: aboutSummary || g.description,
      imageUrl: g.imageUrl,
      url: g.url,
      category: override.category || auto.category,
      demographic: override.demographic || auto.demographic,
      tags: {
        type: override.type || g.sourceType || extractTag(tagText, [/\b(Gather|Grow|Go)\b/i], 'Gather'),
        location: override.location || g.location || extractTag(tagText, [/(?:at|@)\s+(.+?)(?:\.|,|$)/i], 'Inquire Within'),
        season: override.season || extractTag(tagText, [/\b(Spring|Summer|Fall|Winter)\s*\d{4}\b/i, /\b(Spring|Summer|Fall|Winter)\b/i], ''),
        regularity,
        meetingDay: override.meetingDay !== undefined ? override.meetingDay : meeting.meetingDay,
        meetingTime: override.meetingTime !== undefined ? override.meetingTime : meeting.meetingTime,
      },
    };
  });

  const output = {
    lastUpdated: new Date().toISOString(),
    sourcePages: pages.map((p) => ({ type: p.type, url: p.url })),
    groups: classified,
  };

  return output;
}

export function saveGroups(data, outputPath) {
  const dest = outputPath || OUTPUT_PATH;
  fs.writeFileSync(dest, JSON.stringify(data, null, 2));
  return dest;
}

// CLI entry point
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  scrapeAllGroups(SOURCE_PAGES).then((data) => {
    const dest = saveGroups(data);
    console.log(`Wrote ${data.groups.length} groups to ${dest}`);
  }).catch((err) => {
    console.error('Scraper failed:', err);
    process.exit(1);
  });
}
