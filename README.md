# Radiant JXN Community Groups

A single-page site that aggregates Radiant Church community groups from Church Center into a filterable, iPad-friendly view.

## Quick Start

```bash
npm install
npx playwright install chromium
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the Express server (serves site + refresh API) |
| `npm run scrape` | Run the scraper standalone (updates `public/data/groups.json`) |
| `npm run dev` | Serve the `public/` folder statically (no API) |

## Project Structure

```
├── server.js                  # Express server: static files + /api/refresh
├── package.json
├── public/                    # All browser-served files
│   ├── index.html             # Main SPA (Alpine.js + Tailwind CSS)
│   ├── css/styles.css         # Custom styles
│   ├── js/app.js              # App logic (filtering, theme, QR codes)
│   ├── images/                # Background images (light/dark themes)
│   └── data/groups.json       # Scraped group data
└── scraper/
    ├── scrape.js              # Playwright scraper for Church Center
    └── overrides.json         # Manual overrides for group metadata
```

## Features

- **Scrapes** group data from Church Center (Gather, Grow, Go, Team Radiant pages)
- **Filters** by category, demographic, type, and regularity
- **Responsive cards** that expand with QR codes when filtered to 6 or fewer
- **Light/dark theme** toggle with persistent preference
- **Refresh button** to pull latest data without redeploying
- **Overrides** file for manually correcting group metadata

## Overrides

Edit `scraper/overrides.json` to manually set group fields. Keys are group URL slugs:

```json
{
  "iron-sharpens-east": {
    "demographic": "Men's",
    "location": "Biggby - East Michigan",
    "regularity": "Weekly",
    "meetingDay": "Saturdays",
    "meetingTime": "7-9am"
  }
}
```

Overrides take priority over scraped data on refresh.

## Dependencies

- **Express** - Static file serving and refresh API
- **Playwright** - Headless browser for scraping Church Center SPAs
- **Tailwind CSS** - Styling (loaded via CDN)
- **Alpine.js** - Lightweight reactivity (loaded via CDN)
