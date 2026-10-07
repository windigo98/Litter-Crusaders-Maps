/* Litter Crusaders Maps — UI + persistence (localStorage, no backend). */
(function () {
  'use strict';
  const G = window.LMGame;
  const CREATURES = window.LM_CREATURES;
  const RARITY = window.LM_RARITY;
  const svg = window.lmCreatureSvg;
  const bossSvg = window.lmBossSvg;
  const STORE_KEY = 'litterMap.v1';
  // Fallback spot if geolocation is unavailable/denied (Golden Gate Park, SF). Players can tap the map to move.
  const DEFAULT_POS = { lat: 37.7694, lng: -122.4862 };
  const AVATARS = ['🦊', '🐼', '🦄', '🦖', '🐸', '🐯', '🐙', '🦉', '🐝', '🐬', '🦁', '🐨'];

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- state ----------
  function freshState() {
    const id = uid();
    return {
      version: 1,
      settings: { onboarded: false, sound: true, lastPos: null, mapFilter: 'me' },
      profiles: [{ id: id, name: 'Explorer', avatar: '🦊', createdAt: Date.now(), claims: {}, badges: {} }],
      activeId: id,
      catches: [],
      bosses: [],
      park: null,
      parkCache: null,
      parkStatus: 'idle',
      demoActive: false
    };
  }
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const s = JSON.parse(raw); if (s && s.profiles && s.profiles.length) return s; } } catch (e) { console.warn(e); }
    return freshState();
  }
  let state = load();
  if (!state.bosses) state.bosses = [];
  if (!state.parkStatus) state.parkStatus = 'idle';
  if (!state.link) state.link = null; // { code, name, kind, role, memberId, backend }
  if (!state.remote) state.remote = { members: [], catches: [] };
  state.profiles.forEach(function (pr) {
    if (!pr.ispy) pr.ispy = { finds: 0, streak: 0, bestStreak: 0, seen: {} };
    if (!pr.room) pr.room = { baseline: null, baselineAt: null, finds: 0, round: null };
  });
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); return true; }
    catch (e) { toast('😬 Storage is full. Try exporting and removing old photos.'); return false; }
  }
  function me() { return state.profiles.find(function (p) { return p.id === state.activeId; }) || state.profiles[0]; }
  function myStats() { return G.stats(state, me().id); }

  // ---------- toast / sound ----------
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 2600); }
  let actx;
  function chime(kind) {
    if (!state.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = kind === 'badge' ? [659, 784, 988, 1319, 1568] : [523, 659, 784, 1047];
      notes.forEach(function (f, i) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        const t0 = actx.currentTime + i * 0.09;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 0.4);
      });
    } catch (e) { /* no audio */ }
  }

  // ---------- header ----------
  function renderHeader() {
    const p = me(), s = myStats();
    $('#playerAvatar').textContent = p.avatar;
    $('#playerName').textContent = p.name;
    $('#playerLevel').textContent = 'Lv ' + s.level.level + ' · ' + s.level.title;
    $('#xpFill').style.width = s.level.pct + '%';
    $('#pointsText').textContent = s.points;
    $('#streakText').textContent = s.streak + (s.streak === 1 ? ' day' : ' days');
    const seen = p.questsSeenDay === G.dayKey(Date.now());
    const dot = $('#questDot');
    const open = G.questsFor('d', p, Date.now()).filter(function (q) { return !p.claims[q.key]; }).length;
    dot.textContent = open; dot.classList.toggle('hidden', seen || !open);
  }

  // ---------- navigation ----------
  let current = 'map';
  function show(name) {
    current = name;
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.id === 'screen-' + name); });
    $$('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.screen === name); });
    if (name === 'map') { setTimeout(function () { map && map.invalidateSize(); }, 30); }
    if (name === 'dex') renderDex();
    if (name === 'quests') { me().questsSeenDay = G.dayKey(Date.now()); save(); renderQuests(); }
    if (name === 'badges') renderBadges();
    if (name === 'crew') renderCrew();
    renderHeader();
  }
  $$('.tab').forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.screen); }); });

  // ---------- map ----------
  let map, meMarker, pinLayer, pos = null, posSource = 'none', moveMode = false, watchId = null;
  function initMap() {
    const start = state.settings.lastPos || DEFAULT_POS;
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView([start.lat, start.lng], 17);
    window._lmMap = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    pinLayer = L.layerGroup().addTo(map);
    map.on('click', function (e) {
      if (moveMode || posSource !== 'gps') {
        setPos(e.latlng.lat, e.latlng.lng, 'manual');
        if (moveMode) toggleMove(false);
        toast('📍 Got it! This is your spot now.');
      }
    });
    if (state.settings.lastPos) setPos(start.lat, start.lng, state.settings.lastPosSource === 'gps' ? 'saved' : 'manual', true);
    startGeo();
    renderPins();
    if (state.park) { drawParkFence(); renderParkChip(); }
    else if (state.settings.lastPos) scheduleParkLookup(state.settings.lastPos.lat, state.settings.lastPos.lng, false);
  }
  function setPos(lat, lng, source, noPan) {
    pos = { lat: lat, lng: lng }; posSource = source;
    state.settings.lastPos = pos; state.settings.lastPosSource = source === 'saved' ? 'gps' : source; save();
    const icon = L.divIcon({ className: 'me-dot', html: '<div class="me-inner">' + esc(me().avatar) + '</div>', iconSize: [44, 44], iconAnchor: [22, 22] });
    if (!meMarker) meMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 1000, keyboard: false }).addTo(map);
    else { meMarker.setLatLng([lat, lng]); meMarker.setIcon(icon); }
    if (!noPan) map.panTo([lat, lng]);
    updateStatus();
    scheduleParkLookup(lat, lng, source === 'manual');
  }

  // ---------- Park auto-detect ----------
  let parkLayer = null, parkLookupTimer = null, parkLookupSeq = 0;
  function scheduleParkLookup(lat, lng, force) {
    if (!window.LMParks) return;
    clearTimeout(parkLookupTimer);
    // Debounce GPS chatter; manual taps resolve a bit faster.
    parkLookupTimer = setTimeout(function () { lookupPark(lat, lng, force); }, force ? 280 : 900);
  }
  function cacheValid(lat, lng) {
    const c = state.parkCache;
    if (!c || !c.park || !c.at || !c.forPos) return false;
    if (Date.now() - c.at > window.LMParks.CACHE_MS) return false;
    return window.LMParks.distM(c.forPos, { lat: lat, lng: lng }) < 250;
  }
  function applyPark(park, status, meta) {
    state.park = park;
    state.parkStatus = status; // 'found' | 'none' | 'looking' | 'error'
    if (park) {
      state.parkCache = { park: park, at: Date.now(), forPos: pos ? { lat: pos.lat, lng: pos.lng } : null, meta: meta || null };
      const pr = me();
      if (!pr.parkFoundAt) {
        pr.parkFoundAt = Date.now();
        // Award quietly so GPS/park load does not interrupt the map with a modal.
        G.evaluate(state, pr.id, Date.now(), { silent: true });
        save();
        toast('🏞️ Park found: ' + park.name + '!');
      }
    }
    save();
    drawParkFence();
    renderParkChip();
    updateStatus();
    // Re-evaluate boss spawns with park-aware areas
    G.spawnBosses(state, Date.now());
    renderPins();
  }
  function lookupPark(lat, lng, force) {
    if (!force && cacheValid(lat, lng)) {
      applyPark(state.parkCache.park, 'found', { fromCache: true });
      return;
    }
    const seq = ++parkLookupSeq;
    state.parkStatus = 'looking';
    renderParkChip(); updateStatus();
    window.LMParks.findNearbyPark(lat, lng, { allowFixture: true }).then(function (park) {
      if (seq !== parkLookupSeq) return; // stale
      if (park) applyPark(park, 'found');
      else applyPark(null, 'none');
    }).catch(function () {
      if (seq !== parkLookupSeq) return;
      const fix = window.LMParks.fixtureNear(lat, lng);
      if (fix) applyPark(fix, 'found', { fallback: true });
      else applyPark(null, 'error');
    });
  }
  function drawParkFence() {
    if (!map) return;
    if (parkLayer) { map.removeLayer(parkLayer); parkLayer = null; }
    const park = state.park;
    if (!park || !park.ring) return;
    const latlngs = park.ring.map(function (p) { return [p[0], p[1]]; });
    parkLayer = L.polygon(latlngs, {
      className: 'park-fence',
      color: '#16a34a', weight: 3, opacity: 0.9,
      fillColor: '#4ade80', fillOpacity: 0.22,
      dashArray: park.source === 'fixture' ? '6 8' : null,
      interactive: false
    }).addTo(map);
    try { parkLayer.bringToBack(); } catch (e) {}
  }
  function fitParkView() {
    if (!map || !parkLayer) return;
    try { map.fitBounds(parkLayer.getBounds(), { padding: [28, 28], maxZoom: 14 }); } catch (e) {}
  }
  function renderParkChip() {
    const el = $('#parkChip'); if (!el) return;
    const st = state.parkStatus, park = state.park;
    if (st === 'looking') {
      el.className = 'park-chip looking'; el.textContent = '🔎 Looking for your park…'; el.classList.remove('hidden'); return;
    }
    if (st === 'found' && park) {
      el.className = 'park-chip' + (park.source === 'fixture' ? ' fixture' : '');
      el.textContent = (park.contains ? "🏞️ You're in " : '🏞️ Near ') + park.name + '!';
      el.classList.remove('hidden'); return;
    }
    if (st === 'none' || st === 'error') {
      el.className = 'park-chip free';
      el.textContent = st === 'error' ? '🌳 Free roam (park lookup busy)' : '🌳 No park nearby — free roam';
      el.classList.remove('hidden'); return;
    }
    el.classList.add('hidden');
  }

  function updateStatus(override) {
    const el = $('#mapStatus'); el.classList.remove('warn', 'setting', 'park');
    if (override) { el.textContent = override; return; }
    if (moveMode) { el.textContent = '✋ Tap the map where you are'; el.classList.add('setting'); return; }
    if (state.park && state.parkStatus === 'found') {
      el.textContent = (state.park.contains ? "🏞️ You're in " : '🏞️ Near ') + state.park.name + '!';
      el.classList.add('park'); return;
    }
    if (posSource === 'gps') el.textContent = '📍 You\'re here! Find litter creatures!';
    else if (posSource === 'manual') el.textContent = '📍 Spot set by tap. ✋ to move';
    else if (posSource === 'saved') el.textContent = '📍 Finding you…';
    else { el.textContent = '📍 No GPS? Tap the map to set your spot'; el.classList.add('warn'); }
  }
  function startGeo() {
    if (!('geolocation' in navigator)) { if (!pos) setPos(DEFAULT_POS.lat, DEFAULT_POS.lng, 'none'); updateStatus(); return; }
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(function (p) {
      if (posSource === 'manual' && !followGps) return;
      const first = posSource !== 'gps';
      setPos(p.coords.latitude, p.coords.longitude, 'gps', !first);
    }, function () {
      if (posSource !== 'manual') {
        if (!pos) setPos(DEFAULT_POS.lat, DEFAULT_POS.lng, 'none'); else posSource = 'none';
        updateStatus();
      }
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
  }
  let followGps = true;
  function toggleMove(on) {
    moveMode = typeof on === 'boolean' ? on : !moveMode;
    $('#moveMeBtn').classList.toggle('on', moveMode);
    if (moveMode) followGps = false;
    updateStatus();
  }
  $('#moveMeBtn').addEventListener('click', function () { toggleMove(); });
  $('#locateBtn').addEventListener('click', function () {
    followGps = true; toggleMove(false);
    if (posSource === 'manual') posSource = 'saved';
    startGeo();
    if (pos) map.flyTo([pos.lat, pos.lng], 17, { duration: 0.6 });
  });

  function visibleCatches() {
    const linked = !!(state.link && state.link.code);
    const multi = state.profiles.length > 1 || linked;
    const showCrew = multi && state.settings.mapFilter === 'crew';
    const local = state.catches.filter(function (c) { return showCrew || c.profileId === me().id; });
    if (!showCrew || !linked) return local;
    const remote = (state.remote.catches || []).filter(function (c) {
      return c.memberId !== (state.link && state.link.memberId);
    }).map(function (c) {
      return {
        id: 'remote-' + c.id,
        profileId: 'remote:' + c.memberId,
        type: c.type,
        count: c.count || 1,
        lat: c.lat,
        lng: c.lng,
        ts: c.ts,
        remote: true,
        remoteName: (function () {
          const m = (state.remote.members || []).find(function (x) { return x.id === c.memberId; });
          return m ? m.nickname : 'Crewmate';
        })(),
        remoteAvatar: (function () {
          const m = (state.remote.members || []).find(function (x) { return x.id === c.memberId; });
          return m ? m.avatar : '🧤';
        })()
      };
    });
    return local.concat(remote);
  }
  let popNewId = null;
  function renderPins() {
    if (!pinLayer) return;
    pinLayer.clearLayers();
    visibleCatches().forEach(function (c) {
      const cr = G.byId[c.type] || G.byId.mystery;
      const html = '<div class="pin-body" style="--c:' + RARITY[cr.rarity].color + '">' + svg(cr.id) + (c.count > 1 ? '<span class="pin-count">×' + c.count + '</span>' : '') + '</div>';
      const icon = L.divIcon({ className: 'lm-pin' + (c.remote ? ' remote' : '') + (c.id === popNewId ? ' pop' : ''), html: html, iconSize: [52, 52], iconAnchor: [8, 60], popupAnchor: [18, -56] });
      const m = L.marker([c.lat, c.lng], { icon: icon }).addTo(pinLayer);
      m.bindPopup(function () { return popupHtml(c); }, { maxWidth: 240 });
    });
    popNewId = null;
    const multi = state.profiles.length > 1 || !!(state.link && state.link.code);
    $('#crewFilter').classList.toggle('hidden', !multi);
    $$('#crewFilter .seg').forEach(function (b) { b.classList.toggle('active', b.dataset.filter === (state.settings.mapFilter || 'me')); });
    renderBossPins();
    renderQuestPeek();
    renderBossPeek();
  }

  function renderBossPins() {
    if (!map) return;
    // Clear previous boss markers stored on pinLayer via class — use a dedicated layer.
    if (!window._bossLayer) window._bossLayer = L.layerGroup().addTo(map);
    window._bossLayer.clearLayers();
    G.activeBosses(state).forEach(function (inst) {
      const def = G.BOSS_BY_ID[inst.bossId]; if (!def) return;
      const pr = G.bossProgress(inst);
      const html = '<div class="boss-pin-body" style="--c:' + def.color + '">' +
        '<div class="boss-pin-art">' + bossSvg(def.id) + '</div>' +
        '<div class="boss-pin-hp"><div style="width:' + pr.pct + '%"></div></div>' +
        '<span class="boss-pin-tag">BOSS</span></div>';
      const icon = L.divIcon({ className: 'lm-boss-pin', html: html, iconSize: [72, 84], iconAnchor: [36, 78], popupAnchor: [0, -70] });
      const m = L.marker([inst.lat, inst.lng], { icon: icon, zIndexOffset: 800 }).addTo(window._bossLayer);
      m.on('click', function () { openBossSheet(inst.id); });
    });
  }

  function renderBossPeek() {
    const el = $('#bossPeek'); if (!el) return;
    if (!state.settings.onboarded) { el.classList.add('hidden'); return; }
    const here = pos || state.settings.lastPos;
    const active = G.activeBosses(state);
    if (!active.length || !here) { el.classList.add('hidden'); return; }
    // Prefer nearest active boss
    let best = null, bestD = 1e12;
    active.forEach(function (b) { const d = G.distM(here, b); if (d < bestD) { bestD = d; best = b; } });
    if (!best || bestD > 800) { el.classList.add('hidden'); return; }
    const def = G.BOSS_BY_ID[best.bossId], pr = G.bossProgress(best);
    el.innerHTML = '<span class="bp-ico">' + def.emoji + '</span><span class="bp-text"><small>Park boss nearby!</small>' +
      esc(def.name) + ' · ' + pr.left + ' left<div class="qbar bossbar"><div style="width:' + pr.pct + '%"></div></div></span>';
    el.classList.remove('hidden');
    el.onclick = function () { openBossSheet(best.id); };
  }

  let openBossId = null;
  function openBossSheet(instId) {
    const inst = (state.bosses || []).find(function (b) { return b.id === instId; });
    if (!inst) return;
    openBossId = instId;
    const def = G.BOSS_BY_ID[inst.bossId]; if (!def) return;
    const pr = G.bossProgress(inst);
    const defeated = !!inst.defeatedAt;
    $('#bossTitle').textContent = defeated ? 'Cleaned up!' : 'Park Boss!';
    const need = def.types
      ? def.types.map(function (t) { const cr = G.byId[t]; return '<span class="need-chip">' + (cr ? cr.emoji + ' ' + cr.name : t) + '</span>'; }).join('')
      : '<span class="need-chip">🧤 Any litter</span>';
    // Crew contributions
    const contribs = Object.keys(inst.contributions || {}).map(function (pid) {
      const who = state.profiles.find(function (p) { return p.id === pid; });
      return { who: who, n: inst.contributions[pid] };
    }).filter(function (x) { return x.who; }).sort(function (a, b) { return b.n - a.n; });
    const crewHtml = contribs.length
      ? '<div class="boss-crew"><div class="boss-crew-title">Crew clean-up power</div>' +
        contribs.map(function (c) {
          return '<div class="boss-crew-row"><span class="avatar">' + esc(c.who.avatar) + '</span><b>' + esc(c.who.name) + '</b><span class="bp">' + c.n + ' cleaned</span></div>';
        }).join('') + '</div>'
      : '<p class="boss-hint">No one has chipped away at this mess yet — be the first!</p>';
    $('#bossBody').innerHTML =
      '<div class="boss-hero" style="--c:' + def.color + '">' + bossSvg(def.id) +
      '<div class="boss-burst"></div></div>' +
      '<div class="boss-name">' + def.emoji + ' ' + esc(def.name) + '</div>' +
      '<p class="boss-flavor">' + esc(def.flavor) + '</p>' +
      '<div class="boss-hp-wrap"><div class="boss-hp-labels"><span>Mess pile</span><span>' + (defeated ? 'All gone! 🎉' : pr.cleaned + ' / ' + pr.max + ' cleaned · ' + pr.left + ' left') + '</span></div>' +
      '<div class="boss-hp"><div style="width:' + (defeated ? 100 : pr.pct) + '%"></div></div></div>' +
      (defeated ? '' : '<div class="boss-need"><div class="boss-need-title">Catch these nearby to shrink the pile:</div><div class="need-row">' + need + '</div>' +
        '<p class="boss-hint">💡 ' + esc(def.tip) + ' Stay within ~' + Math.round(G.BOSS_HIT_M) + ' m of the boss pin.</p></div>') +
      crewHtml +
      '<div class="boss-reward">🎁 Reward: <b>+' + def.reward + ' pts</b> &amp; the <b>' + esc((G.BADGES.find(function (b) { return b.id === def.badge; }) || { name: 'boss' }).name) + '</b> badge</div>' +
      (defeated
        ? '<button class="big-btn" id="bossOkBtn">Awesome! 🎉</button>'
        : '<button class="big-btn" id="bossCatchBtn">Catch litter to clean it! 🧤</button>');
    $('#bossSheet').classList.remove('hidden');
    const ok = $('#bossOkBtn'); if (ok) ok.addEventListener('click', function () { $('#bossSheet').classList.add('hidden'); });
    const go = $('#bossCatchBtn'); if (go) go.addEventListener('click', function () { $('#bossSheet').classList.add('hidden'); openCatch(); });
  }

  function popupHtml(c) {
    const cr = G.byId[c.type] || G.byId.mystery;
    const who = state.profiles.find(function (p) { return p.id === c.profileId; });
    const d = new Date(c.ts);
    const byline = c.remote
      ? ('<br>Caught by ' + esc((c.remoteAvatar || '') + ' ' + (c.remoteName || 'Crewmate')) + ' · blurred pin')
      : (who && (state.profiles.length > 1 || (state.link && state.link.code)) ? '<br>Caught by ' + esc(who.avatar + ' ' + who.name) : '');
    const div = document.createElement('div');
    div.className = 'pop';
    div.innerHTML = svg(cr.id) + '<b>' + esc(cr.name) + (c.count > 1 ? ' ×' + c.count : '') + '</b>' +
      '<small>' + esc(cr.item) + '<br>' + d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) +
      byline + '</small>' +
      (c.photo && !c.remote ? '<img src="' + c.photo + '" alt="photo of the catch">' : '') +
      (c.profileId === me().id && !c.remote ? '<button class="mini-del">Oops, remove this</button>' : '');
    const del = div.querySelector('.mini-del');
    if (del) del.addEventListener('click', function () {
      if (!confirm('Remove this catch?')) return;
      state.catches = state.catches.filter(function (x) { return x.id !== c.id; });
      save(); map.closePopup(); renderPins(); renderHeader();
    });
    return div;
  }
  $$('#crewFilter .seg').forEach(function (b) { b.addEventListener('click', function () { state.settings.mapFilter = b.dataset.filter; save(); renderPins(); }); });

  function renderQuestPeek() {
    const el = $('#questPeek');
    const p = me(), mine = G.catchesFor(state, p.id);
    const qs = G.questsFor('d', p, Date.now());
    const q = qs.find(function (x) { return !p.claims[x.key]; });
    if (!q || !state.settings.onboarded) { el.classList.add('hidden'); return; }
    const v = G.questProgress(q, mine);
    el.innerHTML = '<span class="qp-ico">' + q.icon + '</span><span class="qp-text"><small>Today\'s quest · +' + q.reward + ' pts</small>' + esc(q.title) +
      '<div class="qbar"><div style="width:' + Math.round(100 * v / q.goal) + '%"></div></div></span><b>' + v + '/' + q.goal + '</b>';
    el.classList.remove('hidden');
  }
  $('#questPeek').addEventListener('click', function () { show('quests'); });

  // ---------- catch flow ----------
  let pick = null, count = 1, photoData = null;
  function openCatch() {
    pick = null; count = 1; photoData = null;
    $('#step1').classList.remove('hidden'); $('#step2').classList.add('hidden');
    $('#catchTitle').textContent = 'What did you find?';
    const grid = $('#pickGrid');
    grid.innerHTML = CREATURES.map(function (c) {
      const tag = c.safety === 'adult' ? '<span class="tag adult">Grown-ups only</span>' : c.safety === 'gloves' ? '<span class="tag gloves">Gloves!</span>' : '';
      return '<button class="pick" data-id="' + c.id + '">' + tag + svg(c.id) + '<span class="p-name">' + esc(c.name) + '</span><span class="p-item">' + esc(c.item) + '</span></button>';
    }).join('') ;
    $$('#pickGrid .pick').forEach(function (b) { b.addEventListener('click', function () { choose(b.dataset.id); }); });
    $('#catchSheet').classList.remove('hidden');
  }
  function choose(id) {
    pick = G.byId[id]; count = 1; photoData = null;
    $('#catchTitle').textContent = 'Nice find!';
    $('#pickedBox').innerHTML = svg(id) + '<div><b>' + esc(pick.name) + '</b><span>' + esc(pick.item) + ' · ' + RARITY[pick.rarity].label + ' · ' + pick.points + ' pts each</span></div>';
    const note = $('#safetyNote');
    note.className = 'safety-note hidden'; note.innerHTML = '';
    if (pick.safety === 'gloves') {
      note.className = 'safety-note';
      note.innerHTML = '🧤 <b>Yucky one!</b> Wear gloves or use a grabber, or ask a grown-up to pick it up.<label><input type="checkbox" id="safeOk"> I used gloves / a grabber</label>';
    } else if (pick.safety === 'adult') {
      note.className = 'safety-note adult';
      note.innerHTML = '⚠️ <b>Grown-ups only!</b> Glass can be sharp. Kids: don\'t touch it. Point it out to your grown-up helper.<label><input type="checkbox" id="safeOk"> A grown-up picked this up safely</label>';
    }
    $('#countNum').textContent = count;
    $('#photoPreview').classList.add('hidden'); $('#photoText').textContent = '📸 Snap a photo (optional)'; $('#photoInput').value = '';
    $('#step1').classList.add('hidden'); $('#step2').classList.remove('hidden');
    const ok = $('#safeOk');
    $('#confirmCatchBtn').disabled = !!ok;
    if (ok) ok.addEventListener('change', function () { $('#confirmCatchBtn').disabled = !ok.checked; });
  }
  $('#countMinus').addEventListener('click', function () { count = Math.max(1, count - 1); $('#countNum').textContent = count; });
  $('#countPlus').addEventListener('click', function () { count = Math.min(50, count + 1); $('#countNum').textContent = count; });
  $('#backBtn').addEventListener('click', function () { $('#step1').classList.remove('hidden'); $('#step2').classList.add('hidden'); $('#catchTitle').textContent = 'What did you find?'; });
  $('#photoInput').addEventListener('change', function (e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    $('#photoText').textContent = '⏳ Shrinking photo…';
    shrinkImage(f, 640, 0.7).then(function (data) {
      photoData = data; const img = $('#photoPreview'); img.src = data; img.classList.remove('hidden');
      $('#photoText').textContent = '📸 Retake photo';
    }).catch(function () { $('#photoText').textContent = '📸 Snap a photo (optional)'; toast('Could not read that photo'); });
  });
  function shrinkImage(file, max, q) {
    return new Promise(function (res, rej) {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = function () {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        res(cv.toDataURL('image/jpeg', q));
      };
      img.onerror = rej; img.src = url;
    });
  }
  function jitter(p) { const r = 5 / 111320; return { lat: p.lat + (Math.random() - 0.5) * r, lng: p.lng + (Math.random() - 0.5) * r / Math.cos(p.lat * Math.PI / 180) }; }

  function doCatch() {
    if (!pick) return;
    const p = me();
    const before = myStats();
    const firstOfKind = !before.perType[pick.id];
    const where = jitter(pos || state.settings.lastPos || DEFAULT_POS);
    const c = { id: uid(), profileId: p.id, type: pick.id, count: count, lat: where.lat, lng: where.lng, ts: Date.now() };
    if (photoData) c.photo = photoData;
    if (state.demoActive) c.demo = false;
    state.catches.push(c);
    if (!save() && c.photo) { delete c.photo; save(); }
    // Boss tick: spawn from busy areas, then apply this catch as clean-up damage
    const spawned = G.spawnBosses(state, Date.now());
    const bossHits = G.applyCatchToBosses(state, c);
    const unlocked = G.evaluate(state, p.id, Date.now());
    save();
    const after = myStats();
    $('#catchSheet').classList.add('hidden');
    popNewId = c.id; renderPins(); renderHeader();
    // Cross-phone: publish blurred catch (no photo) when linked
    if (state.link && state.link.code && window.LMCrewSync) {
      const pts = G.catchPoints(c);
      window.LMCrewSync.publishCatch(state.link.code, state.link.memberId, c, pts).then(function (room) {
        if (room) applyRemoteRoom(room);
      }).catch(function (err) { console.warn('crew publish', err); });
    }
    celebrateCatch(pick, c, before, after, firstOfKind, unlocked, bossHits, spawned);
  }
  $('#confirmCatchBtn').addEventListener('click', doCatch);
  $('#catchBtn').addEventListener('click', openCatch);
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('.overlay').classList.add('hidden'); }); });
  $('#catchSheet').addEventListener('click', function (e) { if (e.target.id === 'catchSheet') e.currentTarget.classList.add('hidden'); });
  $('#bossSheet').addEventListener('click', function (e) { if (e.target.id === 'bossSheet') e.currentTarget.classList.add('hidden'); });
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') e.currentTarget.classList.add('hidden'); });

  // ---------- celebrations ----------
  const celQueue = [];
  function confetti() {
    const box = $('#confetti'); box.innerHTML = '';
    const colors = ['#ff5c8a', '#ffd23f', '#22c55e', '#38bdf8', '#8b5cf6', '#ff9f1c'];
    for (let i = 0; i < 70; i++) {
      const el = document.createElement('i');
      el.style.left = Math.random() * 100 + '%';
      el.style.background = colors[i % colors.length];
      el.style.animationDuration = (1.6 + Math.random() * 1.8) + 's';
      el.style.animationDelay = (Math.random() * 0.6) + 's';
      el.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      if (i % 3 === 0) el.style.borderRadius = '50%';
      box.appendChild(el);
    }
  }
  function extra(ico, html, cls, delay) { return '<div class="cel-extra ' + (cls || '') + '" style="animation-delay:' + delay + 's"><span class="e-ico">' + ico + '</span><span>' + html + '</span></div>'; }
  function celebrateCatch(cr, c, before, after, firstOfKind, unlocked, bossHits, spawned) {
    bossHits = bossHits || []; spawned = spawned || [];
    const el = $('#celebrate'); el.classList.remove('badge-mode', 'boss-mode');
    $('#celCreature').innerHTML = svg(cr.id);
    $('#celTitle').textContent = firstOfKind ? 'NEW CATCH!' : pickOne(['Gotcha!', 'Caught it!', 'Woohoo!', 'Super catch!']);
    $('#celName').textContent = cr.name + (c.count > 1 ? ' ×' + c.count : '');
    $('#celDesc').classList.add('hidden');
    $('#celPoints').textContent = '+' + G.catchPoints(c) + ' pts';
    $('#celPoints').classList.remove('hidden');
    let ex = '', d = 0.5;
    if (firstOfKind) { ex += extra('📖', 'New Litter-dex entry! <small>' + after.distinct + ' of ' + CREATURES.length + ' discovered</small>', '', d); d += 0.12; }
    if (after.level.level > before.level.level) { ex += extra('⬆️', 'Level up! Lv ' + after.level.level + ' <small>You\'re now a ' + after.level.title + '</small>', '', d); d += 0.12; }
    unlocked.quests.forEach(function (q) { ex += extra('📜', 'Quest complete! +' + q.reward + ' bonus <small>' + esc(q.title) + '</small>', '', d); d += 0.12; });
    unlocked.stories.forEach(function (s) { ex += extra(s.icon, 'Story finished! +' + s.reward + ' bonus <small>' + esc(s.title) + '</small>', '', d); d += 0.12; });
    spawned.forEach(function (inst) {
      const def = G.BOSS_BY_ID[inst.bossId];
      ex += extra(def.emoji, 'A park boss appeared! <small>' + esc(def.name) + ' — tap its pin on the map</small>', '', d); d += 0.12;
    });
    bossHits.forEach(function (h) {
      if (h.defeated) return; // defeat gets its own celebration
      ex += extra(h.def.emoji, 'Mess pile −' + h.dmg + '! <small>' + esc(h.def.name) + ' · ' + h.inst.hp + ' left</small>', '', d); d += 0.12;
    });
    if (after.streak > before.streak && after.streak > 1) { ex += extra('🔥', after.streak + '-day streak! <small>Come back tomorrow to keep it going</small>', '', d); d += 0.12; }
    if (cr.safety) ex += extra(cr.safety === 'adult' ? '⚠️' : '🧼', cr.safety === 'adult' ? 'Thanks, grown-up! Wrap sharp glass before binning it.' : 'Great job using gloves! Wash hands when you\'re done.', 'fact', d);
    else ex += extra('💡', esc(cr.fact), 'fact', d);
    $('#celExtras').innerHTML = ex;
    // Queue boss defeats first (big moment), then badges
    bossHits.filter(function (h) { return h.defeated; }).forEach(function (h) { celQueue.push({ __bossDefeat: true, hit: h }); });
    (unlocked.bossDefeats || []).forEach(function (d) {
      // avoid double if already queued from this catch's hit
      if (!bossHits.some(function (h) { return h.defeated && h.inst.id === d.inst.id; }))
        celQueue.push({ __bossDefeat: true, hit: { inst: d.inst, def: d.def, dmg: 0, defeated: true } });
    });
    unlocked.badges.forEach(function (b) { celQueue.push(b); });
    el.classList.remove('hidden'); confetti(); chime('catch');
    if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
  }

  function celebrateBossDefeat(hit) {
    const el = $('#celebrate'); el.classList.remove('badge-mode'); el.classList.add('boss-mode');
    const def = hit.def, inst = hit.inst;
    $('#celCreature').innerHTML = bossSvg(def.id);
    $('#celTitle').textContent = pickOne(['Sent packing!', 'All cleaned up!', 'Recycled away!', 'Boss busted!']);
    $('#celName').textContent = def.name;
    $('#celDesc').textContent = 'The mess pile is gone — nice teamwork!'; $('#celDesc').classList.remove('hidden');
    $('#celPoints').textContent = '+' + def.reward + ' pts'; $('#celPoints').classList.remove('hidden');
    const contribs = Object.keys(inst.contributions || {}).map(function (pid) {
      const who = state.profiles.find(function (p) { return p.id === pid; });
      return who ? who.avatar + ' ' + who.name + ' ×' + inst.contributions[pid] : null;
    }).filter(Boolean);
    let ex = '';
    ex += extra('🏅', 'Badge unlocked: ' + esc((G.BADGES.find(function (b) { return b.id === def.badge; }) || {}).name || 'Boss badge'), '', 0.4);
    if (contribs.length) ex += extra('👨‍👩‍👧', 'Crew helpers <small>' + esc(contribs.join(' · ')) + '</small>', '', 0.52);
    ex += extra('✨', 'Tap the map to find more park bosses after enough clean-ups in an area!', 'fact', 0.64);
    $('#celExtras').innerHTML = ex;
    el.classList.remove('hidden'); confetti(); chime('badge');
    if (navigator.vibrate) navigator.vibrate([30, 40, 30, 40, 80]);
  }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function celebrateBadge(b) {
    const el = $('#celebrate'); el.classList.remove('boss-mode', 'ispy-mode', 'room-mode'); el.classList.add('badge-mode');
    $('#celCreature').innerHTML = '<div class="badge-medal">' + b.icon + '</div>';
    $('#celTitle').textContent = 'Badge unlocked!';
    $('#celName').textContent = b.name;
    $('#celDesc').textContent = b.desc; $('#celDesc').classList.remove('hidden');
    $('#celPoints').classList.add('hidden');
    const left = G.BADGES.length - Object.keys(me().badges).length;
    $('#celExtras').innerHTML = extra('🏅', 'Find it on your Badges page <small>' + (left > 0 ? left + ' more badges to discover!' : 'You collected EVERY badge!') + '</small>', '', 0.4);
    const rec = me().badges[b.id]; if (rec) { rec.seen = true; save(); }
    el.classList.remove('hidden'); confetti(); chime('badge');
  }
  $('#celOk').addEventListener('click', function () {
    if (celQueue.length) {
      const next = celQueue.shift();
      if (next && next.__bossDefeat) celebrateBossDefeat(next.hit);
      else celebrateBadge(next);
      return;
    }
    $('#celebrate').classList.add('hidden');
    renderAll();
  });
  function flushBadges(unlocked) {
    (unlocked.bossDefeats || []).forEach(function (d) { celQueue.push({ __bossDefeat: true, hit: { inst: d.inst, def: d.def, dmg: 0, defeated: true } }); });
    unlocked.badges.forEach(function (b) { celQueue.push(b); });
    if (celQueue.length && $('#celebrate').classList.contains('hidden')) {
      const next = celQueue.shift();
      if (next && next.__bossDefeat) celebrateBossDefeat(next.hit); else celebrateBadge(next);
    }
  }

  // ---------- Litter-dex ----------
  function renderDex() {
    const s = myStats();
    $('#dexSummary').innerHTML = s.distinct + ' / ' + CREATURES.length + ' discovered · ' + s.items + ' litter caught<div class="dex-progress"><div style="width:' + Math.round(100 * s.distinct / CREATURES.length) + '%"></div></div>';
    $('#dexGrid').innerHTML = CREATURES.map(function (c, i) {
      const n = s.perType[c.id] || 0, R = RARITY[c.rarity];
      return '<button class="dex-card r-' + c.rarity + (n ? '' : ' locked') + '" data-id="' + c.id + '"><span class="num">#' + String(i + 1).padStart(3, '0') + '</span>' +
        (n ? '<span class="cnt">×' + n + '</span>' : '') + svg(c.id) + '<div class="d-name">' + (n ? esc(c.name) : '???') + '</div>' +
        '<div class="stars" style="color:' + R.color + '">' + '★'.repeat(R.stars) + '</div></button>';
    }).join('');
    $$('#dexGrid .dex-card').forEach(function (b) { b.addEventListener('click', function () { dexDetail(b.dataset.id); }); });
  }
  function dexDetail(id) {
    const c = G.byId[id], s = myStats(), n = s.perType[id] || 0, R = RARITY[c.rarity];
    const safety = c.safety === 'adult' ? '<p class="safety-note adult">⚠️ Grown-ups only! Kids, point it out but don\'t touch.</p>' : c.safety === 'gloves' ? '<p class="safety-note">🧤 Always wear gloves or ask a grown-up for this one.</p>' : '';
    openModal(n ? c.name : 'Mystery creature',
      '<div class="dex-big' + (n ? '' : ' locked') + '">' + (n ? svg(id) : '<span style="display:inline-block;filter:brightness(0) opacity(.22)">' + svg(id) + '</span>') +
      '<div style="font-weight:900;color:' + R.color + '">' + '★'.repeat(R.stars) + ' ' + R.label + ' · ' + c.points + ' pts</div></div>' +
      (n ? '<p>🗑️ Real-life litter: <b>' + esc(c.item) + '</b><br>🎒 You\'ve caught <b>' + n + '</b>.</p><p>💡 ' + esc(c.fact) + '</p>'
         : '<p>🔍 Hint: look for a <b>' + esc(c.item.toLowerCase()) + '</b>.</p>') + safety);
  }

  // ---------- Quests ----------
  function timeLeft(end) {
    const ms = end - Date.now(), h = Math.floor(ms / 3600000);
    if (h >= 48) return Math.floor(h / 24) + ' days left';
    if (h >= 1) return h + 'h left';
    return Math.max(1, Math.floor(ms / 60000)) + 'm left';
  }
  function questCard(q, mine, claims) {
    const v = G.questProgress(q, mine), done = !!claims[q.key] || v >= q.goal;
    return '<div class="quest ' + (q.period === 'd' ? 'daily' : 'weekly') + (done ? ' done' : '') + '"><div class="q-ico">' + (done ? '✅' : q.icon) + '</div><div class="q-body">' +
      '<div class="q-title">' + esc(q.title) + '</div><div class="qbar' + (done ? ' done' : '') + '"><div style="width:' + Math.round(100 * v / q.goal) + '%"></div></div>' +
      '<div class="q-sub"><span>' + (done ? 'Done! 🎉' : v + ' / ' + q.goal) + '</span><span class="q-reward">' + (done ? '+' + q.reward + ' earned' : '🎁 +' + q.reward + ' pts') + '</span></div></div></div>';
  }
  function renderQuests() {
    const p = me(), mine = G.catchesFor(state, p.id), now = Date.now(), s = myStats();
    const daily = G.questsFor('d', p, now), weekly = G.questsFor('w', p, now);
    const dDone = daily.filter(function (q) { return p.claims[q.key]; }).length;
    let h = '<div class="quest-group"><div class="quest-group-head"><h2>☀️ Daily quests <small style="font-size:14px;color:var(--muted)">' + dDone + '/3</small></h2><span class="timer-chip">⏰ ' + timeLeft(daily[0].end) + '</span></div>' +
      daily.map(function (q) { return questCard(q, mine, p.claims); }).join('') +
      (dDone < 3 ? '<p class="small-print" style="margin:0 4px">🌟 Finish all 3 today to earn the <b>Triple Star</b> badge!</p>' : '') + '</div>';
    h += '<div class="quest-group"><div class="quest-group-head"><h2>📅 Weekly quests</h2><span class="timer-chip">⏰ ' + timeLeft(weekly[0].end) + '</span></div>' +
      weekly.map(function (q) { return questCard(q, mine, p.claims); }).join('') + '</div>';
    h += '<div class="quest-group"><div class="quest-group-head"><h2>📖 Story quests</h2></div>';
    G.STORIES.forEach(function (st) {
      const ss = G.storyStatus(st, s), claimed = !!p.claims['s:' + st.id];
      const curIdx = ss.chapters.findIndex(function (c) { return !c.done; });
      const badge = G.BADGES.find(function (b) { return b.id === st.badge; });
      h += '<div class="story' + (claimed ? ' complete' : '') + '"><div class="story-head"><div class="st-ico">' + st.icon + '</div><div><h3>' + esc(st.title) + '</h3><small>' +
        (claimed ? '🏆 Complete! +' + st.reward + ' pts & ' + badge.icon + ' ' + esc(badge.name) : 'Chapter ' + Math.min(ss.doneCount + 1, 4) + ' of 4 · Reward: +' + st.reward + ' pts & ' + badge.icon + ' badge') + '</small></div></div>' +
        '<p class="story-text">' + esc(st.text) + '</p><div class="chapters">' +
        ss.chapters.map(function (c, i) {
          const cls = c.done ? 'done' : i === curIdx ? 'current' : 'locked-ch';
          return '<div class="chapter ' + cls + '"><span class="c-check">' + (c.done ? '✓' : i + 1) + '</span><span class="c-text">' + esc(c.t) + '</span>' + (!c.done && i === curIdx ? '<span class="c-prog">' + c.v + '/' + c.n + '</span>' : '') + '</div>';
        }).join('') + '</div></div>';
    });
    h += '</div>';
    $('#questsBox').innerHTML = h;
  }

  // ---------- Badges ----------
  function renderBadges() {
    const p = me(), s = myStats();
    const crew = G.crewInfo(state, p.id);
    const ctx = { profile: p, crew: crew };
    const earned = Object.keys(p.badges || {}).length;
    $('#badgeSummary').textContent = earned + ' of ' + G.BADGES.length + ' badges earned';
    $('#statsBox').innerHTML =
      '<div class="stat wide"><span class="big-ico">' + p.avatar + '</span><div><div class="v" style="font-size:22px">Level ' + s.level.level + ' · ' + s.level.title + '</div><div class="l">' + s.points + ' points · ' + (s.level.next - s.points) + ' to next level</div></div></div>' +
      '<div class="stat"><div class="v">' + s.items + '</div><div class="l">Litter caught</div></div>' +
      '<div class="stat"><div class="v">🔥' + s.streak + '</div><div class="l">Day streak (best ' + s.bestStreak + ')</div></div>' +
      '<div class="stat"><div class="v">' + s.spots + '</div><div class="l">Spots cleaned</div></div>';
    const cats = [];
    G.BADGES.forEach(function (b) { if (cats.indexOf(b.cat) < 0) cats.push(b.cat); });
    let h = '';
    cats.forEach(function (cat) {
      h += '<div class="badge-cat">' + esc(cat) + '</div><div class="badge-grid">';
      G.BADGES.filter(function (b) { return b.cat === cat; }).forEach(function (b) {
        const got = p.badges[b.id];
        let progress = '';
        if (!got && b.prog) { const pr = b.prog(s, ctx); progress = '<div class="b-prog"><div style="width:' + Math.round(100 * pr[0] / pr[1]) + '%"></div></div>'; }
        h += '<div class="badge' + (got ? '' : ' locked') + '">' + (got && !got.seen ? '<span class="b-new">NEW</span>' : '') +
          '<div class="b-ico"><span>' + (got ? b.icon : (b.cat === 'Story' ? '❔' : b.icon)) + '</span></div><div class="b-name">' + esc(b.name) + '</div><div class="b-desc">' + esc(b.desc) + '</div>' + progress + '</div>';
      });
      h += '</div>';
    });
    $('#badgeBox').innerHTML = h;
    const recent = s.list.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 8);
    $('#recentList').innerHTML = recent.length ? recent.map(function (c) {
      const cr = G.byId[c.type]; const d = new Date(c.ts);
      return '<li>' + svg(cr.id) + '<span class="r-meta">' + esc(cr.name) + (c.count > 1 ? ' ×' + c.count : '') + '<small>' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + (c.photo ? ' · 📸' : '') + '</small></span><span class="r-pts">+' + G.catchPoints(c) + '</span></li>';
    }).join('') : '<li class="empty">No catches yet. Tap the big Catch! button on the map 🧤</li>';
  }

  // ---------- Crew (local profiles + cross-phone Family/Class link) ----------
  let crewUnwatch = null;
  function applyRemoteRoom(room) {
    if (!room) return;
    state.remote = {
      members: room.members || [],
      catches: room.catches || []
    };
    if (state.link) {
      state.link.name = room.name || state.link.name;
      state.link.kind = room.kind || state.link.kind;
    }
    save();
    if (current === 'crew') renderCrew();
    renderPins();
  }
  function startCrewWatch() {
    if (crewUnwatch) { try { crewUnwatch(); } catch (e) {} crewUnwatch = null; }
    if (!state.link || !state.link.code || !window.LMCrewSync) return;
    crewUnwatch = window.LMCrewSync.watch(state.link.code, function (room) {
      if (room) applyRemoteRoom(room);
    });
  }
  function backendLabel() {
    if (!window.LMCrewSync) return 'offline';
    return window.LMCrewSync.firebaseReady() ? 'cloud' : 'this-device demo';
  }
  function renderLinkCard() {
    const el = $('#linkCard'); if (!el) return;
    const Sync = window.LMCrewSync;
    const cloud = Sync && Sync.firebaseReady();
    if (!state.link || !state.link.code) {
      el.className = 'link-card' + (cloud ? '' : ' offline');
      el.innerHTML =
        '<div class="lc-kicker">Family or class linking</div>' +
        '<div class="lc-name">Not linked to a shared crew yet</div>' +
        '<div class="lc-meta">A grown-up / teacher creates a crew and shares the 6-letter family or class code. Kids join with a nickname + emoji only — no emails. Photos stay on each phone; map pins are blurred (~150 m).' +
        (cloud ? '' : ' <b>Cloud sync needs a free Firebase config</b> (see CREW.md). Until then, create/join works for demos on this device/tabs.') +
        '</div>';
      return;
    }
    const kind = state.link.kind === 'class' ? 'Class' : 'Family';
    el.className = 'link-card';
    el.innerHTML =
      '<div class="lc-kicker">' + kind + ' crew · ' + esc(backendLabel()) + '</div>' +
      '<div class="lc-code">' + esc(state.link.code) + '</div>' +
      '<div class="lc-name">' + esc(state.link.name || (kind + ' crew')) + '</div>' +
      '<div class="lc-meta">You are <b>' + esc(me().name) + '</b> (' + (state.link.role === 'host' ? 'creator' : 'member') + '). Share this family or class code so others can join.</div>' +
      '<div class="lc-actions">' +
        '<button class="chip-btn go" id="copyCrewCode">📋 Copy code</button>' +
        '<button class="chip-btn" id="refreshCrew">🔄 Refresh</button>' +
        '<button class="chip-btn del" id="leaveCrewBtn">🚪 Leave crew</button>' +
      '</div>';
    const copy = $('#copyCrewCode');
    if (copy) copy.addEventListener('click', function () {
      const code = state.link.code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { toast('📋 Copied ' + code); }).catch(function () { toast(code); });
      } else { toast(code); }
    });
    const ref = $('#refreshCrew');
    if (ref) ref.addEventListener('click', function () {
      Sync.fetchCrew(state.link.code).then(function (room) {
        if (room) { applyRemoteRoom(room); toast('🔄 Crew updated'); }
        else toast('😕 Could not reach crew');
      }).catch(function () { toast('😕 Sync failed'); });
    });
    const leave = $('#leaveCrewBtn');
    if (leave) leave.addEventListener('click', function () { leaveLinkedCrew(); });
  }
  function renderCrew() {
    renderLinkCard();
    const Sync = window.LMCrewSync;
    const linked = !!(state.link && state.link.code);
    const rows = [];
    // Local device profiles
    const localCrew = G.crewInfo(state, me().id);
    localCrew.ranked.forEach(function (r) {
      rows.push({
        key: 'local:' + r.p.id,
        name: r.p.name,
        avatar: r.p.avatar,
        points: r.s.points,
        detail: 'Lv ' + r.s.level.level + ' · ' + r.s.items + ' caught · this phone',
        active: r.p.id === me().id,
        remote: false,
        profileId: r.p.id
      });
    });
    // Remote linked members
    if (linked) {
      (state.remote.members || []).forEach(function (m) {
        if (m.id === state.link.memberId) return; // already shown as local active identity
        // Avoid dup if nickname matches only — always show remote roster
        rows.push({
          key: 'remote:' + m.id,
          name: m.nickname || 'Crewmate',
          avatar: m.avatar || '🧤',
          points: m.points || 0,
          detail: (m.role === 'host' ? 'Creator · ' : '') + 'linked phone',
          active: false,
          remote: true,
          profileId: null
        });
      });
    }
    rows.sort(function (a, b) { return b.points - a.points; });
    const medals = ['🥇', '🥈', '🥉'];
    $('#leaderboard').innerHTML = rows.length ? rows.map(function (r, i) {
      return '<div class="lb-row' + (r.active ? ' active' : '') + (r.remote ? ' remote' : '') + '">' +
        '<span class="lb-rank">' + (medals[i] || (i + 1)) + '</span><span class="avatar">' + esc(r.avatar) + '</span>' +
        '<div class="lb-meta"><b>' + esc(r.name) + (r.active ? ' <small>(you)</small>' : '') +
        (r.remote ? '<span class="lb-tag">linked</span>' : '') + '</b><small>' + esc(r.detail) + '</small></div>' +
        '<div class="lb-pts">' + r.points + '<small>points</small></div>' +
        '<div class="lb-actions">' +
          (!r.remote && !r.active ? '<button class="chip-btn go" data-play="' + r.profileId + '">▶ Play as</button>' : '') +
          (!r.remote ? '<button class="chip-btn" data-edit="' + r.profileId + '">✏️ Edit</button>' : '') +
          (!r.remote && state.profiles.length > 1 ? '<button class="chip-btn del" data-del="' + r.profileId + '">🗑️ Remove</button>' : '') +
        '</div></div>';
    }).join('') : '<div class="lb-row"><div class="lb-meta"><b>No one here yet</b><small>Create or join a family / class crew!</small></div></div>';
    $$('[data-play]').forEach(function (b) { b.addEventListener('click', function () { switchTo(b.dataset.play); }); });
    $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editKid(b.dataset.edit); }); });
    $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { removeKid(b.dataset.del); }); });
    // Toggle action buttons when linked
    const createBtn = $('#createCrewBtn');
    const joinBtn = $('#joinCrewBtn');
    if (createBtn) createBtn.classList.toggle('hidden', linked);
    if (joinBtn) joinBtn.classList.toggle('hidden', linked);
  }
  function avatarPickerHtml(selected) {
    return '<div class="field">Pick an animal buddy</div><div class="avatar-pick">' +
      AVATARS.map(function (a) { return '<button type="button" data-av="' + a + '" class="' + (a === selected ? 'sel' : '') + '">' + a + '</button>'; }).join('') +
      '</div>';
  }
  function openCreateCrew() {
    const Sync = window.LMCrewSync;
    if (!Sync) { toast('Crew sync not loaded'); return; }
    let kind = 'family';
    let av = me().avatar || '🦊';
    openModal('Create family / class crew',
      '<p class="small-print">Grown-ups / teachers create the crew. Kids join later with the family or class code + a nickname only.</p>' +
      '<div class="kind-pick">' +
        '<button type="button" data-kind="family" class="sel">👨‍👩‍👧 Family</button>' +
        '<button type="button" data-kind="class">🏫 Class</button>' +
      '</div>' +
      '<label class="field">Crew name (optional)<input type="text" id="crewName" maxlength="32" placeholder="e.g. Rivera family or Room 12"></label>' +
      '<label class="field">Your nickname<input type="text" id="crewNick" maxlength="16" value="' + esc(me().name) + '" placeholder="e.g. Coach Sam"></label>' +
      avatarPickerHtml(av) +
      '<label class="field">Adult PIN (optional, for later moderation)<input type="password" id="crewPin" maxlength="8" inputmode="numeric" placeholder="4–8 digits"></label>' +
      '<button class="big-btn" id="crewCreateGo">Create &amp; get code ✨</button>' +
      '<p class="small-print">🔒 No kid emails. Shared map pins are blurred. Photos never upload.</p>');
    $$('.kind-pick button').forEach(function (b) {
      b.addEventListener('click', function () {
        kind = b.dataset.kind;
        $$('.kind-pick button').forEach(function (x) { x.classList.toggle('sel', x === b); });
      });
    });
    $$('.avatar-pick button').forEach(function (b) {
      b.addEventListener('click', function () {
        av = b.dataset.av;
        $$('.avatar-pick button').forEach(function (x) { x.classList.toggle('sel', x === b); });
      });
    });
    $('#crewCreateGo').addEventListener('click', function () {
      const name = ($('#crewName').value || '').trim();
      const nick = ($('#crewNick').value || '').trim() || 'Explorer';
      const pin = ($('#crewPin').value || '').trim();
      const btn = $('#crewCreateGo'); btn.disabled = true; btn.textContent = 'Creating…';
      Sync.createCrew({ name: name, kind: kind, nickname: nick, avatar: av, pin: pin }).then(function (res) {
        me().name = nick; me().avatar = av;
        state.link = {
          code: res.code,
          name: res.room.name,
          kind: res.room.kind,
          role: 'host',
          memberId: res.memberId,
          backend: Sync.backendName()
        };
        state.settings.mapFilter = 'crew';
        applyRemoteRoom(res.room);
        save();
        startCrewWatch();
        closeModal();
        renderAll();
        toast('🎉 Crew code ' + res.code + ' — share with your family or class!');
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = 'Create & get code ✨';
        toast('😕 Could not create crew');
        console.warn(err);
      });
    });
  }
  function openJoinCrew() {
    const Sync = window.LMCrewSync;
    if (!Sync) { toast('Crew sync not loaded'); return; }
    let av = me().avatar || '🐼';
    openModal('Join with family or class code',
      '<p class="small-print">Ask your grown-up or teacher for the 6-letter code. Use a nickname only — never your real full name or email.</p>' +
      '<label class="field">Family or class code<input type="text" id="joinCode" class="code-input" maxlength="6" placeholder="ABC123" autocomplete="off"></label>' +
      '<label class="field">Your nickname<input type="text" id="joinNick" maxlength="16" value="' + esc(me().name) + '" placeholder="e.g. Maya"></label>' +
      avatarPickerHtml(av) +
      '<label class="field">Adult PIN (only if they set one)<input type="password" id="joinPin" maxlength="8" inputmode="numeric" placeholder="optional"></label>' +
      '<button class="big-btn" id="crewJoinGo">Join crew 🔑</button>');
    $$('.avatar-pick button').forEach(function (b) {
      b.addEventListener('click', function () {
        av = b.dataset.av;
        $$('.avatar-pick button').forEach(function (x) { x.classList.toggle('sel', x === b); });
      });
    });
    $('#crewJoinGo').addEventListener('click', function () {
      const code = Sync.normalizeCode($('#joinCode').value);
      const nick = ($('#joinNick').value || '').trim() || 'Explorer';
      const pin = ($('#joinPin').value || '').trim();
      if (code.length < 6) { toast('Enter the full 6-letter code'); return; }
      const btn = $('#crewJoinGo'); btn.disabled = true; btn.textContent = 'Joining…';
      Sync.joinCrew({ code: code, nickname: nick, avatar: av, pin: pin }).then(function (res) {
        me().name = nick; me().avatar = av;
        state.link = {
          code: res.code,
          name: res.room.name,
          kind: res.room.kind,
          role: 'member',
          memberId: res.memberId,
          backend: Sync.backendName()
        };
        state.settings.mapFilter = 'crew';
        applyRemoteRoom(res.room);
        save();
        startCrewWatch();
        closeModal();
        renderAll();
        toast('🙌 Joined ' + (res.room.name || 'crew') + '!');
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = 'Join crew 🔑';
        if (err && err.code === 'NO_ROOM') {
          toast(Sync.firebaseReady()
            ? '😕 No crew with that code'
            : '😕 Code not found on this phone — cloud sync needed for other phones (CREW.md)');
        } else if (err && err.code === 'BAD_PIN') toast('😕 Wrong adult PIN');
        else { toast('😕 Could not join'); console.warn(err); }
      });
    });
  }
  function leaveLinkedCrew() {
    if (!state.link) return;
    if (!confirm('Leave this family / class crew on this phone? Your local catches stay here.')) return;
    const Sync = window.LMCrewSync;
    const code = state.link.code, mid = state.link.memberId;
    if (crewUnwatch) { try { crewUnwatch(); } catch (e) {} crewUnwatch = null; }
    if (Sync) Sync.leaveCrew(code, mid).catch(function () {});
    state.link = null;
    state.remote = { members: [], catches: [] };
    save();
    renderAll();
    toast('🚪 Left the shared crew');
  }
  function switchTo(id) {
    state.activeId = id; save();
    const un = G.evaluate(state, id, Date.now()); save();
    if (meMarker && pos) setPos(pos.lat, pos.lng, posSource, true);
    renderAll(); toast('👋 Hi ' + me().name + '! Happy hunting!');
    flushBadges(un);
  }
  function editKid(id) {
    const p = id ? state.profiles.find(function (x) { return x.id === id; }) : null;
    let av = p ? p.avatar : AVATARS[(state.profiles.length) % AVATARS.length];
    openModal(p ? 'Edit crew member' : 'Add on this phone',
      '<label class="field">Nickname<input type="text" id="kidName" maxlength="16" value="' + (p ? esc(p.name) : '') + '" placeholder="e.g. Maya"></label>' +
      avatarPickerHtml(av) +
      '<button class="big-btn" id="kidSave">' + (p ? 'Save ✅' : 'Add on this phone ➕') + '</button>' +
      '<p class="small-print">🔒 Tip: nickname only. For other phones, use Create / Join with a family or class code.</p>');
    $$('.avatar-pick button').forEach(function (b) { b.addEventListener('click', function () { av = b.dataset.av; $$('.avatar-pick button').forEach(function (x) { x.classList.toggle('sel', x === b); }); }); });
    $('#kidSave').addEventListener('click', function () {
      const name = $('#kidName').value.trim() || 'Explorer';
      if (p) { p.name = name; p.avatar = av; }
      else {
        const target = { id: uid(), name: name, avatar: av, createdAt: Date.now(), claims: {}, badges: {}, safetyPledgeAt: me().safetyPledgeAt || null };
        state.profiles.push(target);
      }
      save(); closeModal();
      let un = { badges: [] };
      state.profiles.forEach(function (x) { const r = G.evaluate(state, x.id, Date.now(), { silent: x.id !== me().id }); if (x.id === me().id) un = r; });
      save(); renderAll(); if (!p) toast('🎉 ' + name + ' added on this phone!');
      flushBadges(un);
    });
  }
  function removeKid(id) {
    const p = state.profiles.find(function (x) { return x.id === id; });
    if (!p || !confirm('Remove ' + p.name + ' and all their catches on this phone?')) return;
    state.profiles = state.profiles.filter(function (x) { return x.id !== id; });
    state.catches = state.catches.filter(function (c) { return c.profileId !== id; });
    if (state.activeId === id) state.activeId = state.profiles[0].id;
    save(); renderAll();
  }
  $('#addKidBtn').addEventListener('click', function () { editKid(null); });
  $('#createCrewBtn').addEventListener('click', openCreateCrew);
  $('#joinCrewBtn').addEventListener('click', openJoinCrew);
  $('#playerChip').addEventListener('click', function () {
    if (state.profiles.length < 2) { show('crew'); return; }
    openModal('Who\'s playing?', '<div class="leaderboard">' + state.profiles.map(function (p) {
      return '<button class="lb-row' + (p.id === me().id ? ' active' : '') + '" data-who="' + p.id + '" style="width:100%;text-align:left"><span class="avatar">' + esc(p.avatar) + '</span><div class="lb-meta"><b>' + esc(p.name) + '</b></div></button>';
    }).join('') + '</div>');
    $$('[data-who]').forEach(function (b) { b.addEventListener('click', function () { closeModal(); switchTo(b.dataset.who); }); });
  });

  // ---------- modal ----------
  function openModal(title, html) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
  function closeModal() { $('#modal').classList.add('hidden'); }

  // ---------- settings ----------
  $('#settingsBtn').addEventListener('click', function () {
    openModal('⚙️ Settings',
      '<label class="setting-row">🔊 Sounds <input type="checkbox" id="setSound"' + (state.settings.sound ? ' checked' : '') + '></label>' +
      '<button class="big-btn secondary small" id="setSafety">🦸 Safety Squad rules</button>' +
      '<button class="big-btn secondary small" id="setExport">💾 Export my data (JSON)</button>' +
      '<label class="big-btn secondary small" style="display:flex;align-items:center;justify-content:center;cursor:pointer">📂 Import data<input type="file" accept="application/json,.json" id="setImport" hidden></label>' +
      (state.demoActive ? '<button class="big-btn small" id="setDemoOff">🧹 Remove demo data</button>' : '<button class="big-btn secondary small" id="setDemo">✨ Load demo data</button>') +
      '<button class="big-btn danger small" id="setReset">🗑️ Reset everything</button>' +
      '<p class="small-print">🔒 Nicknames only — no kid emails. Photos stay on this device. Optional family/class crew sync shares blurred map pins (~150 m) and nicknames when a grown-up enables free Firebase (CREW.md). ' +
      'Map data © OpenStreetMap contributors. Demo data adds pretend catches near you; remove it any time.</p>');
    $('#setSound').addEventListener('change', function (e) { state.settings.sound = e.target.checked; save(); });
    $('#setSafety').addEventListener('click', function () { closeModal(); showOnboarding(true); });
    $('#setExport').addEventListener('click', exportData);
    $('#setImport').addEventListener('change', importData);
    const demo = $('#setDemo'); if (demo) demo.addEventListener('click', function () { loadDemo(); closeModal(); });
    const demoOff = $('#setDemoOff'); if (demoOff) demoOff.addEventListener('click', function () { removeDemo(); closeModal(); });
    $('#setReset').addEventListener('click', function () {
      if (!confirm('Delete ALL players, catches, badges and photos on this device?')) return;
      localStorage.removeItem(STORE_KEY); location.reload();
    });
  });
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'litter-crusaders-maps-' + G.dayKey(Date.now()) + '.json'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('💾 Saved your Litter Crusaders Maps data');
  }
  function importData(e) {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(function (txt) {
      const s = JSON.parse(txt);
      if (!s.profiles || !s.catches) throw new Error('bad');
      if (!confirm('Replace the data on this device with this file?')) return;
      state = s; save(); location.reload();
    }).catch(function () { toast('😕 That file doesn\'t look like Litter Crusaders Maps data'); });
  }


  // ---------- I Spy (car ride) ----------
  function ensureIspy(pr) {
    if (!pr.ispy) pr.ispy = { finds: 0, streak: 0, bestStreak: 0, seen: {} };
    return pr.ispy;
  }
  function openIspy() {
    const pr = me(); ensureIspy(pr);
    const deck = window.LMActivities.ispyDeck(pr.id, G.dayKey(Date.now()));
    // Pick next unseen today, or wrap
    let idx = 0;
    const seenToday = pr.ispy.seen[G.dayKey(Date.now())] || [];
    while (idx < deck.length && seenToday.indexOf(deck[idx].id) >= 0) idx++;
    if (idx >= deck.length) idx = 0;
    renderIspy(deck, idx);
    $('#ispySheet').classList.remove('hidden');
  }
  function renderIspy(deck, idx) {
    const pr = me(); const data = ensureIspy(pr);
    const item = deck[idx % deck.length];
    const day = G.dayKey(Date.now());
    const foundToday = (data.seen[day] || []).length;
    $('#ispyBody').innerHTML =
      '<div class="act-safety">🚘 <b>Grown-ups drive!</b> Kids play from a seatbelt — never while walking in traffic. I Spy does not need your location.</div>' +
      '<div class="act-progress"><span>👀 ' + data.finds + ' spotted · streak ' + data.streak + '</span><span>' + foundToday + ' today</span></div>' +
      '<div class="act-hero"><span class="act-emoji">' + item.emoji + '</span>' +
      '<div class="act-prompt">I Spy with my little eye…<br>' + esc(item.prompt) + '</div>' +
      '<div class="act-sub">Hint: ' + esc(item.hint) + '</div></div>' +
      '<label class="act-photo" id="ispyPhotoLabel"><input type="file" accept="image/*" capture="environment" id="ispyPhoto" hidden><span id="ispyPhotoText">📸 Snap it!</span></label>' +
      '<img class="act-preview hidden" id="ispyPreview" alt="Your I Spy photo">' +
      '<div class="act-actions"><button class="big-btn secondary small" id="ispySkip">Skip ➜</button>' +
      '<button class="big-btn small" id="ispyGot" disabled>Got it! ✨</button></div>' +
      '<p class="small-print">Photos stay on this device. I Spy finds are not litter catches.</p>';
    let photo = null;
    $('#ispyPhoto').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      $('#ispyPhotoText').textContent = '⏳ …';
      shrinkImage(f, 640, 0.7).then(function (dataUrl) {
        photo = dataUrl; const img = $('#ispyPreview'); img.src = dataUrl; img.classList.remove('hidden');
        $('#ispyPhotoText').textContent = '📸 Retake'; $('#ispyGot').disabled = false;
      }).catch(function () { $('#ispyPhotoText').textContent = '📸 Snap it!'; });
    });
    $('#ispySkip').addEventListener('click', function () {
      data.streak = 0; save();
      renderIspy(deck, idx + 1);
    });
    $('#ispyGot').addEventListener('click', function () {
      if (!photo) return;
      data.finds = (data.finds || 0) + 1;
      data.streak = (data.streak || 0) + 1;
      data.bestStreak = Math.max(data.bestStreak || 0, data.streak);
      data.seen[day] = data.seen[day] || [];
      if (data.seen[day].indexOf(item.id) < 0) data.seen[day].push(item.id);
      // Small bonus points via claims
      const key = 'ispy:' + day + ':' + item.id;
      pr.claims = pr.claims || {};
      if (!pr.claims[key]) pr.claims[key] = { ts: Date.now(), pts: 5, title: 'I Spy: ' + item.prompt, demo: !!state.demoActive };
      const un = G.evaluate(state, pr.id, Date.now());
      save();
      $('#ispySheet').classList.add('hidden');
      celebrateActivity('ispy', item, 5, un);
    });
  }
  $('#ispyBtn').addEventListener('click', openIspy);
  $('#ispySheet').addEventListener('click', function (e) { if (e.target.id === 'ispySheet') e.currentTarget.classList.add('hidden'); });

  // ---------- What's different? (home) ----------
  function ensureRoom(pr) {
    if (!pr.room) pr.room = { baseline: null, baselineAt: null, finds: 0, round: null };
    return pr.room;
  }
  function openRoom() {
    renderRoom();
    $('#roomSheet').classList.remove('hidden');
  }
  function renderRoom() {
    const pr = me(); const room = ensureRoom(pr);
    if (!room.baseline) {
      $('#roomBody').innerHTML =
        '<div class="act-safety home">🏠 <b>At home mode</b> — after a tidy-up, snap your clean room. Later, spot what changed! Grown-ups can help confirm. Photos stay on this device.</div>' +
        '<div class="act-hero"><span class="act-emoji">✨</span><div class="act-prompt">Snap your clean room</div>' +
        '<div class="act-sub">Make the bed, put toys away, then take a baseline photo.</div></div>' +
        '<label class="act-photo"><input type="file" accept="image/*" capture="environment" id="roomBaseline" hidden><span>📷 Clean-room photo</span></label>' +
        '<img class="act-preview hidden" id="roomBasePrev" alt="Baseline">' +
        '<button class="big-btn" id="roomSaveBase" disabled>Save baseline ✅</button>' +
        '<p class="small-print">Tip: same angle next time makes differences easier to spot!</p>';
      let photo = null;
      $('#roomBaseline').addEventListener('change', function (e) {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        shrinkImage(f, 720, 0.72).then(function (d) {
          photo = d; const img = $('#roomBasePrev'); img.src = d; img.classList.remove('hidden');
          $('#roomSaveBase').disabled = false;
        });
      });
      $('#roomSaveBase').addEventListener('click', function () {
        if (!photo) return;
        room.baseline = photo; room.baselineAt = Date.now(); room.round = null;
        const un = G.evaluate(state, pr.id, Date.now());
        save(); renderRoom(); flushBadges(un);
        toast('📷 Clean-room baseline saved!');
      });
      return;
    }
    // Have baseline — start or continue a round
    if (!room.round || !room.round.prompts) {
      const rid = Date.now().toString(36);
      room.round = { id: rid, startedAt: Date.now(), prompts: window.LMActivities.roomDeck(pr.id, rid), found: {}, after: null };
    }
    const round = room.round;
    const foundN = Object.keys(round.found).length;
    const ageMin = Math.max(0, Math.round((Date.now() - (room.baselineAt || Date.now())) / 60000));
    $('#roomBody').innerHTML =
      '<div class="act-safety home">🧼 Spot what is different from your clean room. A grown-up can help confirm. Not a litter catch!</div>' +
      '<div class="act-progress"><span>🔍 ' + room.finds + ' differences found</span><span>Baseline ' + (ageMin < 60 ? ageMin + 'm ago' : Math.round(ageMin / 60) + 'h ago') + '</span></div>' +
      '<div class="baseline-row"><figure><img src="' + room.baseline + '" alt="Before"><figcaption>Clean room (before)</figcaption></figure>' +
      '<figure>' + (round.after ? '<img src="' + round.after + '" alt="After">' : '<div style="height:110px;display:grid;place-items:center;font-size:40px;background:#f1f5f9;border-radius:12px">❓</div>') +
      '<figcaption>Now (after)</figcaption></figure></div>' +
      (round.after ? '' : '<label class="act-photo"><input type="file" accept="image/*" capture="environment" id="roomAfter" hidden><span>📸 Snap the room again</span></label>') +
      '<div class="diff-list" id="diffList"></div>' +
      '<div class="act-actions"><button class="big-btn secondary small" id="roomNewBase">📷 New baseline</button>' +
      '<button class="big-btn secondary small" id="roomNewRound">🔄 New round</button></div>';
    const list = $('#diffList');
    list.innerHTML = round.prompts.map(function (d) {
      const got = !!round.found[d.id];
      return '<div class="diff-item' + (got ? ' found' : '') + '" data-id="' + d.id + '"><span class="d-emoji">' + d.emoji + '</span>' +
        '<span class="d-text">' + esc(d.prompt) + '<small>' + esc(d.hint) + '</small></span>' +
        '<button type="button">' + (got ? 'Found ✓' : (round.after ? 'I see it!' : 'Need photo')) + '</button></div>';
    }).join('');
    if (!round.after) {
      const inp = $('#roomAfter');
      if (inp) inp.addEventListener('change', function (e) {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        shrinkImage(f, 720, 0.72).then(function (d) { round.after = d; save(); renderRoom(); });
      });
    }
    $$('#diffList .diff-item button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!round.after) { toast('📸 Snap the room again first!'); return; }
        const id = btn.closest('.diff-item').dataset.id;
        if (round.found[id]) return;
        // Grown-up confirm for kid-friendliness
        const diff = round.prompts.find(function (x) { return x.id === id; });
        if (!confirm('Grown-up helper: does this look different?\n\n' + diff.prompt)) return;
        round.found[id] = { ts: Date.now() };
        room.finds = (room.finds || 0) + 1;
        pr.claims = pr.claims || {};
        const key = 'room:' + round.id + ':' + id;
        if (!pr.claims[key]) pr.claims[key] = { ts: Date.now(), pts: 8, title: 'Room diff: ' + diff.prompt, demo: !!state.demoActive };
        const un = G.evaluate(state, pr.id, Date.now());
        save();
        celebrateActivity('room', diff, 8, un);
        // Keep sheet open underneath; re-render after celebration dismisses via renderAll — also refresh list now
        renderRoom();
      });
    });
    $('#roomNewBase').addEventListener('click', function () {
      if (!confirm('Replace the clean-room baseline photo?')) return;
      room.baseline = null; room.baselineAt = null; room.round = null; save(); renderRoom();
    });
    $('#roomNewRound').addEventListener('click', function () {
      room.round = null; save(); renderRoom();
    });
  }
  $('#roomBtn').addEventListener('click', openRoom);
  $('#roomSheet').addEventListener('click', function (e) { if (e.target.id === 'roomSheet') e.currentTarget.classList.add('hidden'); });

  function celebrateActivity(kind, item, pts, unlocked) {
    const el = $('#celebrate');
    el.classList.remove('badge-mode', 'boss-mode');
    el.classList.toggle('ispy-mode', kind === 'ispy');
    el.classList.toggle('room-mode', kind === 'room');
    $('#celCreature').innerHTML = '<div class="badge-medal" style="font-size:84px">' + item.emoji + '</div>';
    $('#celTitle').textContent = kind === 'ispy' ? 'Spotted!' : 'Different!';
    $('#celName').textContent = kind === 'ispy' ? item.prompt : item.prompt;
    $('#celDesc').textContent = kind === 'ispy' ? 'Great eyes on the road trip!' : 'Nice detective work in your room!';
    $('#celDesc').classList.remove('hidden');
    $('#celPoints').textContent = '+' + pts + ' pts'; $('#celPoints').classList.remove('hidden');
    let ex = '';
    if (kind === 'ispy') ex += extra('🚗', 'I Spy find logged <small>Road Trip Scout progress: ' + me().ispy.finds + '/8</small>', '', 0.4);
    else ex += extra('🏠', 'Room difference found <small>Room Ranger progress: ' + me().room.finds + '/5</small>', '', 0.4);
    $('#celExtras').innerHTML = ex;
    (unlocked.badges || []).forEach(function (b) { celQueue.push(b); });
    el.classList.remove('hidden'); confetti(); chime('catch');
  }

  // ---------- demo data ----------
  function loadDemo() {
    const base = pos || state.settings.lastPos || DEFAULT_POS;
    state.demoActive = true;
    const now = Date.now(), p = me();
    const r = (function () { let a = 7; return function () { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    function near(spread) { return { lat: base.lat + (r() - 0.5) * spread / 111320, lng: base.lng + (r() - 0.5) * spread / (111320 * Math.cos(base.lat * Math.PI / 180)) }; }
    // a handful of "spots" around the player (meters east, north)
    const SPOTS = [[0, 0], [-170, 120], [150, -160], [210, 170], [-230, -150], [60, 290], [-300, 280]];
    function add(pid, type, n, daysAgo, hour, spot) {
      const t = new Date(G.addDays(G.startOfDay(now), -daysAgo)); t.setHours(hour, Math.floor(r() * 59));
      let ts = t.getTime(); if (ts > now) ts = Math.max(G.startOfDay(now), now - Math.floor(r() * 3600000));
      const o = SPOTS[spot % SPOTS.length], j = near(40);
      const w = { lat: j.lat + o[1] / 111320, lng: j.lng + o[0] / (111320 * Math.cos(base.lat * Math.PI / 180)) };
      state.catches.push({ id: uid(), profileId: pid, type: type, count: n, lat: w.lat, lng: w.lng, ts: ts, demo: true });
    }
    // The current player: a few days of activity
    [['bottle', 2, 0, 9], ['can', 1, 0, 9], ['wrapper', 3, 0, 8], ['cap', 2, 1, 16], ['paper', 1, 1, 16], ['cup', 1, 1, 17],
     ['bag', 1, 2, 10], ['butt', 2, 2, 10], ['straw', 1, 3, 15], ['bottle', 1, 3, 15], ['can', 2, 4, 11], ['wrapper', 1, 4, 11]]
      .forEach(function (x, i) { add(p.id, x[0], x[1], x[2], x[3], [0, 0, 1, 2, 2, 3, 4, 4, 5, 3, 1, 0][i]); });
    // Demo crew mates
    const kids = [{ name: 'Maya', avatar: '🦄' }, { name: 'Leo', avatar: '🦖' }];
    kids.forEach(function (k, ki) {
      const kid = { id: uid(), name: k.name, avatar: k.avatar, createdAt: now, claims: {}, badges: {}, safetyPledgeAt: now, demo: true };
      state.profiles.push(kid);
      const types = ki === 0 ? ['bottle', 'can', 'bag', 'paper', 'cup', 'wrapper', 'cap', 'glass'] : ['wrapper', 'cap', 'can', 'straw'];
      types.forEach(function (t, i) { add(kid.id, t, 1 + (i % 3), i % 4, 10 + i, i + ki * 3); });
    });
    // Seed park bosses: one nearly cleaned (Park Pest) near the player, one mid-progress farther out
    state.bosses = (state.bosses || []).filter(function (b) { return !b.demo; });
    const demoKids = state.profiles.filter(function (x) { return x.demo; });
    const maya = demoKids.find(function (k) { return k.name === 'Maya'; });
    const leo = demoKids.find(function (k) { return k.name === 'Leo'; });
    const pest = G.makeBossInstance(G.BOSS_BY_ID.park_pest, G.cellKey(base.lat, base.lng),
      { lat: base.lat + 0.00035, lng: base.lng + 0.00025 }, now, true);
    pest.hp = 3;
    pest.contributions[p.id] = 5;
    if (maya) pest.contributions[maya.id] = 3;
    if (leo) pest.contributions[leo.id] = 1;
    state.bosses.push(pest);
    const blobPos = { lat: base.lat - 0.0012, lng: base.lng + 0.0010 };
    const blob = G.makeBossInstance(G.BOSS_BY_ID.beach_blob, G.cellKey(blobPos.lat, blobPos.lng), blobPos, now, true);
    blob.hp = 9;
    blob.contributions[p.id] = 3;
    if (maya) blob.contributions[maya.id] = 2;
    state.bosses.push(blob);

    state.profiles.forEach(function (x) { G.evaluate(state, x.id, now, { silent: true }); });
    save(); renderAll();
    if (map) map.setView([base.lat, base.lng], 16);
    // Prefer Golden Gate Park fence for demo (fixture if Overpass flaky)
    try {
      const fix = window.LMParks.fixtureNear(base.lat, base.lng) || window.LMParks.FIXTURE_GGP;
      if (fix) {
        fix.contains = window.LMParks.pointInRing(base.lat, base.lng, fix.ring);
        applyPark(fix, 'found', { demo: true });
      }
    } catch (e) { console.warn(e); }
    toast('✨ Demo data loaded — a Park Pest is almost cleaned up!');
  }
  function removeDemo() {
    state.catches = state.catches.filter(function (c) { return !c.demo; });
    state.profiles = state.profiles.filter(function (p) { return !p.demo; });
    state.bosses = (state.bosses || []).filter(function (b) { return !b.demo; });
    if (!state.profiles.find(function (p) { return p.id === state.activeId; })) state.activeId = state.profiles[0].id;
    state.profiles.forEach(function (p) {
      Object.keys(p.badges || {}).forEach(function (k) { if (p.badges[k].demo) delete p.badges[k]; });
      Object.keys(p.claims || {}).forEach(function (k) { if (p.claims[k].demo) delete p.claims[k]; });
    });
    state.demoActive = false;
    state.profiles.forEach(function (x) { G.evaluate(state, x.id, Date.now(), { silent: true }); });
    save(); renderAll(); toast('🧹 Demo data removed');
  }

  // ---------- onboarding ----------
  function showOnboarding(again) {
    $('#obCreatures').innerHTML = svg('can') + svg('wrapper') + svg('bottle') + svg('bag') + svg('cap');
    const box = $('#pledgeBox'), btn = $('#startBtn');
    box.checked = !!again; btn.disabled = !again;
    btn.textContent = again ? 'Back to the hunt! 🚀' : 'Let\'s go! 🚀';
    $('#onboarding').classList.remove('hidden');
  }
  $('#pledgeBox').addEventListener('change', function (e) { $('#startBtn').disabled = !e.target.checked; });
  $('#startBtn').addEventListener('click', function () {
    $('#onboarding').classList.add('hidden');
    const first = !state.settings.onboarded;
    state.settings.onboarded = true;
    state.profiles.forEach(function (p) { if (!p.safetyPledgeAt) p.safetyPledgeAt = Date.now(); });
    save();
    if (!map) initMap(); else map.invalidateSize();
    const un = G.evaluate(state, me().id, Date.now()); save();
    renderAll();
    if (first) flushBadges(un);
  });

  // ---------- boot ----------
  function renderAll() {
    renderHeader(); renderPins();
    if (current === 'dex') renderDex();
    if (current === 'quests') renderQuests();
    if (current === 'badges') renderBadges();
    if (current === 'crew') renderCrew();
  }
  // Resume linked crew watch after reload
  if (state.link && state.link.code) {
    startCrewWatch();
    if (window.LMCrewSync) {
      window.LMCrewSync.fetchCrew(state.link.code).then(function (room) {
        if (room) applyRemoteRoom(room);
      }).catch(function () {});
    }
  }

  window.LitterMap = { state: function () { return state; }, loadDemo: loadDemo, removeDemo: removeDemo, show: show, openBoss: openBossSheet, spawnBosses: function () { return G.spawnBosses(state); }, openIspy: openIspy, openRoom: openRoom, lookupPark: function (lat, lng, force) { return lookupPark(lat || (pos && pos.lat), lng || (pos && pos.lng), !!force); }, applyPark: applyPark, fitPark: fitParkView };

  if (!state.settings.onboarded) showOnboarding(false);
  else initMap();
  renderAll();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
