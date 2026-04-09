function eventsApp() {
  const COOKIE_OPTS = 'path=/; max-age=31536000; SameSite=Lax';

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; ' + COOKIE_OPTS;
  }

  function getThemeFromCookie() {
    const theme = getCookie('theme');
    return theme === 'light' ? false : true;
  }

  const DEFAULT_EVENT_IMAGE =
    'https://static1.squarespace.com/static/64de46f114810b67d8e4b5f4/t/64e4a511ec64064331d94556/1692706065731/radiant-church-jackson-logo-wide-stacked.png?format=500w';

  return {
    menuOpen: false,
    darkMode: getThemeFromCookie(),
    tileSize: parseInt(getCookie('tileSize'), 10) || 6,
    tileSizes: [
      { min: 60, max: 75 },
      { min: 75, max: 95 },
      { min: 90, max: 110 },
      { min: 110, max: 140 },
      { min: 130, max: 160 },
      { min: 150, max: 180 },
      { min: 185, max: 220 },
      { min: 230, max: 280 },
      { min: 280, max: 350 },
      { min: 350, max: 440 },
      { min: 440, max: 550 },
    ],
    taglines: ['FREE', 'EMPOWERED', 'CONNECTED', 'GENEROUS', 'LOVING OTHERS'],
    taglineIndex: 0,
    currentTagline: 'FREE',
    taglineFading: false,
    showSearch: false,
    searchQuery: '',
    pageTitle: 'Events',
    sourceUrl: '',
    lastUpdated: '',
    events: [],
    loadError: '',
    refreshing: false,
    refreshMessage: '',
    refreshError: false,
    nextEventsRefreshAt: null,
    qrRendered: new Set(),
    selected: null,

    get canRefresh() {
      return !this.refreshing && (this.nextEventsRefreshAt == null || Date.now() >= this.nextEventsRefreshAt);
    },

    get filteredEvents() {
      const q = (this.searchQuery || '').trim().toLowerCase();
      if (!q) return this.events;
      return this.events.filter((e) => {
        const hay = `${e.title || ''} ${e.summary || ''} ${e.dateLabel || ''}`.toLowerCase();
        return hay.includes(q);
      });
    },

    async init() {
      this.applyTheme();
      this.applyTileSize();
      this.startTaglineRotation();
      await this.loadData();
      await this.fetchRefreshStatus();
    },

    startTaglineRotation() {
      setInterval(() => {
        this.taglineFading = true;
        setTimeout(() => {
          this.taglineIndex = (this.taglineIndex + 1) % this.taglines.length;
          this.currentTagline = this.taglines[this.taglineIndex];
          this.taglineFading = false;
        }, 400);
      }, 3000);
    },

    async fetchRefreshStatus() {
      try {
        const resp = await fetch('/api/status');
        const data = await resp.json();
        if (data.nextEventsRefreshAt && Date.now() < data.nextEventsRefreshAt) {
          this.nextEventsRefreshAt = data.nextEventsRefreshAt;
        } else {
          this.nextEventsRefreshAt = null;
        }
      } catch {
        this.nextEventsRefreshAt = null;
      }
    },

    toggleDarkMode() {
      this.darkMode = !this.darkMode;
      setCookie('theme', this.darkMode ? 'dark' : 'light');
      this.applyTheme();
    },

    applyTheme() {
      document.documentElement.classList.toggle('dark', this.darkMode);
    },

    applyTileSize() {
      const s = this.tileSizes[this.tileSize - 1] || this.tileSizes[2];
      document.documentElement.style.setProperty('--tile-min', s.min + 'px');
      document.documentElement.style.setProperty('--tile-max', s.max + 'px');
      const fontScale = 0.75 + ((this.tileSize - 1) / (this.tileSizes.length - 1)) * 0.45;
      document.documentElement.style.setProperty('--card-font-scale', String(fontScale));
    },

    increaseTileSize() {
      if (this.tileSize >= this.tileSizes.length) return;
      this.tileSize++;
      setCookie('tileSize', String(this.tileSize));
      this.applyTileSize();
    },

    decreaseTileSize() {
      if (this.tileSize <= 1) return;
      this.tileSize--;
      setCookie('tileSize', String(this.tileSize));
      this.applyTileSize();
    },

    formatWhen(ev) {
      if (!ev) return '';
      if (ev.startsAt) {
        const d = new Date(ev.startsAt);
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
        }
      }
      return ev.dateLabel || '';
    },

    eventImage(ev) {
      if (ev && ev.imageUrl && /^https?:\/\//i.test(ev.imageUrl)) return ev.imageUrl;
      return DEFAULT_EVENT_IMAGE;
    },

    async loadData() {
      this.loadError = '';
      try {
        const resp = await fetch('/data/events.json?_=' + Date.now());
        if (!resp.ok) throw new Error('Could not load events data');
        const data = await resp.json();
        this.pageTitle = 'Events';
        this.sourceUrl = data.sourceUrl || '';
        this.events = Array.isArray(data.events) ? data.events : [];
        if (data.lastUpdated) {
          const d = new Date(data.lastUpdated);
          this.lastUpdated = d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
        } else {
          this.lastUpdated = '';
        }
      } catch (e) {
        this.loadError = e.message || 'Load failed';
        this.events = [];
        this.lastUpdated = '';
      }
    },

    async refreshEvents() {
      if (!this.canRefresh) return;
      this.refreshing = true;
      this.refreshMessage = '';
      this.refreshError = false;
      try {
        const resp = await fetch('/api/refresh-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const result = await resp.json();
        if (!resp.ok) {
          if (resp.status === 429 && result.nextEventsRefreshAt) {
            this.nextEventsRefreshAt = result.nextEventsRefreshAt;
          }
          throw new Error(result.error || 'Refresh failed');
        }
        this.qrRendered.clear();
        this.selected = null;
        await this.loadData();
        this.refreshMessage = `Updated ${result.eventCount} upcoming events from Church Center`;
        this.refreshError = false;
        if (result.nextEventsRefreshAt) this.nextEventsRefreshAt = result.nextEventsRefreshAt;
        await this.fetchRefreshStatus();
      } catch (e) {
        this.refreshMessage = `Refresh failed: ${e.message}`;
        this.refreshError = true;
      } finally {
        this.refreshing = false;
        setTimeout(() => {
          this.refreshMessage = '';
        }, 8000);
      }
    },

    openEvent(url) {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    },

    openDetail(ev) {
      this.selected = ev;
      this.qrRendered.delete('qr-event-modal');
      this.$nextTick(() => {
        if (this.selected && this.selected.url) {
          this.renderQRTo('qr-event-modal', this.selected.url);
        }
      });
    },

    closeDetail() {
      this.qrRendered.delete('qr-event-modal');
      this.selected = null;
    },

    renderQRTo(containerId, url) {
      if (!url || this.qrRendered.has(containerId)) return;
      const el = document.getElementById(containerId);
      if (!el || typeof qrcode === 'undefined') return;
      el.innerHTML = '';
      try {
        const qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        const cellSize = 4;
        const margin = 1;
        const img = document.createElement('img');
        img.src = qr.createDataURL(cellSize, margin);
        img.className = 'w-full h-full rounded';
        img.alt = 'Scan to open event';
        el.appendChild(img);
        this.qrRendered.add(containerId);
      } catch (err) {
        console.error('QR error:', err);
      }
    },
  };
}
