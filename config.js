/* ============================================================
   CONFIG — the only file ops needs to touch to go live.
   ============================================================ */
window.MM_CONFIG = {
  // Where a finished trip + contact gets sent (POST, JSON). See docs/LEADS.md for the payload.
  // Leave blank and the builder runs in DEMO mode: it shows the lead card but sends nothing.
  LEAD_ENDPOINT: '',

  // Optional. Digits only with country code, e.g. '447000000000'. Adds a "message the crew" button.
  WHATSAPP: '',

  // Optional fallback shown in demo mode / when the endpoint fails.
  CREW_EMAIL: '',

  // Used in share links + the story card. Leave blank to use wherever this page is hosted.
  SITE_URL: '',
  SITE_LABEL: 'madmonkeyhostels.com',

  // Optional privacy link shown under the lead form.
  PRIVACY_URL: ''
};
