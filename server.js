import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { scrapeAllGroups, saveGroups, SOURCE_PAGES } from './scraper/scrape.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const app = express();

// Persistent data path: set DATA_DIR (e.g. /data) on Railway with a volume mount so groups.json survives deploys
const DATA_DIR = process.env.DATA_DIR || null;
const GROUPS_PATH = DATA_DIR
  ? path.join(DATA_DIR, 'groups.json')
  : path.join(__dirname, 'public', 'data', 'groups.json');

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

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

let scrapeInProgress = false;
const REFRESH_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
let lastSuccessfulRefreshAt = null;

app.post('/api/refresh', async (req, res) => {
  if (scrapeInProgress) {
    return res.status(409).json({ error: 'A refresh is already in progress' });
  }

  if (lastSuccessfulRefreshAt && Date.now() - lastSuccessfulRefreshAt < REFRESH_COOLDOWN_MS) {
    const nextAt = lastSuccessfulRefreshAt + REFRESH_COOLDOWN_MS;
    const minutesLeft = Math.ceil((nextAt - Date.now()) / 60000);
    return res.status(429).json({
      error: `Refresh is limited to once every 15 minutes. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
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
  });
});

app.get('/api/sources', (req, res) => {
  res.json({ pages: SOURCE_PAGES });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
