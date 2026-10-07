/* Litter Crusaders Maps — game rules: points, levels, stats, badges, quests, story quests, and park bosses.
   Pure-ish functions over the saved state so the UI can just re-render. */
(function () {
  'use strict';
  const C = window.LM_CREATURES;
  const byId = {};
  C.forEach(function (c) { byId[c.id] = c; });
  const COMMONS = C.filter(function (c) { return c.rarity === 'common'; }).map(function (c) { return c.id; });
  const SPOT_RADIUS_M = 100;
  const DAY = 86400000;

  // ---------- time helpers ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function startOfWeek(ts) { const d = new Date(startOfDay(ts)); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.getTime(); }
  function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }

  // ---------- geo ----------
  function distM(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  // Greedy clustering: each catch farther than SPOT_RADIUS_M from every known spot starts a new spot.
  function spotsOf(catches, seed) {
    const spots = (seed || []).slice();
    catches.slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (c) {
      if (!spots.some(function (s) { return distM(s, c) < SPOT_RADIUS_M; })) spots.push({ lat: c.lat, lng: c.lng });
    });
    return spots;
  }

  // ---------- rng ----------
  function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
  function rng(seedStr) { let a = hash(seedStr); return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- points & levels ----------
  const TITLES = ['Litter Spotter', 'Trash Tracker', 'Wrapper Wrangler', 'Bin Buddy', 'Park Protector', 'Street Star', 'Eco Explorer', 'Recycling Ranger', 'Earth Hero', 'Planet Champion'];
  function levelThreshold(L) { return 25 * (L - 1) * L / 2; }
  function levelInfo(points) {
    let L = 1;
    while (points >= levelThreshold(L + 1)) L++;
    const lo = levelThreshold(L), hi = levelThreshold(L + 1);
    return { level: L, title: TITLES[Math.min(L, TITLES.length) - 1], into: points - lo, need: hi - lo, pct: Math.round(100 * (points - lo) / (hi - lo)), next: hi };
  }
  function catchPoints(c) { const cr = byId[c.type]; return (cr ? cr.points : 5) * (c.count || 1); }

  // ---------- stats ----------
  function catchesFor(state, pid) { return state.catches.filter(function (c) { return c.profileId === pid; }); }
  function bonusPoints(profile) { let s = 0; Object.keys(profile.claims || {}).forEach(function (k) { s += profile.claims[k].pts || 0; }); return s; }

  function streaks(daySet, now) {
    let best = 0, run = 0, prev = null;
    Array.from(daySet).sort().forEach(function (k) {
      const t = new Date(k + 'T00:00:00').getTime();
      run = (prev !== null && Math.round((t - prev) / DAY) === 1) ? run + 1 : 1;
      best = Math.max(best, run); prev = t;
    });
    let cur = 0, t = startOfDay(now);
    if (!daySet.has(dayKey(t))) t = addDays(t, -1);
    while (daySet.has(dayKey(t))) { cur++; t = addDays(t, -1); }
    return { current: cur, best: best };
  }

  function stats(state, pid, now) {
    now = now || Date.now();
    const profile = state.profiles.find(function (p) { return p.id === pid; });
    const list = catchesFor(state, pid);
    const perType = {}; const days = new Set(); const perDay = {};
    let items = 0, pts = 0, photos = 0, rare = 0;
    list.forEach(function (c) {
      const n = c.count || 1; items += n; pts += catchPoints(c);
      perType[c.type] = (perType[c.type] || 0) + n;
      const k = dayKey(c.ts); days.add(k); perDay[k] = (perDay[k] || 0) + n;
      if (c.photo) photos++;
      const cr = byId[c.type]; if (cr && (cr.rarity === 'rare' || cr.rarity === 'legendary')) rare += n;
    });
    const st = streaks(days, now);
    const bonus = profile ? bonusPoints(profile) : 0;
    const points = pts + bonus;
    let maxDay = 0; Object.keys(perDay).forEach(function (k) { maxDay = Math.max(maxDay, perDay[k]); });
    let maxType = 0; Object.keys(perType).forEach(function (k) { maxType = Math.max(maxType, perType[k]); });
    return {
      items: items, events: list.length, perType: perType, distinct: Object.keys(perType).length,
      catchPts: pts, bonus: bonus, points: points, level: levelInfo(points),
      days: days.size, streak: st.current, bestStreak: st.best, maxDay: maxDay, maxType: maxType,
      photos: photos, rare: rare, spots: spotsOf(list).length,
      commonsCaught: COMMONS.filter(function (id) { return perType[id]; }).length,
      questsDone: profile ? Object.keys(profile.claims || {}).filter(function (k) { return k[0] === 'd' || k[0] === 'w'; }).length : 0,
      storiesDone: profile ? Object.keys(profile.claims || {}).filter(function (k) { return k[0] === 's'; }).length : 0,
      dailyTriple: profile ? hasDailyTriple(profile) : false,
      bossesDefeated: profile ? Object.keys(profile.claims || {}).filter(function (k) { return k.indexOf('b:') === 0; }).length : 0,
      ispyFinds: profile && profile.ispy ? (profile.ispy.finds || 0) : 0,
      ispyBestStreak: profile && profile.ispy ? (profile.ispy.bestStreak || 0) : 0,
      roomFinds: profile && profile.room ? (profile.room.finds || 0) : 0,
      list: list
    };
  }
  function hasDailyTriple(profile) {
    const per = {};
    Object.keys(profile.claims || {}).forEach(function (k) { if (k[0] === 'd') { const day = k.split(':')[1]; per[day] = (per[day] || 0) + 1; } });
    return Object.keys(per).some(function (d) { return per[d] >= 3; });
  }

  function crewInfo(state, pid, now) {
    const members = state.profiles;
    const ranked = members.map(function (p) { const s = stats(state, p.id, now); return { p: p, s: s }; })
      .sort(function (a, b) { return b.s.points - a.s.points; });
    const myDays = new Set(catchesFor(state, pid).map(function (c) { return dayKey(c.ts); }));
    const teamDay = state.catches.some(function (c) { return c.profileId !== pid && myDays.has(dayKey(c.ts)); });
    return { size: members.length, ranked: ranked, teamDay: teamDay, isTop: members.length > 1 && ranked[0].p.id === pid && ranked[0].s.points > 0 && (ranked.length < 2 || ranked[0].s.points > ranked[1].s.points) };
  }

  // ---------- badges ----------
  function prog(cur, goal) { return [Math.min(cur, goal), goal]; }
  const BADGES = [
    // Getting started
    { id: 'glove_guardian', cat: 'Getting started', icon: '🧤', name: 'Glove Guardian', desc: 'Took the Safety Squad pledge', test: function (s, x) { return !!x.profile.safetyPledgeAt; } },
    { id: 'first_catch', cat: 'Getting started', icon: '🎉', name: 'First Catch', desc: 'Catch your very first creature', test: function (s) { return s.items >= 1; }, prog: function (s) { return prog(s.items, 1); } },
    { id: 'first_photo', cat: 'Getting started', icon: '📸', name: 'Snapshot Scout', desc: 'Snap a flex pic of a catch', test: function (s) { return s.photos >= 1; } },
    { id: 'park_finder', cat: 'Getting started', icon: '🏞️', name: 'Park Finder', desc: 'Discover a real park on the map', test: function (s, x) { return !!(x.profile.parkFoundAt || (x.state && x.state.park && x.state.park.name)); } },
    { id: 'road_trip_scout', cat: 'On the way', icon: '🚗', name: 'Road Trip Scout', desc: 'Spot 8 things on an I Spy ride', test: function (s) { return s.ispyFinds >= 8; }, prog: function (s) { return prog(s.ispyFinds, 8); } },
    { id: 'ispy_streak', cat: 'On the way', icon: '👀', name: 'Eagle Eyes', desc: 'Find 3 I Spy things in a row without skipping', test: function (s) { return s.ispyBestStreak >= 3; }, prog: function (s) { return prog(s.ispyBestStreak, 3); } },
    { id: 'room_ranger', cat: 'At home', icon: '🏠', name: 'Room Ranger', desc: 'Spot 5 differences after a room tidy-up', test: function (s) { return s.roomFinds >= 5; }, prog: function (s) { return prog(s.roomFinds, 5); } },
    { id: 'room_baseline', cat: 'At home', icon: '📷', name: 'Clean-Room Capper', desc: 'Snap a clean-room baseline photo', test: function (s, x) { return !!(x.profile.room && x.profile.room.baseline); } },
    // Catch counts
    { id: 'catch_10', cat: 'Catch counts', icon: '🔟', name: 'Litter Cadet', desc: 'Catch 10 pieces of litter', test: function (s) { return s.items >= 10; }, prog: function (s) { return prog(s.items, 10); } },
    { id: 'catch_50', cat: 'Catch counts', icon: '⭐', name: 'Clean Machine', desc: 'Catch 50 pieces of litter', test: function (s) { return s.items >= 50; }, prog: function (s) { return prog(s.items, 50); } },
    { id: 'catch_100', cat: 'Catch counts', icon: '💯', name: 'Century Cleaner', desc: 'Catch 100 pieces of litter', test: function (s) { return s.items >= 100; }, prog: function (s) { return prog(s.items, 100); } },
    { id: 'catch_250', cat: 'Catch counts', icon: '🚀', name: 'Planet Protector', desc: 'Catch 250 pieces of litter', test: function (s) { return s.items >= 250; }, prog: function (s) { return prog(s.items, 250); } },
    { id: 'big_haul', cat: 'Catch counts', icon: '💪', name: 'Big Haul', desc: 'Catch 20 pieces in one day', test: function (s) { return s.maxDay >= 20; }, prog: function (s) { return prog(s.maxDay, 20); } },
    // Collection
    { id: 'all_commons', cat: 'Collection', icon: '🌈', name: 'Common Collector', desc: 'Catch every Common creature', test: function (s) { return s.commonsCaught >= COMMONS.length; }, prog: function (s) { return prog(s.commonsCaught, COMMONS.length); } },
    { id: 'first_rare', cat: 'Collection', icon: '💎', name: 'Rare Finder', desc: 'Catch a Rare or Legendary creature', test: function (s) { return s.rare >= 1; } },
    { id: 'mystery', cat: 'Collection', icon: '🦄', name: 'Mystery Solver', desc: 'Catch a Mystery Mimic', test: function (s) { return !!s.perType.mystery; } },
    { id: 'specialist', cat: 'Collection', icon: '🎯', name: 'Specialist', desc: 'Catch 10 of the same creature', test: function (s) { return s.maxType >= 10; }, prog: function (s) { return prog(s.maxType, 10); } },
    { id: 'dex_complete', cat: 'Collection', icon: '🏆', name: "Clean 'Em All", desc: 'Fill the whole Litter-dex', test: function (s) { return s.distinct >= C.length; }, prog: function (s) { return prog(s.distinct, C.length); } },
    // Streaks & explore
    { id: 'streak_3', cat: 'Streaks & exploring', icon: '🔥', name: 'On Fire', desc: 'Clean up 3 days in a row', test: function (s) { return s.bestStreak >= 3; }, prog: function (s) { return prog(s.bestStreak, 3); } },
    { id: 'streak_7', cat: 'Streaks & exploring', icon: '🌋', name: 'Week Warrior', desc: 'Clean up 7 days in a row', test: function (s) { return s.bestStreak >= 7; }, prog: function (s) { return prog(s.bestStreak, 7); } },
    { id: 'spots_5', cat: 'Streaks & exploring', icon: '🏘️', name: 'Neighborhood Hero', desc: 'Clean up in 5 different spots', test: function (s) { return s.spots >= 5; }, prog: function (s) { return prog(s.spots, 5); } },
    { id: 'spots_15', cat: 'Streaks & exploring', icon: '🧭', name: 'Trailblazer', desc: 'Clean up in 15 different spots', test: function (s) { return s.spots >= 15; }, prog: function (s) { return prog(s.spots, 15); } },
    // Quests
    { id: 'quest_1', cat: 'Quests', icon: '📜', name: 'Quest Rookie', desc: 'Clear your first quest', test: function (s) { return s.questsDone >= 1; } },
    { id: 'daily_triple', cat: 'Quests', icon: '🌟', name: 'Triple Star', desc: 'Clear all 3 daily quests in one day', test: function (s) { return s.dailyTriple; } },
    { id: 'quest_10', cat: 'Quests', icon: '🗝️', name: 'Quest Master', desc: 'Clear 10 quests', test: function (s) { return s.questsDone >= 10; }, prog: function (s) { return prog(s.questsDone, 10); } },
    // Story (awarded by story quests)
    { id: 'story_park', cat: 'Story', icon: '🐿️', name: 'Park Ranger', desc: 'Finish "The Park Rescue"', story: 'park' },
    { id: 'story_ocean', cat: 'Story', icon: '🐢', name: 'Ocean Guardian', desc: 'Finish "Ocean Friends"', story: 'ocean' },
    { id: 'story_explorer', cat: 'Story', icon: '🗺️', name: 'Map Maker', desc: 'Finish "The Great Explorer"', story: 'explorer' },
    { id: 'story_legend', cat: 'Story', icon: '👑', name: 'Living Legend', desc: 'Finish "Legend of the Mystery Mimic"', story: 'legend' },
    // Park bosses
    { id: 'boss_park_pest', cat: 'Park bosses', icon: '🦝', name: 'Pest Pacifier', desc: 'Send the Park Pest packing', boss: 'park_pest' },
    { id: 'boss_trash_titan', cat: 'Park bosses', icon: '🗑️', name: 'Titan Tamer', desc: 'Recycle away the Trash Titan', boss: 'trash_titan' },
    { id: 'boss_beach_blob', cat: 'Park bosses', icon: '🫧', name: 'Blob Banisher', desc: 'Clean up the Beach Blob', boss: 'beach_blob' },
    { id: 'boss_playground_pile', cat: 'Park bosses', icon: '🛝', name: 'Pile Popper', desc: 'Clear the Playground Pile', boss: 'playground_pile' },
    { id: 'boss_picnic_phantom', cat: 'Park bosses', icon: '🧺', name: 'Phantom Packer', desc: 'Pack away the Picnic Phantom', boss: 'picnic_phantom' },
    { id: 'boss_street_scourge', cat: 'Park bosses', icon: '🧹', name: 'Street Sweeper', desc: 'Sweep up the Street Sweep Scourge', boss: 'street_scourge' },
    { id: 'boss_buster', cat: 'Park bosses', icon: '🦸', name: 'Boss Buster', desc: 'Send 3 different park bosses packing', test: function (s) { return s.bossesDefeated >= 3; }, prog: function (s) { return prog(s.bossesDefeated, 3); } },
    // Crew
    { id: 'crew_join', cat: 'Crew', icon: '🤝', name: 'Crew Member', desc: 'Roll with a crew of 2+', test: function (s, x) { return x.crew.size >= 2; } },
    { id: 'crew_team', cat: 'Crew', icon: '👫', name: 'Team Clean-up', desc: 'Clean up same day as a crew mate', test: function (s, x) { return x.crew.teamDay && s.items > 0; } },
    { id: 'crew_captain', cat: 'Crew', icon: '🦸', name: 'Crew Captain', desc: 'Sit #1 on the crew leaderboard', test: function (s, x) { return x.crew.isTop; } }
  ];
  BADGES.forEach(function (b) {
    if (b.story) b.test = function (s, x) { return !!(x.profile.claims || {})['s:' + b.story]; };
    if (b.boss) b.test = function (s, x) {
      return Object.keys(x.profile.claims || {}).some(function (k) { return k.indexOf('b:') === 0 && x.profile.claims[k].bossId === b.boss; })
        || !!(x.profile.badges || {})[b.id];
    };
  });

  // ---------- quests ----------
  const QUEST_TYPES = ['bottle', 'can', 'wrapper', 'paper', 'cup', 'cap']; // safe for kids to target
  function plural(cr, n) { return n === 1 ? cr.name : cr.name.replace(/(Ghost|Noodle|Blob|Crab|Wiggler|Pup|Critter|Beetle)$/, '$1s'); }

  const DAILY_POOL = [
    function (r) { const t = pick(r, QUEST_TYPES), n = pick(r, [2, 3, 4, 5]), cr = byId[t]; return { kind: 'type', type: t, goal: n, icon: cr.emoji, title: 'Catch ' + n + ' ' + plural(cr, n), reward: 10 + n * 3 }; },
    function (r) { const n = pick(r, [5, 8, 10]); return { kind: 'items', goal: n, icon: '🧺', title: 'Catch ' + n + ' pieces of litter', reward: 10 + n * 2 }; },
    function (r) { const n = pick(r, [3, 4]); return { kind: 'distinct', goal: n, icon: '🎨', title: 'Catch ' + n + ' different creatures', reward: 15 + n * 5 }; },
    function () { return { kind: 'new_spot', goal: 1, icon: '📍', title: 'Clean up in a new spot', reward: 25 }; },
    function () { return { kind: 'photo', goal: 2, icon: '📸', title: 'Snap photos of 2 catches', reward: 15 }; },
    function (r) { const n = pick(r, [3, 4, 6]); return { kind: 'recyclable', goal: n, icon: '♻️', title: 'Catch ' + n + ' recyclables (bottles, cans, paper)', reward: 10 + n * 3 }; }
  ];
  const WEEKLY_POOL = [
    function (r) { const n = pick(r, [25, 30, 40]); return { kind: 'items', goal: n, icon: '🏋️', title: 'Catch ' + n + ' pieces of litter this week', reward: 40 + n }; },
    function (r) { const n = pick(r, [5, 6, 7]); return { kind: 'distinct', goal: n, icon: '🌈', title: 'Catch ' + n + ' different creatures', reward: 50 + n * 5 }; },
    function () { return { kind: 'days', goal: 3, icon: '📅', title: 'Clean up on 3 different days', reward: 60 }; },
    function () { return { kind: 'spots', goal: 3, icon: '🧭', title: 'Clean up in 3 different spots', reward: 60 }; },
    function () { return { kind: 'rare', goal: 1, icon: '💎', title: 'Catch a Rare or Legendary (grown-ups handle glass!)', reward: 75 }; },
    function (r) { const n = pick(r, [2, 3]); return { kind: 'type', type: 'bag', goal: n, icon: '👻', title: 'Catch ' + n + ' Bag Ghosts', reward: 50 }; }
  ];

  function questsFor(period, profile, now) {
    const start = period === 'd' ? startOfDay(now) : startOfWeek(now);
    const end = period === 'd' ? addDays(start, 1) : addDays(start, 7);
    const pk = dayKey(start);
    const r = rng(period + pk + profile.id);
    const pool = period === 'd' ? DAILY_POOL : WEEKLY_POOL;
    const howMany = period === 'd' ? 3 : 2;
    return shuffle(r, pool.map(function (g, i) { return i; })).slice(0, howMany).map(function (gi, idx) {
      const q = pool[gi](r);
      q.period = period; q.start = start; q.end = end;
      q.key = period + ':' + pk + ':' + idx + ':' + q.kind + (q.type ? '-' + q.type : '') + '-' + q.goal;
      return q;
    });
  }

  function questProgress(q, allMine) {
    const inP = allMine.filter(function (c) { return c.ts >= q.start && c.ts < q.end; });
    let v = 0;
    switch (q.kind) {
      case 'items': inP.forEach(function (c) { v += c.count || 1; }); break;
      case 'type': inP.forEach(function (c) { if (c.type === q.type) v += c.count || 1; }); break;
      case 'distinct': v = new Set(inP.map(function (c) { return c.type; })).size; break;
      case 'photo': v = inP.filter(function (c) { return c.photo; }).length; break;
      case 'recyclable': inP.forEach(function (c) { if (['bottle', 'can', 'paper'].indexOf(c.type) >= 0) v += c.count || 1; }); break;
      case 'rare': inP.forEach(function (c) { const cr = byId[c.type]; if (cr && (cr.rarity === 'rare' || cr.rarity === 'legendary')) v += c.count || 1; }); break;
      case 'days': v = new Set(inP.map(function (c) { return dayKey(c.ts); })).size; break;
      case 'spots': v = spotsOf(inP).length; break;
      case 'new_spot': {
        const before = spotsOf(allMine.filter(function (c) { return c.ts < q.start; }));
        v = inP.some(function (c) { return !before.some(function (s) { return distM(s, c) < SPOT_RADIUS_M; }); }) ? 1 : 0;
        break;
      }
    }
    return Math.min(v, q.goal);
  }

  // ---------- story quests ----------
  const STORIES = [
    { id: 'park', icon: '🌳', title: 'The Park Rescue', reward: 100, badge: 'story_park',
      text: 'Yo — litter critters took over Acorn Park and the squirrels can\'t find their acorns. You in?',
      chapters: [
        { t: 'Catch your first creature', k: 'items', n: 1 },
        { t: 'Catch 3 different kinds of creature', k: 'distinct', n: 3 },
        { t: 'Catch 15 pieces of litter', k: 'items', n: 15 },
        { t: 'Clean up on 3 different days', k: 'days', n: 3 }
      ] },
    { id: 'ocean', icon: '🐢', title: 'Ocean Friends', reward: 150, badge: 'story_ocean',
      text: 'Trash drifts into drains → rivers → ocean. Shelly the sea turtle needs the squad.',
      chapters: [
        { t: 'Catch 5 Bottle Blobs', k: 'type', type: 'bottle', n: 5 },
        { t: 'Catch 3 Bag Ghosts', k: 'type', type: 'bag', n: 3 },
        { t: 'Catch 5 Cap Beetles', k: 'type', type: 'cap', n: 5 },
        { t: 'Catch 3 Straw Noodles', k: 'type', type: 'straw', n: 3 }
      ] },
    { id: 'explorer', icon: '🧭', title: 'The Great Explorer', reward: 200, badge: 'story_explorer',
      text: 'Map Makers Guild wants explorers cleaning every neighborhood corner. Gloves up.',
      chapters: [
        { t: 'Clean up in 2 different spots', k: 'spots', n: 2 },
        { t: 'Snap photos of 3 catches', k: 'photos', n: 3 },
        { t: 'Clean up in 5 different spots', k: 'spots', n: 5 },
        { t: 'Catch 50 pieces of litter', k: 'items', n: 50 }
      ] },
    { id: 'legend', icon: '🦄', title: 'Legend of the Mystery Mimic', reward: 300, badge: 'story_legend',
      text: 'Word is a shimmering Mystery Mimic is hiding nearby. Litter Legend energy only...',
      chapters: [
        { t: 'Discover 6 creatures in your Litter-dex', k: 'distinct', n: 6 },
        { t: 'Keep a 3-day clean-up streak', k: 'bestStreak', n: 3 },
        { t: 'Catch a Mystery Mimic', k: 'type', type: 'mystery', n: 1 },
        { t: 'Fill the whole Litter-dex (12)', k: 'distinct', n: 12 }
      ] }
  ];
  function chapterValue(ch, s) {
    if (ch.k === 'type') return s.perType[ch.type] || 0;
    return s[ch.k] || 0;
  }
  function storyStatus(story, s) {
    const ch = story.chapters.map(function (c) { const v = chapterValue(c, s); return { t: c.t, v: Math.min(v, c.n), n: c.n, done: v >= c.n }; });
    return { chapters: ch, doneCount: ch.filter(function (c) { return c.done; }).length, complete: ch.every(function (c) { return c.done; }) };
  }


  // ---------- park bosses ----------
  // Areas are ~220 m grid cells. After enough crew catches in a cell, a boss
  // appears. Catching matching litter near the boss "cleans" its HP (shared).
  const BOSSES = window.LM_BOSSES || [];
  const BOSS_BY_ID = {};
  BOSSES.forEach(function (b) { BOSS_BY_ID[b.id] = b; });
  const AREA_CELL = 0.002; // ~220 m
  const BOSS_HIT_M = 280;   // catch must be this close to chip a boss's pile
  const BOSS_SPAWN_M = 220;

  function cellKey(lat, lng) {
    return Math.floor(lat / AREA_CELL) + ':' + Math.floor(lng / AREA_CELL);
  }
  function cellCenter(key) {
    const p = key.split(':').map(Number);
    return { lat: (p[0] + 0.5) * AREA_CELL, lng: (p[1] + 0.5) * AREA_CELL };
  }
  function typeMatches(bossDef, type) {
    if (!bossDef.types || !bossDef.types.length) return true;
    return bossDef.types.indexOf(type) >= 0;
  }
  function typeLabel(bossDef) {
    if (!bossDef.types) return 'any litter';
    return bossDef.types.map(function (t) { return (byId[t] || { name: t }).name; }).join(', ');
  }
  function bossesDefeated(profile) {
    const set = {};
    Object.keys(profile.claims || {}).forEach(function (k) {
      if (k.indexOf('b:') === 0 && profile.claims[k].bossId) set[profile.claims[k].bossId] = true;
    });
    // also count boss badges as a fallback
    BOSSES.forEach(function (b) { if ((profile.badges || {})[b.badge]) set[b.id] = true; });
    return Object.keys(set).length;
  }
  function activeBosses(state) {
    return (state.bosses || []).filter(function (b) { return !b.defeatedAt; });
  }
  function bossProgress(inst) {
    const cleaned = Math.max(0, (inst.maxHp || 0) - (inst.hp || 0));
    return { cleaned: cleaned, max: inst.maxHp, left: Math.max(0, inst.hp), pct: Math.round(100 * cleaned / (inst.maxHp || 1)) };
  }

  // Pick which boss type belongs in a cell (stable, prefers undefeated types).
  function bossForCell(state, cell) {
    const defeatedTypes = {};
    (state.bosses || []).forEach(function (b) {
      if (b.cell === cell && b.defeatedAt) defeatedTypes[b.bossId] = true;
    });
    // already have an active one here?
    if ((state.bosses || []).some(function (b) { return b.cell === cell && !b.defeatedAt; })) return null;
    const pool = BOSSES.filter(function (b) { return !defeatedTypes[b.id]; });
    if (!pool.length) return null;
    const r = rng('boss-' + cell);
    return pool[Math.floor(r() * pool.length)];
  }

  // Count crew catches per cell (items, not events).
  function areaKey(state, lat, lng) {
    const park = state.park;
    if (park && park.ring && window.LMParks && window.LMParks.pointInRing(lat, lng, park.ring)) {
      return 'park:' + park.id;
    }
    return cellKey(lat, lng);
  }
  function cellCounts(state) {
    const map = {};
    state.catches.forEach(function (c) {
      const k = areaKey(state, c.lat, c.lng);
      if (!map[k]) map[k] = { n: 0, lat: 0, lng: 0, parkId: k.indexOf('park:') === 0 ? k.slice(5) : null };
      const n = c.count || 1;
      map[k].n += n;
      map[k].lat += c.lat * n;
      map[k].lng += c.lng * n;
    });
    Object.keys(map).forEach(function (k) {
      const m = map[k];
      m.lat /= m.n; m.lng /= m.n;
      // If this is the active park bucket, prefer park centroid for boss pin
      if (m.parkId && state.park && state.park.id === m.parkId && state.park.center) {
        m.lat = state.park.center.lat; m.lng = state.park.center.lng;
      }
    });
    return map;
  }

  function makeBossInstance(def, cell, pos, now, demo) {
    return {
      id: 'boss_' + cell.replace(':', '_') + '_' + def.id + '_' + now.toString(36),
      bossId: def.id,
      cell: cell,
      lat: pos.lat,
      lng: pos.lng,
      maxHp: def.hp,
      hp: def.hp,
      contributions: {},
      spawnedAt: now,
      defeatedAt: null,
      demo: !!demo
    };
  }

  // Spawn bosses for cells that crossed the threshold. Mutates state.bosses.
  function spawnBosses(state, now, opts) {
    now = now || Date.now(); opts = opts || {};
    state.bosses = state.bosses || [];
    const counts = cellCounts(state);
    const spawned = [];
    Object.keys(counts).forEach(function (cell) {
      const info = counts[cell];
      const def = bossForCell(state, cell);
      if (!def) return;
      if (info.n < def.spawnNeed) return;
      // place near the cluster centroid
      const inst = makeBossInstance(def, cell, { lat: info.lat, lng: info.lng }, now, !!state.demoActive);
      state.bosses.push(inst);
      spawned.push(inst);
    });
    return spawned;
  }

  // Apply one catch to nearby active bosses. Returns list of {inst, dmg, defeated, def}.
  function applyCatchToBosses(state, catchObj) {
    state.bosses = state.bosses || [];
    const hits = [];
    activeBosses(state).forEach(function (inst) {
      const def = BOSS_BY_ID[inst.bossId];
      if (!def) return;
      if (distM(inst, catchObj) > BOSS_HIT_M) return;
      if (!typeMatches(def, catchObj.type)) return;
      const dmg = Math.min(inst.hp, catchObj.count || 1);
      if (dmg <= 0) return;
      inst.hp -= dmg;
      inst.contributions = inst.contributions || {};
      inst.contributions[catchObj.profileId] = (inst.contributions[catchObj.profileId] || 0) + dmg;
      const defeated = inst.hp <= 0;
      if (defeated) inst.defeatedAt = catchObj.ts || Date.now();
      hits.push({ inst: inst, def: def, dmg: dmg, defeated: defeated });
    });
    return hits;
  }

  // Award defeat rewards to contributors. Returns {defeats:[], badges:[]} for the active pid.
  function settleBossDefeats(state, pid, now, opts) {
    now = now || Date.now(); opts = opts || {};
    const profile = state.profiles.find(function (p) { return p.id === pid; });
    if (!profile) return { defeats: [], badges: [] };
    profile.claims = profile.claims || {}; profile.badges = profile.badges || {};
    const out = { defeats: [], badges: [] };
    const demo = !!state.demoActive;
    (state.bosses || []).forEach(function (inst) {
      if (!inst.defeatedAt) return;
      const key = 'b:' + inst.id;
      const contrib = (inst.contributions || {})[pid] || 0;
      // Anyone on the device crew gets credit if they contributed OR (solo / empty contrib and they're the only profile)
      const participated = contrib > 0 || (state.profiles.length === 1 && pid === state.activeId);
      // Actually: award to every profile that contributed; if somehow empty (seeded), award to all profiles once.
      const anyContrib = Object.keys(inst.contributions || {}).length > 0;
      const eligible = contrib > 0 || (!anyContrib && true);
      if (!eligible) return;
      // For multi-crew with seeded contribs, only contributors get the reward.
      if (anyContrib && contrib <= 0) return;
      if (profile.claims[key]) return;
      const def = BOSS_BY_ID[inst.bossId];
      if (!def) return;
      profile.claims[key] = { ts: now, pts: def.reward, title: def.name + ' cleaned up!', bossId: def.id, demo: demo || !!inst.demo };
      out.defeats.push({ inst: inst, def: def });
      // badge
      if (!profile.badges[def.badge]) {
        profile.badges[def.badge] = { ts: now, demo: demo || !!inst.demo, seen: !!opts.silent };
        const badge = BADGES.find(function (b) { return b.id === def.badge; });
        if (badge) out.badges.push(badge);
      }
    });
    return out;
  }

  // Full boss tick: spawn → (caller applies catch) → settle. Used after catches.
  function evaluateBosses(state, pid, catchObj, now, opts) {
    now = now || Date.now(); opts = opts || {};
    const spawned = spawnBosses(state, now, opts);
    let hits = [];
    if (catchObj) hits = applyCatchToBosses(state, catchObj);
    // Also settle any already-defeated (e.g. demo seed) for this player
    const settled = settleBossDefeats(state, pid, now, opts);
    // Collect badges newly granted for this player from boss badges + Boss Buster
    return { spawned: spawned, hits: hits, defeats: settled.defeats };
  }

  // Award anything newly earned. Returns {quests:[], stories:[], badges:[]} of new unlocks.
  function evaluate(state, pid, now, opts) {
    now = now || Date.now(); opts = opts || {};
    const profile = state.profiles.find(function (p) { return p.id === pid; });
    if (!profile) return { quests: [], stories: [], badges: [], bossDefeats: [] };
    profile.claims = profile.claims || {}; profile.badges = profile.badges || {};
    const out = { quests: [], stories: [], badges: [], bossDefeats: [] };
    const mine = catchesFor(state, pid);
    const demo = !!state.demoActive;
    // quests (current period only)
    ['d', 'w'].forEach(function (per) {
      questsFor(per, profile, now).forEach(function (q) {
        if (!profile.claims[q.key] && questProgress(q, mine) >= q.goal) {
          profile.claims[q.key] = { ts: now, pts: q.reward, title: q.title, demo: demo };
          out.quests.push(q);
        }
      });
    });
    // stories
    let s = stats(state, pid, now);
    STORIES.forEach(function (st) {
      const key = 's:' + st.id;
      if (!profile.claims[key] && storyStatus(st, s).complete) {
        profile.claims[key] = { ts: now, pts: st.reward, title: st.title, demo: demo };
        out.stories.push(st);
      }
    });
    // Park bosses: spawn from busy areas; settle any defeats for this player
    spawnBosses(state, now);
    const bossSettled = settleBossDefeats(state, pid, now, opts);
    out.bossDefeats = bossSettled.defeats;
    (bossSettled.badges || []).forEach(function (b) {
      if (!out.badges.some(function (x) { return x.id === b.id; })) out.badges.push(b);
    });

    s = stats(state, pid, now);
    const ctx = { profile: profile, crew: crewInfo(state, pid, now), state: state };
    BADGES.forEach(function (b) {
      if (!profile.badges[b.id] && b.test(s, ctx)) {
        profile.badges[b.id] = { ts: now, demo: demo, seen: !!opts.silent };
        out.badges.push(b);
      }
    });
    return out;
  }

  window.LMGame = {
    byId: byId, COMMONS: COMMONS, BADGES: BADGES, STORIES: STORIES, TITLES: TITLES,
    BOSSES: BOSSES, BOSS_BY_ID: BOSS_BY_ID, BOSS_HIT_M: BOSS_HIT_M,
    dayKey: dayKey, startOfDay: startOfDay, startOfWeek: startOfWeek, addDays: addDays, distM: distM, spotsOf: spotsOf,
    levelInfo: levelInfo, catchPoints: catchPoints, stats: stats, crewInfo: crewInfo,
    questsFor: questsFor, questProgress: questProgress, storyStatus: storyStatus, evaluate: evaluate, catchesFor: catchesFor,
    cellKey: cellKey, areaKey: areaKey, cellCenter: cellCenter, typeMatches: typeMatches, typeLabel: typeLabel,
    activeBosses: activeBosses, bossProgress: bossProgress, bossesDefeated: bossesDefeated,
    spawnBosses: spawnBosses, applyCatchToBosses: applyCatchToBosses, settleBossDefeats: settleBossDefeats,
    evaluateBosses: evaluateBosses, makeBossInstance: makeBossInstance
  };
})();
