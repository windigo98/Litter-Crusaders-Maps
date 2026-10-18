/* Litter Crusaders Maps — Closet, coin Shop and Trophy Room, plus the shared Crusader look renderer.
   Coins are free to earn only (cleanups, dungeon runs, goals). No real money, no ads. Everything lives on the profile as plain JSON:
   profile.wallet {coins, earned, spent, day}, profile.closet {owned:{id:ts}, equipped:{slot:id}}, profile.records, profile.trophies. */
(function () {
  'use strict';
  const G = window.LMGame, SND = window.LMSound;
  const $ = function (s) { return document.querySelector(s); };
  const esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const snd = function (n) { if (SND) SND.play(n); };
  let H = null; // host hooks from app.js: {me, save, refresh, confetti}

  // ---------- shared sprite cache (SVG creature art -> small canvases) ----------
  const sprites = {};
  function sprite(id, svgStr, size) {
    if (sprites[id]) return sprites[id];
    const c = document.createElement('canvas'); c.width = c.height = size; c.ok = false; sprites[id] = c;
    const im = new Image();
    im.onload = function () { c.getContext('2d').drawImage(im, 0, 0, size, size); c.ok = true; if (c.onready) c.onready(); };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr.replace('<svg ', '<svg width="' + size + '" height="' + size + '" '));
    return c;
  }

  // ---------- catalog. price = shop item; prize = earned only (trophy id hint); premium = pricier cosmetic ----------
  const SLOTS = [['hair', '💇 Hair'], ['outfit', '👕 Outfits & skins'], ['trail', '✨ Trails'], ['perk', '⚡ Dungeon perks'], ['buddy', '🐾 Critter buddy']];
  const ITEMS = [
    { id: 'hair_cap', slot: 'hair', icon: '🧢', name: 'Crusader Cap', price: 0 },
    { id: 'hair_bob', slot: 'hair', icon: '💇', name: 'Bob Cut', price: 60, c: '#7c4a1e' },
    { id: 'hair_spikes', slot: 'hair', icon: '🔥', name: 'Spiky Do', price: 70, c: '#f59e0b' },
    { id: 'hair_bun', slot: 'hair', icon: '🍙', name: 'Top Bun', price: 70, c: '#2b2b3a' },
    { id: 'hair_curls', slot: 'hair', icon: '🌀', name: 'Big Curls', price: 90, c: '#5b3a8c' },
    { id: 'hair_rainbow', slot: 'hair', icon: '🌈', name: 'Rainbow Hair', price: 300, premium: true },
    { id: 'hair_crown', slot: 'hair', icon: '👑', name: 'Crusader Crown', prize: 'Finish 5 Litter Dungeon runs' },
    { id: 'outfit_tee', slot: 'outfit', icon: '👕', name: 'Green Tee', price: 0, body: '#22c55e', legs: '#2b4a8a', mark: '♻' },
    { id: 'outfit_sunny', slot: 'outfit', icon: '☀️', name: 'Sunny Tee', price: 60, body: '#ffd23f', legs: '#2b4a8a', mark: '☀' },
    { id: 'outfit_hoodie', slot: 'outfit', icon: '🧥', name: 'Blue Hoodie', price: 90, body: '#3b82f6', legs: '#1f2937', mark: '' },
    { id: 'outfit_overalls', slot: 'outfit', icon: '👖', name: 'Garden Overalls', price: 110, body: '#f97316', legs: '#3b6bb5', bib: '#3b6bb5', mark: '' },
    { id: 'outfit_cape', slot: 'outfit', icon: '🦸', name: 'Hero Cape', price: 150, body: '#22c55e', legs: '#2b4a8a', mark: '♻', cape: '#8b5cf6' },
    { id: 'outfit_galaxy', slot: 'outfit', icon: '🌌', name: 'Galaxy Runner Skin', price: 400, premium: true, body: '#312e81', legs: '#1e1b4b', mark: '★', cape: '#4338ca', stars: true },
    { id: 'outfit_bosscape', slot: 'outfit', icon: '🧹', name: 'Boss Tidier Cape', prize: 'Tidy 3 different park bosses', body: '#22c55e', legs: '#2b4a8a', mark: '♻', cape: '#f5b301' },
    { id: 'outfit_star', slot: 'outfit', icon: '🌟', name: 'Star Suit', prize: 'Complete 25 quests', body: '#fbbf24', legs: '#7c3aed', mark: '★', stars: true },
    { id: 'trail_none', slot: 'trail', icon: '➖', name: 'No trail', price: 0 },
    { id: 'trail_sparkle', slot: 'trail', icon: '✨', name: 'Sparkle Trail', price: 80, cols: ['#fff36b', '#ffffff', '#ffd23f'] },
    { id: 'trail_leaf', slot: 'trail', icon: '🍃', name: 'Leaf Trail', price: 90, cols: ['#4ade80', '#22c55e', '#86efac'] },
    { id: 'trail_bubble', slot: 'trail', icon: '🫧', name: 'Bubble Trail', price: 100, cols: ['#bae6fd', '#7dd3fc', '#e0f2fe'] },
    { id: 'trail_rainbow', slot: 'trail', icon: '🌈', name: 'Rainbow Trail', price: 350, premium: true, cols: ['#ff7ad9', '#ffd166', '#5ee6a8', '#6aa8ff', '#c77dff'] },
    { id: 'trail_gold', slot: 'trail', icon: '🥇', name: 'Golden Trail', prize: 'Finish a run with zero bonks', cols: ['#fbbf24', '#fde68a', '#f59e0b'] },
    { id: 'perk_none', slot: 'perk', icon: '➖', name: 'No perk', price: 0 },
    { id: 'perk_magnet', slot: 'perk', icon: '🧲', name: 'Coin Magnet', price: 150, blurb: 'Grabs coins & litter bits from the lanes next to you' },
    { id: 'perk_shield', slot: 'perk', icon: '🛡️', name: 'Bonk Shield', price: 200, blurb: 'Blocks your first bonk of each run' },
    { id: 'buddy_none', slot: 'buddy', icon: '➖', name: 'No buddy', price: 0 },
    { id: 'buddy_bottle', slot: 'buddy', icon: '🧴', name: 'Bottle Blob buddy', price: 120, cr: 'bottle' },
    { id: 'buddy_can', slot: 'buddy', icon: '🥫', name: 'Can Crab buddy', price: 120, cr: 'can' },
    { id: 'buddy_wrapper', slot: 'buddy', icon: '🍬', name: 'Wrapper Wiggler buddy', price: 120, cr: 'wrapper' },
    { id: 'buddy_paper', slot: 'buddy', icon: '📦', name: 'Paper Pup buddy', price: 130, cr: 'paper' },
    { id: 'buddy_straw', slot: 'buddy', icon: '🐍', name: 'Straw Noodle buddy', price: 160, cr: 'straw' },
    { id: 'buddy_bag', slot: 'buddy', icon: '👻', name: 'Bag Ghost buddy', price: 180, cr: 'bag' },
    { id: 'buddy_mystery', slot: 'buddy', icon: '❓', name: 'Mystery Mimic buddy', price: 450, premium: true, cr: 'mystery' },
    { id: 'buddy_cap', slot: 'buddy', icon: '🔴', name: 'Cap Beetle buddy', prize: 'Finish your first Litter Dungeon run', cr: 'cap' }
  ];
  const BY = {}; ITEMS.forEach(function (i) { BY[i.id] = i; });
  const DEFAULTS = { hair: 'hair_cap', outfit: 'outfit_tee', trail: 'trail_none', perk: 'perk_none', buddy: 'buddy_none' };

  function prof() { return G.ensureProfile(H.me()); }
  const isFree = function (it) { return it.price === 0; };
  function owns(p, id) { const it = BY[id]; return !!it && (isFree(it) || !!p.closet.owned[id]); }
  function look(p) {
    p = p || prof(); const e = p.closet.equipped, o = {};
    SLOTS.forEach(function (s) { const id = e[s[0]]; o[s[0]] = (id && BY[id] && owns(p, id)) ? id : DEFAULTS[s[0]]; });
    return o;
  }
  const balance = function () { return prof().wallet.coins; };

  // ---------- the Crusader, drawn on canvas (used by dungeon, closet previews and trophy shelf) ----------
  function ell(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, 7); c.fill(); }
  function rr(c, x, y, w, h, r, col) { c.fillStyle = col; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); }
  function hairDraw(c, id, u) {
    const hy = -u * 0.95, r = u * 0.2, it = BY[id] || {};
    if (id === 'hair_cap') { c.fillStyle = '#15803d'; c.beginPath(); c.arc(0, hy - u * 0.04, r * 1.05, Math.PI, 0); c.fill(); rr(c, -u * 0.05, hy - u * 0.06, u * 0.3, u * 0.06, 3, '#15803d'); return; }
    if (id === 'hair_bob') { c.fillStyle = it.c; c.beginPath(); c.arc(0, hy - u * 0.02, r * 1.08, Math.PI, 0); c.fill(); rr(c, -r * 1.1, hy - u * 0.04, r * 0.5, r * 1.5, u * 0.06, it.c); rr(c, r * 0.6, hy - u * 0.04, r * 0.5, r * 1.5, u * 0.06, it.c); return; }
    if (id === 'hair_spikes') { c.fillStyle = it.c; c.beginPath(); c.arc(0, hy - u * 0.03, r * 1.05, Math.PI, 0); c.fill(); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * r * 0.42 - r * 0.22, hy - r * 0.8); c.lineTo(i * r * 0.42, hy - r * 1.9 + Math.abs(i) * r * 0.2); c.lineTo(i * r * 0.42 + r * 0.22, hy - r * 0.8); c.fill(); } return; }
    if (id === 'hair_bun') { c.fillStyle = it.c; c.beginPath(); c.arc(0, hy - u * 0.03, r * 1.05, Math.PI, 0); c.fill(); ell(c, 0, hy - r * 1.35, r * 0.5, r * 0.5, it.c); return; }
    if (id === 'hair_curls') { for (let i = -2; i <= 2; i++) ell(c, i * r * 0.5, hy - r * (0.85 + (i % 2 ? 0.1 : 0.25)) + Math.abs(i) * r * 0.12, r * 0.42, r * 0.42, it.c); ell(c, -r * 1.0, hy + r * 0.1, r * 0.35, r * 0.35, it.c); ell(c, r * 1.0, hy + r * 0.1, r * 0.35, r * 0.35, it.c); return; }
    if (id === 'hair_rainbow') { const cols = ['#ff7ad9', '#ffd166', '#5ee6a8', '#6aa8ff', '#c77dff']; for (let i = 0; i < 5; i++) { c.fillStyle = cols[i]; c.beginPath(); c.arc(0, hy - u * 0.03, r * (1.12 - i * 0.05), Math.PI + i * Math.PI / 5, Math.PI + (i + 1) * Math.PI / 5); c.lineTo(0, hy - u * 0.03); c.fill(); } return; }
    if (id === 'hair_crown') { c.fillStyle = '#7c4a1e'; c.beginPath(); c.arc(0, hy - u * 0.02, r * 1.05, Math.PI, 0); c.fill(); c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(-r * 0.9, hy - r * 0.7); c.lineTo(-r * 0.9, hy - r * 1.6); c.lineTo(-r * 0.45, hy - r * 1.1); c.lineTo(0, hy - r * 1.8); c.lineTo(r * 0.45, hy - r * 1.1); c.lineTo(r * 0.9, hy - r * 1.6); c.lineTo(r * 0.9, hy - r * 0.7); c.fill(); }
  }
  // o: {t (time), sl (sliding), jump (airborne), buddy (draw critter buddy), bside (+1 right / -1 left), shield}
  function draw(c, x, y, u, lk, o) {
    o = o || {}; const out = BY[lk.outfit] || BY.outfit_tee, run = (o.t || 0) * 15, sw = o.sl || o.jump ? 0 : Math.sin(run) * u * 0.1;
    c.save(); c.translate(x, y); if (o.sl) c.scale(1.15, 0.5);
    if (out.cape) { c.fillStyle = out.cape; c.beginPath(); c.moveTo(-u * 0.2, -u * 0.78); c.lineTo(u * 0.2, -u * 0.78); c.lineTo(u * 0.3 + Math.sin(run * 0.5) * u * 0.04, -u * 0.18); c.lineTo(-u * 0.3 - Math.sin(run * 0.5) * u * 0.04, -u * 0.18); c.fill(); }
    rr(c, -u * 0.17, -u * 0.36, u * 0.14, u * 0.36 + sw, u * 0.05, out.legs); rr(c, u * 0.03, -u * 0.36, u * 0.14, u * 0.36 - sw, u * 0.05, out.legs);
    rr(c, -u * 0.24, -u * 0.8, u * 0.48, u * 0.46, u * 0.12, out.body);
    if (out.bib) rr(c, -u * 0.16, -u * 0.58, u * 0.32, u * 0.28, u * 0.05, out.bib);
    if (out.stars) { c.fillStyle = 'rgba(255,255,255,.85)'; [[-0.14, -0.7], [0.15, -0.62], [-0.08, -0.45], [0.12, -0.42]].forEach(function (p) { c.fillRect(p[0] * u, p[1] * u, u * 0.03, u * 0.03); }); }
    if (out.mark) { ell(c, 0, -u * 0.58, u * 0.1, u * 0.1, '#fff'); c.fillStyle = out.body === '#ffd23f' || out.body === '#fbbf24' ? '#b45309' : '#16a34a'; c.font = '900 ' + u * 0.15 + 'px system-ui'; c.textAlign = 'center'; c.fillText(out.mark, 0, -u * 0.53); }
    ell(c, -u * 0.3, -u * 0.55 + sw, u * 0.09, u * 0.09, '#ffd23f'); ell(c, u * 0.3, -u * 0.55 - sw, u * 0.09, u * 0.09, '#ffd23f');
    ell(c, 0, -u * 0.95, u * 0.2, u * 0.2, '#ffd6a5');
    ell(c, -u * 0.07, -u * 0.93, u * 0.025, u * 0.03, '#2b2b3a'); ell(c, u * 0.07, -u * 0.93, u * 0.025, u * 0.03, '#2b2b3a');
    c.strokeStyle = '#2b2b3a'; c.lineWidth = Math.max(1, u * 0.02); c.beginPath(); c.arc(0, -u * 0.88, u * 0.06, 0.2, Math.PI - 0.2); c.stroke();
    hairDraw(c, lk.hair, u);
    c.restore();
    if (o.shield) { c.save(); c.globalAlpha = 0.35 + Math.sin((o.t || 0) * 6) * 0.08; ell(c, x, y - u * 0.55, u * 0.52, u * 0.62, '#7dd3fc'); c.restore(); }
    const bd = BY[lk.buddy];
    if (o.buddy !== false && bd && bd.cr) {
      const sp = sprite(bd.cr, window.lmCreatureSvg(bd.cr), 150), bs = u * 0.5, bx = x + (o.bside || 1) * u * 0.66, hop = Math.abs(Math.sin((o.t || 0) * 9)) * u * 0.1 * (o.sl ? 0 : 1);
      ell(c, bx, y, bs * 0.4, bs * 0.08, 'rgba(0,0,0,.2)'); if (sp.ok) c.drawImage(sp, bx - bs / 2, y - bs * 0.98 - hop, bs, bs);
    }
  }
  // preview into a <canvas>
  function paint(cv, lk, bigU) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth || +cv.dataset.w || 90, h = cv.clientHeight || +cv.dataset.h || 110;
    cv.width = w * dpr; cv.height = h * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const u = bigU || Math.min(w / 1.3, h / 1.35);
    draw(c, w * (lk.buddy !== 'buddy_none' ? 0.4 : 0.5), h - 6, u, lk, { t: 0 });
    const bd = BY[lk.buddy]; if (bd && bd.cr) { const sp = sprite(bd.cr, window.lmCreatureSvg(bd.cr), 150); if (!sp.ok) sp.onready = function () { paint(cv, lk, bigU); }; }
  }
  function paintAll(root) {
    root.querySelectorAll('canvas[data-look]').forEach(function (cv) {
      const lk = JSON.parse(cv.dataset.look); paint(cv, lk, cv.dataset.u ? +cv.dataset.u : 0);
    });
  }
  const lookWith = function (lk, it) { const o = Object.assign({}, lk); o[it.slot] = it.id; return o; };
  const cvHtml = function (lk, w, h, u) { return '<canvas class="lk-cv" data-look=\'' + JSON.stringify(lk) + '\' data-w="' + w + '" data-h="' + h + '"' + (u ? ' data-u="' + u + '"' : '') + ' style="width:' + w + 'px;height:' + h + 'px"></canvas>'; };

  // ---------- Closet sheet (Wardrobe + Shop) ----------
  let tab = 'wardrobe', confirmId = null;
  function pill() { return '🪙 ' + balance(); }
  function openCloset(which) {
    tab = which || tab; confirmId = null; $('#closetSheet').classList.remove('hidden'); renderCloset();
  }
  function afford(it) { return balance() >= it.price; }
  function priceTag(p, it) {
    if (owns(p, it.id)) return '<span class="sh-own">' + (look(p)[it.slot] === it.id ? 'Equipped ✓' : 'Owned · Equip') + '</span>';
    if (it.prize) return '<span class="sh-prize">🏆 Prize</span>';
    return '<span class="sh-price ' + (afford(it) ? 'ok' : 'no') + '">🪙 ' + it.price + '</span>';
  }
  function renderCloset() {
    const p = prof(), lk = look(p); $('#clCoins').textContent = pill();
    let h = '<div class="cl-tabs"><button class="seg' + (tab === 'wardrobe' ? ' active' : '') + '" data-tab="wardrobe">👕 Wardrobe</button><button class="seg' + (tab === 'shop' ? ' active' : '') + '" data-tab="shop">🛍️ Shop</button></div>';
    if (confirmId) {
      const it = BY[confirmId];
      h = '<div class="cl-confirm"><div class="cl-prev">' + cvHtml(lookWith(lk, it), 150, 190) + '</div><h3>Buy ' + esc(it.name) + '?</h3><p>It costs <b>🪙 ' + it.price + '</b>. You\'ll have <b>🪙 ' + (balance() - it.price) + '</b> left. No real money, ever.</p>' +
        '<div class="act-actions"><button class="big-btn secondary small" id="clNo">Not now</button><button class="big-btn small" id="clYes">Buy 🪙 ' + it.price + '</button></div></div>';
    } else if (tab === 'wardrobe') {
      h += '<div class="cl-prev">' + cvHtml(lk, 170, 210) + '</div>';
      SLOTS.forEach(function (s) {
        const mine = ITEMS.filter(function (i) { return i.slot === s[0] && owns(p, i.id); });
        h += '<div class="cl-slot"><b>' + s[1] + '</b><div class="cl-chips">' + mine.map(function (i) { return '<button class="cl-chip' + (lk[s[0]] === i.id ? ' sel' : '') + '" data-eq="' + i.id + '"><span>' + i.icon + '</span>' + esc(i.name) + '</button>'; }).join('') + '</div></div>';
      });
      h += '<p class="small-print">Earn 🪙 by cleaning up real litter, finishing Litter Dungeon runs and completing quests. Prize-only gear comes from trophies.</p>';
    } else {
      h += '<p class="small-print" style="margin:4px 2px 8px">🪙 coins are free to earn. Tap an item to buy it. Prize items (🏆) can only be won in the Trophy Room.</p>';
      SLOTS.forEach(function (s) {
        h += '<div class="cl-slot"><b>' + s[1] + '</b></div><div class="shop-grid">';
        ITEMS.filter(function (i) { return i.slot === s[0] && !isFree(i); }).forEach(function (i) {
          const vis = (i.slot === 'hair' || i.slot === 'outfit' || i.slot === 'buddy') ? cvHtml(lookWith(lk, i), 84, 104) : '<div class="sh-ico">' + i.icon + '</div>';
          h += '<button class="shop-card' + (i.premium ? ' premium' : '') + (owns(p, i.id) ? ' owned' : '') + (!owns(p, i.id) && (i.prize || !afford(i)) ? ' locked' : '') + '" data-item="' + i.id + '">' +
            (i.premium ? '<span class="sh-badge">✨ Premium</span>' : '') + vis + '<div class="sh-name">' + esc(i.name) + '</div>' +
            (i.blurb ? '<div class="sh-blurb">' + esc(i.blurb) + '</div>' : '') + (i.prize && !owns(p, i.id) ? '<div class="sh-blurb">' + esc(i.prize) + '</div>' : '') + priceTag(p, i) + '</button>';
        });
        h += '</div>';
      });
    }
    $('#closetBody').innerHTML = h; paintAll($('#closetBody'));
    $('#closetBody').querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { tab = b.dataset.tab; renderCloset(); }); });
    $('#closetBody').querySelectorAll('[data-eq]').forEach(function (b) { b.addEventListener('click', function () { equip(b.dataset.eq); }); });
    $('#closetBody').querySelectorAll('[data-item]').forEach(function (b) { b.addEventListener('click', function () { tapItem(b.dataset.item); }); });
    const no = $('#clNo'), yes = $('#clYes');
    if (no) no.addEventListener('click', function () { confirmId = null; renderCloset(); });
    if (yes) yes.addEventListener('click', function () { buy(confirmId); });
  }
  function equip(id) {
    const p = prof(), it = BY[id]; if (!it || !owns(p, id)) return;
    p.closet.equipped[it.slot] = id; H.save(); snd('tab'); renderCloset(); H.refresh();
  }
  function tapItem(id) {
    const p = prof(), it = BY[id];
    if (owns(p, id)) { equip(id); return; }
    if (it.prize) { H.toast('🏆 Prize only: ' + it.prize); return; }
    if (!afford(it)) { H.toast('Need 🪙 ' + (it.price - balance()) + ' more. Clean up or run the dungeon to earn some!'); snd('warn'); return; }
    confirmId = id; renderCloset();
  }
  function buy(id) {
    const p = prof(), it = BY[id];
    if (!it || owns(p, id) || it.prize || !G.spendCoins(p, it.price)) { confirmId = null; renderCloset(); return; }
    p.closet.owned[id] = Date.now(); p.closet.equipped[it.slot] = id; H.save(); confirmId = null;
    snd('buy'); renderCloset(); H.refresh(); celebrateItem(it, '🛍️ Fresh gear!', 'Bought for 🪙 ' + it.price + '. Equipped and ready to go.');
  }
  function celebrateItem(it, title, desc) {
    const el = $('#celebrate'); el.classList.remove('boss-mode', 'ispy-mode', 'room-mode'); el.classList.add('badge-mode');
    $('#celCreature').innerHTML = '<div class="cel-look">' + cvHtml(look(), 150, 190) + '</div>';
    $('#celTitle').textContent = title; $('#celName').textContent = it.name; $('#celDesc').textContent = desc; $('#celDesc').classList.remove('hidden');
    $('#celPoints').textContent = '🪙 ' + balance() + ' left'; $('#celPoints').classList.remove('hidden');
    $('#celExtras').innerHTML = '<div class="cel-extra fact" style="animation-delay:.4s"><span class="e-ico">' + it.icon + '</span><span>Change your look any time in the Closet.</span></div>';
    el.classList.remove('hidden'); paintAll($('#celCreature')); if (H.confetti) H.confetti();
  }

  // ---------- Trophy Room ----------
  function tile(icon, name, hint, got, extra) {
    return '<div class="tr-tile' + (got ? ' got' : '') + '"><div class="tr-ico"><span>' + icon + '</span></div><div class="tr-name">' + esc(got ? name : '???') + '</div><div class="tr-hint">' + esc(hint) + '</div>' + (extra || '') + '</div>';
  }
  function openTrophies() {
    const p = prof(), s = H.stats(), lk = look(p), rec = p.records, d = p.dungeon || { runs: 0 };
    let h = '<div class="tr-hero"><div class="tr-me">' + cvHtml(lk, 130, 165) + '<div class="tr-plank"></div></div><div class="tr-who"><div class="tr-name2"><span class="avatar">' + esc(p.avatar) + '</span> ' + esc(p.name) + '</div>' +
      '<div class="lv">Level ' + s.level.level + ' · ' + esc(s.level.title) + '</div><div class="tr-coins">🪙 ' + p.wallet.coins + '</div>' +
      '<button class="big-btn secondary small" id="trCloset">👕 Closet & Shop</button></div></div>';
    h += '<div class="tr-sec">📊 Dungeon records</div><div class="dg-stats tr-rec"><div><b>' + Math.round(rec.bestDist) + 'm</b>best distance</div><div><b>' + Math.round(rec.longestClean) + 'm</b>longest no-bonk</div><div><b>' + rec.bestCoins + '</b>most coins in a run</div>' +
      '<div><b>' + d.runs + '</b>runs finished</div><div><b>' + s.goals + '</b>goals completed</div><div><b>' + rec.tidiedTotal + '</b>critters tidied</div></div>';
    const cats = []; G.TROPHIES.forEach(function (t) { if (cats.indexOf(t.cat) < 0) cats.push(t.cat); });
    cats.forEach(function (cat) {
      h += '<div class="tr-sec">' + (cat === 'Litter Dungeon' ? '🏃' : '📜') + ' ' + esc(cat) + '</div><div class="tr-shelf">' + G.TROPHIES.filter(function (t) { return t.cat === cat; }).map(function (t) {
        return tile(t.icon, t.name, t.desc, !!p.trophies[t.id], t.prize ? '<div class="tr-prize">🎁 ' + (p.trophies[t.id] ? 'Won: ' : 'Prize: ') + esc(BY[t.prize].name) + '</div>' : '');
      }).join('') + '</div>';
    });
    h += '<div class="tr-sec">🦝 Park boss wins</div><div class="tr-shelf">' + G.BOSSES.map(function (b) {
      const got = Object.keys(p.claims || {}).some(function (k) { return k.indexOf('b:') === 0 && p.claims[k].bossId === b.id; });
      return tile(b.emoji, b.name, 'Clean up the ' + b.name, got);
    }).join('') + '</div>';
    h += '<div class="tr-sec">💎 Rare cosmetic prizes</div><div class="tr-shelf">' + ITEMS.filter(function (i) { return i.prize; }).map(function (i) { return tile(i.icon, i.name, i.prize, owns(p, i.id)); }).join('') + '</div>';
    const bs = G.BADGES, got = bs.filter(function (b) { return p.badges[b.id]; });
    h += '<div class="tr-sec">🏅 Badges <small>' + got.length + ' / ' + bs.length + '</small></div><div class="tr-shelf small">' + bs.map(function (b) { return tile(b.icon, b.name, b.desc, !!p.badges[b.id]); }).join('') + '</div>';
    h += '<p class="small-print">Locked trophies show a hint. Keep cleaning, crusader!</p>';
    $('#trophyBody').innerHTML = h; paintAll($('#trophyBody')); $('#trophySheet').classList.remove('hidden');
    $('#trCloset').addEventListener('click', function () { $('#trophySheet').classList.add('hidden'); openCloset('wardrobe'); });
  }

  function init(host) {
    H = host;
    $('#clTrophy').addEventListener('click', function () { $('#closetSheet').classList.add('hidden'); openTrophies(); });
    $('#closetSheet').addEventListener('click', function (e) { if (e.target.id === 'closetSheet') e.currentTarget.classList.add('hidden'); });
    $('#trophySheet').addEventListener('click', function (e) { if (e.target.id === 'trophySheet') e.currentTarget.classList.add('hidden'); });
  }

  window.LMLook = { sprite: sprite, sprites: sprites, draw: draw, paint: paint, paintAll: paintAll, current: look, item: function (id) { return BY[id]; }, cvHtml: cvHtml };
  window.LMCloset = { init: init, openCloset: openCloset, openTrophies: openTrophies, balance: balance, look: look, celebrateItem: celebrateItem, item: function (id) { return BY[id]; }, ITEMS: ITEMS };
})();
