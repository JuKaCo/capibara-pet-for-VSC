/* Capibara Pet — tiny 8-bit sound effects, synthesised with WebAudio (no files).
 *
 * Loaded by the webview only when `capibaraPet.sounds` is on; exposes
 * window.Chiptune.play(name). Browsers only allow audio after a user gesture,
 * so the first click (or key) in the panel unlocks it; until then it is silent.
 */
(function () {
  'use strict';

  const VOL = 0.05;
  let ctx = null;
  const lastAt = {}; // per-effect rate limit, so bursts don't stack up

  function audio() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) { return null; }
      ctx = new C();
    }
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
    return ctx;
  }
  ['pointerdown', 'keydown'].forEach((e) => window.addEventListener(e, audio, { once: true, capture: true }));

  // A square/triangle/sine blip with an optional pitch slide.
  function tone(t, freq, dur, type, vol, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) { o.frequency.exponentialRampToValueAtTime(slideTo, t + dur); }
    g.gain.setValueAtTime(VOL * (vol || 1), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Filtered white noise: splashes and thunder.
  function noise(t, dur, vol, cutoff) {
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { d[i] = Math.random() * 2 - 1; }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf;
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(VOL * (vol || 1), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
  }

  const SFX = {
    pet: (t) => { tone(t, 880, 0.07); tone(t + 0.08, 1175, 0.09); },
    fanfare: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.08, f, i === 3 ? 0.22 : 0.08)),
    oops: (t) => { tone(t, 440, 0.12, 'square', 1, 330); tone(t + 0.13, 330, 0.2, 'square', 1, 220); },
    yuzu: (t) => [784, 988, 1319].forEach((f, i) => tone(t + i * 0.06, f, 0.08, 'triangle', 1.2)),
    nom: (t) => { tone(t, 230, 0.05, 'triangle', 1.6); tone(t + 0.07, 190, 0.05, 'triangle', 1.6); },
    thud: (t) => tone(t, 150, 0.09, 'triangle', 1.8, 70),
    splash: (t) => noise(t, 0.25, 1.2, 2500),
    chirp: (t) => { tone(t, 2400, 0.05, 'sine', 0.8, 3200); tone(t + 0.07, 2600, 0.05, 'sine', 0.8, 3400); },
    quack: (t) => { tone(t, 320, 0.09, 'sawtooth', 0.5, 230); tone(t + 0.12, 300, 0.09, 'sawtooth', 0.5, 220); },
    thunder: (t) => noise(t + 0.3, 1.4, 1.6, 260),
  };

  window.Chiptune = {
    play(name) {
      const c = audio(), now = Date.now();
      if (!c || c.state !== 'running' || !SFX[name] || now - (lastAt[name] || 0) < 150) { return; }
      lastAt[name] = now;
      SFX[name](c.currentTime + 0.01);
    },
  };
})();
