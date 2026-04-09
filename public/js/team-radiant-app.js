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
  const GROUP_LABELS = {
    prayer: 'Prayer',
    worship: 'Worship',
    'first-impressions': 'First Impressions Ministry',
    'next-generation': 'Generational Ministries',
    'radiant-students': 'Radiant Students',
    'community-groups': 'Community Groups',
    'creative-arts-worship': 'Creative Arts and Worship',
  };
  const GROUP_ORDER = [
    'prayer',
    'worship',
    'first-impressions',
    'next-generation',
    'radiant-students',
    'community-groups',
    'creative-arts-worship',
  ];

  /** Same order as scraper/team-radiant-scrape.js TILE_ORDER (serialized tile order). */
  const TILE_ORDER = [
    'prayer-team',
    'worship-vocals',
    'worship-band',
    'fi-coffee',
    'fi-greeters',
    'fi-information',
    'fi-ushers',
    'fi-parking',
    'fi-medical',
    'fi-merchandise',
    'ng-infants',
    'ng-early-childhood',
    'ng-elementary',
    'ng-check-in',
    'ng-radiant-friends',
    'stu-jr-high',
    'stu-sr-high',
    'cg-leader',
    'caw-service-director',
    'caw-producer',
    'caw-graphic-tech',
    'caw-audio-tech',
    'caw-camera-operator',
  ];

  function sortOpportunitiesForDisplay(opportunities) {
    if (!opportunities?.length) return opportunities;
    return [...opportunities].sort((a, b) => {
      const ia = TILE_ORDER.indexOf(a.id);
      const ib = TILE_ORDER.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      const ga = GROUP_ORDER.indexOf(a.groupId);
      const gb = GROUP_ORDER.indexOf(b.groupId);
      if (ga !== gb) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);
      return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    });
  }

  /** Shown under the section heading for specific groups */
  const GROUP_SUBTITLES = {
    worship: 'Worship Team',
    'next-generation': 'Radiant Kids',
    'creative-arts-worship': 'Production Team',
  };

  /**
   * Canonical role copy for the detail modal (matches scraper/team-radiant-scrape.js CURATED_OPPORTUNITIES).
   * Used so the detail view always shows full prompt text even if team-radiant.json is stale.
   */
  const TEAM_RADIANT_DETAIL_COPY = {
    'prayer-team':
      'Stand in the gap through intercession for our church family, our city, and the nations—in the prayer room on Sundays, in corporate prayer, or behind the scenes.',
    'worship-vocals':
      'This team expresses their worship through singing and physical gestures to invite others to enter into and encounter the presence of the Lord.',
    'worship-band':
      'This team expresses their worship through instruments commonly used in our culture such as: Drums, Percussion, Guitars, Piano, and Orchestral Strings to invite others to enter into and encounter the presence of the Lord.',
    'fi-coffee':
      'The coffee team exists to enhance fellowship, set an approachable atmosphere, and promote community through quality coffee and service.',
    'fi-greeters':
      'This friendly team loves people and makes them feel at home here at Radiant. They welcome guests with a smile, encouragement, and a comforting atmosphere so that hearts are open to the Gospel message.',
    'fi-information':
      'This team connects guests to the Church community, providing resources and information on all of our current events, ministry opportunities, and services at Radiant.',
    'fi-ushers':
      'This team prepares a positive worship experience by welcoming and assisting people to a seat, facilitating the offering and communion, and maintaining a distraction-free environment.',
    'fi-parking':
      'This team is the first impression of Radiant and operates to create an orderly atmosphere and welcoming environment. If you want to be the very first to welcome our guests to Radiant, this is the team for you.',
    'fi-medical':
      'These individuals work with our Safety Team to supply medical care in case of emergency. Previous medical training and experience are required.',
    'fi-merchandise':
      'This team promotes our church and its mission by offering quality merchandise that sparks conversations and shares the message of Christ with our community. Every purchase helps spread the word and create opportunities for faith encounters.',
    'ng-infants':
      'For ages 6 weeks to 23 months. Infants receive individual attention from trained volunteers. We attend to your child’s physical and spiritual needs by holding, talking to, and praying for each child.',
    'ng-early-childhood':
      'For ages 2 years to kindergarten. Children in this age group enjoy experiential play, a lesson that teaches age-appropriate Biblical truths, and a time of interactive praise and worship. The monthly memory verse engages kids to hide God’s Word in their hearts. After a simple snack and story, children depart with ideas for continued learning at home.',
    'ng-elementary':
      'For 1st–4th graders. Children experience a purposeful and fun worship service. They strengthen friendships with leaders and other kids through play. Together, we connect with God in worship, praising Him through music, dance, giving, and prayer. In every service, kids receive Biblical truth with life application, putting God’s Word to work in their lives today, while also laying a firm foundation for the future.',
    'ng-check-in':
      'This team welcomes all families as they arrive and is often the first contact for first-time guests. This team utilizes a computer system to print name tags for new children and walks families through self-check-in stations to print their own tags. Security tags are an essential component to child safety in Radiant Kids.',
    'ng-radiant-friends':
      'This team works closely with kids who need a friend by their side to enjoy Sunday classes. Whether engaging in their age-appropriate class or spending time in the friends room, this team understands that every child is uniquely created by God and has a place in His Kingdom. For children with special needs. Spring Arbor Campus only.',
    'stu-jr-high':
      'For 5th–7th grade (Sunday mornings). Radiant Students worship together in the main sanctuary before being dismissed to their class for an age-appropriate message, prayer, and group discussions with real-life applications.',
    'stu-sr-high':
      'For 7th–12th grade (Sunday nights). This group meets every Sunday from 6:00 PM to 8:15 PM. There will be a customized service with time to hang out, play games, and make new friends. We will then move into a time of intentional worship and a message with small group discussions targeted at strengthening our faith.',
    'cg-leader':
      'Facilitate a weekly Community Group: welcome people, guide discussion around Scripture and sermon application, pray together, and help members build real relationships that point one another to Jesus. Training and ongoing support are provided.',
    'caw-service-director':
      'Directs camera operators, graphic techs, and technical directors for both livestream and IMAG in-house. Able to remain calm under pressure and demonstrates excellent verbal communication. Has a thorough understanding of the order of each service. Some experience is preferred but not required.',
    'caw-producer':
      'Operates the broadcast panel to switch live video for both livestream and IMAG in-house. Able to retain focus and follow instructions from the video director. Must be technically minded. No experience is required.',
    'caw-graphic-tech':
      'Controls ProPresenter for livestream and IMAG in-house. Able to retain focus and has excellent hand-eye coordination. Must work well on a team. No experience is required.',
    'caw-audio-tech':
      'Mixes worship and teaching for in-house experience and for livestream. This is a highly technical position and requires someone who has had previous audio experience.',
    'caw-camera-operator':
      'Responsible for capturing high-quality footage, expertly framing shots, and executing smooth camera movements to bring the director’s vision to life. They work closely with the production team, ensuring that the visuals are technically precise and creatively engaging throughout the shoot.',
  };

  const FALLBACK_BY_ID = {
    'prayer-team': `${SERVE_IMG}/prayer-2.png`,
    'worship-vocals': `${SERVE_IMG}/vocals.png`,
    'worship-band': `${SERVE_IMG}/instrumentals-1.png`,
    'fi-coffee': `${SERVE_IMG}/coffee-1.png`,
    'fi-greeters': `${SERVE_IMG}/greeters-4.png`,
    'fi-information': `${SERVE_IMG}/greeters-3.png`,
    'fi-ushers': `${SERVE_IMG}/ushers-1.png`,
    'fi-parking': `${SERVE_IMG}/parking-1.png`,
    'fi-medical': `${SERVE_IMG}/prayer-1.png`,
    'fi-merchandise': `${SERVE_IMG}/greeters-1.png`,
    'ng-infants': `${SERVE_IMG}/kids-1.png`,
    'ng-early-childhood': `${SERVE_IMG}/kids-2.png`,
    'ng-elementary': `${SERVE_IMG}/kids-6.png`,
    'ng-check-in': `${SERVE_IMG}/kids-checkin-1.png`,
    'ng-radiant-friends': `${SERVE_IMG}/kids-5.png`,
    'stu-jr-high': `${SERVE_IMG}/kids-4.png`,
    'stu-sr-high': `${SERVE_IMG}/kids-6.png`,
    'caw-service-director': `${SERVE_IMG}/production-3.png`,
    'caw-producer': `${SERVE_IMG}/producer-1.png`,
    'caw-graphic-tech': `${SERVE_IMG}/graphics-tech-1.png`,
    'caw-audio-tech': `${SERVE_IMG}/audio-tech-1.png`,
    'caw-camera-operator': `${SERVE_IMG}/camera-operator-1.png`,
    'cg-leader': `${SERVE_IMG}/greeters-2.png`,
  };
  const FALLBACK_IMAGES = {
    Welcome: `${SERVE_IMG}/greeters-4.png`,
    Music: `${SERVE_IMG}/worship-1.png`,
    Prayer: `${SERVE_IMG}/prayer-2.png`,
    'Next Generation': `${SERVE_IMG}/kids-6.png`,
    Tech: `${SERVE_IMG}/production-3.png`,
    Students: `${SERVE_IMG}/kids-6.png`,
    Serve: `${SERVE_IMG}/ushers-1.png`,
    Community: `${SERVE_IMG}/greeters-2.png`,
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
        const gl = o.groupLabel || GROUP_LABELS[o.groupId] || '';
        const sub = (o.groupId && GROUP_SUBTITLES[o.groupId]) || '';
        const hay = `${o.title || ''} ${o.description || ''} ${o.tag || ''} ${gl} ${sub}`.toLowerCase();
        return hay.includes(q);
      });
    },

    get groupedSections() {
      const list = this.filteredOpportunities;
      return GROUP_ORDER.map((groupId) => ({
        groupId,
        label: GROUP_LABELS[groupId] || groupId,
        subtitle: GROUP_SUBTITLES[groupId] || '',
        items: list.filter((o) => (o.groupId || '') === groupId),
      })).filter((s) => s.items.length > 0);
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
        const mapped = raw.map((o) => ({
          ...o,
          title: normalizeOpportunityTitle(o.title),
          tag: normalizeOpportunityTag(o.tag),
          groupLabel: o.groupLabel || GROUP_LABELS[o.groupId] || '',
          signUpUrl: o.signUpUrl || data.signUpUrl || '',
          description: (TEAM_RADIANT_DETAIL_COPY[o.id] || o.description || '').trim(),
          imageUrl:
            o.imageUrl ||
            FALLBACK_BY_ID[o.id] ||
            FALLBACK_IMAGES[o.tag] ||
            FALLBACK_IMAGES.Serve,
        }));
        this.opportunities = sortOpportunitiesForDisplay(mapped);
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

    /** Full detail copy for modal (canonical map + fallback) */
    detailDescription(opp) {
      if (!opp) return '';
      return (TEAM_RADIANT_DETAIL_COPY[opp.id] || opp.description || '').trim();
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

    signUpLinkFor(opp) {
      if (!opp) return this.signUpUrl || '';
      return opp.signUpUrl || this.signUpUrl || '';
    },

    groupSubtitle(groupId) {
      return (groupId && GROUP_SUBTITLES[groupId]) || '';
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
