/* ============================================================
   CONFIG — the only file ops needs to touch to go live.
   ============================================================ */
window.MM_CONFIG = {
  // Using the bundled crew server (npm run server)? It sets this to '/api' for you and every endpoint below fills in
  // automatically. Hosting the site elsewhere? Set it to your API's full URL, e.g. 'https://api.example.com/api'.
  // Blank = demo mode (nothing is sent anywhere).
  API_BASE: '',

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

  // Serve photos from your own copies (run scripts/mirror-photos.mjs first). e.g. '/assets/photos' or a CDN URL. Blank = hot-link madmonkeyhostels.com.
  PHOTO_BASE: 'assets/photos',

  // Optional privacy link shown under the lead form.
  PRIVACY_URL: ''
};

// With an API, fill in every endpoint that wasn't set by hand.
(function (c) {
  if (!c.API_BASE) return; var b = c.API_BASE.replace(/\/$/, '');
  c.LEAD_ENDPOINT = c.LEAD_ENDPOINT || b + '/leads'; c.STATUS_ENDPOINT = c.STATUS_ENDPOINT || b + '/status'; c.GROUP_ENDPOINT = c.GROUP_ENDPOINT || b;
  c.EVENT_ENDPOINT = c.EVENT_ENDPOINT || b + '/event'; c.LIVE_ENDPOINT = c.LIVE_ENDPOINT || b + '/live'; c.FARES_ENDPOINT = c.FARES_ENDPOINT || b + '/fares'; c.SHARE_ENDPOINT = c.SHARE_ENDPOINT || b + '/share'; c.REVIEWS_ENDPOINT = c.REVIEWS_ENDPOINT || b + '/reviews'; c.FLOW_ENDPOINT = c.FLOW_ENDPOINT || b + '/flow';
})(window.MM_CONFIG);
