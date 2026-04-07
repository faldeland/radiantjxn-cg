import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVE_URL = 'https://radiantjxn.com/serve';
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'team-radiant.json');
const SOCIAL_IMAGES_PATH = path.join(__dirname, '..', 'public', 'data', 'social-images.json');

/** Local art under public/images/serve (served as /images/serve/…) */
const SERVE_IMG = '/images/serve';

const IMAGE_BY_ID = {
  'first-impressions': `${SERVE_IMG}/greeters-3.png`,
  worship: `${SERVE_IMG}/worship-1.png`,
  'prayer-ministry': `${SERVE_IMG}/prayer-1.png`,
  'next-generation': `${SERVE_IMG}/kids-3.png`,
  production: `${SERVE_IMG}/production-1.png`,
};

const IMAGE_BY_TAG = {
  Welcome: `${SERVE_IMG}/greeters-3.png`,
  Music: `${SERVE_IMG}/worship-1.png`,
  Prayer: `${SERVE_IMG}/prayer-1.png`,
  'Next Generation': `${SERVE_IMG}/kids-3.png`,
  Tech: `${SERVE_IMG}/production-1.png`,
  Serve: `${SERVE_IMG}/ushers-1.png`,
};

const DEFAULT_OPPORTUNITY_IMAGE = IMAGE_BY_TAG.Serve;

/** Always offered as a Team Radiant row; merged in after live scrape if the site omits it */
const PRAYER_OPPORTUNITY = {
  id: 'prayer-ministry',
  title: 'Prayer',
  tag: 'Prayer',
  description:
    'The Prayer Team stands in the gap through intercession for our church family, our city, and the nations. Whether you serve in the prayer room on Sundays, join corporate prayer gatherings, or commit to praying behind the scenes, this team helps carry the heart of Jesus to every need.',
};

function ensurePrayerOpportunity(opportunities) {
  if (opportunities.some((o) => o.id === 'prayer-ministry' || o.tag === 'Prayer')) {
    return opportunities;
  }
  return [...opportunities, PRAYER_OPPORTUNITY];
}

/** Tile order: Prayer → Worship → First Impressions → Next Generation → Production; unknown rows last */
const OPPORTUNITY_DISPLAY_ORDER = {
  'prayer-ministry': 0,
  prayer: 0,
  worship: 1,
  'first-impressions': 2,
  'next-generation': 3,
  generational: 3,
  production: 4,
};

function sortTeamRadiantOpportunities(opportunities) {
  if (!opportunities?.length) return opportunities;
  const tagOrder = {
    Prayer: 0,
    Music: 1,
    Welcome: 2,
    'Next Generation': 3,
    Tech: 4,
    Serve: 5,
  };
  return [...opportunities].sort((a, b) => {
    const ra = OPPORTUNITY_DISPLAY_ORDER[a.id] ?? tagOrder[a.tag] ?? 100;
    const rb = OPPORTUNITY_DISPLAY_ORDER[b.id] ?? tagOrder[b.tag] ?? 100;
    if (ra !== rb) return ra - rb;
    return (a.title || '').localeCompare(b.title || '');
  });
}

/** Rotate radiant.church vs radiantjxn.com hero art across ministry tags when replacing stock */
const CHURCH_ROTATION_TAGS = ['Welcome', 'Music', 'Prayer', 'Next Generation', 'Tech', 'Serve'];

function isUnsplashStock(url) {
  return typeof url === 'string' && url.includes('images.unsplash.com');
}

function isLocalServeImage(url) {
  return typeof url === 'string' && url.startsWith(`${SERVE_IMG}/`);
}

function churchImageForTag(data, tag) {
  const cs = data.churchSiteImages || {};
  const urls = [cs.radiantChurch, cs.radiantJxn].filter(Boolean);
  if (urls.length === 0) return data.defaultImageUrl || null;
  const idx = CHURCH_ROTATION_TAGS.indexOf(tag);
  const i = idx >= 0 ? idx : 0;
  return urls[i % urls.length];
}

