/* Litter Crusaders Maps — nearby park detection via OpenStreetMap Overpass (+ cache + fixture fallback). */
(function () {
  'use strict';
  const CACHE_MS = 30 * 60 * 1000; // 30 min
  const SEARCH_M = 1200;
  const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  // Simplified Golden Gate Park outline (lat,lng) for demo / screenshots when Overpass is unreachable.
  const FIXTURE_GGP = {
    id: 'fixture:golden-gate-park',
    name: 'Golden Gate Park',
    kind: 'park',
    source: 'fixture',
    ring: [[37.77125, -122.51087], [37.77089, -122.51082], [37.77056, -122.51082], [37.76943, -122.51069], [37.76911, -122.51064], [37.76873, -122.51056], [37.76833, -122.51043], [37.76796, -122.51039], [37.76752, -122.51031], [37.76705, -122.51024], [37.76655, -122.5102], [37.76627, -122.51019], [37.76598, -122.51019], [37.7657, -122.51019], [37.76544, -122.5102], [37.7647, -122.51026], [37.76448, -122.51027], [37.76418, -122.51026], [37.76418, -122.50966], [37.76414, -122.50926], [37.76606, -122.46539], [37.76613, -122.46424], [37.76621, -122.46221], [37.76633, -122.45965], [37.76638, -122.45858], [37.76619, -122.45793], [37.76607, -122.45765], [37.76601, -122.45745], [37.76597, -122.4572], [37.76597, -122.45696], [37.76599, -122.45675], [37.76635, -122.45399], [37.76661, -122.45348], [37.76664, -122.45318], [37.76738, -122.45333], [37.76843, -122.45355], [37.76862, -122.45358], [37.7693, -122.45368], [37.77124, -122.45407], [37.77159, -122.45417], [37.77184, -122.45421], [37.77241, -122.45431], [37.77459, -122.45475], [37.77465, -122.45481], [37.77464, -122.4549], [37.77422, -122.45821], [37.77368, -122.4626], [37.77335, -122.46529], [37.77249, -122.48406], [37.77248, -122.48426], [37.77195, -122.49581], [37.77128, -122.51052], [37.77125, -122.51087]]
  };

  function pointInRing(lat, lng, ring) {
    if (!ring || ring.length < 3) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
      const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function distM(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function ringCentroid(ring) {
    let lat = 0, lng = 0;
    const n = ring.length - (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? 1 : 0);
    for (let i = 0; i < n; i++) { lat += ring[i][0]; lng += ring[i][1]; }
    return { lat: lat / Math.max(1, n), lng: lng / Math.max(1, n) };
  }
  function nearestOnRing(lat, lng, ring) {
    let best = 1e15, pt = ring[0];
    ring.forEach(function (p) {
      const d = distM({ lat: lat, lng: lng }, { lat: p[0], lng: p[1] });
      if (d < best) { best = d; pt = p; }
    });
    return { dist: best, pt: { lat: pt[0], lng: pt[1] } };
  }

  function overpassQuery(lat, lng, radius) {
    return '[out:json][timeout:18];(' +
      'way["leisure"="park"](around:' + radius + ',' + lat + ',' + lng + ');' +
      'relation["leisure"="park"](around:' + radius + ',' + lat + ',' + lng + ');' +
      'way["leisure"="nature_reserve"](around:' + radius + ',' + lat + ',' + lng + ');' +
      'relation["leisure"="nature_reserve"](around:' + radius + ',' + lat + ',' + lng + ');' +
      'way["leisure"="playground"](around:' + radius + ',' + lat + ',' + lng + ');' +
      'way["boundary"="national_park"](around:' + radius + ',' + lat + ',' + lng + ');' +
      'relation["boundary"="national_park"](around:' + radius + ',' + lat + ',' + lng + ');' +
      'way["leisure"="garden"]["name"](around:' + radius + ',' + lat + ',' + lng + ');' +
      ');out tags geom center;';
  }

  function geomToRing(el) {
    if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
      return el.geometry.map(function (p) { return [p.lat, p.lon]; });
    }
    if (el.type === 'relation' && el.members) {
      const pts = [];
      el.members.forEach(function (m) {
        if (m.role && m.role.indexOf('inner') >= 0) return;
        if (m.geometry) m.geometry.forEach(function (p) { pts.push([p.lat, p.lon]); });
      });
      if (pts.length >= 3) return pts;
    }
    return null;
  }

  function parseElements(elements, lat, lng) {
    const parks = [];
    elements.forEach(function (el) {
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || null;
      const ring = geomToRing(el);
      if (!ring) return;
      const kind = tags.leisure || tags.boundary || 'park';
      const center = el.center ? { lat: el.center.lat, lng: el.center.lon } : ringCentroid(ring);
      const contains = pointInRing(lat, lng, ring);
      const near = nearestOnRing(lat, lng, ring);
      parks.push({
        id: el.type + '/' + el.id,
        name: name || (kind === 'playground' ? 'Playground' : 'Green space'),
        kind: kind, source: 'overpass', ring: ring, center: center,
        contains: contains, dist: contains ? 0 : near.dist, named: !!name
      });
    });
    return parks;
  }

  function pickBest(parks) {
    if (!parks.length) return null;
    const score = function (p) {
      return (p.contains ? 1e9 : 0) + (p.named ? 1e6 : 0) - p.dist +
        (p.kind === 'park' || p.kind === 'national_park' || p.kind === 'nature_reserve' ? 5000 : 0);
    };
    return parks.slice().sort(function (a, b) { return score(b) - score(a); })[0];
  }

  let inflight = null, lastFailAt = 0, endpointIdx = 0;
  const BACKOFF_MS = 20000;

  function fetchOverpass(lat, lng) {
    const now = Date.now();
    if (now - lastFailAt < BACKOFF_MS && !inflight) return Promise.reject(new Error('backoff'));
    if (inflight) return inflight;
    const body = overpassQuery(lat, lng, SEARCH_M);
    const tryOne = function (i) {
      if (i >= ENDPOINTS.length) return Promise.reject(new Error('all endpoints failed'));
      const url = ENDPOINTS[(endpointIdx + i) % ENDPOINTS.length];
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = setTimeout(function () { if (ctrl) try { ctrl.abort(); } catch (e) {} }, 16000);
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(body),
        signal: ctrl && ctrl.signal
      }).then(function (res) {
        clearTimeout(t);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (data) {
        endpointIdx = (endpointIdx + i) % ENDPOINTS.length;
        return parseElements(data.elements || [], lat, lng);
      }).catch(function () {
        clearTimeout(t);
        return tryOne(i + 1);
      });
    };
    inflight = tryOne(0).then(function (parks) { inflight = null; return parks; },
      function (err) { inflight = null; lastFailAt = Date.now(); throw err; });
    return inflight;
  }

  function fixtureNear(lat, lng) {
    const f = FIXTURE_GGP;
    const contains = pointInRing(lat, lng, f.ring);
    const near = nearestOnRing(lat, lng, f.ring);
    if (!contains && near.dist > 2500) return null;
    return {
      id: f.id, name: f.name, kind: f.kind, source: 'fixture', ring: f.ring.slice(),
      center: ringCentroid(f.ring), contains: contains, dist: contains ? 0 : near.dist, named: true,
      demoNote: 'Demo park outline (live map lookup unavailable)'
    };
  }

  function findNearbyPark(lat, lng, opts) {
    opts = opts || {};
    return fetchOverpass(lat, lng).then(function (parks) {
      const best = pickBest(parks);
      if (best) return best;
      if (opts.allowFixture !== false) return fixtureNear(lat, lng);
      return null;
    }, function () {
      if (opts.allowFixture === false) throw new Error('overpass failed');
      return fixtureNear(lat, lng);
    });
  }

  function areaKeyForPoint(lat, lng, park, cellKeyFn) {
    if (park && park.ring && pointInRing(lat, lng, park.ring)) return 'park:' + park.id;
    return cellKeyFn(lat, lng);
  }

  window.LMParks = {
    SEARCH_M: SEARCH_M, CACHE_MS: CACHE_MS, FIXTURE_GGP: FIXTURE_GGP,
    pointInRing: pointInRing, distM: distM, ringCentroid: ringCentroid,
    findNearbyPark: findNearbyPark, fixtureNear: fixtureNear, pickBest: pickBest,
    areaKeyForPoint: areaKeyForPoint, parseElements: parseElements
  };
})();
