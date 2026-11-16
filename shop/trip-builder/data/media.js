/* ============================================================
   MEDIA — real Mad Monkey photography, hot-linked from madmonkeyhostels.com
   (the share images each hostel / tour page already publishes).
   If one ever 404s the UI falls back to a flat colour block, so nothing breaks.
   Before launch: copy these into /assets or your CDN so the page does not
   depend on the main site being up (and swap in Drive-approved shots if wanted).
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  var BASE = 'https://madmonkeyhostels.com/api/share-image/';

  var HOSTEL = {
    'kampot': 'x5hd2s1j', 'hanoi': '1xreurh3', 'dumaguete': 'kn4rz21l', 'kuta-lombok': 'bm10ef1g', 'manila': 'grco051h',
    'koh-rong': 'c93wxu1v', 'panglao': 'm54wf51a', 'phuket': '1g05ufzr', 'siargao': '8xbp8d1r', 'phnom-penh': 'yd6kdp9o',
    'chiang-mai': '1ctl9ulb', 'siquijor': 'x874en9k', 'pai': 'nks2lq7b', 'uluwatu': '1oumepn1', 'gili-trawangan': '1dnmf7fq',
    'vang-vieng': 'i07ry4yx', 'bangkok': '5hxnwt15', 'luang-prabang': 'cpx9x91b', 'koh-sdach': '1ngywv41',
    'nusa-lembongan': 'vojosd9h', 'hoi-an': '109obuaq', 'nacpan-beach': '1q4y5dh1', 'siem-reap': '18p6uvx1'
  };

  var TOUR = {
    'hanoi-street-food-tour-train-street': '5vdh8s1x', 'the-ha-giang-loop-tour-4d-3n-easy-rider': '396raziz', 'hanoi-cooking-class': '1cqoyeu1',
    'the-ha-giang-loop-tour-3d2n-easy-rider': '7uv0se5d', 'ha-long-bay-day-trip-from-to-hanoi': 'nf7w6r10', 'the-ha-giang-loop-tour-4d-3n-self-riding': '1vpkobsn',
    'hanoi-michelin-street-food-water-puppet-show': 'w5w2y418', 'lan-ha-bay-2days-1night': '2bsk6m2p', 'hanoi-pub-crawl': '125fy497', 'white-party': '1x43b5iw',
    'ha-long-bay-legend-cruise-3-days-2-nights': '1kytbka1', 'ninh-binh-day-trip-hoa-lu-trang-an-mua-cave': 'w56w7l19', 'sapa-trekking-tour-2d1n-homestay-group': 'm4nwx816',
    'cooking-class': '1evdeg21', 'vietnamese-coffee-making-class': '1b8s9rh1', 'sunset-river-cruise': 'lnw8zn1s', 'bicycle-tour': 'mgggthm1',
    'cham-island-snorkelling-experience': '1td4h3wm', 'sunrise-sunset-paddle-boarding': '14whbou1', 'cham-island-diving-non-certified': 'lb8cg6rc',
    'marble-mountain-morning': '1ep9sq41', 'basket-boats': 'odg40xyq', 'hai-van-pass-hoi-an-day-trip-pillion-tour': '8zzpxzcz', 'floating-village-tour': '86x5bm1j',
    'sunrise-angkor-wat-temple-tour': 'ff9lj8l2', 'my-son-sanctuary-morning': 'oq24e13w', 'kulen-waterfalls-tour': '1giv0en1', 'ba-na-hills': 'kxc1f41b',
    'quad-bike-tour': '1nzqpkmm', 'wake-park-wakebording-experience': '2r8kwamq', 'elephant-discovery-morning-tour': 'trw15011', 'phare-circus-experience': '948tje1t',
    'sunset-countryside-cycling-tour': '1xqnita1', 'the-weekly-foam-party': '1sq2gw7r', 'make-your-own-pizza': 'i6cfn8xs', 's21-and-killing-fields-tour': 'j2dd4bh8',
    'level-2-siem-reap-essentials': '1sjhfdn1', 'sunset-boat-cruise': '9k7p5x1y', 'phnom-penh-bike-boat-adventure': '6u35q61o', 'siem-reap-pub-crawl': '1j0gcxto',
    'tuk-tuk-city-tour': 'x52bwl1q', 'kun-khmer-boxing-experience': 'hae20p1d', 'khmer-family-dinner': '14gje7ah', 'phnom-penh-pub-crawl': 'i9wpau1e',
    'sup-paddle-board-hire': '10bvq191', 'cycle-the-mekong-island': 'p185mrp0', 'phnom-penh-evening-food-tour': 'zfor8t1s', 'cooking-class-bustling-market-experience': 'nml1ro12',
    'phnom-penh-pool-party': 'qaki6bvg', 'free-the-bears-bear-care-tour': '1o6s9gr6', 'kayak-hire-koh-rong': '1hcka0c8', 'volleyball-tournament-koh-rong': 'hkjlhooh',
    'meet-up-mad-monkey-koh-rong': '10sbk8e1', 'killer-pool-games-night': '1lnv57yh', 'beach-olympics': '12xsefg1', 'mt-batur-sunrise-trekking': '1t08fh3r',
    'surf-lesson-group-of-4': 'h3ua11a0', 'the-meet-up-mad-monkey-koh-sdach': 'dxxuhd1q', 'bukit-sari-atv-adventure-experience': '1xnqfy49',
    'kuber-bali-adventure-tour-premium-atv-solo-and-white-water-rafting': '1azq8fj1', 'snorkeling': 'yh2q4u1s', 'music-quiz-2': 'xp2q901h', 'island-hopping-penida': '1i64btce',
    'sauna-gym-ice-bath': '55fjh2z4', 'gili-trawangan-boat-party': '133s24b1', 'uluwatu-pub-crawl': '18rf72lp', 'mangrove-tour': 'p3rud9a5', 'fun-scuba-diving-exploration': 'sgjssc2z',
    'snorkeling-adventure': '1k2v3wtt', 'bbq-and-free-flow-dinner-gili-t': '67a335yn', 'discover-scuba-diving': '14leoulw', 'mt-rinjani-summit-trek-2-days-1-night-mmglt': '14b9i84m',
    'komodo-tour-shared-room-mmglt': '19hz5bq1', 'snorkeling-mexican-family-dinner': '1nens3hx', 'surf-camp': '6k0f1xbu', 'lombok-waterfall-tour-mad-family-dinner': '1fo3qbx8',
    'surf-camp-4-day': 'wrizucj7', 'madventure-snorkeling-secret-gili-s': 'a6kxgo8v', 'mt-rinjani-summit-trek-2-days-1-night': 'tgt9cqj3', 'lombok-family-dinner': 'eburvq8p',
    'padi-advance-open-water-course-certification': '1a6d9yx1', 'gili-t-foam-party': '68r2u21v', 'surf-leson-intermediate-level': '1he8snw1',
    'dolphin-watching-and-island-hopping-tour-balicasag-and-virgin-island': 'u0yfa1qt', 'bohol-countryside-tour': 'kr288a1u', 'mojito-masterclass': '3hm5ym1a',
    'panglao-cave-beach-tour': '1r3cftk1', 'valencia-tour': '7q429c1s', 'mad-golf': '1u9a2yl1', 'panglao-sunset-cruise': '98d0rr1b', 'panglao-mojito-masterclass': '6stptbxr',
    'siquijor-sunset-cruise': '1by7nno1', 'tri-island-tour': 'ip4wlp1r', 'surf-lesson': '7q8lke16', 'sunset-beer-yoga-panglao': '5jhd2y1t', 'siquijor-pub-crawl': '1mut9cid',
    'siargao-surf-camp-4d-3n-all-inclusive-package': '12edop7c', 'siquijor-island-countryside-tour': 'ic2j0lbt', 'tri-island-classic-boat-tour': 'oecuz210',
    'tour-m-island-hopping': '18vrb6s1', 'pub-crawl-2': '1e1qvxi1', 'adventure-land-tour': '1m6boziu', 'wakeboarding': '4rzhruua', 'land-madness-tour': '1yn06b91',
    'siargao-surf-camp-7d-6n-all-inclusive-package': 'gq5fym1d', 'siargao-sohoton-tour': '1yq409o1', 'unlimited-drinks': '1ucd2q51', 'sunset-cruise': '1vmf1oul',
    'the-meet-up-mad-monkey-phuket': '1suiw31p', 'phuket-bar-olympics': 'vto4zcdd', 'kuang-si-waterfall': '1dm7g4eo', 'vang-vieng-tipsy-tubing': '1mna148n',
    'vang-vieng-pub-crawl': '3ppp9i1m', 'pool-and-foam-party': '1eknf2on', 'the-mad-package-3-day-phnom-penh-to-siem-reap': '1xhmuu31', 'karaoke-night-bkk': 'xiljz416',
    'pub-quiz-bangkok': '6zgic05m', 'the-mad-package-phnom-penh-to-siem-reap-2': '9t0ckngk'
  };

  // PHOTO_BASE (config.js) points at your own copies, made by scripts/mirror-photos.mjs: <base>/hostel/<id>.jpg, /tour/<slug>.jpg, /gallery/<id>-<n>.jpg
  var own = function () { return (r.MM_CONFIG && r.MM_CONFIG.PHOTO_BASE || '').replace(/\/$/, ''); };
  MM.hostelImg = function (id) { return HOSTEL[id] ? (own() ? own() + '/hostel/' + id + '.jpg' : BASE + 'property/' + id + '/' + HOSTEL[id] + '.jpg') : null; };
  MM.tourImg = function (slug) { return slug && TOUR[slug] ? (own() ? own() + '/tour/' + slug + '.jpg' : BASE + 'tour/' + slug + '/' + TOUR[slug] + '.jpg') : null; };
  MM.actImg = function (a) { return MM.tourImg(a.slug); };
  // Small copies of the same photos (scripts/make-thumbs.mjs): 's' is 320px wide for thumbnails and strips, 'm' is 720px wide for the big cards.
  // Two ways to have them:
  //   PHOTO_BASE   we host full copies of the photos too, and the small ones sit beside them: <base>/s/hostel/<id>.webp
  //   THUMB_BASE   only the small copies are hosted next to the builder (about 13 MB instead of 61) and the full photos are still hot-linked from madmonkeyhostels.com:
  //                <thumb base>/s/hostel/<id>.webp. This is how the live ALL IN site gets them.
  // A photo with no small copy comes back unchanged, and the page falls back to the full photo if a small one is missing.
  var thumbBase = function () { return (r.MM_CONFIG && r.MM_CONFIG.THUMB_BASE || '').replace(/\/$/, ''); };
  var NAMES = null;     // a hot-linked photo's address -> its name in assets/photos ("hostel/hanoi"), worked out the first time it is needed
  function names() {
    if (NAMES) return NAMES;
    NAMES = {};
    Object.keys(HOSTEL).forEach(function (id) { NAMES[BASE + 'property/' + id + '/' + HOSTEL[id] + '.jpg'] = 'hostel/' + id; });
    Object.keys(TOUR).forEach(function (slug) { NAMES[BASE + 'tour/' + slug + '/' + TOUR[slug] + '.jpg'] = 'tour/' + slug; });
    if (MM.gallery && MM.PLACES) Object.keys(MM.PLACES).forEach(function (id) { MM.gallery(id).forEach(function (u, k) { NAMES[u] = 'gallery/' + id + '-' + k; }); });
    return NAMES;
  }
  MM.thumb = function (url, size) {
    var cfg = r.MM_CONFIG || {}, b = own();
    if (!url || cfg.PHOTO_THUMBS === false || (size !== 's' && size !== 'm')) return url;
    if (b) return url.indexOf(b + '/') === 0 ? b + '/' + size + '/' + url.slice(b.length + 1).replace(/\.jpe?g$/i, '.webp') : url;
    var t = thumbBase(), name = t && names()[url];
    return name ? t + '/' + size + '/' + name + '.webp' : url;
  };

  if (typeof module !== 'undefined') module.exports = { HOSTEL: HOSTEL, TOUR: TOUR };
})(typeof window !== 'undefined' ? window : globalThis);
