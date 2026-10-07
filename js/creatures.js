/* Litter Crusaders Maps — creature definitions + cute SVG art.
   Every litter type is a collectible "creature". Art is hand-built SVG so it
   works offline, scales crisply, and can be shown as a silhouette in the dex. */
(function () {
  'use strict';

  // Shared cute face: googly eyes, blush, smile.
  function face(cx, cy, gap, r, opts) {
    opts = opts || {};
    const lx = cx - gap / 2, rx = cx + gap / 2;
    const pr = r * 0.55;
    const look = opts.look || 0.25;
    let s = '';
    [lx, rx].forEach(function (x) {
      s += '<circle cx="' + x + '" cy="' + cy + '" r="' + r + '" fill="#fff" stroke="#2b2b3a" stroke-width="1.6"/>';
      s += '<circle cx="' + (x + r * look) + '" cy="' + (cy + r * 0.12) + '" r="' + pr + '" fill="#2b2b3a"/>';
      s += '<circle cx="' + (x + r * look + pr * 0.35) + '" cy="' + (cy - pr * 0.35) + '" r="' + pr * 0.35 + '" fill="#fff"/>';
    });
    // blush
    s += '<ellipse cx="' + (lx - r * 0.6) + '" cy="' + (cy + r * 1.5) + '" rx="' + r * 0.6 + '" ry="' + r * 0.35 + '" fill="#ff7aa8" opacity=".55"/>';
    s += '<ellipse cx="' + (rx + r * 0.6) + '" cy="' + (cy + r * 1.5) + '" rx="' + r * 0.6 + '" ry="' + r * 0.35 + '" fill="#ff7aa8" opacity=".55"/>';
    // smile
    const my = cy + r * 1.35, mw = gap * 0.32;
    if (opts.mouth === 'o') {
      s += '<ellipse cx="' + cx + '" cy="' + (my + 1.5) + '" rx="' + mw * 0.45 + '" ry="' + mw * 0.55 + '" fill="#2b2b3a"/>';
    } else {
      s += '<path d="M' + (cx - mw) + ' ' + my + ' Q' + cx + ' ' + (my + mw * 1.1) + ' ' + (cx + mw) + ' ' + my + '" fill="#ff5c7a" stroke="#2b2b3a" stroke-width="1.8" stroke-linecap="round"/>';
    }
    return s;
  }

  const OUT = 'stroke="#2b2b3a" stroke-width="2.4" stroke-linejoin="round"';

  const ART = {
    bottle: function () {
      return '<rect x="40" y="5" width="20" height="10" rx="3" fill="#2f80ed" ' + OUT + '/>' +
        '<path d="M43 15 h14 v8 q10 5 11 16 v46 q0 9 -9 9 h-18 q-9 0 -9 -9 v-46 q1 -11 11 -16z" fill="#8fd8ff" ' + OUT + '/>' +
        '<rect x="32" y="52" width="36" height="14" fill="#3ddc97" opacity=".9"/>' +
        '<path d="M37 30 q-2 8 -2 16" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>' +
        face(50, 40, 16, 5);
    },
    can: function () {
      return '<circle cx="15" cy="55" r="9" fill="#ff8a80" ' + OUT + '/><path d="M12 47 l3 6 l4 -6" fill="#fff"/>' +
        '<circle cx="85" cy="55" r="9" fill="#ff8a80" ' + OUT + '/><path d="M82 47 l3 6 l4 -6" fill="#fff"/>' +
        '<rect x="26" y="16" width="48" height="74" rx="10" fill="#ff5f57" ' + OUT + '/>' +
        '<ellipse cx="50" cy="18" rx="22" ry="5" fill="#d9dee6" ' + OUT + '/>' +
        '<rect x="46" y="14" width="8" height="4" rx="2" fill="#9aa3af"/>' +
        '<path d="M26 64 q24 10 48 0 v10 q-24 10 -48 0z" fill="#fff" opacity=".85"/>' +
        face(50, 42, 18, 6);
    },
    wrapper: function () {
      return '<path d="M8 32 L30 44 L30 60 L8 72 L14 52z" fill="#ffd166" ' + OUT + '/>' +
        '<path d="M92 32 L70 44 L70 60 L92 72 L86 52z" fill="#ffd166" ' + OUT + '/>' +
        '<ellipse cx="50" cy="52" rx="24" ry="20" fill="#c77dff" ' + OUT + '/>' +
        '<path d="M34 40 q8 -6 16 -2" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>' +
        face(50, 49, 16, 5);
    },
    butt: function () {
      return '<path d="M28 34 q-6 -14 -14 -14" stroke="#2b2b3a" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="14" cy="20" r="3.5" fill="#ff9f43"/>' +
        '<path d="M36 33 q-1 -14 6 -18" stroke="#2b2b3a" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="42" cy="15" r="3.5" fill="#ff9f43"/>' +
        '<g stroke="#2b2b3a" stroke-width="2.4" stroke-linecap="round"><path d="M30 70 l-4 10"/><path d="M45 72 l-2 10"/><path d="M60 72 l2 10"/><path d="M75 70 l4 10"/></g>' +
        '<rect x="14" y="36" width="74" height="36" rx="18" fill="#fff8ec" ' + OUT + '/>' +
        '<path d="M14 54 a18 18 0 0 1 18 -18 h14 v36 h-14 a18 18 0 0 1 -18 -18z" fill="#ffb26b" ' + OUT + '/>' +
        '<circle cx="24" cy="48" r="1.6" fill="#c46a1b"/><circle cx="32" cy="58" r="1.6" fill="#c46a1b"/><circle cx="38" cy="46" r="1.6" fill="#c46a1b"/>' +
        face(66, 50, 16, 5);
    },
    bag: function () {
      return '<path d="M32 26 q0 -18 10 -18 q6 0 6 12" fill="none" ' + OUT + '/>' +
        '<path d="M68 26 q0 -18 -10 -18 q-6 0 -6 12" fill="none" ' + OUT + '/>' +
        '<path d="M22 30 q28 -10 56 0 l4 52 q-6 8 -12 0 q-6 8 -12 0 q-6 8 -12 0 q-6 8 -12 0 q-6 8 -12 0z" fill="#f4f7ff" ' + OUT + '/>' +
        '<path d="M30 40 q-2 16 0 30" stroke="#b9c6ff" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        face(51, 50, 18, 6, { mouth: 'o' });
    },
    paper: function () {
      return '<path d="M22 30 q-14 4 -12 26 q8 -2 14 -12z" fill="#b5835a" ' + OUT + '/>' +
        '<path d="M78 30 q14 4 12 26 q-8 -2 -14 -12z" fill="#b5835a" ' + OUT + '/>' +
        '<rect x="20" y="26" width="60" height="62" rx="8" fill="#e0b07c" ' + OUT + '/>' +
        '<path d="M20 40 h60" stroke="#2b2b3a" stroke-width="2"/><rect x="44" y="26" width="12" height="14" fill="#f6d7a7"/>' +
        '<ellipse cx="50" cy="70" rx="6" ry="4.5" fill="#2b2b3a"/>' +
        face(50, 56, 20, 5.5);
    },
    glass: function () {
      return '<path d="M86 14 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="#fff36b" stroke="#2b2b3a" stroke-width="1.5"/>' +
        '<rect x="42" y="6" width="16" height="22" rx="4" fill="#3c9d5d" ' + OUT + '/>' +
        '<path d="M42 26 h16 q18 8 18 26 v32 q0 8 -8 8 h-36 q-8 0 -8 -8 v-32 q0 -18 18 -26z" fill="#6fdc8c" ' + OUT + '/>' +
        '<path d="M32 48 q0 -8 6 -12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>' +
        '<path d="M24 74 h52" stroke="#3c9d5d" stroke-width="2" opacity=".6"/>' +
        face(50, 54, 18, 6);
    },
    straw: function () {
      return '<path d="M20 86 C 10 60, 40 60, 34 40 S 50 10, 70 18" fill="none" stroke="#2b2b3a" stroke-width="15" stroke-linecap="round"/>' +
        '<path d="M20 86 C 10 60, 40 60, 34 40 S 50 10, 70 18" fill="none" stroke="#ff4d8d" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="M20 86 C 10 60, 40 60, 34 40 S 50 10, 70 18" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="6 7"/>' +
        '<circle cx="72" cy="22" r="17" fill="#ff4d8d" ' + OUT + '/>' +
        '<path d="M86 30 l8 3 l-8 2" stroke="#ff2e63" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        face(72, 19, 13, 4.5);
    },
    cup: function () {
      return '<rect x="56" y="2" width="7" height="22" rx="2" fill="#ff6b6b" ' + OUT + ' transform="rotate(12 60 14)"/>' +
        '<rect x="20" y="20" width="60" height="12" rx="6" fill="#fff" ' + OUT + '/>' +
        '<path d="M25 32 h50 l-7 56 q-1 4 -5 4 h-26 q-4 0 -5 -4z" fill="#ffe08a" ' + OUT + '/>' +
        '<path d="M28 52 h44 l-2 16 h-40z" fill="#ff9f68" opacity=".9"/>' +
        face(50, 44, 18, 5.5);
    },
    mask: function () {
      return '<path d="M24 40 q-22 -16 -20 6 q2 20 22 14" fill="#cfe8ff" ' + OUT + '/>' +
        '<path d="M76 40 q22 -16 20 6 q-2 20 -22 14" fill="#cfe8ff" ' + OUT + '/>' +
        '<path d="M22 34 q28 -10 56 0 v30 q-28 16 -56 0z" fill="#8ecbff" ' + OUT + '/>' +
        '<g stroke="#5aa9e6" stroke-width="2.2"><path d="M24 50 q26 6 52 0"/><path d="M24 58 q26 8 52 0"/></g>' +
        '<path d="M44 26 q-4 -12 -10 -14 M56 26 q4 -12 10 -14" stroke="#2b2b3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
        face(50, 42, 18, 5);
    },
    cap: function () {
      let ridges = '';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ridges += '<circle cx="' + (50 + Math.cos(a) * 30).toFixed(1) + '" cy="' + (52 + Math.sin(a) * 30).toFixed(1) + '" r="5" fill="#e63946" ' + OUT + '/>';
      }
      return '<g stroke="#2b2b3a" stroke-width="2.4" stroke-linecap="round"><path d="M22 80 l-8 8"/><path d="M78 80 l8 8"/><path d="M18 60 l-10 2"/><path d="M82 60 l10 2"/></g>' +
        ridges + '<circle cx="50" cy="52" r="30" fill="#ff5d6c" ' + OUT + '/>' +
        '<circle cx="50" cy="52" r="22" fill="#ff8c96"/>' +
        face(50, 48, 16, 5.5);
    },
    mystery: function () {
      return '<defs><linearGradient id="rb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ad9"/><stop offset=".35" stop-color="#ffd166"/><stop offset=".7" stop-color="#5ee6a8"/><stop offset="1" stop-color="#6aa8ff"/></linearGradient></defs>' +
        '<path d="M14 18 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" fill="#fff36b" stroke="#2b2b3a" stroke-width="1.3"/>' +
        '<path d="M86 70 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" fill="#fff36b" stroke="#2b2b3a" stroke-width="1.3"/>' +
        '<path d="M50 8 q34 0 36 34 q2 30 -14 44 q-6 -6 -10 0 q-6 -6 -12 0 q-6 -6 -12 0 q-4 -6 -10 0 q-16 -14 -14 -44 q2 -34 36 -34z" fill="url(#rb)" ' + OUT + '/>' +
        '<text x="50" y="40" text-anchor="middle" font-size="20" font-weight="900" font-family="system-ui,sans-serif" fill="#fff" stroke="#2b2b3a" stroke-width="1.5">?</text>' +
        face(50, 52, 18, 6);
    }
  };

  const CREATURES = [
    { id: 'bottle', name: 'Bottle Blob', item: 'Plastic bottle', emoji: '🧴', rarity: 'common', points: 10, color: '#8fd8ff',
      fact: 'Bottle Blobs can float around for hundreds of years! Recycle them and they can become new bottles, or even fleece jackets.' },
    { id: 'can', name: 'Can Crab', item: 'Drink can', emoji: '🥫', rarity: 'common', points: 10, color: '#ff8a80',
      fact: 'Aluminum cans can be recycled again and again forever, and come back as a new can in about 60 days!' },
    { id: 'wrapper', name: 'Wrapper Wiggler', item: 'Candy or snack wrapper', emoji: '🍬', rarity: 'common', points: 5, color: '#c77dff',
      fact: 'Wrappers are light and sneaky. The wind loves to blow them into bushes, so check under hedges!' },
    { id: 'butt', name: 'Butt Bug', item: 'Cigarette butt', emoji: '🐛', rarity: 'common', points: 10, color: '#ffb26b',
      safety: 'gloves', fact: 'Butt Bugs are the most common litter on Earth. They\'re yucky, so always wear gloves or ask a grown-up to grab them.' },
    { id: 'paper', name: 'Paper Pup', item: 'Paper or cardboard', emoji: '📦', rarity: 'common', points: 5, color: '#e0b07c',
      fact: 'Paper Pups love to be recycled. Paper can be turned into new paper up to 7 times!' },
    { id: 'cup', name: 'Cup Critter', item: 'Cup or lid', emoji: '🥤', rarity: 'common', points: 10, color: '#ffe08a',
      fact: 'Lots of paper cups have a thin plastic lining inside, which makes them tricky to recycle.' },
    { id: 'cap', name: 'Cap Beetle', item: 'Bottle cap', emoji: '🔴', rarity: 'common', points: 5, color: '#ff5d6c',
      fact: 'Cap Beetles are tiny, and birds sometimes think they\'re food. Every one you catch helps wildlife!' },
    { id: 'bag', name: 'Bag Ghost', item: 'Plastic bag', emoji: '👻', rarity: 'uncommon', points: 15, color: '#e8eeff',
      fact: 'Bag Ghosts drift through the air and water. Sea turtles can mistake them for jellyfish, so catching them really matters.' },
    { id: 'straw', name: 'Straw Noodle', item: 'Straw', emoji: '🐍', rarity: 'uncommon', points: 15, color: '#ff4d8d',
      fact: 'Straws are too small and light for most recycling machines, so the bin is the best home for them.' },
    { id: 'mask', name: 'Mask Moth', item: 'Face mask', emoji: '😷', rarity: 'uncommon', points: 15, color: '#8ecbff',
      safety: 'gloves', fact: 'Used masks can carry germs. Wear gloves or use a grabber, and snip the ear loops so animals don\'t get tangled.' },
    { id: 'glass', name: 'Glass Gremlin', item: 'Glass bottle or jar', emoji: '🍾', rarity: 'rare', points: 25, color: '#6fdc8c',
      safety: 'adult', fact: 'Glass Gremlins can be sharp! Grown-ups only. Kids: point and shout "Grown-up, I found a Glass Gremlin!"' },
    { id: 'mystery', name: 'Mystery Mimic', item: 'Mystery item (anything else!)', emoji: '❓', rarity: 'legendary', points: 30, color: '#ff7ad9',
      fact: 'Mystery Mimics can look like anything: a lost toy, a shoe, a strange gadget. If it looks sharp or weird, tell a grown-up!' }
  ];

  const RARITY = {
    common: { label: 'Common', color: '#3ddc97', stars: 1 },
    uncommon: { label: 'Uncommon', color: '#4dabf7', stars: 2 },
    rare: { label: 'Rare', color: '#b26bff', stars: 3 },
    legendary: { label: 'Legendary', color: '#ff9f1c', stars: 4 }
  };

  let uid = 0;
  function svg(id, cls) {
    const fn = ART[id] || ART.mystery;
    // make gradient ids unique per instance
    const n = ++uid;
    const body = fn().replace(/id="rb"/g, 'id="rb' + n + '"').replace(/url\(#rb\)/g, 'url(#rb' + n + ')');
    return '<svg class="creature-svg ' + (cls || '') + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
  }

  window.LM_CREATURES = CREATURES;
  window.LM_RARITY = RARITY;
  window.lmCreatureSvg = svg;
  window.lmCreature = function (id) { return CREATURES.find(function (c) { return c.id === id; }); };
})();
