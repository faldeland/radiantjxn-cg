function teamRadiantApp() {
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

  const SERVE_IMG = '/images/serve';
  const FALLBACK_BY_ID = {
    'first-impressions': `${SERVE_IMG}/greeters-3.png`,
    worship: `${SERVE_IMG}/worship-1.png`,
    'prayer-ministry': `${SERVE_IMG}/prayer-1.png`,
    'next-generation': `${SERVE_IMG}/kids-3.png`,
    production: `${SERVE_IMG}/production-1.png`,
  };
  const FALLBACK_IMAGES = {
    Welcome: `${SERVE_IMG}/greeters-3.png`,
    Music: `${SERVE_IMG}/worship-1.png`,
    Prayer: `${SERVE_IMG}/prayer-1.png`,
    'Next Generation': `${SERVE_IMG}/kids-3.png`,
    Tech: `${SERVE_IMG}/production-1.png`,
    Serve: `${SERVE_IMG}/ushers-1.png`,
  };

  function normalizeOpportunityTitle(title) {
    if (!title || typeof title !== 'string') return title;
    let t = title.replace(/\s+/g, ' ').trim();
    t = t.replace(/\bgenerational\b/gi, 'Next Generation');
    t = t.replace(/\s+Ministry\s*$/i, '').trim();
    return t;
  }

  function normalizeOpportunityTag(tag) {
    if (!tag || typeof tag !== 'string') return tag;
    return tag.replace(/\bgenerational\b/gi, 'Next Generation');
  }

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
    pageTitle: 'Team Radiant',
    introParagraphs: [],
    closingNote: '',
    signUpUrl: '',
    sourceUrl: '',
    lastUpdated: '',
    opportunities: [],
    selected: null,
    qrRendered: new Set(),
    loadError: '',
    refreshing: false,
    refreshMessage: '',
    refreshError: false,

    get canRefresh() {
      return !this.refreshing;
    },

    get filteredOpportunities() {
      const q = (this.searchQuery || '').trim().toLowerCase();
      if (!q) return this.opportunities;
      return this.opportunities.filter((o) => {
        const hay = `${o.title || ''} ${o.description || ''} ${o.tag || ''}`.toLowerCase();
        return hay.includes(q);
      });
    },

    async init() {
      this.applyTheme();
      this.applyTileSize();
      this.startTaglineRotation();
      await this.loadData();
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

    async loadData() {
      this.loadError = '';
      try {
        const resp = await fetch('/data/team-radiant.json?_=' + Date.now());
        if (!resp.ok) throw new Error('Could not load Team Radiant data');
        const data = await resp.json();
        this.pageTitle = data.pageTitle || 'Team Radiant';
        this.introParagraphs = Array.isArray(data.introParagraphs) ? data.introParagraphs : [];
        this.closingNote = data.closingNote || '';
        this.signUpUrl = data.signUpUrl || '';
        this.sourceUrl = data.sourceUrl || '';
        const raw = Array.isArray(data.opportunities) ? data.opportunities : [];
        this.opportunities = raw.map((o) => ({
          ...o,
          title: normalizeOpportunityTitle(o.title),
          tag: normalizeOpportunityTag(o.tag),
          imageUrl:
            o.imageUrl ||
            FALLBACK_BY_ID[o.id] ||
            FALLBACK_IMAGES[o.tag] ||
            FALLBACK_IMAGES.Serve,
        }));
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
        this.opportunities = [];
        this.lastUpdated = '';
      }
    },

    async refreshTeamRadiant() {
      if (!this.canRefresh) return;
      this.refreshing = true;
      this.refreshMessage = '';
      this.refreshError = false;
      try {
        const resp = await fetch('/api/refresh-team-radiant', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Refresh failed');
        await this.loadData();
        this.refreshMessage = `Updated Team Radiant (${result.opportunityCount} opportunities)`;
        this.refreshError = false;
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

    opportunityImage(opp) {
      if (!opp) return FALLBACK_IMAGES.Serve;
      return (
        opp.imageUrl ||
        FALLBACK_BY_ID[opp.id] ||
        FALLBACK_IMAGES[opp.tag] ||
        FALLBACK_IMAGES.Serve
      );
    },

    tagClass() {
      return 'bg-radiant-100 text-radiant-800 dark:bg-radiant-900/40 dark:text-radiant-200';
    },

    openDetail(opp) {
      this.selected = opp;
    },

    closeDetail() {
      if (this.selected) {
        this.qrRendered.delete('qr-modal-' + this.selected.id);
      }
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
        img.alt = 'Scan to open sign-up form';
        el.appendChild(img);
        this.qrRendered.add(containerId);
      } catch (err) {
        console.error('QR error:', err);
      }
    },
  };
}
