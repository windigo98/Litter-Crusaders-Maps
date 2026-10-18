/* Litter Crusaders Maps sound: all music + SFX are synthesized with the Web Audio API.
   No audio files = no licensing, tiny, works offline. Audio only starts after the first tap (iOS). */
(function () {
  'use strict';
  const KEY = 'lcm-sound-v1';
  let prefs = { music: true, sfx: true };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) prefs = Object.assign(prefs, s); } catch (e) {}
  const MUSIC_VOL = 0.045, SFX_VOL = 0.22;
  let ctx = null, master, musicBus, sfxBus, unlocked = false, musicTimer = null, step = 0, nextT = 0;
  const listeners = [];

  function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} listeners.forEach(function (f) { f(prefs); }); }
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_VOL; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_VOL; sfxBus.connect(master);
    return ctx;
  }
  function tone(f, t0, dur, type, vol, bus, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.6, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(bus || sfxBus); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, vol, freq) {
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 1200; g.gain.value = vol || 0.4;
    s.connect(f).connect(g).connect(sfxBus); s.start(t0);
  }
  function seq(notes, gap, type, dur, vol) {
    const t = ctx.currentTime + 0.01;
    notes.forEach(function (f, i) { if (f) tone(f, t + i * gap, dur || 0.25, type, vol); });
  }

  // ---- SFX recipes ----
  const SFX = {
    tap: function () { tone(880, ctx.currentTime, 0.06, 'sine', 0.3); },
    tab: function () { const t = ctx.currentTime; tone(660, t, 0.06, 'sine', 0.25); tone(990, t + 0.05, 0.08, 'sine', 0.22); },
    catch: function () { const t = ctx.currentTime; noise(t, 0.12, 0.35, 900); tone(330, t, 0.18, 'square', 0.18, null, 990); seq([0, 0, 784, 1047], 0.07, 'triangle', 0.22, 0.5); },
    newEntry: function () { seq([523, 659, 784, 1047, 1319], 0.08, 'triangle', 0.3, 0.5); setTimeout(function () { ctx && tone(1568, ctx.currentTime, 0.5, 'sine', 0.3); }, 420); },
    badge: function () { seq([659, 784, 988, 1319, 1568], 0.09, 'triangle', 0.35, 0.5); const t = ctx.currentTime + 0.5; [1319, 1661, 1976].forEach(function (f) { tone(f, t, 0.8, 'sine', 0.18); }); },
    quest: function () { seq([392, 523, 659, 784], 0.11, 'square', 0.18, 0.22); const t = ctx.currentTime + 0.46; [523, 659, 784].forEach(function (f) { tone(f, t, 0.6, 'triangle', 0.3); }); },
    bossHit: function () { const t = ctx.currentTime; tone(200, t, 0.22, 'square', 0.35, null, 70); noise(t, 0.15, 0.5, 400); },
    bossDefeat: function () { const t = ctx.currentTime; tone(160, t, 0.5, 'sawtooth', 0.25, null, 50); noise(t, 0.4, 0.5, 300);
      [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) { tone(f, t + 0.45 + i * 0.1, 0.3, 'square', 0.2); }); tone(1047, t + 1.2, 0.9, 'triangle', 0.35); },
    ispy: function () { seq([988, 1319], 0.09, 'sine', 0.25, 0.45); const t = ctx.currentTime + 0.2; tone(1760, t, 0.4, 'sine', 0.15); },
    diff: function () { seq([587, 740, 880, 1175], 0.07, 'triangle', 0.2, 0.45); },
    crewJoin: function () { seq([392, 494, 587, 784], 0.12, 'triangle', 0.3, 0.45); const t = ctx.currentTime + 0.5; tone(392, t, 0.7, 'sine', 0.25); tone(587, t, 0.7, 'sine', 0.2); },
    dgLane: function () { noise(ctx.currentTime, 0.07, 0.18, 2200); },
    dgJump: function () { tone(330, ctx.currentTime, 0.2, 'sine', 0.3, null, 760); },
    dgSlide: function () { const t = ctx.currentTime; noise(t, 0.2, 0.22, 700); tone(520, t, 0.18, 'sine', 0.18, null, 260); },
    dgCoin: function () { const t = ctx.currentTime; tone(1175, t, 0.07, 'square', 0.14); tone(1568, t + 0.06, 0.16, 'square', 0.14); },
    dgTidy: function () { seq([659, 880, 1175, 1568], 0.06, 'triangle', 0.2, 0.5); },
    dgBump: function () { const t = ctx.currentTime; tone(150, t, 0.2, 'sine', 0.45, null, 60); noise(t, 0.1, 0.25, 350); },
    buy: function () { const t = ctx.currentTime; tone(1568, t, 0.07, 'square', 0.14); tone(2093, t + 0.07, 0.2, 'square', 0.14); seq([0, 0, 523, 659, 784, 1047], 0.07, 'triangle', 0.25, 0.4); },
    trophy: function () { seq([523, 659, 784, 1047, 784, 1047, 1319], 0.1, 'triangle', 0.3, 0.5); const t = ctx.currentTime + 0.75; [1047, 1319, 1568].forEach(function (f) { tone(f, t, 1.0, 'sine', 0.2); }); },
    warn: function () { const t = ctx.currentTime; tone(523, t, 0.35, 'sine', 0.3); tone(415, t + 0.25, 0.5, 'sine', 0.3); }
  };
  function play(name) {
    if (!prefs.sfx || !unlocked || !SFX[name]) return;
    if (!ensure()) return;
    try { if (ctx.state === 'suspended') ctx.resume(); SFX[name](); } catch (e) {}
  }

  // ---- Chill looping music: soft pentatonic lead over pads, ~84 bpm ----
  const BEAT = 60 / 84 / 2; // eighth notes
  const CHORDS = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]]; // C Am F G
  const MEL = [523, 0, 659, 0, 784, 659, 0, 587, 440, 0, 523, 0, 659, 0, 587, 0,
               349, 0, 440, 523, 0, 587, 523, 0, 392, 0, 494, 0, 587, 0, 0, 0];
  function scheduleMusic() {
    while (nextT < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % 4;
      if (step % 8 === 0) { CHORDS[bar].forEach(function (f) { tone(f, nextT, BEAT * 8, 'sine', 0.35, musicBus); }); tone(CHORDS[bar][0] / 2, nextT, BEAT * 7, 'triangle', 0.5, musicBus); }
      const m = MEL[step % MEL.length]; if (m) tone(m, nextT, BEAT * 1.6, 'triangle', 0.4, musicBus);
      step++; nextT += BEAT;
    }
  }
  function startMusic() {
    if (!prefs.music || !unlocked || document.hidden || musicTimer) return;
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    musicBus.gain.setValueAtTime(MUSIC_VOL, ctx.currentTime);
    nextT = ctx.currentTime + 0.1; musicTimer = setInterval(scheduleMusic, 100); scheduleMusic();
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (ctx) { musicBus.gain.setValueAtTime(0.0001, ctx.currentTime); }
  }

  function unlock() {
    if (unlocked) return; unlocked = true;
    if (ensure() && ctx.state === 'suspended') ctx.resume();
    startMusic();
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(function (ev) { window.addEventListener(ev, unlock, { once: false, passive: true, capture: true }); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopMusic(); if (ctx && ctx.suspend) ctx.suspend(); }
    else if (unlocked) { if (ctx) ctx.resume(); startMusic(); }
  });

  window.LMSound = {
    play: play,
    prefs: function () { return Object.assign({}, prefs); },
    setMusic: function (on) { prefs.music = !!on; savePrefs(); if (on) startMusic(); else stopMusic(); },
    setSfx: function (on) { prefs.sfx = !!on; savePrefs(); },
    muted: function () { return !prefs.music && !prefs.sfx; },
    toggleAll: function () { const on = this.muted(); prefs.music = on; prefs.sfx = on; savePrefs(); if (on) startMusic(); else stopMusic(); },
    onChange: function (f) { listeners.push(f); }
  };
})();
