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

  function getEventTracksFromCookie() {
    const raw = getCookie('eventTrackFilters');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Lowercased text used to match bottom-track filters */
  function eventHaystack(ev) {
    return `${ev.title || ''} ${ev.summary || ''} ${ev.url || ''}`.toLowerCase();
  }

  /** Match scraper/events-scrape.js sortUpcomingEvents (soonest first; stable tie-break). */
  function sortEventsForDisplay(events) {
    function parseTimeMs(iso) {
      if (!iso || typeof iso !== 'string') return null;
      const t = Date.parse(iso);
      return Number.isFinite(t) ? t : null;
    }
    if (!events?.length) return events;
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

  function eventMatchesTrack(hay, trackName) {
    switch (trackName) {
      case 'Next Steps':
        return /next\s+steps?/.test(hay) || hay.includes('next step') || hay.includes('new to radiant');
      case 'Baptism':
        return hay.includes('baptism');
      case 'Discipleship':
        return hay.includes('discipleship') || /\bdisciple\b/.test(hay);
      case 'Marriage':
        return (
          hay.includes('marriage') ||
          hay.includes('rekindle') ||
          hay.includes('vision retreat') ||
          hay.includes('premarital') ||
          hay.includes('spouse')
        );
      case "Women's":
        return (
          /women'?s?/.test(hay) ||
          hay.includes('womxn') ||
          hay.includes('ladies') ||
          /rise\s*up/.test(hay)
        );
      case "Men's":
        if (/women/.test(hay)) return false;
        if (/\bawaken\b/.test(hay)) return true;
        return (
          /\bmen'?s\b/.test(hay) ||
          /\bmens\b/.test(hay) ||
          /\bfor men\b/.test(hay) ||
          /\bbrotherhood\b/.test(hay)
        );
      case 'School of Spirit':
        return hay.includes('school of the spirit') || hay.includes('school of spirit');
      case 'Mission Trip':
        return (
          hay.includes('mission trip') ||
          hay.includes('costa rica') ||
          hay.includes('haiti') ||
          /\bmission\b.*\b(sign|trip|deadline)/.test(hay) ||
          hay.includes('global trip')
        );
      default:
        return false;
    }
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
    filterBarExpanded: false,
    eventTrackFilters: getEventTracksFromCookie(),
    eventTracks: [
      { name: 'Next Steps', activeClass: 'bg-radiant-600 text-white shadow-sm' },
      { name: 'Baptism', activeClass: 'bg-sky-600 text-white shadow-sm' },
      { name: 'Discipleship', activeClass: 'bg-emerald-600 text-white shadow-sm' },
      { name: 'Marriage', activeClass: 'bg-rose-600 text-white shadow-sm' },
      { name: "Women's", activeClass: 'bg-fuchsia-600 text-white shadow-sm' },
      { name: "Men's", activeClass: 'bg-blue-700 text-white shadow-sm' },
      { name: 'School of Spirit', activeClass: 'bg-violet-600 text-white shadow-sm' },
      { name: 'Mission Trip', activeClass: 'bg-amber-600 text-white shadow-sm' },
    ],
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
      let list = this.events;
      const q = (this.searchQuery || '').trim().toLowerCase();
      if (q) {
        list = list.filter((e) => {
          const hay = `${e.title || ''} ${e.summary || ''} ${e.dateLabel || ''}`.toLowerCase();
          return hay.includes(q);
        });
      }
      if (this.eventTrackFilters.length > 0) {
        list = list.filter((e) => {
          const hay = eventHaystack(e);
          return this.eventTrackFilters.some((track) => eventMatchesTrack(hay, track));
        });
      }
      return list;
    },

    get hasActiveEventFilters() {
      return this.eventTrackFilters.length > 0 || (this.searchQuery || '').trim().length > 0;
    },

    saveEventTrackFiltersCookie() {
      setCookie('eventTrackFilters', JSON.stringify(this.eventTrackFilters));
    },

    toggleEventTrack(name) {
      const idx = this.eventTrackFilters.indexOf(name);
      if (idx === -1) this.eventTrackFilters.push(name);
      else this.eventTrackFilters.splice(idx, 1);
      this.saveEventTrackFiltersCookie();
    },

    isEventTrackActive(name) {
      return this.eventTrackFilters.includes(name);
    },

    clearEventFilters() {
      this.eventTrackFilters = [];
      this.searchQuery = '';
      this.saveEventTrackFiltersCookie();
    },

    async init() {
      this.applyTheme();
      this.applyTileSize();
      this.startTaglineRotation();
      await this.loadData();
      await this.fetchRefreshStatus();
      let closeIfOutsideRef = null;
      let scrollCloseRef = null;
      this.$watch('filterBarExpanded', (expanded) => {
        if (expanded) {
          closeIfOutsideRef = (e) => {
            if (e.target && e.target.closest && e.target.closest('.filter-bar')) return;
            const x = e.clientX ?? e.changedTouches?.[0]?.clientX;
            const y = e.clientY ?? e.changedTouches?.[0]?.clientY;
            if (x != null && y != null) {
              const atPoint = document.elementFromPoint(x, y);
              if (atPoint && atPoint.closest('.filter-bar')) return;
            }
            this.filterBarExpanded = false;
            document.removeEventListener('touchend', closeIfOutsideRef);
            document.removeEventListener('click', closeIfOutsideRef);
          };
          document.addEventListener('touchend', closeIfOutsideRef, { passive: true });
          document.addEventListener('click', closeIfOutsideRef);
          const scrollStartY = window.scrollY;
          scrollCloseRef = (e) => {
            const el = e.target;
            const isMainViewportScroll = el === document || el === document.documentElement || el === document.body;
            if (!isMainViewportScroll) return;
            if (Math.abs(window.scrollY - scrollStartY) < 50) return;
            this.filterBarExpanded = false;
            window.removeEventListener('scroll', scrollCloseRef, { passive: true });
          };
          window.addEventListener('scroll', scrollCloseRef, { passive: true });
        } else {
          if (closeIfOutsideRef) {
            document.removeEventListener('touchend', closeIfOutsideRef);
            document.removeEventListener('click', closeIfOutsideRef);
            closeIfOutsideRef = null;
          }
          if (scrollCloseRef) {
            window.removeEventListener('scroll', scrollCloseRef, { passive: true });
            scrollCloseRef = null;
          }
        }
      });
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

    /** Date only — never show clock on tiles/modal (ISO times from API are often wrong). */
    formatDateOnly(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    },

    /** Remove clock fragments from scraped labels (e.g. trailing ", 8:00 PM"). */
    stripClockFromLabel(s) {
      if (!s || typeof s !== 'string') return '';
      return s
        .replace(/\s*,\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b/gi, '')
        .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi, '')
        .replace(/\b\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)\b/gi, '')
        .replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi, '')
        .replace(/,\s*$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    },

    /** Tile + modal date line: dates only, no time. */
    formatTileWhen(ev) {
      if (!ev) return '';
      const label = (ev.dateLabel || '').trim();
      if (label) return this.stripClockFromLabel(label);
      if (ev.startsAt) return this.formatDateOnly(ev.startsAt);
      return '';
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
        const rawEvents = Array.isArray(data.events) ? data.events : [];
        this.events = sortEventsForDisplay(rawEvents);
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
