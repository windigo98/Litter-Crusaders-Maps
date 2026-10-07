/* Litter Crusaders Maps — Park Bosses: big cleanup challenges that appear when an area
   gets busy with litter catches. Tone is fun & non-violent ("send packing"). */
(function () {
  'use strict';

  function face(cx, cy, gap, r, opts) {
    opts = opts || {};
    const lx = cx - gap / 2, rx = cx + gap / 2, pr = r * 0.55, look = opts.look || 0.2;
    let s = '';
    [lx, rx].forEach(function (x) {
      s += '<circle cx="' + x + '" cy="' + cy + '" r="' + r + '" fill="#fff" stroke="#2b2b3a" stroke-width="1.8"/>';
      s += '<circle cx="' + (x + r * look) + '" cy="' + (cy + r * 0.1) + '" r="' + pr + '" fill="#2b2b3a"/>';
      s += '<circle cx="' + (x + r * look + pr * 0.35) + '" cy="' + (cy - pr * 0.35) + '" r="' + pr * 0.35 + '" fill="#fff"/>';
    });
    s += '<ellipse cx="' + (lx - r * 0.55) + '" cy="' + (cy + r * 1.45) + '" rx="' + r * 0.55 + '" ry="' + r * 0.32 + '" fill="#ff7aa8" opacity=".5"/>';
    s += '<ellipse cx="' + (rx + r * 0.55) + '" cy="' + (cy + r * 1.45) + '" rx="' + r * 0.55 + '" ry="' + r * 0.32 + '" fill="#ff7aa8" opacity=".5"/>';
    if (opts.mouth === 'grin') {
      s += '<path d="M' + (cx - gap * 0.35) + ' ' + (cy + r * 1.4) + ' Q' + cx + ' ' + (cy + r * 2.4) + ' ' + (cx + gap * 0.35) + ' ' + (cy + r * 1.4) + '" fill="#2b2b3a"/>';
      s += '<path d="M' + (cx - gap * 0.22) + ' ' + (cy + r * 1.55) + ' Q' + cx + ' ' + (cy + r * 2.05) + ' ' + (cx + gap * 0.22) + ' ' + (cy + r * 1.55) + '" fill="#ff7aa8"/>';
    } else {
      s += '<ellipse cx="' + cx + '" cy="' + (cy + r * 1.55) + '" rx="' + gap * 0.18 + '" ry="' + gap * 0.14 + '" fill="#2b2b3a"/>';
    }
    return s;
  }
  const OUT = 'stroke="#2b2b3a" stroke-width="2.6" stroke-linejoin="round"';

  const ART = {
    park_pest: function () {
      return '<ellipse cx="50" cy="88" rx="28" ry="6" fill="#000" opacity=".12"/>' +
        '<ellipse cx="22" cy="62" rx="10" ry="14" fill="#8b5e3c" ' + OUT + ' transform="rotate(-25 22 62)"/>' +
        '<ellipse cx="78" cy="62" rx="10" ry="14" fill="#8b5e3c" ' + OUT + ' transform="rotate(25 78 62)"/>' +
        '<ellipse cx="50" cy="58" rx="34" ry="28" fill="#a67c52" ' + OUT + '/>' +
        '<ellipse cx="50" cy="40" rx="26" ry="22" fill="#c49a6c" ' + OUT + '/>' +
        '<path d="M34 28 q-4 -14 0 -18 M50 24 q0 -16 4 -20 M66 28 q4 -14 0 -18" stroke="#2b2b3a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<circle cx="34" cy="10" r="4" fill="#6b4423"/><circle cx="54" cy="4" r="4" fill="#6b4423"/><circle cx="66" cy="10" r="4" fill="#6b4423"/>' +
        '<path d="M40 70 h20 v10 q0 6 -10 6 t-10 -6z" fill="#5c4033" ' + OUT + '/>' +
        '<rect x="58" y="48" width="14" height="10" rx="2" fill="#ff5c8a" ' + OUT + '/>' +
        face(50, 40, 20, 6, { mouth: 'grin' });
    },
    trash_titan: function () {
      return '<ellipse cx="50" cy="90" rx="32" ry="6" fill="#000" opacity=".12"/>' +
        '<rect x="18" y="28" width="64" height="54" rx="10" fill="#6b7280" ' + OUT + '/>' +
        '<rect x="24" y="34" width="52" height="20" fill="#9ca3af"/>' +
        '<path d="M30 18 h40 l6 12 h-52z" fill="#22c55e" ' + OUT + '/>' +
        '<rect x="42" y="8" width="16" height="12" rx="3" fill="#16a34a" ' + OUT + '/>' +
        '<text x="50" y="50" text-anchor="middle" font-size="14" font-weight="900" font-family="system-ui" fill="#fff">♻️</text>' +
        '<circle cx="28" cy="70" r="8" fill="#ff5f57" ' + OUT + '/><circle cx="72" cy="70" r="8" fill="#8fd8ff" ' + OUT + '/>' +
        '<path d="M14 48 q-8 4 -8 14 q0 10 8 10" fill="#9ca3af" ' + OUT + '/><path d="M86 48 q8 4 8 14 q0 10 -8 10" fill="#9ca3af" ' + OUT + '/>' +
        face(50, 58, 22, 6.5, { mouth: 'grin' });
    },
    beach_blob: function () {
      return '<ellipse cx="50" cy="90" rx="34" ry="6" fill="#000" opacity=".12"/>' +
        '<path d="M18 70 q-6 -30 14 -48 q12 -14 36 -10 q22 6 28 34 q4 22 -10 36 q-12 12 -30 8 q-20 -4 -28 -20z" fill="#5eead4" ' + OUT + '/>' +
        '<path d="M30 78 q10 8 24 4 q14 -2 22 -12" fill="#2dd4bf" opacity=".7"/>' +
        '<path d="M70 34 q10 -8 18 -2" stroke="#99f6e4" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<circle cx="24" cy="48" r="5" fill="#fef08a" ' + OUT + '/><circle cx="78" cy="58" r="4" fill="#fda4af" ' + OUT + '/>' +
        '<path d="M42 22 q4 -14 12 -10" stroke="#2b2b3a" stroke-width="2.4" fill="none"/><circle cx="56" cy="12" r="5" fill="#f472b6" ' + OUT + '/>' +
        face(48, 52, 22, 7, { mouth: 'grin' });
    },
    playground_pile: function () {
      return '<ellipse cx="50" cy="90" rx="30" ry="6" fill="#000" opacity=".12"/>' +
        '<ellipse cx="34" cy="70" rx="22" ry="16" fill="#c77dff" ' + OUT + '/>' +
        '<ellipse cx="66" cy="68" rx="20" ry="15" fill="#ffe08a" ' + OUT + '/>' +
        '<ellipse cx="50" cy="52" rx="24" ry="18" fill="#ff4d8d" ' + OUT + '/>' +
        '<rect x="40" y="22" width="20" height="28" rx="4" fill="#8fd8ff" ' + OUT + '/>' +
        '<circle cx="50" cy="18" r="10" fill="#ffd23f" ' + OUT + '/>' +
        '<path d="M20 58 q-8 2 -10 12 M80 56 q10 4 12 14" stroke="#2b2b3a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        face(50, 50, 18, 5.5, { mouth: 'grin' });
    },
    picnic_phantom: function () {
      return '<ellipse cx="50" cy="92" rx="26" ry="5" fill="#000" opacity=".1"/>' +
        '<path d="M28 30 q22 -20 44 0 l6 40 q-8 14 -14 4 q-6 12 -14 4 q-6 12 -14 4 q-8 10 -14 4z" fill="#f8fafc" ' + OUT + ' opacity=".95"/>' +
        '<path d="M34 38 q16 -8 32 0" stroke="#e2e8f0" stroke-width="3" fill="none"/>' +
        '<rect x="38" y="48" width="24" height="14" rx="3" fill="#fb923c" ' + OUT + '/>' +
        '<circle cx="44" cy="22" r="3" fill="#fbbf24"/><circle cx="56" cy="18" r="2.5" fill="#f472b6"/><circle cx="64" cy="26" r="2" fill="#60a5fa"/>' +
        face(50, 40, 18, 5.5, { mouth: 'o' });
    },
    street_scourge: function () {
      return '<ellipse cx="50" cy="90" rx="30" ry="6" fill="#000" opacity=".12"/>' +
        '<path d="M20 70 q-4 -28 12 -42 q14 -14 36 -8 q20 8 26 36 q4 20 -8 30 q-14 10 -28 4 q-18 -6 -28 -20z" fill="#78716c" ' + OUT + '/>' +
        '<rect x="30" y="48" width="40" height="18" rx="4" fill="#a8a29e"/>' +
        '<circle cx="28" cy="62" r="7" fill="#ffb26b" ' + OUT + '/><circle cx="72" cy="62" r="7" fill="#ff5d6c" ' + OUT + '/>' +
        '<path d="M36 28 q-6 -16 2 -20 M50 24 q0 -18 6 -22 M64 28 q6 -16 0 -20" stroke="#ff9f43" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<path d="M14 50 l-8 4 M86 50 l8 4" stroke="#2b2b3a" stroke-width="3" stroke-linecap="round"/>' +
        face(50, 44, 20, 6, { mouth: 'grin' });
    }
  };

  // types: null = any litter. spawnNeed = catches in the area before the boss appears.
  // hp = litter pieces (matching types) needed to send it packing. Shared across the crew.
  const BOSSES = [
    { id: 'park_pest', name: 'Park Pest', emoji: '🦝', color: '#a67c52',
      spawnNeed: 8, hp: 12, types: null, reward: 80, badge: 'boss_park_pest',
      flavor: 'Bro there\'s a raccoon made of wrappers bouncing around the park. Clean streak = it peaces out.',
      tip: 'Snag any litter nearby and that mess pile shrinks. Easy.' },
    { id: 'trash_titan', name: 'Trash Titan', emoji: '🗑️', color: '#6b7280',
      spawnNeed: 10, hp: 15, types: ['bottle', 'can', 'cup', 'paper'], reward: 120, badge: 'boss_trash_titan',
      flavor: 'Big walking bin energy. It\'s stuffed with bottles + cans — feed it recyclables and watch it chill out.',
      tip: 'Hit it with Bottle Blobs, Can Crabs, Cup Critters, or Paper Pups.' },
    { id: 'beach_blob', name: 'Beach Blob', emoji: '🫧', color: '#2dd4bf',
      spawnNeed: 8, hp: 14, types: ['bag', 'bottle', 'straw', 'cap'], reward: 100, badge: 'boss_beach_blob',
      flavor: 'Squishy bag-and-bottle blob washed up. Sea turtles would appreciate the assist — recycle that thing.',
      tip: 'Grab Bag Ghosts, Bottle Blobs, Straw Noodles, or Cap Beetles nearby.' },
    { id: 'playground_pile', name: 'Playground Pile', emoji: '🛝', color: '#ff4d8d',
      spawnNeed: 7, hp: 10, types: ['wrapper', 'cup', 'straw', 'cap'], reward: 90, badge: 'boss_playground_pile',
      flavor: 'Snack wrappers + straws threw a mini party on the playground. Sweep it so everyone can play again.',
      tip: 'Wrapper Wigglers, Cup Critters, Straw Noodles, Cap Beetles — you know the drill.' },
    { id: 'picnic_phantom', name: 'Picnic Phantom', emoji: '👻', color: '#e2e8f0',
      spawnNeed: 8, hp: 12, types: ['wrapper', 'paper', 'cup', 'bag'], reward: 95, badge: 'boss_picnic_phantom',
      flavor: 'Picnic ghost floating over the grass like it owns the place. Bin the leftovers and it peaces out happy.',
      tip: 'Wrappers, paper, cups, bags near it — bag \'em.' },
    { id: 'street_scourge', name: 'Street Sweep Scourge', emoji: '🧹', color: '#78716c',
      spawnNeed: 10, hp: 16, types: ['butt', 'cap', 'can', 'wrapper'], reward: 130, badge: 'boss_street_scourge',
      flavor: 'Grumpy sidewalk pile blocking the path. Gloves on — sweep that mess into the bin.',
      tip: 'Butt Bugs (gloves!), Cap Beetles, Can Crabs, wrappers. Grown-up helper? Even better.' }
  ];

  let uid = 0;
  function svg(id, cls) {
    const fn = ART[id] || ART.park_pest;
    const body = fn();
    return '<svg class="boss-svg ' + (cls || '') + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
  }

  window.LM_BOSSES = BOSSES;
  window.lmBossSvg = svg;
  window.lmBoss = function (id) { return BOSSES.find(function (b) { return b.id === id; }); };
})();