function mergeSocialFromDisk(opportunities) {
  if (!fs.existsSync(SOCIAL_IMAGES_PATH)) return opportunities;
  try {
    const data = JSON.parse(fs.readFileSync(SOCIAL_IMAGES_PATH, 'utf8'));
    const byTag = data.imageByTag || {};
    const byId = data.imageById || {};
    return opportunities.map((o) => {
      const social = byId[o.id] || byTag[o.tag];
      if (social) return { ...o, imageUrl: social };
      if (isLocalServeImage(o.imageUrl)) return o;
      const church = churchImageForTag(data, o.tag);
      if (church && isUnsplashStock(o.imageUrl)) return { ...o, imageUrl: church };
      return o;
    });
  } catch {
    return opportunities;
  }
}

function withImageUrls(opportunities) {
  const withStock = opportunities.map((o) => ({
    ...o,
    imageUrl:
      o.imageUrl ||
      IMAGE_BY_ID[o.id] ||
      IMAGE_BY_TAG[o.tag] ||
      DEFAULT_OPPORTUNITY_IMAGE,
  }));
  return mergeSocialFromDisk(withStock);
}

const FALLBACK = {
  sourceUrl: SERVE_URL,
  lastUpdated: new Date().toISOString(),
  pageTitle: 'Team Radiant',
  introParagraphs: [
    'Here at Radiant we believe that the local church is the hope of the world and how we reach and serve our community with the love and life giving message of Jesus, so that they may become full devoted followers of Him.',
    'By providing the best Sunday experience we can for those who walk through our doors, we can help them to live out their faith and be Jesus to this city. We also believe that every follower of Jesus has a part to play in serving the house of God. We know that serving the local church helps us to find community, grow in faith, and develop a servant’s heart to reach our city all while we serve those searching for Hope. From the parking lot to the pulpit, every position is eternal. So, no matter your gifting, talents or interests, we believe there is a place for you on Team Radiant!',
  ],
  signUpUrl: 'https://radiantjxn.churchcenter.com/people/forms/586040',
  closingNote:
    'After you submit your application, someone from our team will follow up with you and get you connected with a serving team.',
  opportunities: withImageUrls([
    PRAYER_OPPORTUNITY,
    {
      id: 'worship',
      title: 'Worship',
      tag: 'Music',
      description:
        'Leaders in the worship ministry use their musical abilities to lead the congregation into the presence of God through corporate worship. Whether through instruments or vocals, by stewarding their giftings well they eliminate distractions for others to encounter the Presence of God.',
    },
    {
      id: 'first-impressions',
      title: 'First Impressions',
      tag: 'Welcome',
      description:
        'First impressions mean everything! This team is often the face of Radiant Church and the first people our attendees come in contact with to help them feel welcome. We do this by greeting others at the doors, directing traffic in the parking lot, ushering during services, brewing fresh coffee and providing first-time visitors with information.',
    },
    {
      id: 'next-generation',
      title: 'Next Generation',
      tag: 'Next Generation',
      description:
        'Radiant Church is passionately committed to discipling the next generation. This is a diverse area to serve in as ministries range from infants to high schoolers. There is a unique role available for everyone desiring to see young people fall in love with Jesus. We do require a background check of all volunteers in this area.',
    },
    {
      id: 'production',
      title: 'Production',
      tag: 'Tech',
      description:
        'The Production Team uses their gifts and abilities to help facilitate an atmosphere for God’s Presence to be fully experienced while minimizing distractions. This team directs lights, sound, cameras, online broadcast and ProPresenter.',
    },
  ]),
};

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function cleanOpportunityTitle(title) {
  return title.replace(/\s+Ministry\s*$/i, '').trim();
}

