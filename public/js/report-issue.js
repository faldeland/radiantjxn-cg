function reportIssueApp() {
  return {
    open: false,
    submitting: false,
    submitted: false,
    error: '',
    url: '',
    description: '',

    init() {
      this.url = window.location.href;
    },

    openModal() {
      this.url = window.location.href;
      this.description = '';
      this.submitted = false;
      this.error = '';
      this.open = true;
      this.$nextTick(() => {
        const ta = document.getElementById('report-issue-description');
        if (ta) ta.focus();
      });
    },

    closeModal() {
      this.open = false;
    },

    async submit() {
      if (!this.description.trim() && !this.url.trim()) return;
      this.submitting = true;
      this.error = '';
      try {
        const res = await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: this.url, description: this.description }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        this.submitted = true;
        setTimeout(() => { this.open = false; this.submitted = false; }, 2000);
      } catch (err) {
        this.error = err.message || 'Failed to submit. Please try again.';
      } finally {
        this.submitting = false;
      }
    },
  };
}
