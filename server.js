import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeAllGroups, saveGroups, SOURCE_PAGES } from './scraper/scrape.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

let scrapeInProgress = false;

app.post('/api/refresh', async (req, res) => {
  if (scrapeInProgress) {
    return res.status(409).json({ error: 'A refresh is already in progress' });
  }

  scrapeInProgress = true;
  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };

  try {
    const pages = req.body?.pages || SOURCE_PAGES;
    log(`Starting refresh for ${pages.length} page(s)...`);

    const data = await scrapeAllGroups(pages, log);
    const dest = saveGroups(data);

    log(`Refresh complete: ${data.groups.length} groups saved to ${dest}`);
    res.json({
      success: true,
      groupCount: data.groups.length,
      lastUpdated: data.lastUpdated,
      logs,
    });
  } catch (err) {
    log(`Refresh failed: ${err.message}`);
    res.status(500).json({ error: err.message, logs });
  } finally {
    scrapeInProgress = false;
  }
});

app.get('/api/status', (req, res) => {
  res.json({ scrapeInProgress });
});

app.get('/api/sources', (req, res) => {
  res.json({ pages: SOURCE_PAGES });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