export async function scrapeTeamRadiant(log = console.log) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    log(`Playwright unavailable (${e.message}); using embedded Team Radiant snapshot.`);
    return { ...FALLBACK, lastUpdated: new Date().toISOString() };
  }

  let context;
  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    const page = await context.newPage();
    await page.goto(SERVE_URL, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);

    const parsed = await page.evaluate(() => {
      let signUpUrl = '';
      for (const a of document.querySelectorAll('a[href]')) {
        const h = a.getAttribute('href') || '';
        if (/churchcenter\.com.*forms/i.test(h) || /\/people\/forms\//i.test(h)) {
          signUpUrl = a.href;
          break;
        }
      }

      const root = document.querySelector('main, article, [role="main"], #main_page_content') || document.body;
      const allH = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));

      let servingIdx = -1;
      for (let i = 0; i < allH.length; i++) {
        if (/serving opportunities/i.test((allH[i].textContent || '').trim())) {
          servingIdx = i;
          break;
        }
      }

      const introParagraphs = [];
      if (servingIdx >= 0) {
        const marker = allH[servingIdx];
        for (const p of root.querySelectorAll('p')) {
          if (marker.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_PRECEDING) {
            const t = (p.textContent || '').trim();
            if (t.length > 40 && !/sign up to serve/i.test(t)) introParagraphs.push(t);
          }
        }
      }

      const opportunities = [];
      const oppStartIdx = servingIdx >= 0 ? servingIdx + 1 : -1;
      if (oppStartIdx >= 0 && oppStartIdx < allH.length) {
        for (let i = oppStartIdx; i < allH.length; i++) {
          const h = allH[i];
          const title = (h.textContent || '').replace(/\s+/g, ' ').trim();
          if (!title || /thank you for your interest/i.test(title)) break;
          if (title.length > 140) continue;

          const parts = [];
          let sib = h.nextElementSibling;
          while (sib && !/^H[1-6]$/i.test(sib.tagName)) {
            if (sib.tagName === 'P') {
              const pt = (sib.textContent || '').trim();
              if (pt) parts.push(pt);
            }
            sib = sib.nextElementSibling;
          }
          const description = parts.join(' ').trim();
          if (title && description) opportunities.push({ title, description });
        }
      }

      return { signUpUrl, introParagraphs, opportunities };
    });

    await context.close();
    await browser.close();
    browser = null;

    const rawList = (parsed.opportunities || [])
      .filter((o) => o.title && o.description)
      .map((o, i) => {
        const title = cleanOpportunityTitle(o.title.trim());
        return {
          id: slugify(title) || `opportunity-${i}`,
          title,
          tag: inferTag(title),
          description: o.description.replace(/\s+/g, ' ').trim(),
        };
      });
    let opportunities = withImageUrls(
      sortTeamRadiantOpportunities(ensurePrayerOpportunity(rawList)),
    );

    if (opportunities.length === 0) {
      log('DOM parse yielded no opportunities; using fallback snapshot.');
      return { ...FALLBACK, lastUpdated: new Date().toISOString() };
    }

    const introParagraphs =
      parsed.introParagraphs && parsed.introParagraphs.length > 0
        ? parsed.introParagraphs
        : FALLBACK.introParagraphs;

    return {
      sourceUrl: SERVE_URL,
      lastUpdated: new Date().toISOString(),
      pageTitle: 'Team Radiant',
      introParagraphs,
      signUpUrl: parsed.signUpUrl || FALLBACK.signUpUrl,
      closingNote: FALLBACK.closingNote,
      opportunities,
    };
  } catch (err) {
    log(`Team Radiant scrape error: ${err.message}`);
    if (context) await context.close().catch(() => {});
    return { ...FALLBACK, lastUpdated: new Date().toISOString() };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

function inferTag(title) {
  const t = title.toLowerCase();
  if (/first impression|greet|usher|coffee|parking/i.test(t)) return 'Welcome';
  if (/\bprayer\b|intercess/i.test(t)) return 'Prayer';
  if (/worship|music|vocal|instrument/i.test(t)) return 'Music';
  if (/generation|kid|student|infant|youth|children/i.test(t)) return 'Next Generation';
  if (/production|sound|camera|light|broadcast|propresenter/i.test(t)) return 'Tech';
  return 'Serve';
}

export function saveTeamRadiantData(data, outputPath) {
  const dest = outputPath || OUTPUT_PATH;
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(data, null, 2));
  return dest;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  scrapeTeamRadiant().then((data) => {
    const dest = saveTeamRadiantData(data);
    console.log(`Wrote ${data.opportunities.length} opportunities to ${dest}`);
  });
}
