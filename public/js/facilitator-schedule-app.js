function facilitatorScheduleApp() {
  const now = new Date();
  const MIN_CALENDAR_YEAR = 2026;
  const MIN_CALENDAR_MONTH = 3; // April (0-based)
  const startsBeforeMin = now.getFullYear() < MIN_CALENDAR_YEAR ||
    (now.getFullYear() === MIN_CALENDAR_YEAR && now.getMonth() < MIN_CALENDAR_MONTH);
  return {
    darkMode: false,
    menuOpen: false,
    entries: {},
    saving: {},
    calendarYear: startsBeforeMin ? MIN_CALENDAR_YEAR : now.getFullYear(),
    calendarMonth: startsBeforeMin ? MIN_CALENDAR_MONTH : now.getMonth(),
    selectedYear: startsBeforeMin ? MIN_CALENDAR_YEAR : now.getFullYear(),
    selectedMonth: startsBeforeMin ? MIN_CALENDAR_MONTH : now.getMonth(),

    taglines: ['Facilitator Schedule'],
    currentTagline: 'Facilitator Schedule',
    taglineFading: false,

    init() {
      this.darkMode = document.cookie.includes('darkMode=true');
      if (this.darkMode) document.documentElement.classList.add('dark');
      this.enforceCalendarMin();
      this.loadSchedule();
    },

    async loadSchedule() {
      try {
        const res = await fetch('/api/facilitator-schedule');
        const data = await res.json();
        this.entries = data.entries || {};
      } catch {
        this.entries = {};
      }
    },

    toggleDarkMode() {
      this.darkMode = !this.darkMode;
      document.documentElement.classList.toggle('dark', this.darkMode);
      document.cookie = `darkMode=${this.darkMode};path=/;max-age=31536000`;
    },

    // ── Calendar helpers ──────────────────────────────────────────────

    get calendarMonthLabel() {
      return new Date(this.calendarYear, this.calendarMonth, 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    },

    get canGoPrevMonth() {
      return this.calendarYear > MIN_CALENDAR_YEAR ||
        (this.calendarYear === MIN_CALENDAR_YEAR && this.calendarMonth > MIN_CALENDAR_MONTH);
    },

    enforceCalendarMin() {
      const isBeforeMin = this.calendarYear < MIN_CALENDAR_YEAR ||
        (this.calendarYear === MIN_CALENDAR_YEAR && this.calendarMonth < MIN_CALENDAR_MONTH);
      if (isBeforeMin) {
        this.calendarYear = MIN_CALENDAR_YEAR;
        this.calendarMonth = MIN_CALENDAR_MONTH;
      }
    },

    prevMonth() {
      this.enforceCalendarMin();
      if (!this.canGoPrevMonth) return;
      if (this.calendarMonth === 0) {
        this.calendarMonth = 11;
        this.calendarYear--;
      } else {
        this.calendarMonth--;
      }
    },

    nextMonth() {
      if (this.calendarMonth === 11) {
        this.calendarMonth = 0;
        this.calendarYear++;
      } else {
        this.calendarMonth++;
      }
    },

    selectMonth() {
      this.selectedYear = this.calendarYear;
      this.selectedMonth = this.calendarMonth;
    },

    get isSelectedMonth() {
      return this.calendarYear === this.selectedYear &&
             this.calendarMonth === this.selectedMonth;
    },

    get calendarDays() {
      const year = this.calendarYear;
      const month = this.calendarMonth;
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDow = firstDay.getDay();
      const days = [];

      for (let i = 0; i < startDow; i++) {
        days.push({ day: '', date: '', blank: true });
      }

      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dt = new Date(year, month, d);
        const iso = this.toISO(dt);
        days.push({
          day: d,
          date: iso,
          blank: false,
          isSaturday: dt.getDay() === 6,
          isToday: iso === this.toISO(new Date()),
          hasFacilitator: !!this.entries[iso],
        });
      }

      return days;
    },

    dayHasFacilitator(dateStr) {
      return !!this.entries[dateStr];
    },

    // ── Selected month Saturdays ──────────────────────────────────────

    get selectedMonthLabel() {
      return new Date(this.selectedYear, this.selectedMonth, 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    },

    get saturdays() {
      const year = this.selectedYear;
      const month = this.selectedMonth;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const list = [];
      for (let d = 1; d <= lastDay; d++) {
        const dt = new Date(year, month, d);
        if (dt.getDay() === 6) {
          const iso = this.toISO(dt);
          list.push({
            date: iso,
            label: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            dayLabel: 'Saturday',
            facilitator: this.entries[iso] || '',
          });
        }
      }
      return list;
    },

    async saveFacilitator(dateStr, value) {
      this.saving[dateStr] = true;
      try {
        const res = await fetch(`/api/facilitator-schedule/${dateStr}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ facilitator: value }),
        });
        const data = await res.json();
        this.entries = data.entries || this.entries;
      } catch { /* silent */ }
      this.saving[dateStr] = false;
    },

    // ── Utility ───────────────────────────────────────────────────────

    toISO(dt) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },
  };
}
