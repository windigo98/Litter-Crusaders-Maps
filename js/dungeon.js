/* Litter Crusaders Maps — Litter Dungeon: a 3-lane endless-runner mini game (no GPS, no network, no assets).
   Swipe left/right = change lane, up = jump, down = slide (arrow keys / WASD on desktop).
   Canvas at devicePixelRatio, requestAnimationFrame + fixed 120 Hz sim step, input applied the instant a touch moves 20 px.
   Friendly: critters get tidied up (bonus), nobody gets hurt. Rewards are handed to LMDungeonHost (app.js). */
(function () {
  'use strict';
  const C = window.LM_CREATURES, SND = window.LMSound;
  const STEP = 1 / 120, VIEW = 70, GOAL = 800, FIN_T = 14, MAX_BONKS = 3, SWIPE = 20, BOSS_D = 28;
  const POOL = C.filter(function (c) { return c.id !== 'glass'; }); // sharp stuff stays out of the game
  const BOSS_IDS = (window.LM_BOSSES || []).map(function (b) { return b.id; });
  const $ = function (s) { return document.querySelector(s); };
  const snd = function (n) { if (SND) SND.play(n); };
  const rnd = Math.random, pickOf = function (a) { return a[Math.floor(rnd() * a.length)]; };

  let wallet0 = 0, safeT = 0, root, cv, ctx, bg, W = 0, H = 0, dpr = 1, hy, by, LW, S = null, raf = 0, last = 0, acc = 0, active = false;
  const sprites = window.LMLook.sprites, sprite = window.LMLook.sprite;
  const perf = { ft: new Float32Array(900), wt: new Float32Array(900), n: 0 };

  // ---------- sprites (pre-rasterised from the existing SVG art; shared with the Closet) ----------
  const crit = function (id) { return sprite(id, window.lmCreatureSvg(id), 150); };
  const bossSp = function (id) { return sprite('boss:' + id, window.lmBossSvg(id), 240); };

  // ---------- layout / background ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden'; document.body.appendChild(probe); safeT = probe.offsetHeight; probe.remove();
    hy = H * 0.3; by = H * 0.8; LW = Math.min(W * 0.27, 130);
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const g = bg.getContext('2d'); g.scale(dpr, dpr);
    let gr = g.createLinearGradient(0, 0, 0, hy); gr.addColorStop(0, '#7dd3fc'); gr.addColorStop(1, '#e0f7ff');
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 1);
    g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(W * 0.8, hy * 0.45, 26, 0, 7); g.fill();
    g.fillStyle = '#a7e8b5'; g.beginPath(); g.moveTo(0, hy); g.quadraticCurveTo(W * 0.25, hy - 48, W * 0.5, hy); g.quadraticCurveTo(W * 0.78, hy - 40, W, hy); g.fill();
    gr = g.createLinearGradient(0, hy, 0, H); gr.addColorStop(0, '#6fd36f'); gr.addColorStop(1, '#2fa84f');
    g.fillStyle = gr; g.fillRect(0, hy, W, H - hy);
  }
  const sc = function (d) { return 1 / (1 + d * 0.085); };
  const X = function (lane, s) { return W / 2 + lane * LW * s; };
  const Y = function (s) { return hy + (by - hy) * s; };

  // ---------- run state ----------
  function newRun() {
    const known = (window.LMDungeonHost && window.LMDungeonHost.known()) || {};
    const fresh = POOL.filter(function (c) { return !known[c.id]; }).map(function (c) { return c.id; });
    const ids = POOL.map(function (c) { return c.id; });
    ids.forEach(crit);
    const boss = pickOf(BOSS_IDS); bossSp(boss);
    const lk = window.LMLook.current(); if (lk.buddy !== 'buddy_none') window.LMLook.item(lk.buddy) && crit(window.LMLook.item(lk.buddy).cr);
    const lead = pickOf(ids.filter(function (i) { return ['bag', 'mystery'].indexOf(i) < 0; }));
    return {
      t: 0, dist: 0, v: 9, mul: 1, lane: 0, px: 0, jh: 0, jv: 0, jbuf: 0, slide: 0, fall: false, inv: 0, shake: 0, lives: MAX_BONKS,
      coins: 0, bits: 0, tidied: [], score: 0, objs: [], next: 38, fin: false, finT: 0, finRow: 0, finBits: 0, finGot: 0, over: false, won: false,
      look: window.LMLook.current(), shield: false, bonks: 0, lastBonk: 0, clean: 0, trailT: 0,
      boss: boss, lead: lead, fresh: fresh, ids: ids, parts: [], banner: 'Chase it! 🏃', bannerT: 2.2, pop: '', popT: 0, rows: 0, doneT: 0
    };
  }

  // ---------- actions (called straight from the touch handlers) ----------
  function laneMove(dir) {
    if (!S || S.over) return;
    const n = Math.max(-1, Math.min(1, S.lane + dir));
    if (n !== S.lane) { S.lane = n; snd('dgLane'); }
  }
  function jump() {
    if (!S || S.over) return;
    if (S.jh === 0 && S.jv === 0) { S.jv = 9; S.slide = 0; S.fall = false; snd('dgJump'); } else S.jbuf = 0.18;
  }
  function slide() {
    if (!S || S.over) return;
    if (S.jh > 0) { S.jv = -17; S.fall = true; } else { S.slide = 0.7; snd('dgSlide'); }
  }

  // ---------- spawning ----------
  function put(t, z, lane, extra) { const o = { t: t, z: z, lane: lane, h: 0, hit: false }; if (extra) for (const k in extra) o[k] = extra[k]; S.objs.push(o); return o; }
  function trail(z, lane, n, kind, h) {
    for (let i = 0; i < n; i++) { put(kind, z + i * 1.8, lane, { h: h || 0 }); if (S.fin && kind === 'bit') S.finBits++; }
  }
  function arc(z, lane, kind) { for (let i = 0; i < 5; i++) { put(kind, z - 3.6 + i * 1.8, lane, { h: Math.sin((i + 0.5) / 5 * Math.PI) * 1.15 }); if (S.fin && kind === 'bit') S.finBits++; } }
  const LOW = ['pile', 'cone', 'puddle'];
  function row(z, fin) {
    const L = [-1, 0, 1], a = pickOf(L), rest = L.filter(function (x) { return x !== a; }), b = pickOf(rest), c = rest.filter(function (x) { return x !== b; })[0];
    const calm = !fin && S.dist < 90, kind = fin ? 'bit' : (rnd() < 0.55 ? 'bit' : 'coin');
    const r = fin ? pickOf([1, 2, 3, 5, 0]) : (calm ? pickOf([0, 1, 4]) : pickOf([0, 1, 2, 3, 4, 5, 2, 4]));
    S.rows++;
    switch (r) {
      case 0: trail(z, a, 6, kind); break;
      case 1: put(pickOf(LOW), z, a); arc(z, a, kind); trail(z, b, 3, 'coin'); break;
      case 2: put(pickOf(LOW), z, a); put(pickOf(LOW), z, b); trail(z, c, 6, kind); break;
      case 3: L.forEach(function (l) { put('bar', z, l); }); trail(z + 0.5, a, 4, kind); break;
      case 4: {
        const id = pickOf(S.fresh.length && rnd() < 0.7 ? S.fresh : S.ids);
        put('crit', z, a, { id: id }); trail(z - 7, a, 4, kind); put('rowdy', z + 1, b, { id: pickOf(S.ids) }); trail(z, c, 3, 'coin');
        break;
      }
      default: put('bar', z, a); put(pickOf(LOW), z, b); trail(z, c, 5, kind);
    }
    S.objs.sort(function (p, q) { return p.z - q.z; });
  }

  // ---------- simulation ----------
  function bonk() {
    if (S.inv > 0) return;
    if (S.shield) { S.shield = false; S.inv = 1.0; S.shake = 0.15; snd('dgTidy'); pop('Shield saved you! 🛡️'); return; }
    S.bonks++; S.clean = Math.max(S.clean, S.dist - S.lastBonk); S.lastBonk = S.dist;
    S.lives--; S.inv = 1.4; S.mul = 0.55; S.shake = 0.3; snd('dgBump'); pop('Oof! 😅');
    if (S.lives <= 0) end(false);
  }
  function pop(txt) { S.pop = txt; S.popT = 0.9; }
  function sparkle(lane, col, n) {
    for (let i = 0; i < n; i++) S.parts.push({ x: X(S.px, 1), y: by - LW * 0.5, vx: (rnd() - 0.5) * 260, vy: -rnd() * 240 - 40, life: 0.6, col: col });
    if (S.parts.length > 80) S.parts.splice(0, S.parts.length - 80);
  }
  function update(dt) {
    const s = S; if (s.over && !s.won) return;
    s.t += dt;
    if (!s.over) {
      s.mul += (1 - s.mul) * Math.min(1, dt * 1.1);
      s.v = (s.fin ? 12 : Math.min(17, 9 + s.dist * 0.0095)) * s.mul;
      s.dist += s.v * dt;
      s.px += (s.lane - s.px) * Math.min(1, dt * 22);
      if (s.jh > 0 || s.jv > 0) {
        s.jv -= (s.fall ? 40 : 30) * dt; s.jh += s.jv * dt;
        if (s.jh <= 0) { s.jh = 0; s.jv = 0; if (s.fall) { s.fall = false; s.slide = 0.55; snd('dgSlide'); } else if (s.jbuf > 0) { s.jbuf = 0; jump(); } }
      }
      const tr = window.LMLook.item(s.look.trail);
      if (tr && tr.cols) { s.trailT -= dt; if (s.trailT <= 0) { s.trailT = 0.03; s.parts.push({ x: X(s.px, 1) + (rnd() - 0.5) * LW * 0.3, y: by - s.jh * LW - LW * 0.15, vx: (rnd() - 0.5) * 30, vy: 40 + rnd() * 50, g: 0, life: 0.5, col: tr.cols[(rnd() * tr.cols.length) | 0] }); } }
      if (s.jbuf > 0) s.jbuf -= dt;
      if (s.slide > 0) s.slide -= dt;
      if (s.inv > 0) s.inv -= dt;
      // spawn
      if (!s.fin) {
        const lim = Math.min(s.dist + VIEW, GOAL);
        while (s.next < lim) { row(s.next, false); s.next += 9 + s.v * 0.5; }
        if (s.dist >= GOAL) { s.fin = true; s.banner = 'Park Boss! Tidy it up 🧹'; s.bannerT = 2.6; snd('quest'); }
      } else if (s.finT < FIN_T) {
        s.finT += dt; s.finRow -= dt;
        if (s.finRow <= 0) { row(s.dist + BOSS_D, true); s.finRow = 0.95; }
      } else if (s.objs.length === 0 || s.objs[s.objs.length - 1].z < s.dist - 1) { end(true); }
      // collide
      for (let i = 0; i < s.objs.length; i++) {
        const o = s.objs[i]; if (o.hit) continue;
        const dz = o.z - s.dist; if (dz > 0.7) break; if (dz < -0.7) continue;
        const t = o.t, reach = (t === 'coin' || t === 'bit') ? (S.look.perk === 'perk_magnet' ? 1.55 : 0.62) : t === 'crit' ? 0.62 : 0.42; // obstacles are a little forgiving
        if (Math.abs(o.lane - s.px) > reach) continue;
        if (t === 'coin' || t === 'bit') {
          if (Math.abs(s.jh - o.h) > 0.9) continue;
          o.hit = true; if (t === 'coin') { s.coins++; s.score += 1; } else { s.bits++; s.score += 2; if (s.fin) s.finGot++; }
          snd('dgCoin'); sparkle(o.lane, t === 'coin' ? '#ffd23f' : '#4ade80', 4);
        } else if (t === 'crit') {
          if (s.jh > 1.0) continue;
          o.hit = true; s.score += 8; if (s.tidied.indexOf(o.id) < 0) s.tidied.push(o.id);
          snd('dgTidy'); sparkle(o.lane, '#a7f3d0', 14); pop('Tidied! ✨ +8');
        } else if (t === 'bar') { if (s.slide <= 0) { o.hit = true; bonk(); } }
        else { if (s.jh < (t === 'puddle' ? 0.25 : 0.65)) { o.hit = true; bonk(); } }
        if (s.over) return;
      }
      while (s.objs.length && s.objs[0].z < s.dist - 4) s.objs.shift();
    }
    if (s.bannerT > 0) s.bannerT -= dt;
    if (s.popT > 0) s.popT -= dt;
    if (s.shake > 0) s.shake -= dt;
    for (let i = s.parts.length - 1; i >= 0; i--) {
      const p = s.parts[i]; p.life -= dt; p.vy += (p.g === undefined ? 500 : p.g) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) s.parts.splice(i, 1);
    }
  }

  // ---------- drawing ----------
  function ell(x, y, rx, ry, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, 7); ctx.fill(); }
  function rrect(x, y, w, h, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); }
  const PCOL = ['#ff5d6c', '#8fd8ff', '#ffd166', '#c77dff', '#6fdc8c'];
  function drawObj(o, d) {
    const s = sc(d), x = X(o.lane, s), y = Y(s), u = LW * s, t = o.t;
    ctx.globalAlpha = d > VIEW - 12 ? Math.max(0, (VIEW - d) / 12) : 1;
    if (t === 'coin' || t === 'bit') {
      const cy = y - u * (0.3 + o.h), r = u * (t === 'coin' ? 0.13 : 0.15), bob = Math.sin(S.t * 6 + o.z) * 0.04 * u;
      ell(x, y - u * 0.02, r * 0.9, r * 0.3, 'rgba(0,0,0,.18)');
      if (t === 'coin') { ell(x, cy + bob, r, r, '#ffd23f'); ell(x, cy + bob, r * 0.65, r * 0.65, '#ffb703'); }
      else { rrect(x - r, cy + bob - r, r * 2, r * 2, r * 0.5, PCOL[(o.z | 0) % 5]); ell(x - r * 0.3, cy + bob - r * 0.3, r * 0.3, r * 0.3, 'rgba(255,255,255,.7)'); }
    } else if (t === 'pile') {
      ell(x, y, u * 0.5, u * 0.14, 'rgba(0,0,0,.2)'); ell(x, y - u * 0.2, u * 0.46, u * 0.3, '#8b6b4a'); ell(x - u * 0.12, y - u * 0.34, u * 0.2, u * 0.16, '#a98363');
      for (let i = 0; i < 4; i++) rrect(x - u * 0.34 + i * u * 0.2, y - u * (0.42 + (i % 2) * 0.1), u * 0.15, u * 0.12, 3, PCOL[(i + ((o.z | 0) % 5)) % 5]);
    } else if (t === 'cone') {
      ell(x, y, u * 0.3, u * 0.09, 'rgba(0,0,0,.2)'); rrect(x - u * 0.24, y - u * 0.1, u * 0.48, u * 0.1, 4, '#374151');
      ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(x - u * 0.2, y - u * 0.1); ctx.lineTo(x + u * 0.2, y - u * 0.1); ctx.lineTo(x + u * 0.06, y - u * 0.68); ctx.lineTo(x - u * 0.06, y - u * 0.68); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - u * 0.14, y - u * 0.3); ctx.lineTo(x + u * 0.14, y - u * 0.3); ctx.lineTo(x + u * 0.1, y - u * 0.43); ctx.lineTo(x - u * 0.1, y - u * 0.43); ctx.fill();
    } else if (t === 'puddle') {
      ell(x, y - u * 0.05, u * 0.5, u * 0.17, '#3b9be0'); ell(x - u * 0.12, y - u * 0.08, u * 0.18, u * 0.05, 'rgba(255,255,255,.55)');
    } else if (t === 'bar') {
      const w = u * 0.5; rrect(x - w - u * 0.04, y - u * 1.45, u * 0.08, u * 1.45, 2, '#9aa3af'); rrect(x + w - u * 0.04, y - u * 1.45, u * 0.08, u * 1.45, 2, '#9aa3af');
      for (let i = 0; i < 8; i++) rrect(x - w + i * (w / 4), y - u * 1.3, w / 4 + 0.5, u * 0.34, 0, i % 2 ? '#2b2b3a' : '#ffd23f');
    } else {
      const sp = sprites[o.id], big = LW * s * 0.95, wob = Math.sin(S.t * 9 + o.z) * 0.06, fr = t === 'crit';
      ell(x, y, big * 0.42, big * 0.1, 'rgba(0,0,0,.2)');
      ctx.strokeStyle = fr ? 'rgba(52,211,153,.9)' : 'rgba(251,146,60,.95)'; ctx.lineWidth = Math.max(2, u * 0.05);
      ctx.beginPath(); ctx.ellipse(x, y - big * 0.04, big * 0.5, big * 0.14, 0, 0, 7); ctx.stroke();
      if (sp && sp.ok) { ctx.save(); ctx.translate(x, y); ctx.rotate(wob); ctx.drawImage(sp, -big / 2, -big * 1.02, big, big); ctx.restore(); }
      if (d < 38) { ctx.font = '800 ' + Math.max(10, u * 0.3) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = fr ? '#059669' : '#ea580c'; ctx.fillText(fr ? '✨' : '❗', x, y - big * 1.1); }
    }
    ctx.globalAlpha = 1;
  }
  function drawPlayer() {
    const u = LW, x = X(S.px, 1);
    if (S.inv > 0 && ((S.t * 14) | 0) % 2) ctx.globalAlpha = 0.45;
    ell(x, by, u * 0.32 * (1 - Math.min(S.jh, 1.2) * 0.25), u * 0.08, 'rgba(0,0,0,.25)');
    window.LMLook.draw(ctx, x, by - S.jh * u, u, S.look, { t: S.t, sl: S.slide > 0 || S.fall, jump: S.jh > 0, shield: S.shield, bside: S.px > 0.5 ? -1 : 1 });
    ctx.globalAlpha = 1;
  }
  function label(txt, x, y, size, col) {
    ctx.font = '900 ' + size + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = size * 0.22; ctx.strokeStyle = 'rgba(20,40,30,.75)'; ctx.lineJoin = 'round';
    ctx.strokeText(txt, x, y); ctx.fillStyle = col || '#fff'; ctx.fillText(txt, x, y);
  }
  function render() {
    const s = S; ctx.drawImage(bg, 0, 0, W, H);
    ctx.save();
    if (s.shake > 0) ctx.translate((rnd() - 0.5) * 8 * (s.shake / 0.3), (rnd() - 0.5) * 6 * (s.shake / 0.3));
    const sBot = (H - hy) / (by - hy), sFar = sc(VIEW);
    // road
    ctx.fillStyle = '#e8d7b0'; ctx.beginPath();
    ctx.moveTo(X(-1.65, sFar), Y(sFar)); ctx.lineTo(X(1.65, sFar), Y(sFar)); ctx.lineTo(X(1.65, sBot), H); ctx.lineTo(X(-1.65, sBot), H); ctx.fill();
    ctx.fillStyle = '#cdb88a'; [-1.65, 1.65].forEach(function (e) {
      ctx.beginPath(); ctx.moveTo(X(e, sFar), Y(sFar)); ctx.lineTo(X(e + Math.sign(e) * 0.09, sFar), Y(sFar)); ctx.lineTo(X(e + Math.sign(e) * 0.09, sBot), H); ctx.lineTo(X(e, sBot), H); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let k = Math.ceil((s.dist - 3) / 4), z = k * 4; z - s.dist < VIEW; z += 4) {
      const d0 = Math.max(z - s.dist, -2), d1 = z - s.dist + 1.6, a = sc(d0), b = sc(d1); if (d1 < -2) continue;
      [-0.5, 0.5].forEach(function (l) {
        ctx.beginPath(); ctx.moveTo(X(l, a) - LW * 0.02 * a, Y(a)); ctx.lineTo(X(l, a) + LW * 0.02 * a, Y(a)); ctx.lineTo(X(l, b) + LW * 0.02 * b, Y(b)); ctx.lineTo(X(l, b) - LW * 0.02 * b, Y(b)); ctx.fill();
      });
    }
    // trees (far to near)
    const k0 = Math.ceil((s.dist - 2) / 6);
    for (let k = k0 + Math.floor(VIEW / 6); k >= k0; k--) {
      const d = k * 6 - s.dist, q = sc(d), side = k % 2 ? -1 : 1, lat = side * (2.35 + ((k * 7) % 3) * 0.35), x = X(lat, q), y = Y(q), u = LW * q;
      ctx.globalAlpha = d > VIEW - 12 ? Math.max(0, (VIEW - d) / 12) : 1;
      rrect(x - u * 0.08, y - u * 0.7, u * 0.16, u * 0.7, 2, '#7a5230'); ell(x, y - u * 1.0, u * 0.45, u * 0.5, '#2e9d4f'); ell(x - u * 0.12, y - u * 1.1, u * 0.28, u * 0.3, '#3dbb63');
    }
    ctx.globalAlpha = 1;
    // boss (appears as the goal nears; locks in place for the finale)
    const bossZ = s.fin ? s.dist + BOSS_D : GOAL + BOSS_D, bd = bossZ - s.dist;
    let leadDone = false;
    const drawLead = function () {
      leadDone = true; if (s.fin) return;
      const q = sc(34), lx = X(Math.sin(s.t * 1.3) * 1.0, q), sp = sprites[s.lead], big = LW * q * 0.95, hop = Math.abs(Math.sin(s.t * 7)) * big * 0.25;
      ell(lx, Y(q), big * 0.4, big * 0.09, 'rgba(0,0,0,.2)'); if (sp && sp.ok) ctx.drawImage(sp, lx - big / 2, Y(q) - big * 1.02 - hop, big, big);
    };
    if (bd < VIEW) {
      const q = sc(bd), bs = LW * q * 4.4, sp = sprites['boss:' + s.boss], bob = Math.sin(s.t * 3) * bs * 0.03, happy = s.won;
      ctx.globalAlpha = Math.min(1, (VIEW - bd) / 12);
      ell(X(0, q), Y(q), bs * 0.45, bs * 0.08, 'rgba(0,0,0,.22)');
      if (sp && sp.ok) ctx.drawImage(sp, X(0, q) - bs / 2, Y(q) - bs * 0.98 + bob - (happy ? Math.abs(Math.sin(s.t * 6)) * bs * 0.08 : 0), bs, bs);
      ctx.globalAlpha = 1;
    }
    // objects far -> near; player slots in at depth 0
    const list = s.objs; let i = list.length - 1;
    for (; i >= 0; i--) {
      const o = list[i], d = o.z - s.dist; if (d < 0) break; if (d >= VIEW || o.hit && o.t !== 'bar') continue;
      if (!leadDone && d < 34) drawLead(); drawObj(o, d);
    }
    if (!leadDone) drawLead();
    drawPlayer();
    for (; i >= 0; i--) { const o = list[i], d = o.z - s.dist; if (d < -2 || o.hit && o.t !== 'bar') continue; drawObj(o, d); }
    // sparkles
    for (let j = 0; j < s.parts.length; j++) { const p = s.parts[j]; ctx.globalAlpha = Math.max(0, p.life / 0.6); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 6, 6); }
    ctx.globalAlpha = 1; ctx.restore();
    // HUD (canvas only: no DOM updates while running)
    const top = 22 + safeT;
    ctx.textAlign = 'left'; ctx.font = '22px system-ui'; for (let h = 0; h < MAX_BONKS; h++) { ctx.globalAlpha = h < s.lives ? 1 : 0.25; ctx.fillText('💚', 14 + h * 30, top + 14); }
    ctx.globalAlpha = 1; ctx.font = '18px system-ui'; ctx.fillText(s.look.perk === 'perk_magnet' ? '🧲' : (s.look.perk === 'perk_shield' ? (s.shield ? '🛡️' : '') : ''), 14 + MAX_BONKS * 30 + 2, top + 12);
    ctx.textAlign = 'left'; ctx.font = '900 18px system-ui'; ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,40,30,.75)';
    const sc2 = '⭐ ' + s.score + '   ♻ ' + s.bits + '   🪙 ' + s.coins; ctx.strokeText(sc2, 14, top + 44); ctx.fillText(sc2, 14, top + 44);
    const bw = W - 28, pct = s.fin ? (s.finBits ? Math.min(1, s.finGot / Math.max(1, s.finBits)) : 0) : Math.min(1, s.dist / GOAL);
    rrect(14, top + 56, bw, 12, 6, 'rgba(255,255,255,.45)'); rrect(14, top + 56, Math.max(12, bw * pct), 12, 6, s.fin ? '#ff9f1c' : '#22c55e');
    ctx.textAlign = 'right'; ctx.font = '900 14px system-ui'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,40,30,.75)'; const wl = '👛 ' + (wallet0 + Math.min(25, Math.floor(s.coins / 4))); ctx.strokeText(wl, W - 14, top + 90); ctx.fillStyle = '#ffe066'; ctx.fillText(wl, W - 14, top + 90);
    label(s.fin ? 'Boss tidiness' : Math.floor(s.dist) + ' / ' + GOAL + ' m', W / 2, top + 90, 14, '#fff');
    if (s.bannerT > 0) label(s.banner, W / 2, H * 0.2, 26, '#ffe066');
    if (s.popT > 0) label(s.pop, W / 2, by - LW * 1.6 - (0.9 - s.popT) * 40, 22, '#bbf7d0');
  }

  // ---------- loop ----------
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const w0 = performance.now();
    let dt = (ts - last) / 1000; last = ts; if (dt > 0.1) dt = 0.1;
    if (dt > 0 && dt < 1) { perf.ft[perf.n % 900] = dt * 1000; }
    acc += dt; let n = 0;
    while (acc >= STEP && n++ < 20) { update(STEP); acc -= STEP; }
    if (n >= 20) acc = 0;
    render();
    perf.wt[perf.n % 900] = performance.now() - w0; perf.n++;
  }
  function startLoop() { if (raf) return; last = performance.now(); acc = 0; raf = requestAnimationFrame(frame); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', function () { if (!active || !S || S.over || $('#dgCard').classList.contains('hidden') === false) return; if (document.hidden) stopLoop(); else startLoop(); });

  // ---------- input: touch (non-passive), mouse drag, arrow keys ----------
  let ox = 0, oy = 0, armed = false;
  function swipeMove(x, y) {
    if (!armed) return; const dx = x - ox, dy = y - oy, ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < SWIPE && ay < SWIPE) return;
    if (ax > ay) laneMove(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else slide();
    ox = x; oy = y; // origin resets so a long drag can chain swipes
  }
  function bindInput() {
    const opt = { passive: false };
    cv.addEventListener('touchstart', function (e) { e.preventDefault(); const t = e.changedTouches[0]; ox = t.clientX; oy = t.clientY; armed = true; }, opt);
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); const t = e.changedTouches[0]; swipeMove(t.clientX, t.clientY); }, opt);
    cv.addEventListener('touchend', function (e) { e.preventDefault(); armed = false; }, opt);
    cv.addEventListener('touchcancel', function () { armed = false; }, opt);
    cv.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') return; ox = e.clientX; oy = e.clientY; armed = true; });
    window.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') swipeMove(e.clientX, e.clientY); });
    window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'touch') armed = false; });
    window.addEventListener('keydown', function (e) {
      if (!active) return; const k = e.key;
      if (k === 'ArrowLeft' || k === 'a') laneMove(-1); else if (k === 'ArrowRight' || k === 'd') laneMove(1);
      else if (k === 'ArrowUp' || k === 'w' || k === ' ') jump(); else if (k === 'ArrowDown' || k === 's') slide(); else return;
      e.preventDefault();
    });
  }

  // ---------- cards ----------
  const card = function (html) { const c = $('#dgCard'); c.innerHTML = html; c.classList.remove('hidden'); };
  const links = function () { return '<div class="dg-links"><button class="big-btn secondary small" data-dgl="closet">👕 Closet</button><button class="big-btn secondary small" data-dgl="trophy">🏆 Trophies</button></div>'; };
  function bindLinks() {
    $('#dgCard').querySelectorAll('[data-dgl]').forEach(function (b) {
      b.addEventListener('click', function () { if (b.dataset.dgl === 'closet') window.LMCloset.openCloset('wardrobe'); else window.LMCloset.openTrophies(); });
    });
  }
  function showStart() {
    const best = window.LMDungeonHost ? window.LMDungeonHost.best() : 0;
    card('<div class="dg-hero">' + window.lmCreatureSvg(S.lead) + '</div><h2>🏃 Litter Dungeon</h2>' +
      '<p>The ' + window.LM_CREATURES.find(function (c) { return c.id === S.lead; }).name + ' is making a run for it! Chase it through the park, grab litter bits, and tidy up the friendly critters. Nobody gets hurt.</p>' +
      '<div class="dg-howto"><span>⬅️➡️ Swipe: change lane</span><span>⬆️ Swipe: jump</span><span>⬇️ Swipe: slide</span><span>✨ Run through green critters</span></div>' +
      '<p>🦘 Hop over cones, piles &amp; puddles. 🛷 Slide under tape. ' + MAX_BONKS + ' bonks and the run ends.' + (best ? ' Best: ⭐ ' + best : '') + '</p>' +
      '<div class="dg-coinline">👛 ' + window.LMDungeonHost.wallet() + ' coins · earn more by running</div>' +
      '<button class="big-btn" id="dgGo">Let\'s run! 🏃</button>' + links());
    $('#dgGo').addEventListener('click', go); bindLinks();
  }
  function go() { $('#dgCard').classList.add('hidden'); S.t = 0; S.look = window.LMLook.current(); S.shield = S.look.perk === 'perk_shield'; wallet0 = window.LMDungeonHost.wallet(); S.banner = 'Chase it! 🏃'; S.bannerT = 2.2; startLoop(); }
  function end(won) {
    S.over = true; S.won = won; if (won) { S.banner = 'Boss tidied! ✨'; S.bannerT = 9; snd('bossDefeat'); } else snd('warn');
    const pts = Math.min(120, S.score + (won ? 50 : 0));
    S.clean = Math.max(S.clean, S.dist - S.lastBonk);
    const res = window.LMDungeonHost.finish({ finished: won, pts: pts, tidied: S.tidied.slice(), dist: Math.floor(S.dist), coins: S.coins, bonks: S.bonks, clean: Math.floor(S.clean), boss: S.boss });
    S.res = res;
    setTimeout(function () { if (!active) return; showEnd(res, won); }, won ? 1400 : 500);
  }
  function showEnd(res, won) {
    const un = res.unlocked || { quests: [], badges: [] }, bd = window.LM_BOSSES.find(function (b) { return b.id === S.boss; });
    let h = won ? '<div class="dg-hero">' + window.lmBossSvg(S.boss) + '</div><h2>Run complete! 🎉</h2><p>You tidied up the ' + bd.name + ' and the critter is chilling now.</p>'
      : '<div class="dg-hero">' + window.lmCreatureSvg(S.lead) + '</div><h2>Tripped on trash 😅</h2><p>Nice try! Finish the whole run to clear the park boss, win the badge and unlock critters.</p>';
    h += '<div class="dg-pts">+' + res.pts + ' pts</div><div class="dg-stats four"><div><b>' + Math.floor(S.dist) + 'm</b>ran</div><div><b>' + S.bits + '</b>bits</div><div><b>' + S.coins + '</b>coins</div>' +
      '<div><b>' + S.tidied.length + '</b>tidied</div></div>';
    h += '<div class="dg-coinline">🪙 +' + (res.coinsRun + res.coinsGoal) + ' coins · wallet 👛 ' + res.balance + (res.coinCapHit ? '<br><small>Daily coin cap reached. More tomorrow!</small>' : '') + '</div>';
    if (res.newMet.length) h += '<div class="dg-note">📖 New Litter Log entr' + (res.newMet.length > 1 ? 'ies' : 'y') + '!</div><div class="dg-new">' + res.newMet.map(function (i) { return window.lmCreatureSvg(i); }).join('') + '</div>';
    un.quests.forEach(function (q) { h += '<div class="dg-note">📜 Quest complete! +' + q.reward + ' bonus <small>' + q.title + '</small></div>'; });
    un.badges.forEach(function (b) { h += '<div class="dg-note">' + b.icon + (b.trophy ? ' Trophy unlocked: <b>' : ' Badge unlocked: <b>') + b.name + '</b></div>'; });
    if (res.capped) h += '<div class="dg-note">😴 Big run day! Bonus points are on pause. Come back tomorrow.</div>';
    h += '<div class="dg-row"><button class="big-btn secondary small" id="dgDone">Done</button><button class="big-btn small" id="dgAgain">Run again 🏃</button></div>' + links();
    card(h); bindLinks();
    $('#dgDone').addEventListener('click', function () { close(true); });
    $('#dgAgain').addEventListener('click', function () { reset(); });
  }
  function reset() { $('#dgCard').classList.add('hidden'); stopLoop(); S = newRun(); S.t = 0; showStart(); render(); }
  function close(award) {
    active = false; stopLoop(); root.classList.add('hidden');
    const un = award && S && S.res ? S.res.unlocked : null;
    S = null; window.LMDungeonHost.done(un);
  }
  function renderMute() { const b = $('#dgMute'); if (b) { const m = SND.muted(); b.textContent = m ? '🔇' : '🔊'; b.setAttribute('aria-label', m ? 'Turn sound on' : 'Mute sound'); } }

  let inited = false;
  function open() {
    if (!inited) {
      inited = true; root = $('#dungeon'); cv = $('#dgCanvas'); ctx = cv.getContext('2d'); bindInput();
      $('#dgClose').addEventListener('click', function () { close(false); });
      $('#dgMute').addEventListener('click', function () { SND.toggleAll(); });
      if (SND) SND.onChange(renderMute);
      window.addEventListener('resize', function () { if (active) { resize(); if (S && !raf) render(); } });
    }
    root.classList.remove('hidden'); active = true; resize(); renderMute(); reset();
  }

  window.LMDungeon = {
    open: open,
    _state: function () { return S; },
    _perf: function () {
      const n = Math.min(perf.n, 900), f = Array.prototype.slice.call(perf.ft, 0, n).sort(function (a, b) { return a - b; }), w = Array.prototype.slice.call(perf.wt, 0, n);
      const avg = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / (a.length || 1); };
      return { frames: n, avgFrameMs: avg(f), p95FrameMs: f[Math.floor(n * 0.95)], maxFrameMs: f[n - 1], avgWorkMs: avg(w), maxWorkMs: Math.max.apply(null, w) };
    }
  };
})();
