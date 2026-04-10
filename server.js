import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { scrapeAllGroups, saveGroups, SOURCE_PAGES } from './scraper/community-groups-scrape.js';
import { scrapeTeamRadiant, saveTeamRadiantData } from './scraper/team-radiant-scrape.js';
import { scrapeSocialImages } from './scraper/social-images-scrape.js';
import { scrapeEvents, saveEventsData } from './scraper/events-scrape.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const app = express();

// Persistent data path: set DATA_DIR (e.g. /data) on Railway with a volume mount so groups.json survives deploys
const DATA_DIR = process.env.DATA_DIR || null;
const GROUPS_PATH = DATA_DIR
  ? path.join(DATA_DIR, 'groups.json')
  : path.join(__dirname, 'public', 'data', 'groups.json');

const TEAM_RADIANT_PATH = DATA_DIR
  ? path.join(DATA_DIR, 'team-radiant.json')
  : path.join(__dirname, 'public', 'data', 'team-radiant.json');

const EVENTS_PATH = DATA_DIR
  ? path.join(DATA_DIR, 'events.json')
  : path.join(__dirname, 'public', 'data', 'events.json');

if (DATA_DIR) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not ensure DATA_DIR exists:', err.message);
  }
}

app.use(express.json());

// Serve groups.json from the data path (persistent on Railway when DATA_DIR is a volume)
app.get('/data/groups.json', (req, res) => {
  if (!fs.existsSync(GROUPS_PATH)) {
    return res.status(404).json({ error: 'No groups data yet. Trigger a refresh to scrape.' });
  }
  res.type('json').send(fs.readFileSync(GROUPS_PATH, 'utf8'));
});

app.get('/data/team-radiant.json', (req, res) => {
  if (!fs.existsSync(TEAM_RADIANT_PATH)) {
    return res.status(404).json({ error: 'No Team Radiant data yet. Run scrape or refresh from the Team Radiant page.' });
  }
  res.type('json').send(fs.readFileSync(TEAM_RADIANT_PATH, 'utf8'));
});

app.get('/data/events.json', (req, res) => {
  if (!fs.existsSync(EVENTS_PATH)) {
    return res.status(404).json({ error: 'No events data yet. Refresh from the Events page or run scrape:events.' });
  }
  res.type('json').send(fs.readFileSync(EVENTS_PATH, 'utf8'));
});

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

let scrapeInProgress = false;
let teamRadiantScrapeInProgress = false;
let eventsScrapeInProgress = false;
const REFRESH_COOLDOWN_MINUTES = 5;
const REFRESH_COOLDOWN_MS = REFRESH_COOLDOWN_MINUTES * 60 * 1000;
let lastSuccessfulRefreshAt = null;
let lastSuccessfulEventsRefreshAt = null;

app.post('/api/refresh', async (req, res) => {
  if (scrapeInProgress) {
    return res.status(409).json({ error: 'A refresh is already in progress' });
  }

  if (lastSuccessfulRefreshAt && Date.now() - lastSuccessfulRefreshAt < REFRESH_COOLDOWN_MS) {
    const nextAt = lastSuccessfulRefreshAt + REFRESH_COOLDOWN_MS;
    const minutesLeft = Math.ceil((nextAt - Date.now()) / 60000);
    return res.status(429).json({
      error: `Refresh is limited to once every ${REFRESH_COOLDOWN_MINUTES} minutes. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
      nextRefreshAt: nextAt,
    });
  }

  scrapeInProgress = true;
  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };

  try {
    const pages = req.body?.pages || SOURCE_PAGES;
    log(`Starting refresh for ${pages.length} page(s)...`);

    const data = await scrapeAllGroups(pages, log);
    const dest = saveGroups(data, GROUPS_PATH);

    log(`Refresh complete: ${data.groups.length} groups saved to ${dest}`);
    lastSuccessfulRefreshAt = Date.now();
    res.json({
      success: true,
      groupCount: data.groups.length,
      lastUpdated: data.lastUpdated,
      logs,
      nextRefreshAt: lastSuccessfulRefreshAt + REFRESH_COOLDOWN_MS,
    });
  } catch (err) {
    log(`Refresh failed: ${err.message}`);
    res.status(500).json({ error: err.message, logs });
  } finally {
    scrapeInProgress = false;
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    scrapeInProgress,
    lastSuccessfulRefreshAt,
    nextRefreshAt: lastSuccessfulRefreshAt ? lastSuccessfulRefreshAt + REFRESH_COOLDOWN_MS : null,
    eventsScrapeInProgress,
    lastSuccessfulEventsRefreshAt,
    nextEventsRefreshAt: lastSuccessfulEventsRefreshAt
      ? lastSuccessfulEventsRefreshAt + REFRESH_COOLDOWN_MS
      : null,
  });
});

app.get('/api/sources', (req, res) => {
  res.json({ pages: SOURCE_PAGES });
});

app.post('/api/refresh-team-radiant', async (req, res) => {
  if (teamRadiantScrapeInProgress) {
    return res.status(409).json({ error: 'A Team Radiant refresh is already in progress' });
  }
  teamRadiantScrapeInProgress = true;
  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };
  try {
    try {
      log('Refreshing social preview images (social-sources / og:image)...');
      await scrapeSocialImages(log);
    } catch (socialErr) {
      log(`Social images skipped: ${socialErr.message}`);
    }
    log('Scraping Team Radiant from radiantjxn.com/serve...');
    const data = await scrapeTeamRadiant(log);
    const dest = saveTeamRadiantData(data, TEAM_RADIANT_PATH);
    log(`Saved to ${dest}`);
    res.json({
      success: true,
      opportunityCount: data.opportunities.length,
      lastUpdated: data.lastUpdated,
      logs,
    });
  } catch (err) {
    log(`Team Radiant refresh failed: ${err.message}`);
    res.status(500).json({ error: err.message, logs });
  } finally {
    teamRadiantScrapeInProgress = false;
  }
});

app.post('/api/refresh-events', async (req, res) => {
  if (eventsScrapeInProgress) {
    return res.status(409).json({ error: 'An events refresh is already in progress' });
  }

  if (
    lastSuccessfulEventsRefreshAt &&
    Date.now() - lastSuccessfulEventsRefreshAt < REFRESH_COOLDOWN_MS
  ) {
    const nextAt = lastSuccessfulEventsRefreshAt + REFRESH_COOLDOWN_MS;
    const minutesLeft = Math.ceil((nextAt - Date.now()) / 60000);
    return res.status(429).json({
      error: `Refresh is limited to once every ${REFRESH_COOLDOWN_MINUTES} minutes. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
      nextEventsRefreshAt: nextAt,
    });
  }

  eventsScrapeInProgress = true;
  const logs = [];
  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    log('Scraping upcoming events from Church Center…');
    const data = await scrapeEvents(log);
    const dest = saveEventsData(data, EVENTS_PATH);
    log(`Saved ${data.events.length} events to ${dest}`);
    lastSuccessfulEventsRefreshAt = Date.now();
    res.json({
      success: true,
      eventCount: data.events.length,
      lastUpdated: data.lastUpdated,
      logs,
      nextEventsRefreshAt: lastSuccessfulEventsRefreshAt + REFRESH_COOLDOWN_MS,
    });
  } catch (err) {
    log(`Events refresh failed: ${err.message}`);
    res.status(500).json({ error: err.message, logs });
  } finally {
    eventsScrapeInProgress = false;
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
