function groupsApp() {
  return {
    allGroups: [],
    sourcePages: [],
    lastUpdated: '',
    searchQuery: '',
    showSearch: false,
    detailGroup: null,
    qrRendered: new Set(),
    refreshing: false,
    refreshMessage: '',
    refreshError: false,
    darkMode: localStorage.getItem('theme') === 'dark',
    taglines: ['FREE', 'EMPOWERED', 'CONNECTED', 'GENEROUS', 'LOVING OTHERS'],
    taglineIndex: 0,
    currentTagline: 'FREE',

    filters: {
      category: [],
      demographic: [],
      type: [],
      regularity: [],
    },

    categories: [
      { name: 'Adult', dotColor: 'bg-radiant-500', borderClass: 'border-radiant-200', activeClass: 'bg-radiant-600 text-white shadow-sm' },
      { name: 'Young Adult', dotColor: 'bg-radiant-500', borderClass: 'border-radiant-200', activeClass: 'bg-radiant-600 text-white shadow-sm' },
      { name: 'Students', dotColor: 'bg-radiant-500', borderClass: 'border-radiant-200', activeClass: 'bg-radiant-600 text-white shadow-sm' },
    ],

    demographics: ["Co-Ed", "Women's", "Men's"],
    groupTypes: ['Gather', 'Grow', 'Go'],
    regularities: ['Weekly', 'Bi-Weekly', 'Monthly', 'Daily', 'As Needed', 'Varies'],

    async init() {
      this.applyTheme();
      this.startTaglineRotation();
      await this.loadGroups();
    },

    taglineFading: false,

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
      localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
      this.applyTheme();
    },

    applyTheme() {
      document.documentElement.classList.toggle('dark', this.darkMode);
    },

    async loadGroups() {
      try {
        const resp = await fetch('data/groups.json?_=' + Date.now());
        const data = await resp.json();
        this.allGroups = data.groups || [];
        this.sourcePages = data.sourcePages || [];
        if (data.lastUpdated) {
          const d = new Date(data.lastUpdated);
          this.lastUpdated = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        }
      } catch (e) {
        console.error('Failed to load groups data:', e);
      }
    },

    async refreshGroups() {
      if (this.refreshing) return;
      this.refreshing = true;
      this.refreshMessage = '';
      this.refreshError = false;

      try {
        const resp = await fetch('/api/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pages: this.sourcePages.length ? this.sourcePages : undefined }),
        });
        const result = await resp.json();

        if (!resp.ok) {
          throw new Error(result.error || 'Refresh failed');
        }

        this.qrRendered.clear();
        await this.loadGroups();
        this.$nextTick(() => this.renderAllVisibleQR());
        this.refreshMessage = `Updated ${result.groupCount} groups from Church Center`;
        this.refreshError = false;
      } catch (e) {
        console.error('Refresh failed:', e);
        this.refreshMessage = `Refresh failed: ${e.message}`;
        this.refreshError = true;
      } finally {
        this.refreshing = false;
        setTimeout(() => { this.refreshMessage = ''; }, 8000);
      }
    },

    get filteredGroups() {
      return this.allGroups.filter((g) => {
        if (this.filters.category.length && !this.filters.category.includes(g.category)) return false;
        if (this.filters.demographic.length && !this.filters.demographic.includes(g.demographic)) return false;
        if (this.filters.type.length && !this.filters.type.includes(g.tags.type)) return false;
        if (this.filters.regularity.length && !this.filters.regularity.includes(g.tags.regularity)) return false;
        if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase();
          const haystack = `${g.name} ${g.description} ${g.tags.location}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
    },

    get filteredCount() {
      return this.filteredGroups.length;
    },

    get isExpanded() {
      return this.filteredCount > 0 && this.filteredCount <= 6;
    },

    get hasActiveFilters() {
      return (
        this.filters.category.length > 0 ||
        this.filters.demographic.length > 0 ||
        this.filters.type.length > 0 ||
        this.filters.regularity.length > 0 ||
        this.searchQuery.length > 0
      );
    },

    toggleFilter(key, value) {
      const idx = this.filters[key].indexOf(value);
      if (idx === -1) {
        this.filters[key].push(value);
      } else {
        this.filters[key].splice(idx, 1);
      }
      this.qrRendered.clear();
      this.$nextTick(() => this.renderAllVisibleQR());
    },

    isFilterActive(key, value) {
      return this.filters[key].includes(value);
    },

    clearFilters() {
      this.filters.category = [];
      this.filters.demographic = [];
      this.filters.type = [];
      this.filters.regularity = [];
      this.searchQuery = '';
      this.qrRendered.clear();
    },

    sectionHasGroups(category) {
      return this.filteredGroups.some((g) => g.category === category);
    },

    sectionCount(category) {
      return this.filteredGroups.filter((g) => g.category === category).length;
    },

    subSectionHasGroups(category, demographic) {
      return this.filteredGroups.some((g) => g.category === category && g.demographic === demographic);
    },

    getGroups(category, demographic) {
      return this.filteredGroups.filter((g) => g.category === category && g.demographic === demographic);
    },

    openGroupPage(url) {
      window.location.href = url;
    },

    openDetail(group) {
      if (this.isExpanded) return;
      this.detailGroup = group;
      this.$nextTick(() => {
        this.renderQRTo('qr-modal-' + group.id, group.url);
      });
    },

    typeColor(type) {
      switch (type) {
        case 'Gather': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
        case 'Grow': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
        case 'Go': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';
        default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
      }
    },

    typeActiveClass(type) {
      switch (type) {
        case 'Gather': return 'bg-amber-500 text-white shadow-sm';
        case 'Grow': return 'bg-emerald-600 text-white shadow-sm';
        case 'Go': return 'bg-sky-600 text-white shadow-sm';
        default: return 'bg-gray-600 text-white shadow-sm';
      }
    },

    renderQR(group) {
      if (!this.isExpanded) return;
      this.renderQRTo('qr-' + group.id, group.url);
    },

    renderQRTo(containerId, url) {
      if (this.qrRendered.has(containerId)) return;
      const el = document.getElementById(containerId);
      if (!el || typeof qrcode === 'undefined') return;
      el.innerHTML = '';
      
      try {
        // Create QR code with qrcode-generator library
        const qr = qrcode(0, 'M'); // Type number 0 (auto), error correction level M
        qr.addData(url);
        qr.make();
        
        // Create image element with data URL
        const cellSize = 4;
        const margin = 1;
        const img = document.createElement('img');
        img.src = qr.createDataURL(cellSize, margin);
        img.className = 'w-full h-full rounded';
        img.alt = 'Scan to open group page';
        el.appendChild(img);
        this.qrRendered.add(containerId);
      } catch (err) {
        console.error('QR error:', err);
      }
    },

    renderAllVisibleQR() {
      if (!this.isExpanded) return;
      this.filteredGroups.forEach((g) => {
        this.$nextTick(() => this.renderQRTo('qr-' + g.id, g.url));
      });
    },
  };
}
