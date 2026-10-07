/* Litter Crusaders Maps — cross-phone Family / Class crew sync.
   Backends: Firebase (Anonymous Auth + Firestore) when configured; otherwise local
   passcode rooms (same device / tabs). Photos never leave the device. Locations
   are blurred ~150 m before any cloud write. Nicknames only — no kid emails. */
(function (global) {
  'use strict';

  var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  var BLUR_M = 150;
  var ROOM_STORE = 'lm.crewRooms.v1';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function makeCode() {
    var s = '';
    for (var i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return s;
  }

  function normalizeCode(c) {
    return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  function blurLatLng(lat, lng) {
    var dLat = BLUR_M / 111320;
    var dLng = BLUR_M / (111320 * Math.max(0.2, Math.cos((lat || 0) * Math.PI / 180)));
    return {
      lat: Math.round(lat / dLat) * dLat,
      lng: Math.round(lng / dLng) * dLng
    };
  }

  function catchPayload(c, memberId) {
    var b = blurLatLng(c.lat, c.lng);
    return {
      id: c.id,
      memberId: memberId,
      type: c.type,
      count: c.count || 1,
      lat: b.lat,
      lng: b.lng,
      ts: c.ts || Date.now()
      // no photo
    };
  }

  function hashPin(pin) {
    // Light obfuscation only (not a substitute for real auth). Optional adult pin.
    var s = String(pin || '');
    if (!s) return null;
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function firebaseReady() {
    var cfg = global.LM_FIREBASE_CONFIG || {};
    return !!(cfg.apiKey && cfg.projectId && global.firebase);
  }

  // ---------- Local room backend (device / tabs) ----------
  function loadRooms() {
    try { return JSON.parse(localStorage.getItem(ROOM_STORE) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveRooms(rooms) {
    try { localStorage.setItem(ROOM_STORE, JSON.stringify(rooms)); } catch (e) { /* ignore */ }
  }

  var LocalBackend = {
    name: 'local',
    async createCrew(opts) {
      var code = makeCode();
      var rooms = loadRooms();
      while (rooms[code]) code = makeCode();
      var room = {
        code: code,
        name: (opts.name || '').trim() || (opts.kind === 'class' ? 'Class crew' : 'Family crew'),
        kind: opts.kind === 'class' ? 'class' : 'family',
        pinHash: hashPin(opts.pin),
        createdAt: Date.now(),
        members: {},
        catches: {}
      };
      var mid = uid();
      room.members[mid] = {
        id: mid,
        nickname: opts.nickname,
        avatar: opts.avatar,
        role: 'host',
        joinedAt: Date.now(),
        points: 0
      };
      rooms[code] = room;
      saveRooms(rooms);
      broadcast(code);
      return { code: code, memberId: mid, room: snapshot(room) };
    },
    async joinCrew(opts) {
      var code = normalizeCode(opts.code);
      var rooms = loadRooms();
      var room = rooms[code];
      if (!room) {
        var err = new Error('NO_ROOM');
        err.code = 'NO_ROOM';
        throw err;
      }
      if (room.pinHash && opts.pin) {
        if (hashPin(opts.pin) !== room.pinHash) {
          var e2 = new Error('BAD_PIN'); e2.code = 'BAD_PIN'; throw e2;
        }
      }
      var mid = uid();
      room.members[mid] = {
        id: mid,
        nickname: opts.nickname,
        avatar: opts.avatar,
        role: 'member',
        joinedAt: Date.now(),
        points: 0
      };
      saveRooms(rooms);
      broadcast(code);
      return { code: code, memberId: mid, room: snapshot(room) };
    },
    async leaveCrew(code, memberId) {
      code = normalizeCode(code);
      var rooms = loadRooms();
      var room = rooms[code];
      if (!room) return;
      delete room.members[memberId];
      if (!Object.keys(room.members).length) delete rooms[code];
      saveRooms(rooms);
      broadcast(code);
    },
    async publishCatch(code, memberId, catchObj, points) {
      code = normalizeCode(code);
      var rooms = loadRooms();
      var room = rooms[code];
      if (!room) return null;
      var payload = catchPayload(catchObj, memberId);
      room.catches[payload.id] = payload;
      if (room.members[memberId]) {
        room.members[memberId].points = (room.members[memberId].points || 0) + (points || 0);
        room.members[memberId].nickname = room.members[memberId].nickname;
      }
      saveRooms(rooms);
      broadcast(code);
      return snapshot(room);
    },
    async fetchCrew(code) {
      code = normalizeCode(code);
      var room = loadRooms()[code];
      return room ? snapshot(room) : null;
    },
    watch(code, cb) {
      code = normalizeCode(code);
      var handler = function (ev) {
        if (!ev.data || ev.data.type !== 'lm-crew' || ev.data.code !== code) return;
        cb(snapshot(loadRooms()[code]));
      };
      if (global.BroadcastChannel) {
        var ch = new BroadcastChannel('lm-crew');
        ch.addEventListener('message', handler);
        return function () { ch.removeEventListener('message', handler); ch.close(); };
      }
      var iv = setInterval(function () { cb(snapshot(loadRooms()[code])); }, 2500);
      return function () { clearInterval(iv); };
    }
  };

  function snapshot(room) {
    if (!room) return null;
    return JSON.parse(JSON.stringify({
      code: room.code,
      name: room.name,
      kind: room.kind,
      pinSet: !!room.pinHash,
      createdAt: room.createdAt,
      members: Object.keys(room.members || {}).map(function (k) { return room.members[k]; }),
      catches: Object.keys(room.catches || {}).map(function (k) { return room.catches[k]; })
    }));
  }

  function broadcast(code) {
    try {
      if (global.BroadcastChannel) {
        var ch = new BroadcastChannel('lm-crew');
        ch.postMessage({ type: 'lm-crew', code: code });
        ch.close();
      }
    } catch (e) { /* ignore */ }
  }

  // ---------- Firebase backend ----------
  var FirebaseBackend = {
    name: 'firebase',
    _db: null,
    _auth: null,
    async _ensure() {
      if (this._db) return;
      if (!firebaseReady()) throw new Error('Firebase not configured');
      if (!global.firebase.apps.length) {
        global.firebase.initializeApp(global.LM_FIREBASE_CONFIG);
      }
      this._auth = global.firebase.auth();
      this._db = global.firebase.firestore();
      if (!this._auth.currentUser) {
        await this._auth.signInAnonymously();
      }
    },
    async createCrew(opts) {
      await this._ensure();
      var code = makeCode();
      var ref = this._db.collection('crews').doc(code);
      // rare collision retry
      for (var i = 0; i < 5; i++) {
        var exists = await ref.get();
        if (!exists.exists) break;
        code = makeCode();
        ref = this._db.collection('crews').doc(code);
      }
      var mid = uid();
      var crew = {
        name: (opts.name || '').trim() || (opts.kind === 'class' ? 'Class crew' : 'Family crew'),
        kind: opts.kind === 'class' ? 'class' : 'family',
        pinHash: hashPin(opts.pin),
        createdAt: Date.now(),
        creatorUid: this._auth.currentUser.uid
      };
      await ref.set(crew);
      await ref.collection('members').doc(mid).set({
        nickname: opts.nickname,
        avatar: opts.avatar,
        role: 'host',
        joinedAt: Date.now(),
        points: 0,
        uid: this._auth.currentUser.uid
      });
      var room = await this.fetchCrew(code);
      return { code: code, memberId: mid, room: room };
    },
    async joinCrew(opts) {
      await this._ensure();
      var code = normalizeCode(opts.code);
      var ref = this._db.collection('crews').doc(code);
      var snap = await ref.get();
      if (!snap.exists) {
        var err = new Error('NO_ROOM'); err.code = 'NO_ROOM'; throw err;
      }
      var data = snap.data() || {};
      if (data.pinHash && opts.pin && hashPin(opts.pin) !== data.pinHash) {
        var e2 = new Error('BAD_PIN'); e2.code = 'BAD_PIN'; throw e2;
      }
      var mid = uid();
      await ref.collection('members').doc(mid).set({
        nickname: opts.nickname,
        avatar: opts.avatar,
        role: 'member',
        joinedAt: Date.now(),
        points: 0,
        uid: this._auth.currentUser.uid
      });
      return { code: code, memberId: mid, room: await this.fetchCrew(code) };
    },
    async leaveCrew(code, memberId) {
      await this._ensure();
      code = normalizeCode(code);
      await this._db.collection('crews').doc(code).collection('members').doc(memberId).delete().catch(function () {});
    },
    async publishCatch(code, memberId, catchObj, points) {
      await this._ensure();
      code = normalizeCode(code);
      var payload = catchPayload(catchObj, memberId);
      var ref = this._db.collection('crews').doc(code);
      await ref.collection('catches').doc(payload.id).set(payload);
      var mref = ref.collection('members').doc(memberId);
      await this._db.runTransaction(async function (tx) {
        var m = await tx.get(mref);
        if (!m.exists) return;
        tx.update(mref, { points: (m.data().points || 0) + (points || 0) });
      });
      return this.fetchCrew(code);
    },
    async fetchCrew(code) {
      await this._ensure();
      code = normalizeCode(code);
      var ref = this._db.collection('crews').doc(code);
      var snap = await ref.get();
      if (!snap.exists) return null;
      var d = snap.data();
      var mems = await ref.collection('members').get();
      var cats = await ref.collection('catches').get();
      return {
        code: code,
        name: d.name,
        kind: d.kind || 'family',
        pinSet: !!d.pinHash,
        createdAt: d.createdAt,
        members: mems.docs.map(function (doc) {
          var x = doc.data(); x.id = doc.id; return x;
        }),
        catches: cats.docs.map(function (doc) {
          var x = doc.data(); x.id = doc.id; return x;
        })
      };
    },
    watch(code, cb) {
      var self = this;
      code = normalizeCode(code);
      var unsubs = [];
      var tick = async function () {
        try { cb(await self.fetchCrew(code)); } catch (e) { /* ignore */ }
      };
      self._ensure().then(function () {
        var ref = self._db.collection('crews').doc(code);
        unsubs.push(ref.collection('members').onSnapshot(function () { tick(); }));
        unsubs.push(ref.collection('catches').onSnapshot(function () { tick(); }));
        tick();
      }).catch(function () {});
      return function () { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); };
    }
  };

  function pickBackend() {
    return firebaseReady() ? FirebaseBackend : LocalBackend;
  }

  global.LMCrewSync = {
    blurLatLng: blurLatLng,
    normalizeCode: normalizeCode,
    makeCode: makeCode,
    firebaseReady: firebaseReady,
    backendName: function () { return pickBackend().name; },
    createCrew: function (opts) { return pickBackend().createCrew(opts); },
    joinCrew: function (opts) { return pickBackend().joinCrew(opts); },
    leaveCrew: function (code, memberId) { return pickBackend().leaveCrew(code, memberId); },
    publishCatch: function (code, memberId, c, pts) { return pickBackend().publishCatch(code, memberId, c, pts); },
    fetchCrew: function (code) { return pickBackend().fetchCrew(code); },
    watch: function (code, cb) { return pickBackend().watch(code, cb); }
  };
})(window);
