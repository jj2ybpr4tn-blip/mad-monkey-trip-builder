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

  // Human review + bed hold ("Hold my beds + get it checked"). How long beds are held while the crew checks the trip.
  // Only promise what ops can honour: the hold itself happens on YOUR side when the lead arrives.
  HOLD_HOURS: 48,

  // Optional. GET <url>?ref=MM-XXXXXX -> { status: 'submitted'|'checking'|'ready'|'approved', note?, payLink? } powers the trip status page.
  STATUS_ENDPOINT: '',

  // Optional. Enables group mode across devices. Contract in docs/GROUP.md. Blank = demo mode (votes sync between tabs of one browser only).
  GROUP_ENDPOINT: '',

  // Optional privacy link shown under the lead form.
  PRIVACY_URL: ''
};
