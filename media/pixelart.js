/* Capibara Pet — procedural pixel-art stage (backdrop + particle effects).
 *
 * Loaded by the webview before the pet logic; exposes window.PixelArt.create().
 * Everything is drawn on low-resolution canvases (1 "art pixel" = PX CSS px)
 * that the browser upscales with nearest-neighbour filtering, so edges stay
 * crisp at any panel size. Gradients use ordered (Bayer) dithering over a small
 * fixed palette instead of smooth blends, and the scenery comes from a fixed
 * seed, so it looks the same after every resize or reload — and at every time of
 * day: day, sunset and night only change the palette and the sky life.
 *
 * Layers (bottom to top):
 *   #scene  sky, sun/moon, clouds/stars, hills, meadow, lake, path, pet shadow
 *   #pet    the capybara sprite (DOM, owned by the webview)
 *   #fx     particles: dust, hearts, confetti, sparkles, "!" alert, zzz, steam, sweat,
 *           and what rides on the capybara's head (a little bird, a mandarin)
 * The capybara can also go for a swim: the DOM pet hides and a smaller swimmer
 * (it is farther away, in the lake) is drawn on #scene on the same pixel grid.
 *
 * The world follows the local date too: seasons (by hemisphere), holidays, the
 * real moon phase and the weather (clear, cloudy, rain, storm, fog, snow) tint
 * the palette and add their own life — falling leaves, rain or snow over the
 * scene, a frozen lake, ducks and a turtle on a log.
 *
 * Optional company: a baby capybara that follows its mum around (and rides on
 * her back when she swims), and a watermelon to feed them.
 *
 * Habitats: 'lake' (the capybara's wetland, above) and 'andes' (the condor's: the
 * Illimani over La Paz, drawn at a finer grid — relief shaded from a noise height
 * field, foothills, eroded badlands, the city and a perching rock).
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ helpers

  // Small seeded PRNG (mulberry32) so the generated scenery is stable.
  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 4x4 Bayer matrix: blends two palette colours without inventing new ones.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y, t) => t * 16 > BAYER[((y & 3) << 2) | (x & 3)] + 0.5;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const B = rgb(b); return hex(rgb(a).map((v, i) => v + (B[i] - v) * t)); };

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function dot(ctx, c, x, y, w, h) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w || 1, h || 1);
  }

  // Pixel circle; `paint(dx, dy, x, y)` returns a colour (or null to skip).
  function disc(ctx, cx, cy, r, paint) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r * 0.6) { continue; }
        const c = paint(dx, dy, cx + dx, cy + dy);
        if (c) { dot(ctx, c, cx + dx, cy + dy); }
      }
    }
  }

  // Tiny bitmap: rows of characters, each mapped to a colour ('.' = empty).
  function blit(ctx, rows, colours, x, y, flip) {
    for (let j = 0; j < rows.length; j++) {
      const w = rows[j].length;
      for (let i = 0; i < w; i++) {
        const c = colours[rows[j][flip ? w - 1 - i : i]];
        if (c) { dot(ctx, c, x + i, y + j); }
      }
    }
  }

  function blitK(ctx, rows, colours, x, y, flip, k) {
    if (k === 1) { blit(ctx, rows, colours, x, y, flip); return; }
    for (let j = 0; j < rows.length; j++) {
      const w = rows[j].length;
      for (let i = 0; i < w; i++) {
        const c = colours[rows[j][flip ? w - 1 - i : i]];
        if (c) { dot(ctx, c, x + i * k, y + j * k, k, k); }
      }
    }
  }

  // Vertical gradient across several palette colours, ordered-dithered.
  function ditherBands(ctx, x0, y0, w, h, cols) {
    if (w <= 0 || h <= 0) { return; }
    const img = ctx.createImageData(w, h), d = img.data, pal = cols.map(rgb);
    const n = pal.length - 1;
    for (let y = 0; y < h; y++) {
      const f = (y / Math.max(1, h - 1)) * n;
      const i = Math.min(n - 1, Math.floor(f)), frac = f - i;
      for (let x = 0; x < w; x++) {
        const c = pal[dith(x0 + x, y0 + y, frac) ? i + 1 : i], k = (y * w + x) * 4;
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  // Seeded 2-D value noise with fBm and ridged variants (for mountains and rock).
  function valueNoise(seed) {
    const hash = (x, y) => {
      let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1013904223)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const sm = (t) => t * t * (3 - 2 * t);
    const n = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const octaves = (f) => (x, y, oct) => {
      let sum = 0, amp = 0.5, fr = 1, norm = 0;
      for (let i = 0; i < (oct || 4); i++) { sum += amp * f(n(x * fr, y * fr)); norm += amp; amp *= 0.5; fr *= 2; }
      return sum / norm;
    };
    n.fbm = octaves((v) => v);
    n.ridge = octaves((v) => 1 - Math.abs(v * 2 - 1)); // sharp crests: aretes, rock ribs
    return n;
  }

  // A shade 0..1 picked from a dark→light palette, ordered-dithered between tones.
  function tone(arr, v, x, y) {
    const n = arr.length - 1, f = clamp(v, 0, 1) * n, i = Math.min(n - 1, Math.floor(f));
    return arr[dith(x, y, f - i) ? i + 1 : i];
  }

  // Per-pixel painting straight into ImageData (much faster than fillRect per pixel).
  function painter(ctx, w, h, keep) {
    const img = keep ? ctx.getImageData(0, 0, w, h) : ctx.createImageData(w, h), d = img.data, cache = {};
    return {
      put(x, y, c) {
        if (x < 0 || y < 0 || x >= w || y >= h) { return; }
        const v = cache[c] || (cache[c] = rgb(c)), k = (y * w + x) * 4;
        d[k] = v[0]; d[k + 1] = v[1]; d[k + 2] = v[2]; d[k + 3] = 255;
      },
      done() { ctx.putImageData(img, 0, 0); },
    };
  }

  // ----------------------------------------------------------------- palettes
  //
  // One palette per time of day. The landscape (hills, lake, trees, path) is the
  // same in all of them; only the light changes. Optional keys switch features on:
  // cloud (+ bird), star (+ starSky: share of the sky, starDensity: px per star),
  // meteors, firefly.

  const PAL = {
    scene: {
      body: 'sun',
      sky: ['#4f9ee6', '#6db4ee', '#93cbf4', '#bfe3fa', '#e2f3fd'],
      sun: ['#fff6c2', '#ffe27a', '#ffc24d'],
      cloud: ['#ffffff', '#d3e6f5'],
      far: '#a9d2c0', near: '#7fbf6a',
      field: ['#8fcf5a', '#6fb04a', '#5a9a3d'],
      tuft: '#4a8530', tuftHi: '#b5e37a',
      trunk: '#7a5230', leaf: ['#5aa04a', '#3f8038', '#86c85e'],
      path: ['#dcbb82', '#c49a60', '#a57c48'], pebble: '#8c6a3c',
      flowers: ['#ff7a8a', '#ffe066', '#ffffff', '#c59bff'], flowerEvery: 9,
      water: ['#cdeaf8', '#8fcaf0', '#5b9fdc'], shore: '#c9b27a',
      reed: '#5f8f3a', cattail: '#7a4a2a', lily: '#4f9a3a', lilyFlower: '#ff9ac0',
      shimmer: '#ffffff', glitter: '#fff6c2',
      bird: '#3b4a5c', ink: '#2f3b52',
      dust: ['#f1e2bf', '#dcc596'],
      shadow: 'rgba(60,40,10,0.32)',
    },
    sunset: {
      body: 'sunset',
      sky: ['#2b2857', '#5c3a78', '#a8507c', '#e6765e', '#ffb56b'],
      sun: ['#fff0b0', '#ffc65a', '#ff8a3d'],
      cloud: ['#d9687e', '#ffb07a'], // lit from below by the low sun
      star: ['#5a4a8a', '#a898d8', '#fff0f0'], starSky: 0.4, starDensity: 90,
      far: '#8e5a86', near: '#6f7440',
      field: ['#a0984a', '#7e843c', '#626c34'],
      tuft: '#4c5428', tuftHi: '#d0b45c',
      trunk: '#4e3226', leaf: ['#5c5e2e', '#434622', '#8c8038'],
      path: ['#d6a070', '#b57c54', '#8e5e3e'], pebble: '#6a4430',
      flowers: ['#ff8a7a', '#ffd070', '#ffb0c8'], flowerEvery: 14,
      water: ['#ffc07a', '#d86a6e', '#6a3c70'], shore: '#a07a50',
      reed: '#4a5028', cattail: '#4e2c1c', lily: '#56602c', lilyFlower: '#ff8aa0',
      shimmer: '#ffe2a8', glitter: '#ffd27a',
      bird: '#2e1c38', ink: '#2e1c38',
      dust: ['#e8bf90', '#c69a70'],
      shadow: 'rgba(60,20,40,0.35)',
    },
    night: {
      body: 'moon',
      sky: ['#070b1c', '#0c1330', '#131d44', '#1b2856', '#243468'],
      moon: ['#f6f2d4', '#d8d2a4', '#bdb68a'],
      star: ['#5a6aa0', '#aab8e8', '#ffffff'], starSky: 1, starDensity: 26, meteors: true,
      far: '#1f2d4a', near: '#1b3326',
      field: ['#2c4a2a', '#243f24', '#1d3420'],
      tuft: '#15291a', tuftHi: '#3f6a38',
      trunk: '#2e2218', leaf: ['#1c3a24', '#132a1a', '#2a4e30'],
      path: ['#4d4238', '#3f362e', '#322a24'], pebble: '#262019',
      flowers: ['#6a78b8', '#8a9ad0'], flowerEvery: 22,
      water: ['#2a3a70', '#16214a', '#0b1230'], shore: '#3a3a30',
      reed: '#16281a', cattail: '#241a14', lily: '#1c3624', lilyFlower: '#7a88c8',
      shimmer: '#aab8e8', glitter: '#f6f2d4',
      firefly: '#f2ff8a', glow: 'rgba(214,255,110,0.3)', ink: '#dfe6ff',
      dust: ['#6a5e52', '#524840'],
      shadow: 'rgba(0,0,0,0.38)',
    },
    none: {
      dust: ['rgba(170,170,170,0.75)', 'rgba(130,130,130,0.6)'], ink: '#8a94a6',
      shadow: 'rgba(0,0,0,0.25)',
    },
  };

  // The condor's habitat: the Illimani over La Paz. Tone ramps are dark → light.
  // `light` is how much the scene is lit from the left (sun / moon); at sunset the
  // light comes from behind the viewer (the Illimani glows, no sun disc).
  const ANDES_COMMON = {
    leaf: ['#5a6a3a', '#43502c', '#7a8a4a'], trunk: '#5a4030', flowers: ['#e86a8a', '#f2d06a'],
    flowerEvery: 1e9, water: ['#cdeaf8', '#8fcaf0', '#5b9fdc'], shore: '#9a8a6a', reed: '#5a6a3a',
    cattail: '#5a3a2a', lily: '#4f9a3a', lilyFlower: '#ff9ac0', shimmer: '#ffffff', glitter: '#fff6c2',
  };
  const ANDES = {
    scene: Object.assign({}, ANDES_COMMON, {
      body: 'sun', light: 1,
      sky: ['#1b4b98', '#275fb0', '#3874c2', '#538dcf', '#79a8da'],
      sun: ['#fff6c2', '#ffe27a', '#ffc24d'],
      cloud: ['#ffffff', '#c9d6e6'],
      ice: ['#5f7199', '#8597bc', '#b3c2dc', '#dde6f3', '#ffffff'],
      rock: ['#2e3346', '#444a60', '#5d647b', '#7a8197'],
      far: '#8fa7cc', distant: ['#6f86ad', '#97abc9', '#e3ebf6'],
      hillFar: ['#47434e', '#5b5560', '#726a72', '#8a8085'],
      hill: ['#3b2e28', '#55433a', '#73584a', '#937262'],
      badland: ['#6b4430', '#8f5c3e', '#b77a52', '#d69a6a'],
      city: ['#9c4a32', '#b5583b', '#c7714d', '#dccfba', '#8d969f', '#5e4638'],
      lights: ['#ffd27a', '#ffb04a', '#fff0c0'],
      field: ['#a8925e', '#8f7a4c', '#76643e'], path: ['#b49a64', '#9c8452', '#836c42'],
      tuft: '#86682a', tuftHi: '#e3c466', rockFg: ['#3a3431', '#57504a', '#776e66', '#9a8f84'],
      near: '#73584a', bird: '#2e2a2e', ink: '#2f3b52',
      dust: ['#d8c49a', '#bfa77c'], shadow: 'rgba(40,30,20,0.32)',
    }),
    sunset: Object.assign({}, ANDES_COMMON, {
      body: 'alpenglow', light: 0.35,
      sky: ['#2c2448', '#5a3a5e', '#9a5a62', '#d88a62', '#f2b878'],
      cloud: ['#e88a6a', '#ffc08a'],
      star: ['#5a4a8a', '#a898d8', '#fff0f0'], starSky: 0.35, starDensity: 90,
      ice: ['#8a5a6e', '#c27a74', '#e8a080', '#f8c8a0', '#fff0d8'],
      rock: ['#4a3036', '#6a4440', '#8c5e4c', '#b07a58'],
      far: '#c48a78', distant: ['#8a5a6e', '#c48a78', '#f8c8a0'],
      hillFar: ['#5a3a34', '#7a5240', '#9c6a4c', '#c08a5a'],
      hill: ['#4a2e22', '#74482e', '#a8683c', '#d89650'],
      badland: ['#6a3a24', '#9c5a30', '#d0843e', '#f0b060'],
      city: ['#7a3a2a', '#a85434', '#c8744a', '#ecd0a8', '#9a7a6a', '#4a2e26'],
      lights: ['#ffd27a', '#ffb04a', '#fff0c0'],
      field: ['#c09a58', '#a07e46', '#7e6236'], path: ['#c8a060', '#a8844c', '#86683a'],
      tuft: '#7a5a24', tuftHi: '#f4c860', rockFg: ['#3a2a28', '#5a403a', '#80604e', '#a8826a'],
      near: '#a8683c', bird: '#2e1c38', ink: '#2e1c38',
      dust: ['#e8bf90', '#c69a70'], shadow: 'rgba(60,20,40,0.35)',
    }),
    // Dawn: from La Paz the sun rises behind the Illimani — the massif stands dark against
    // a golden sky, its crest rimmed with light.
    dawn: Object.assign({}, ANDES_COMMON, {
      body: 'sunrise', light: 0.15, rim: '#ffe6a0',
      sky: ['#2a2c58', '#5a4a7a', '#b4707a', '#f0a878', '#ffd89a'],
      sun: ['#fff8d8', '#ffe08a', '#ffb050'],
      cloud: ['#c8889a', '#ffd0a0'],
      star: ['#4a4a7a', '#8a88c0', '#e8e0ff'], starSky: 0.3, starDensity: 120,
      ice: ['#2e2a4a', '#3e3860', '#524a74', '#6a5e88', '#8a7aa0'],
      rock: ['#1e1a2e', '#2a2440', '#363050', '#443c60'],
      far: '#7a6a8a', distant: ['#4a4060', '#7a6a8a', '#c8a8a8'],
      hillFar: ['#3a3040', '#4a3c4c', '#5c4a58', '#705a64'],
      hill: ['#2a1e1e', '#3a2a26', '#4e3830', '#644a3c'],
      badland: ['#4a2e26', '#64402e', '#86583a', '#a8744a'],
      city: ['#5a3a30', '#6e4636', '#84563e', '#c8a888', '#7a6a6a', '#2e2020'],
      lights: ['#ffd27a', '#ffb04a', '#fff0c0'],
      field: ['#8a7a58', '#706448', '#5a503a'], path: ['#94805a', '#7a6a4a', '#62543c'],
      tuft: '#5a4a24', tuftHi: '#e8c070', rockFg: ['#262024', '#3a3236', '#544a4a', '#706460'],
      near: '#4e3830', bird: '#2e1c38', ink: '#2e1c38',
      dust: ['#c8a888', '#a88a6a'], shadow: 'rgba(30,20,40,0.35)',
    }),
    night: Object.assign({}, ANDES_COMMON, {
      body: 'moon', light: 0.6,
      sky: ['#050816', '#0a1128', '#0f1a3c', '#16244e', '#1e2e5e'],
      moon: ['#f6f2d4', '#d8d2a4', '#bdb68a'],
      star: ['#5a6aa0', '#aab8e8', '#ffffff'], starSky: 1, starDensity: 20, meteors: true,
      ice: ['#283456', '#3a4a72', '#586a96', '#8294be', '#b2c2e2'],
      rock: ['#121828', '#1a2236', '#242d46', '#303a56'],
      far: '#2a3658', distant: ['#1a2236', '#2a3658', '#8294be'],
      hillFar: ['#131724', '#191e2e', '#202638', '#272e44'],
      hill: ['#0f0e16', '#16141e', '#1e1a27', '#272131'],
      badland: ['#19131f', '#231829', '#2d1f33', '#38293f'],
      city: ['#1c1820', '#241e28', '#2a2430', '#34303c', '#221c26', '#141218'],
      lights: ['#ffd27a', '#ffb04a', '#fff0c0', '#ff8a3a'],
      field: ['#2a2a30', '#22222a', '#1c1c24'], path: ['#2e2a2a', '#262222', '#1e1a1a'],
      tuft: '#1a1814', tuftHi: '#4a4430', rockFg: ['#0e0e14', '#16161e', '#20202a', '#2c2c38'],
      near: '#1e1a27', bird: '#2a2a3a', ink: '#dfe6ff',
      dust: ['#4a4652', '#3a3642'], shadow: 'rgba(0,0,0,0.4)',
    }),
  };

  // Local time -> palette. Dawn (6-7 h) reuses the warm sunset light.
  function phaseNow() {
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    if (h >= 7 && h < 17.5) { return 'scene'; }
    if ((h >= 6 && h < 7) || (h >= 17.5 && h < 19.5)) { return 'sunset'; }
    return 'night';
  }

  // ------------------------------------------------------------------- world
  //
  // Season, holidays, weather and moon phase come from the local date. The
  // southern hemisphere (seasons flipped, moon mirrored) is guessed from the
  // time zone unless set.

  const SOUTH_TZ = new RegExp('^(Australia|Antarctica)/' +
    '|^Pacific/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Efate|Tahiti)' +
    '|^America/(Argentina/|Buenos_Aires|Santiago|Punta_Arenas|La_Paz|Lima|Asuncion|Montevideo|Sao_Paulo' +
    '|Rio_Branco|Porto_Velho|Cuiaba|Campo_Grande|Manaus|Belem|Fortaleza|Recife|Maceio|Bahia|Araguaina' +
    '|Santarem|Noronha|Eirunepe)' +
    '|^Africa/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane|Lubumbashi|Luanda' +
    '|Blantyre|Dar_es_Salaam|Kinshasa)' +
    '|^Indian/(Antananarivo|Mauritius|Reunion|Mayotte|Comoro)|^Asia/(Jakarta|Makassar|Jayapura|Dili)');

  function southern(pref) {
    if (pref === 'north' || pref === 'south') { return pref === 'south'; }
    try { return SOUTH_TZ.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); }
    catch (e) { return false; }
  }

  function seasonAt(d, south) {
    const m = (d.getMonth() + (south ? 6 : 0)) % 12; // as a northern month
    return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  }

  function holidayAt(d) {
    const m = d.getMonth() + 1, day = d.getDate();
    if ((m === 10 && day >= 25) || (m === 11 && day === 1)) { return 'halloween'; }
    if (m === 12 && day >= 20 && day <= 26) { return 'christmas'; }
    if ((m === 12 && day === 31) || (m === 1 && day === 1)) { return 'newyear'; }
    return '';
  }

  const WEATHERS = ['clear', 'cloudy', 'rain', 'storm', 'fog', 'snow'];

  // 'auto': one roll per 4-hour block, the same for the whole block.
  function weatherAt(d, pref, season) {
    if (WEATHERS.indexOf(pref) >= 0) { return pref; }
    const day = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 864e5);
    const r = mulberry32(d.getFullYear() * 4000 + day * 8 + Math.floor(d.getHours() / 4));
    const a = r(), b = r();
    let w = a < 0.5 ? 'clear' : a < 0.7 ? 'cloudy' : a < 0.84 ? 'rain' : a < 0.9 ? 'storm' : 'fog';
    if (w === 'fog' && d.getHours() >= 11) { w = 'cloudy'; } // fog lifts by late morning
    if ((w === 'rain' || w === 'storm') && season === 'winter' && b < 0.5) { w = 'snow'; }
    return w;
  }

  // Moon phase 0..1 (0 new, 0.5 full), from a known new moon: 2000-01-06 18:14 UTC.
  function moonPhase(d) {
    const days = (d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
    return (((days / 29.530588853) % 1) + 1) % 1;
  }

  // Season and weather tint a copy of the time-of-day palette. Tint targets are
  // darkened at night and warmed at sunset so the light stays consistent.
  function adjust(base, mode, w) {
    const p = Object.assign({}, base);
    if (!base.sky) { return p; }
    const night = mode === 'night', dusk = mode === 'sunset';
    const lit = (c) => (night ? mix(c, '#0b1230', 0.62) : dusk ? mix(c, '#7a3f6a', 0.25) : c);
    const tint = (arr, to, f) => arr.map((c) => mix(c, lit(to), f));
    if (w.season === 'spring') {
      p.flowerEvery = base.flowerEvery * 0.5;
      p.blossom = lit('#ffb7d0');
      p.falling = [p.blossom, lit('#ffd9e6')];
    } else if (w.season === 'autumn') {
      p.leaf = [mix(base.leaf[0], lit('#d0782a'), 0.65), mix(base.leaf[1], lit('#9a4420'), 0.6),
        mix(base.leaf[2], lit('#f2b443'), 0.65)];
      p.field = tint(base.field, '#b89a48', 0.25);
      p.flowerEvery = base.flowerEvery * 2;
      p.falling = p.leaf;
    } else if (w.season === 'winter') {
      p.field = tint(base.field, '#9aa494', 0.25);
      p.flowerEvery = base.flowerEvery * 3;
      p.firefly = null;
    }

    const wx = w.weather, wet = wx === 'rain' || wx === 'storm' || wx === 'snow';
    const grey = night ? '#151a28' : dusk ? '#6e5a6c' : '#9aa6b0';
    const over = { cloudy: 0.35, fog: 0.25, rain: 0.55, storm: 0.7, snow: 0.45 }[wx] || 0;
    if (over) {
      p.sky = base.sky.map((c) => mix(c, grey, over));
      p.cloud = base.cloud ? base.cloud.map((c) => mix(c, grey, over * 0.9)) : [mix(grey, '#8090b0', 0.25), grey];
      p.cloudMore = wx === 'fog' ? 1 : wx === 'cloudy' ? 2.5 : 3;
      p.far = mix(base.far, grey, over * 0.5);
    }
    if (wx === 'cloudy' && base.star) { p.starDensity = base.starDensity * 2; }
    if (wet) {
      p.wet = true; p.hideBody = true; p.star = null; p.meteors = false; p.bird = null; p.firefly = null;
      p.falling = null;
    }
    if (wx === 'rain' || wx === 'storm') {
      p.rain = night ? 'rgba(150,170,220,0.55)' : 'rgba(215,228,242,0.75)';
      p.storm = wx === 'storm';
    }
    if (wx === 'fog') { p.fog = night ? '#3a4466' : dusk ? '#e8b8b0' : '#eef3f5'; }
    if (wx === 'snow') {
      const sn = night ? '#8a96b8' : dusk ? '#f0d4dc' : '#f4f8fc';
      p.snow = night ? '#c8d0e8' : '#ffffff';
      p.field = p.field.map((c) => mix(c, sn, 0.6));
      p.near = mix(base.near, sn, 0.55); p.far = mix(p.far, sn, 0.45);
      p.tuft = mix(base.tuft, sn, 0.35); p.tuftHi = sn;
      p.path = base.path.map((c) => mix(c, sn, 0.35));
      p.leaf = p.leaf.map((c) => mix(c, sn, 0.3)); p.snowCap = sn;
      p.flowerEvery = 1e9;
      p.water = night ? ['#4a5a80', '#3a4a70', '#2a3a60'] : dusk ? ['#f0d0d8', '#d8b8cc', '#b898b8']
        : ['#e6f3fa', '#cfe5f2', '#b2d2e8'];
      p.frozen = true; // no swimming, no ducks, no ripples
      ['hill', 'hillFar', 'badland', 'rockFg'].forEach((k) => {
        if (base[k]) { p[k] = base[k].map((c, i) => mix(c, sn, 0.25 + 0.1 * i)); }
      });
    }
    return p;
  }

  const CONFETTI = ['#ff5d73', '#ffd23f', '#4dd6ff', '#7cf29a', '#c792ff'];
  const SPARK = ['#fff8d6', '#ffd23f'];

  const HEART = [
    '.oo.oo.',
    'ohrorro',
    'orrrrro',
    '.orrro.',
    '..oro..',
    '...o...',
  ];
  const HEART_C = { o: '#7a1030', r: '#ff4d6d', h: '#ffc2cf' };

  const ALERT = ['ooo', 'oyo', 'oyo', 'oyo', 'ooo', 'oyo', 'ooo'];
  const ALERT_C = { o: '#3a2a10', y: '#ffd23f' };

  // Sleep "z"s (small, then big as they float away).
  const Z_SMALL = ['xxx', '.x.', 'xxx'];
  const Z_BIG = ['xxxx', '..x.', '.x..', 'xxxx'];

  const DROP = ['.b', 'bw', 'bb'];
  const DROP_C = { b: '#6ec6ff', w: '#e6f6ff' };
  const STEAM = 'rgba(242,237,231,0.85)';

  // The capybara swimming, half size (it is farther away): head and back above
  // the water, facing right. Row 6 sits on the waterline.
  const SWIM = [
    '..........o.o...',
    '.........ooooo..',
    '........ohhfffo.',
    '....ooooffffoffo',
    '..oohhffffffffdo',
    '.ohffffffffffffo',
    'offfffffffffffso',
  ];
  const SWIM_C = { o: '#0a0502', f: '#c86e3d', h: '#f08952', s: '#8e4d35', d: '#7c3f2b' };
  const SWIM_W = 16, SWIM_HEAD = 11; // width, head-top column (facing right)

  // Top of the head (sprite px, facing right) of the poses that can carry
  // something on it; on the others a mandarin falls off and a bird flies away.
  const HEAD = { walk: [25.5, 19], eat: [25.5, 19], coffee: [19, 14], sleep: [25.5, 24] };

  // A little bird (yellow belly, like the ones that ride capybaras), facing right.
  const PERCH = ['..hh.', '.hhek', 'bbyy.', '..f..'];
  const PERCH_C = { h: '#7a7f8c', e: '#0a0502', k: '#f2a03d', b: '#565a66', y: '#f7d148', f: '#3a2a10' };
  const NOTE = ['.xx', '.x.', 'xx.'];

  // The mandarin (the capybara-in-a-hot-spring meme); a smaller one for the swimmer.
  const ORANGE = ['..gl.', '.ooo.', 'ohooo', 'ooood', '.ddd.'];
  const ORANGE_S = ['.l.', 'hoo', 'ood'];
  const ORANGE_C = { o: '#f28a1e', h: '#ffd08a', d: '#c4620e', g: '#4a7a2a', l: '#7cc444' };
  // An Andean chullo (knitted hat with ear flaps and a pompom) for the condor.
  const CHULLO = ['...p...', '..rrr..', '.ryyyr.', 'rbrbrbr', 'rrrrrrr', 'b.....b', 'y.....y'];
  const CHULLO_C = { p: '#f2f2f2', r: '#d8343a', y: '#f2c230', b: '#2a6ad8' };

  // Andean fauna (facing right; the last row stands on the ground).
  // A llama with coloured wool tassels in its ears (t), walking (2 frames) and grazing.
  const LLAMA = [
    ['........t.t..', '........o.o..', '.......owwwo.', '.......owkwwo', '.......owwwo.', '........owo..',
      '........owo..', '..oooooo.owo.', '.owwwwwwwwwo.', 'owwwwwwwwwwo.', '.oswwwwwwsso.', '..s.s..s..s..',
      '..s.s..s..s..', '..f.f..f..f..'],
    ['........t.t..', '........o.o..', '.......owwwo.', '.......owkwwo', '.......owwwo.', '........owo..',
      '........owo..', '..oooooo.owo.', '.owwwwwwwwwo.', 'owwwwwwwwwwo.', '.oswwwwwwsso.', '...ss...ss...',
      '...ss...ss...', '...ff...ff...'],
  ];
  const LLAMA_GRAZE = ['.............', '.............', '.............', '.............', '.............',
    '.............', '.............', '..oooooooo...', '.owwwwwwwwo..', 'owwwwwwwwwwo.', '.oswwwwwwswot',
    '..s.s..s..owo', '..s.s..s..owk', '..f.f..f..fow'];
  const LLAMA_FUR = [['#f4efe6', '#d6c8b4'], ['#b98b5e', '#8f6640'], ['#6a5a50', '#4c4038'], ['#e9dcc4', '#c9b494']];
  const TASSELS = ['#e8344a', '#f2c230', '#3aa0e0', '#e85ab8'];
  // A vizcacha sitting on the rocks (ears up / ears down), with its curled tail.
  const VIZCACHA = [
    ['.o.o.....', '.o.o.....', 'owwwo....', 'owkwwo...', '.owwwwo..', '.owwwwwo.', '.owwwwwot', '..ff.ff.t'],
    ['.........', '.oo......', 'owwwo....', 'owkwwo...', '.owwwwo..', '.owwwwwo.', '.owwwwwot', '..ff.ff.t'],
  ];
  const VIZCACHA_C = { o: '#3a3028', w: '#b8ab98', k: '#0a0502', f: '#4a3e34', t: '#8a7a68' };
  // A condor feather drifting down (two tilts).
  const FEATHER = [['.oo', 'oo.', 'o..'], ['oo.', '.oo', '..o']];

  // The baby capybara (half the size of its mum, a bigger head), facing right.
  const BABY = {
    walk: [
      ['.........o.o...', '........ooooo..', '.......ohhffoo.', '..ooooofffofffo', '.ohhfffffffffdo',
        'offffffffffffo.', 'offfffffffffo..', '.offfffffffo...', '.ofo.oo.ofo....', '.oo..oo..oo....'],
      ['.........o.o...', '........ooooo..', '.......ohhffoo.', '..ooooofffofffo', '.ohhfffffffffdo',
        'offffffffffffo.', 'offfffffffffo..', '.offfffffffo...', '..ofoo.ofo.....', '..oo.oo.oo.....'],
    ],
    stand: ['.........o.o...', '........ooooo..', '.......ohhffoo.', '..ooooofffofffo', '.ohhfffffffffdo',
      'offffffffffffo.', 'offfffffffffo..', '.offfffffffo...', '.ofo....ofo....', '.oo.....oo.....'],
    sleep: ['.........o.o...', '....ooooooooo..', '..oohhhhhhhffo.', '.offfffffffoffo', 'offffffffffffdo',
      'offffffffffffo.', '.ooooooooooooo.'],
    // Riding on its swimming mum's back: just a tiny head peeking out.
    ride: ['.....o.', '...oooo', '.ooffoo', 'offfffo'],
  };
  const BABY_W = 15;

  // A slice of watermelon to feed them (eaten from the top down).
  const MELON = ['...r...', '..rkr..', '.rrrrr.', 'rkrrrkr', 'ggggggg', '.GGGGG.'];
  const MELON_C = { r: '#ff5a6e', k: '#2a1a14', g: '#8fd16a', G: '#3f8a3a' };

  // Lake visitors (facing right; the last row sits on the waterline).
  const DUCK = ['....hh.', '....hek', 'bbbbbb.', '.dddd..'];
  const DUCK_C = { h: '#7a5a3a', e: '#0a0502', k: '#e8902a', b: '#9a7a52', d: '#6a5236' };
  const DUCKLING = ['..yk', 'yyy.'];
  const DUCKLING_C = { y: '#f7d148', k: '#e8902a' };
  const TURTLE = ['.sSs.', 'hsssh'];
  const TURTLE_C = { s: '#4a7a32', S: '#7aa848', h: '#8a9a4a' };

  // Holidays: a Santa hat (facing right, the tip droops back), pumpkins, bats.
  const HAT = ['w.....', 'wrr...', '.rrrr.', 'rrrrrr', 'wwwwww'];
  const HAT_S = ['w..', 'rr.', 'www'];
  const HAT_C = { r: '#d8343a', w: '#f4f1ea' };
  const PUMPKIN = ['..g..', '.ooo.', 'oyoyo', 'oyyyo', '.ooo.'];
  const BAT = [
    ['x.....x', 'xx...xx', '.xxxxx.', '...x...'],
    ['.......', '..xxx..', 'xxxxxxx', 'x..x..x'],
  ];

  const BIRD = [
    ['x...x', '.x.x.', '..x..'], // wings up
    ['.....', '.xxx.', 'x...x'], // wings down
  ];

  // -------------------------------------------------------------------- stage

  // o = { stage, px, pet, base, feet, mode: 'time'|'scene'|'sunset'|'night'|'none', reduced }
  //   pet  sprite size (CSS px); base = sprite bottom offset; feet = feet line offset
  //   'time' follows the local clock (day / sunset / night) and switches live.
  function create(o) {
    const PX = o.px, stage = o.stage, anim = !o.reduced;
    const byTime = o.mode === 'time';
    const baseMode = () => (byTime ? phaseNow() : PAL[o.mode] ? o.mode : 'none');
    function worldNow() {
      const d = new Date(), south = southern(o.hemisphere), seasons = o.seasons !== false;
      const season = seasons ? seasonAt(d, south) : 'summer';
      return {
        season, south, holiday: seasons ? holidayAt(d) : '', day: d.toDateString(),
        weather: weatherAt(d, o.weather || 'auto', season), moon: moonPhase(d),
        dawn: byTime && d.getHours() < 12, // the 'sunset' light in the morning is dawn
      };
    }
    let mode = baseMode(), world = worldNow();
    const habitat = o.habitat === 'andes' ? 'andes' : 'lake';
    const TABLE = habitat === 'andes' ? Object.assign({}, ANDES, { none: PAL.none }) : PAL;
    const palFor = (m, w) => (m === 'sunset' && w.dawn && TABLE.dawn ? TABLE.dawn : TABLE[m]);
    let P = adjust(palFor(mode, world), mode, world);
    let perchSpot = null, cityLights = [];
    // Andean life: the ground band and rock (for placing it), dust devils, a llama herd, a vizcacha.
    let ground = null, devils = [], herd = null, vizcacha = null;
    const scenic = mode !== 'none';
    const report = () => {
      if (o.onWorld) { o.onWorld({ mode, weather: world.weather, season: world.season, holiday: world.holiday }); }
    };

    const sceneCv = layer(1, 1), fxCv = layer(1, 1);
    sceneCv.id = 'scene'; fxCv.id = 'fx';
    sceneCv.className = fxCv.className = 'pix';
    stage.insertBefore(sceneCv, stage.firstChild);
    stage.appendChild(fxCv);
    const sc = sceneCv.getContext('2d'), fc = fxCv.getContext('2d');

    let W = 0, H = 0, t = 0, clock = 0, horizon = 0, pathTop = 0;
    let back = null, front = null, clouds = [], stars = [], flies = [];
    let body = { cx: -99, cy: 0, R: 0 }, water = null, lake = null, shimmer = [];
    let birds = null, meteor = null, ripple = null, parts = [], fxDirty = false;
    let last = null, prevState = '';
    // Swimming: the lake row it swims on and the range of its left edge (art px).
    let swimY = 0, swimMin = 0, swimMax = -1, swimmer = null, dripFor = 0;
    let perch = null, orange = 0, orangeWait = 0, lastHead = null;
    const GRID = o.grid || 42;
    const condor = o.kind === 'condor';
    const HK = GRID >= 84 ? 2 : 1; // hats drawn at 2× on the finer grid
    const baseOf = (p) => (p && p.bottom !== undefined ? p.bottom : o.base); // the condor flies
    // World life: trees (for falling leaves), weather particles, lake visitors.
    let trees = [], falling = [], drops = [], flakes = [], fog = null, bolt = null;
    let ducks = null, log = null, turtleAway = 0, fireworks = [], pumpkins = [];
    // Fur colours (variants swap these four) for the swimmer and the baby.
    const FUR = Object.assign({}, SWIM_C, o.fur || {});
    let baby = null, food = null;
    const sfx = (n) => { if (o.sfx && anim) { o.sfx(n); } };

    // Canvas row that contains the given CSS offset from the stage bottom.
    const row = (b) => H - 1 - Math.floor(b / PX);
    const isWater = (x, y) => !!water && x >= 0 && x < W && y >= 0 && y < H && water[y * W + x] === 1;

    // ------------------------------------------------------------ scenery

    function cloudSprite(r, s) {
      const puffs = 3 + Math.floor(r() * 2), rad = [];
      for (let i = 0; i < puffs; i++) {
        // Middle puffs are the tallest, like a cumulus.
        const mid = i > 0 && i < puffs - 1 ? 1 : 0;
        rad.push(s + mid + Math.floor(r() * 2));
      }
      const cx = [rad[0]];
      for (let i = 1; i < puffs; i++) {
        cx.push(cx[i - 1] + Math.max(2, Math.round((rad[i - 1] + rad[i]) * 0.7)));
      }
      const maxR = Math.max.apply(null, rad), base = s + maxR;
      const cv = layer(cx[puffs - 1] + rad[puffs - 1] + 1, base + 1), g = cv.getContext('2d');
      for (let i = 0; i < puffs; i++) {
        disc(g, cx[i], base - s, rad[i], (dx, dy, x, y) => {
          if (y > base) { return null; }
          if (y === base || (y === base - 1 && dith(x, y, 0.5))) { return P.cloud[1]; }
          return P.cloud[0];
        });
      }
      return cv;
    }

    function tree(g, x, baseY, cr) {
      const th = cr + 1, cy = baseY - th - cr + 1;
      dot(g, P.trunk, x, baseY - th, cr > 3 ? 2 : 1, th + 1);
      disc(g, x, cy, cr, (dx, dy, px, py) => {
        if (P.snowCap && dy < -cr * 0.35 && dith(px, py, 0.8)) { return P.snowCap; }
        if (P.blossom && (px * 7 + py * 13) % 5 === 0) { return P.blossom; } // spring blossom
        if (dx + dy < -cr * 0.5) { return P.leaf[2]; }
        if (dx + dy > cr * 0.3 && dith(px, py, 0.55)) { return P.leaf[1]; }
        return P.leaf[0];
      });
      trees.push({ x, y: cy, r: cr });
    }

    function drawBody(b) {
      const sunset = P.body === 'sunset';
      const R = sunset ? clamp(Math.round(H * 0.1), 3, 8) : clamp(Math.round(H * 0.07), 2, 6);
      const andes = habitat === 'andes';
      const cx = Math.round(W * (andes ? 0.12 : sunset ? 0.7 : 0.8));
      // The setting sun sits on the horizon, half hidden behind the hills.
      const cy = sunset ? horizon - Math.round(R * 0.4) : Math.max(R + 2, Math.round(horizon * (andes ? 0.2 : 0.3)));
      body = { cx, cy, R, light: 1 };
      if (P.hideBody || P.body === 'alpenglow' || P.body === 'sunrise') { body = { cx: -99, cy: 0, R: 0, light: 0 }; return; } // rain clouds / sun behind us or behind the mountain
      if (P.body === 'moon') {
        // Tonight's phase: lit from the right while waxing (mirrored in the south).
        const ph = world.moon, k = Math.cos(ph * 2 * Math.PI);
        body.light = (1 - k) / 2;
        const isLit = (dx, dy) => {
          const hw = Math.sqrt(Math.max(0, R * R - dy * dy)) + 0.5, sx = world.south ? -dx : dx;
          return ph < 0.5 ? sx >= k * hw : sx <= -k * hw;
        };
        const shade = mix(P.sky[2], P.moon[2], 0.2); // earthshine: the dark part, barely there
        if (body.light > 0.3) { disc(b, cx, cy, R + 2, (dx, dy, x, y) => (dith(x, y, 0.25) ? P.sky[4] : null)); }
        disc(b, cx, cy, R, (dx, dy) => (isLit(dx, dy) ? P.moon[0] : shade));
        [[-0.4, -0.2], [0.15, 0.35], [-0.1, 0.5]].forEach((c) => {
          const dx = Math.round(c[0] * R), dy = Math.round(c[1] * R);
          if (isLit(dx, dy)) { dot(b, P.moon[1], cx + dx, cy + dy); }
        });
        return;
      }
      disc(b, cx, cy, R + (sunset ? 3 : 2), (dx, dy, x, y) =>
        (dith(x, y, sunset ? 0.3 : 0.35) ? P.sun[sunset ? 1 : 0] : null));
      disc(b, cx, cy, R, (dx, dy, x, y) => {
        if (dx + dy < -R * 0.6) { return P.sun[0]; }
        if (dx + dy > R * 0.5 && dith(x, y, 0.5)) { return P.sun[2]; }
        return P.sun[1];
      });
    }

    function build() {
      if (habitat === 'andes') { buildAndes(); return; }
      // Separate seeded streams: the landscape is identical at every time of day.
      const rl = mulberry32(0x5eed1), rs = mulberry32(0x5eed2), rf = mulberry32(0x5eed3);
      pathTop = clamp(row(o.feet) - 2, 3, H - 2);
      horizon = clamp(Math.round(H * 0.5), 2, pathTop - 2);

      // --- back layer: sky, sun or moon
      back = layer(W, H);
      const b = back.getContext('2d');
      ditherBands(b, 0, 0, W, horizon + 1, P.sky);
      drawBody(b);

      // --- sky life: clouds, twinkling stars
      clouds = []; stars = [];
      if (P.cloud) {
        const n = Math.round((2 + Math.floor(W / 70)) * (P.cloudMore || 1));
        const near = clamp(Math.round(H * 0.03), 2, 4);
        for (let i = 0; i < n; i++) {
          const far = i % 2 === 1, cv = cloudSprite(rs, far ? near - 1 : near);
          clouds.push({
            cv, x: rs() * (W + cv.width) - cv.width,
            y: Math.floor(rs() * Math.max(1, horizon * 0.5 - cv.height + 2)),
            v: (far ? 0.018 : 0.04) * (0.8 + rs() * 0.4),
          });
        }
      }
      if (P.star) {
        const skyH = Math.max(2, Math.round(horizon * P.starSky));
        const n = Math.round((W * skyH) / P.starDensity);
        for (let i = 0; i < n; i++) {
          const x = Math.floor(rs() * W), y = Math.floor(rs() * Math.max(1, skyH - 2));
          if (Math.abs(x - body.cx) < body.R + 3 && Math.abs(y - body.cy) < body.R + 3) { continue; }
          stars.push({ x, y, p: rs() * 6.283, s: 0.04 + rs() * 0.12, big: rs() < 0.12 });
        }
      }

      // --- front layer: hills, trees, meadow, lake, path
      front = layer(W, H);
      const f = front.getContext('2d');
      const p1 = rl() * 6.283, p2 = rl() * 6.283, p3 = rl() * 6.283;
      const farAmp = Math.max(2, Math.round(horizon * 0.42));
      const nearAmp = Math.max(1, Math.round(horizon * 0.2));
      const farY = (x) => horizon - Math.round(farAmp *
        (0.55 + 0.3 * Math.sin(x * 0.06 + p1) + 0.15 * Math.sin(x * 0.17 + p2)));
      const nearY = (x) => horizon - Math.round(nearAmp * (0.5 + 0.5 * Math.sin(x * 0.1 + p3)));
      for (let x = 0; x < W; x++) {
        const y = farY(x);
        dot(f, P.far, x, y, 1, horizon - y + 1);
      }
      trees = [];
      const treeN = W < 40 ? 0 : 1 + Math.floor(W / 90);
      const cr = clamp(Math.round(H * 0.06), 2, 5);
      for (let i = 0; i < treeN; i++) {
        const tx = Math.floor(rl() * W);
        tree(f, tx, nearY(tx) + 1, cr);
      }
      for (let x = 0; x < W; x++) {
        const y = nearY(x);
        dot(f, P.near, x, y, 1, horizon - y + 1);
        dot(f, P.field[0], x, y);
      }

      const fieldH = pathTop - horizon - 1;
      ditherBands(f, 0, horizon + 1, W, fieldH, P.field);
      buildLake(f, rl, fieldH, farY, nearY);

      const tufts = Math.round((W * Math.max(1, fieldH)) / 26);
      for (let i = 0; i < tufts; i++) {
        const x = Math.floor(rl() * W), y = horizon + 2 + Math.floor(rl() * Math.max(1, fieldH - 1));
        const hi = rl() < 0.3;
        if (isWater(x, y) || isWater(x, y + 1) || isWater(x, y - 2)) { continue; }
        dot(f, P.tuft, x - 1, y - 1);
        dot(f, P.tuft, x + 1, y - 1);
        dot(f, P.tuft, x, y - 2, 1, 2);
        if (hi) { dot(f, P.tuftHi, x, y - 2); }
      }

      ditherBands(f, 0, pathTop, W, H - pathTop, P.path);
      for (let x = 0; x < W; x++) {
        if (rl() < 0.5) { dot(f, P.field[2], x, pathTop); }
        if (rl() < 0.15) { dot(f, P.field[2], x, pathTop + 1); }
      }
      const pebbles = Math.round(W / 8);
      for (let i = 0; i < pebbles; i++) {
        const x = Math.floor(rl() * W), y = pathTop + 2 + Math.floor(rl() * Math.max(1, H - pathTop - 2));
        dot(f, P.pebble, x, y, rl() < 0.3 ? 2 : 1, 1);
        dot(f, P.path[0], x, y - 1);
      }

      // Flowers and fireflies depend on the palette, so they use their own stream.
      const flowers = Math.round(W / P.flowerEvery);
      for (let i = 0; i < flowers; i++) {
        const x = Math.floor(rf() * W);
        const y = horizon + 2 + Math.floor((0.4 + rf() * 0.6) * Math.max(1, fieldH - 1));
        const c = P.flowers[Math.floor(rf() * P.flowers.length)];
        if (isWater(x, y) || isWater(x, y - 1)) { continue; }
        dot(f, P.tuft, x, y);
        dot(f, c, x, y - 1);
      }
      flies = [];
      if (P.firefly) {
        const n = 3 + Math.floor(W / 45);
        for (let i = 0; i < n; i++) {
          flies.push({ bx: rf() * W, by: horizon - 2 + rf() * (pathTop - horizon + 1), p: rf() * 6.283 });
        }
      }

      // Halloween: pumpkins on the grass by the path (their eyes glow at night).
      pumpkins = [];
      if (world.holiday === 'halloween') {
        const colours = { g: P.tuft, o: mix('#e07a1a', P.path[2], mode === 'night' ? 0.45 : 0),
          y: mode === 'night' ? '#ffd23f' : '#3a2010' };
        const n = 1 + Math.floor(W / 110);
        for (let i = 0; i < n; i++) {
          const x = Math.round(W * (0.15 + 0.7 * (i + 0.5) / n) + (rf() - 0.5) * 10);
          blit(f, PUMPKIN, colours, x - 2, pathTop - 4);
          pumpkins.push(x);
        }
      }
      buildWeather(rf);
    }

    // ------------------------------------------------------------ andes

    // A thin, wispy cirrus streak (high-altitude skies are full of them).
    function cirrusSprite(r, w) {
      const cv = layer(w, 4), g = cv.getContext('2d');
      for (let x = 0; x < w; x++) {
        const k = Math.sin((x / w) * Math.PI), th = k * 3.2;
        for (let y = 0; y < 4; y++) {
          const d = Math.abs(y - 1.6 - Math.sin(x * 0.07 + r() * 0.2) * 0.6);
          if (d < th * 0.5 && dith(x, y, 0.35 + k * 0.6)) { dot(g, P.cloud[d < 0.7 ? 0 : 1], x, y); }
        }
      }
      return cv;
    }

    // A cumulus with volume: overlapping puffs, lit on top, shaded underneath.
    function cumulusSprite(r, s) {
      const n = 4 + Math.floor(r() * 4), puffs = [];
      let x = s;
      for (let i = 0; i < n; i++) {
        const mid = 1 - Math.abs(i / (n - 1) - 0.5) * 1.4; // taller in the middle
        const rad = Math.max(2, Math.round(s * (0.55 + mid * 0.6 + r() * 0.3)));
        puffs.push({ x, rad }); x += Math.max(2, Math.round(rad * (0.9 + r() * 0.4)));
      }
      const maxR = Math.max.apply(null, puffs.map((q) => q.rad));
      const w = x + maxR + 1, base = maxR * 2, h = base + 1;
      const cv = layer(w, h), g = cv.getContext('2d');
      const ramp = [P.cloud[1], mix(P.cloud[1], P.cloud[0], 0.5), P.cloud[0]];
      for (const q of puffs) {
        const cy = base - q.rad + Math.round(q.rad * 0.15);
        disc(g, q.x, cy, q.rad, (dx, dy, px, py) => {
          if (py > base) { return null; }
          const v = 1 - (py - (base - maxR * 2)) / (maxR * 2) * 0.9 - (dx > 0 ? 0.08 : 0);
          return tone(ramp, py >= base - 1 ? 0 : v, px, py);
        });
      }
      return cv;
    }

    function buildAndes() {
      const rs = mulberry32(0xa11e2), rf = mulberry32(0xa11e3);
      const N = valueNoise(7), N2 = valueNoise(11);
      water = null; lake = null; shimmer = []; swimMin = 0; swimMax = -1; log = null;
      pumpkins = []; trees = []; flies = []; cityLights = [];
      pathTop = clamp(row(o.feet) - 2, 3, H - 2);
      const fgTop = clamp(pathTop - Math.round(H * 0.08), 2, pathTop);
      horizon = clamp(Math.round(H * 0.6), 2, fgTop - 2);
      const L = P.light;

      // --- back: sky, sun / moon, distant ranges and the Illimani
      back = layer(W, H);
      const b = back.getContext('2d');
      ditherBands(b, 0, 0, W, horizon + 1, P.sky);
      drawBody(b);
      const bp = painter(b, W, H, true);

      // Distant snowy cordillera to the left, faint far peaks to the right.
      const ridgeLine = (x, amp, f, seed) => horizon - Math.round(amp * (0.35 + 0.65 * N.fbm(x * f, seed, 3)));
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const amp = H * (u < 0.35 ? 0.12 * (1 - u / 0.35) + 0.03 : u > 0.82 ? 0.05 : 0.025);
        const t = ridgeLine(x, amp, 0.03, 21);
        for (let y = t; y <= horizon + 2; y++) {
          const d = y - t, cap = d < amp * 0.35 * (0.6 + 0.8 * N(x * 0.1, 3));
          bp.put(x, y, cap ? P.distant[2] : dith(x, y, 0.5 + (N(x * 0.2, y * 0.2) - 0.5)) ? P.distant[1] : P.distant[0]);
        }
      }

      // The Illimani: a three-summit massif (pointed left peak with bare rock, two
      // rounded summits, a long ridge falling to the right), relief from noise.
      const mH = Math.round(H * 0.5), mW = Math.min(Math.round(W * 0.92), Math.round(mH * 3.3));
      const mx0 = Math.round(W * 0.56 - mW / 2);
      const PROF = [[0, 0.06], [0.07, 0.2], [0.16, 0.38], [0.27, 0.72], [0.335, 0.93], [0.355, 1],
        [0.375, 0.93], [0.42, 0.85], [0.47, 0.88], [0.53, 0.95], [0.6, 0.9], [0.67, 0.96], [0.75, 0.84],
        [0.82, 0.71], [0.87, 0.66], [0.93, 0.44], [1, 0.08]];
      const prof = (u) => {
        let i = 0;
        while (i < PROF.length - 2 && PROF[i + 1][0] < u) { i++; }
        const [u0, v0] = PROF[i], [u1, v1] = PROF[i + 1], t = clamp((u - u0) / (u1 - u0), 0, 1);
        return v0 + (v1 - v0) * (1 - Math.cos(t * Math.PI)) / 2;
      };
      const crest = (x) => {
        const u = (x - mx0) / mW;
        return u < 0 || u > 1 ? null : base(u, x);
      };
      function base(u, x) { return Math.round(horizon - prof(u) * mH - (N.fbm(x * 0.15, 3.1, 3) - 0.5) * mH * 0.05); }
      if (P.body === 'sunrise' && !P.hideBody) { // the sun peeking over the Illimani's right summit
        const sx = Math.round(mx0 + mW * 0.62), R = clamp(Math.round(H * 0.07), 3, 9);
        const sy = crest(sx) - Math.round(R * 0.35);
        for (let dy = -R - 4; dy <= R + 4; dy++) {
          for (let dx = -R - 4; dx <= R + 4; dx++) {
            const d2 = dx * dx + dy * dy, x = sx + dx, y = sy + dy;
            if (d2 <= R * R + R * 0.6) { bp.put(x, y, dx + dy < -R * 0.5 ? P.sun[0] : P.sun[1]); }
            else if (d2 <= (R + 4) * (R + 4) && dith(x, y, 0.35)) { bp.put(x, y, P.sun[0]); }
          }
        }
        body = { cx: sx, cy: sy, R, light: 1 };
      }
      const yEnd = horizon + Math.round(H * 0.08);
      const hazed = (arr, k) => arr.map((c) => mix(c, P.far, k));
      const ICE = [P.ice, hazed(P.ice, 0.3), hazed(P.ice, 0.6)], ROCK = [P.rock, hazed(P.rock, 0.3), hazed(P.rock, 0.6)];
      for (let x = Math.max(0, mx0); x < Math.min(W, mx0 + mW); x++) {
        const t = crest(x), u = (x - mx0) / mW;
        const slant = 0.8 * Math.cos(u * Math.PI); // aretes run down-left, then down-right
        const dR = clamp((prof(u + 0.01) - prof(u - 0.01)) / 0.02 * 0.22, -1, 1);
        for (let y = t; y <= yEnd; y++) {
          const d = y - t;
          const rib = (xx) => N.ridge((xx + d * slant) * 0.1, d * 0.03 + 3.7, 3);
          const r0 = rib(x), dr = rib(x + 1) - rib(x - 1);
          let v = 0.6 - dr * 3.2 * L + dR * 0.3 * L - (d / mH) * 0.3 + (N2(x * 0.3, y * 0.3) - 0.5) * 0.14;
          // Ice down to ~a third of the face, glacier tongues further down the gullies.
          const snowLine = mH * (0.16 + 0.2 * N.fbm(x * 0.025, 9.1, 3)) + Math.pow(1 - r0, 1.5) * mH * 0.5;
          const summitRock = Math.abs(u - 0.355) < 0.025 && d < mH * 0.1 && N2(x * 0.5, y * 0.5) > 0.4;
          const rockRib = r0 > 0.74 && d > mH * 0.06 && N2(x * 0.15 + 5, y * 0.12) > 0.45;
          const rock = d > snowLine || summitRock || rockRib;
          // Its feet fade into the haze, in steps (with a little noise on the edges).
          const hz = clamp((d / mH - 0.45) / 0.45 + (N2(x * 0.08, y * 0.08) - 0.5) * 0.3, 0, 0.999);
          const lv = Math.floor(hz * 3);
          let c = rock ? tone(ROCK[lv], v * 0.95, x, y) : tone(ICE[lv], v + 0.12, x, y);
          if (P.rim && d <= 1 && (d === 0 || dith(x, y, 0.5))) { c = P.rim; } // backlit crest
          bp.put(x, y, c);
        }
      }
      bp.done();

      // Sky life: cumulus catching on the mountain, cirrus streaks up high, stars.
      clouds = []; stars = [];
      if (P.cloud) {
        const n = Math.round((1 + Math.floor(W / 160)) * (P.cloudMore || 1));
        const sz = clamp(Math.round(H * 0.03), 2, 7);
        for (let i = 0; i < n; i++) {
          const cv = cumulusSprite(rs, i % 2 ? sz - 1 : sz);
          clouds.push({
            cv, x: rs() * (W + cv.width) - cv.width, v: 0.02 + rs() * 0.02,
            y: Math.round(horizon - mH * (0.25 + rs() * 0.45)),
          });
        }
        const m = Math.round((2 + Math.floor(W / 120)) * (P.cloudMore || 1));
        for (let i = 0; i < m; i++) {
          const cv = cirrusSprite(rs, Math.round(W * (0.12 + rs() * 0.25)));
          clouds.push({ cv, x: rs() * (W + cv.width) - cv.width, v: 0.03 + rs() * 0.03, y: Math.round(rs() * horizon * 0.35) });
        }
      }
      if (P.star) {
        const skyH = Math.max(2, Math.round(horizon * P.starSky));
        const n = Math.round((W * skyH) / P.starDensity);
        for (let i = 0; i < n; i++) {
          const x = Math.floor(rs() * W), y = Math.floor(rs() * Math.max(1, skyH - 2));
          const c = crest(x);
          if ((c !== null && y >= c) || (Math.abs(x - body.cx) < body.R + 3 && Math.abs(y - body.cy) < body.R + 3)) { continue; }
          stars.push({ x, y, p: rs() * 6.283, s: 0.04 + rs() * 0.12, big: rs() < 0.12 });
        }
      }

      // --- front: foothills, badlands, the city, the altiplano and the rock
      front = layer(W, H);
      const f = front.getContext('2d');
      const fp = painter(f, W, H, false);
      // Relief from a height field lit from the upper left (lumps, ravines, eroded ribs).
      const relief = (x, y, f, seed, k, stretch) => {
        const h = (xx, yy) => N.fbm(xx * f, yy * f * stretch + seed, 4) * 0.65 + N.ridge(xx * f * 2.3, yy * f * stretch * 1.3 + seed * 2, 3) * 0.35;
        return -(h(x + 1, y) - h(x - 1, y)) * k * L - (h(x, y + 1) - h(x, y - 1)) * k * 0.45;
      };
      // Two ranges of brown foothills with ridged crests.
      const farTop = (x) => horizon + Math.round(H * 0.03) - Math.round(H * (0.05 + 0.13 * N.ridge(x * 0.005, 31, 3) + 0.02 * N.fbm(x * 0.05, 33, 2)));
      // The dark pointed hill in front of the Illimani's right flank, and rolling slopes.
      const hx = W * 0.64, hw = Math.max(30, W * 0.2);
      const nearTop = (x) => {
        const tri = Math.max(0, 1 - Math.abs(x - hx) / hw);
        const roll = 0.03 + 0.12 * N.ridge(x * 0.007, 41, 3);
        return horizon + Math.round(H * 0.15) - Math.round(H * Math.max(tri * tri * 0.22 + tri * 0.05, roll) + (N.fbm(x * 0.06, 43, 2) - 0.5) * H * 0.02);
      };
      const cityTop = Math.round(horizon + (fgTop - horizon) * 0.4);
      // Eroded badlands (like the Valle de la Luna): one or two clusters of chunky pinnacles.
      // La Paz always has its district (around 40 % of the width); the badlands recede there.
      const district = (x) => clamp(1 - Math.abs(x - W * 0.4) / (W * 0.16), 0, 1);
      const badEnv = (x) => clamp((N.fbm(x * 0.004, 51, 2) - 0.5) * 6, 0, 1) * (1 - Math.min(1, district(x) * 1.6));
      const badTop = (x) => fgTop - Math.round(badEnv(x) * H * (0.07 + 0.13 * Math.pow(N.ridge(x * 0.045, 61, 2), 2) + 0.02 * N(x * 0.3, 62)));
      const cityZone = (x) => (N.fbm(x * 0.005 + 100, 71, 2) > 0.4 || district(x) > 0.15) && badEnv(x) < 0.15;
      const farPal = P.hillFar.map((c) => mix(c, P.far, 0.4)); // aerial perspective
      for (let x = 0; x < W; x++) {
        const t1 = farTop(x);
        for (let y = t1; y < fgTop; y++) {
          const v = 0.58 + relief(x, y, 0.035, 5, 9, 1.6) - (y - t1) / H * 0.45;
          fp.put(x, y, P.rim && y === t1 && dith(x, y, 0.6) ? P.rim : tone(farPal, v, x, y));
        }
        const t2 = nearTop(x);
        for (let y = t2; y < fgTop; y++) {
          const v = 0.55 + relief(x, y, 0.022, 17, 11, 1.4) - (y - t2) / H * 0.3 + (y === t2 ? 0.15 : 0);
          fp.put(x, y, P.rim && y === t2 ? mix(P.rim, P.hill[3], 0.4) : tone(P.hill, v, x, y));
        }
        const tb = badTop(x);
        for (let y = tb; y < fgTop; y++) { // vertical ribs: lit on their left, shadowed on the right
          const v = 0.58 + relief(x, y, 0.09, 29, 6, 0.25) - (y - tb) / H * 0.5 + (y === tb ? 0.12 : 0);
          fp.put(x, y, tone(P.badland, v, x, y));
        }
      }
      // La Paz on the slopes: little houses scattered in clumps, a few downtown towers.
      const rc = mulberry32(0xa11e4);
      const houses = Math.round(W * (fgTop - cityTop) * 0.3);
      for (let i = 0; i < houses; i++) {
        const x = Math.floor(rc() * W), y = cityTop + Math.floor(rc() * Math.max(1, fgTop - cityTop - 1));
        if (!cityZone(x) || y < nearTop(x) + 2 || y >= badTop(x) || N2(x * 0.08, y * 0.12) < 0.38 + (1 - district(x)) * 0.22) { continue; } // denser downtown
        const k = rc(), c = P.city[k < 0.4 ? 0 : k < 0.7 ? 1 : k < 0.85 ? 2 : k < 0.95 ? 3 : 4];
        const wide = rc() < 0.5;
        fp.put(x, y, c); if (wide) { fp.put(x + 1, y, c); }
        fp.put(x, y + 1, P.city[5]);
        if (rc() < 0.3) { cityLights.push({ x, y, p: rc() * 6.283, c: P.lights[Math.floor(rc() * P.lights.length)] }); }
      }
      const towers = Math.max(2, Math.round(W / 90)), cx0 = W * 0.4;
      for (let i = 0; i < towers; i++) {
        const tx = Math.round(cx0 + (rc() - 0.5) * W * 0.1), th = Math.round(H * (0.03 + rc() * 0.07)), tw = 2 + Math.floor(rc() * 2);
        const tb = fgTop - 1 - Math.floor(rc() * 3);
        for (let x = tx; x < tx + tw; x++) {
          for (let y = tb - th; y <= tb; y++) {
            const win = (x - tx) % 2 === 1 && y % 2 === 0;
            fp.put(x, y, win ? P.city[5] : x === tx ? P.city[3] : P.city[4]);
            if (win && rc() < 0.5) { cityLights.push({ x, y, p: rc() * 6.283, c: P.lights[2] }); }
          }
        }
      }

      // The altiplano in front: ochre ground with a little texture.
      for (let y = fgTop; y < H; y++) {
        const g = (y - fgTop) / Math.max(1, H - fgTop);
        for (let x = 0; x < W; x++) {
          const tex = N2(x * 0.25, y * 0.5) - 0.5;
          fp.put(x, y, tone(y >= pathTop ? P.path : P.field, 0.7 - g * 0.5 + tex * 0.4, x, y));
        }
      }

      // The perching rock (peñasco), lit from the left, flat-topped for the condor.
      const rw = clamp(Math.round(H * 0.3), 14, 90), rh = clamp(Math.round(H * 0.24), 10, 70);
      const rx0 = Math.round(W * 0.8 - rw / 2), rBase = pathTop;
      let topMin = H;
      const rockTop = (x) => {
        const e = (x - rx0) / rw * 2 - 1;
        if (e < -1 || e > 1) { return rBase + 1; }
        // Asymmetric: a steep left face, a stepped slope to the right, a rough top.
        const shape = e < 0 ? Math.pow(1 - Math.pow(-e, 2.4), 0.6) : Math.pow(1 - Math.pow(e, 1.6), 0.8);
        return rBase - Math.round(rh * shape * (0.82 + 0.18 * N.fbm(x * 0.12, 81, 2)) - (e > 0.3 && e < 0.6 ? rh * 0.06 : 0));
      };
      for (let x = rx0; x < rx0 + rw; x++) {
        const e = (x - rx0) / rw * 2 - 1, top = rockTop(x);
        topMin = Math.min(topMin, top);
        for (let y = top; y <= rBase; y++) {
          const crack = N.ridge(x * 0.15 + y * 0.05, y * 0.08 + 5, 2);
          let v = 0.6 - (e + 1) * 0.26 * L + relief(x, y, 0.08, 91, 4, 1) + (crack > 0.85 ? -0.35 : 0) - (y - top) / rh * 0.15;
          if (y - top < 2) { v += 0.22; } // sunlit top edge
          const edge = y === top || rockTop(x - 1) > y || rockTop(x + 1) > y;
          let c = edge ? P.rockFg[0] : tone(P.rockFg, v, x, y);
          if (!edge && N2(x * 0.7, y * 0.7 + 40) > 0.88) { c = mix(P.tuftHi, P.rockFg[2], 0.55); } // lichen
          fp.put(x, y, c);
        }
      }
      perchSpot = { x: rx0 + rw * 0.45, y: rockTop(Math.round(rx0 + rw * 0.45)), w: rw };
      ground = { fgTop, pathTop, rockX: rx0, rockW: rw, rockBase: rBase, rockTop };
      devils = []; herd = null; vizcacha = null;

      // Paja brava: golden spiky tussocks behind the path (and a few in front).
      const tufts = Math.round(W / 6);
      for (let i = 0; i < tufts; i++) {
        const x = Math.floor(rf() * W), front_ = rf() < 0.2;
        const by = front_ ? H - 1 - Math.floor(rf() * 2) : fgTop + 1 + Math.floor(rf() * Math.max(1, pathTop - fgTop));
        if (x >= rx0 - 2 && x <= rx0 + rw + 2 && by <= rBase) { continue; }
        const hh = Math.round((3 + rf() * 6) * clamp(H / 120, 1, 2.2)), k = 2 + Math.floor(rf() * 2);
        for (let bl = -k; bl <= k; bl++) {
          const len = Math.round(hh * (1 - Math.abs(bl) / (k + 1) * 0.35));
          for (let j = 0; j < len; j++) {
            const xx = Math.round(x + bl + (bl * 0.7 * j) / len);
            fp.put(xx, by - j, j > len * 0.55 ? P.tuftHi : P.tuft);
          }
        }
      }
      fp.done();

      buildWeather(rf);
    }

    // Andean life on top of the front layer: dust devils, llamas, a vizcacha, and the
    // city lights at dusk and at night.
    function drawAndes() {
      if (habitat !== 'andes') { return; }
      if (ground) { drawDevils(); drawHerd(); drawVizcacha(); }
      if (mode === 'night' || mode === 'sunset') {
        for (const l of cityLights) {
          if (mode === 'sunset' && (l.p * 10) % 3 > 1) { continue; } // only some lit at dusk
          if (Math.sin(t * 0.05 + l.p) > -0.7) { dot(sc, l.c, l.x, l.y); }
        }
      }
    }

    // Dust devils: whirlwinds of dust crossing the dry altiplano (thermals the condor rides).
    function drawDevils() {
      const dry = (mode === 'scene' || mode === 'sunset') && !P.wet && !P.fog;
      if (dry && anim && devils.length === 0 && Math.random() < 1 / 1800) {
        const d = Math.random() < 0.5 ? 1 : -1, h = Math.round(H * (0.3 + Math.random() * 0.15));
        devils.push({ x: d > 0 ? -6 : W + 6, vx: d * (0.15 + Math.random() * 0.15), h, life: 900, base: ground.pathTop + 1 });
      }
      const haze = mix(P.dust[0], '#ffffff', 0.25), streak = mix(P.dust[0], '#ffffff', 0.5);
      devils = devils.filter((dv) => {
        if (anim) { dv.x += dv.vx + Math.sin(t * 0.03) * 0.1; dv.life--; }
        const fade = Math.min(1, dv.life / 120, (t + 1) / 1); // fades out at the end
        for (let k = 0; k < dv.h; k++) {
          const r = 1.5 + k * 0.16 + Math.sin(k * 0.3 + t * 0.05) * 0.8; // a funnel, wider at the top
          const a = t * 0.45 + k * 0.55, wob = Math.sin(t * 0.07 + k * 0.08) * k * 0.06;
          const dens = (1 - k / dv.h) * fade, y = dv.base - k, cx = dv.x + wob;
          for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) { // hazy body
            const x = Math.round(cx + dx), e = 1 - Math.abs(dx) / (r + 0.5);
            if (e > 0 && dith(x, y + (t >> 1), e * 0.75 * dens)) { dot(sc, haze, x, y); }
          }
          for (let j = 0; j < 2; j++) { // the spinning streaks
            const x = Math.round(cx + Math.cos(a + j * Math.PI) * r);
            if (dith(x, y, 0.95 * dens)) { dot(sc, streak, x, y); }
          }
        }
        if (anim && t % 3 === 0) { // kicked-up dust at its foot
          add({ k: 'dust', x: dv.x + rand(-3, 3), y: dv.base - rand(0, 2), vx: rand(-0.3, 0.3), vy: -rand(0.1, 0.3), life: 8, c: P.dust[0] });
        }
        return dv.life > 0 && dv.x > -20 && dv.x < W + 20;
      });
    }

    // A small herd of llamas crossing the altiplano, stopping now and then to graze.
    function drawHerd() {
      const day = (mode === 'scene' || mode === 'sunset') && !P.storm;
      if (day && anim && !herd && Math.random() < 1 / 2600) {
        const d = Math.random() < 0.5 ? 1 : -1, n = 1 + Math.floor(Math.random() * 3), m = [];
        for (let i = 0; i < n; i++) {
          const fur = LLAMA_FUR[Math.floor(Math.random() * LLAMA_FUR.length)];
          const edge = mix(fur[1], '#1a1410', 0.5); // a soft outline in the wool's own shade
          m.push({ c: { o: edge, w: fur[0], s: fur[1], k: '#0a0502', f: mix(edge, '#000000', 0.3), t: TASSELS[(i + Math.floor(Math.random() * 4)) % 4] }, off: i * 17 + Math.floor(Math.random() * 5), graze: 0 });
        }
        herd = { x: d > 0 ? -8 : W + 8, d, m, y: ground.fgTop + Math.round((ground.pathTop - ground.fgTop) * 0.55) };
      }
      if (!herd) { return; }
      const hd = herd;
      let anyWalking = false;
      for (const l of hd.m) {
        if (anim) {
          if (l.graze > 0) { l.graze--; }
          else if (Math.random() < 1 / 300) { l.graze = 80 + Math.floor(Math.random() * 120); }
        }
        if (!l.graze) { anyWalking = true; }
      }
      if (anim && anyWalking) { hd.x += hd.d * 0.18; }
      for (const l of hd.m) {
        const x = Math.round(hd.x - hd.d * l.off * HK), bm = l.graze ? LLAMA_GRAZE : LLAMA[(t >> 3) % 2];
        blitK(sc, bm, l.c, x - 6 * HK, hd.y - bm.length * HK + 1, hd.d < 0, HK);
      }
      if (hd.x < -60 - hd.m.length * 40 || hd.x > W + 60 + hd.m.length * 40) { herd = null; }
    }

    // A vizcacha peeking out by the condor's rock; it hides when the condor comes close.
    function drawVizcacha() {
      const g = ground, pet = last;
      const near = pet && Math.abs(pet.x / PX + o.pet / PX / 2 - (g.rockX + g.rockW / 2)) < g.rockW && (pet.alt || 0) < H * PX * 0.6;
      if (!vizcacha && anim && !P.wet && mode !== 'night' && Math.random() < 1 / 1500) {
        vizcacha = { life: 300 + Math.floor(Math.random() * 300), ears: 0 };
      }
      if (!vizcacha) { return; }
      const v = vizcacha;
      if (anim) { v.life--; if (Math.random() < 1 / 60) { v.ears = 6; } if (v.ears > 0) { v.ears--; } }
      if (v.life <= 0 || near) { vizcacha = null; return; }
      // Sits on a low ledge at the rock's left foot.
      const x = g.rockX - 9 * HK, y = g.rockBase;
      blitK(sc, VIZCACHA[v.ears > 0 ? 1 : 0], VIZCACHA_C, x, y - 8 * HK + 1, false, HK);
    }

    // Where a thermal rises (a dust devil), for the condor to circle over: CSS x, or null.
    function thermalX() {
      return devils.length ? devils[0].x * PX : null;
    }

    // Rain, snow and fog: particles over the scene, rebuilt with the layers.
    function buildWeather(r) {
      drops = []; flakes = []; fog = null; falling = []; bolt = null; fireworks = [];
      if (P.rain) {
        const n = Math.min(P.storm ? 1500 : 800, Math.round((W * H) / (P.storm ? 18 : 40))); // capped for big panels
        for (let i = 0; i < n; i++) { drops.push({ x: r() * W, y: r() * H, v: 1.6 + r() * 0.9 }); }
      }
      if (P.snow) {
        const n = Math.min(900, Math.round((W * H) / 55));
        for (let i = 0; i < n; i++) {
          flakes.push({ x: r() * W, y: r() * H, v: 0.15 + r() * 0.2, p: r() * 6.283, big: r() < 0.2 });
        }
      }
      if (P.fog) {
        // Banks of fog over the hills' feet and the lake, densest at the horizon.
        const top = Math.max(0, horizon - Math.round(horizon * 0.35)), span = Math.max(2, pathTop - 2 - top);
        fog = { cv: layer(W + 32, span), top };
        const g = fog.cv.getContext('2d');
        for (let y = 0; y < span; y++) {
          const yy = top + y, near = 1 - Math.min(1, Math.abs(yy - horizon) / (span * 0.6));
          for (let x = 0; x < W + 32; x++) {
            const bank = 0.6 + 0.4 * Math.sin(x * 0.08 + yy * 0.3) * Math.sin(x * 0.031 + 1.7);
            if (dith(x, yy, Math.max(0, near * bank * 0.75))) { dot(g, P.fog, x, y); }
          }
        }
      }
    }

    // A lake between the hills and the path — the capybara's natural habitat —
    // with the hills reflected in it, a reedy shore and a few water lilies.
    function buildLake(f, rl, fieldH, farY, nearY) {
      water = new Uint8Array(W * H);
      lake = null; shimmer = [];
      if (fieldH < 6 || W < 30) { return; }
      const lh = clamp(Math.round(fieldH * 0.45), 3, 24), top = horizon + 1;
      const lx0 = Math.round(W * (0.08 + rl() * 0.14)), wp = rl() * 6.283;
      // Rounded left bank; the lake runs off the right edge of the panel.
      const left = (y) => lx0 + Math.round(((y - top) / lh) ** 2 * lh * 1.6);
      const bot = (x) => top + lh - 1 + Math.round(Math.sin(x * 0.13 + wp) * 0.9);
      const reflFar = mix(P.far, P.water[1], 0.45), reflNear = mix(P.near, P.water[1], 0.4);
      for (let x = 0; x < W; x++) {
        const bt = bot(x);
        const nd = Math.round((horizon - nearY(x)) * 0.6), fd = Math.round((horizon - farY(x)) * 0.5);
        for (let y = top; y <= bt; y++) {
          if (x < left(y)) { continue; }
          water[y * W + x] = 1;
          const k = y - top, g = (k / Math.max(1, lh - 1)) * 2;
          const i = Math.min(1, Math.floor(g)), frac = g - i;
          let c = P.water[dith(x, y, frac) ? i + 1 : i];
          // Mirrored hills: the near ones touch the waterline, the far ones peek below.
          if (k < nd) { if (dith(x, y, 0.7)) { c = reflNear; } }
          else if (k < fd && dith(x, y, 0.55)) { c = reflFar; }
          dot(f, c, x, y);
        }
        if (x >= left(bt)) { dot(f, P.shore, x, bt + 1); }
      }
      for (let y = top; y <= top + lh; y++) {
        const lx = left(y) - 1;
        if (lx >= 0 && lx < W) { dot(f, P.shore, lx, y); }
      }
      lake = { top, lh, left };
      // Where the swimmer fits: a row in the nearer half, wide enough for its body.
      swimMin = 0; swimMax = -1;
      if (lh >= 5 && !P.frozen) {
        swimY = top + Math.round(lh * 0.55);
        for (let x = 0; x + SWIM_W <= W; x++) {
          if (isWater(x, swimY) && isWater(x + SWIM_W - 1, swimY)) {
            if (swimMax < 0) { swimMin = x; }
            swimMax = x;
          }
        }
      }

      // Reeds and cattails along the bank (more of them at the rounded end).
      const clumps = 3 + Math.floor(W / 40);
      for (let i = 0; i < clumps; i++) {
        const atEnd = rl() < 0.35;
        const x = atEnd ? lx0 + Math.floor(rl() * lh) : Math.floor(lx0 + rl() * (W - lx0));
        const base = bot(x) + 1, stems = 2 + Math.floor(rl() * 3);
        for (let j = 0; j < stems; j++) {
          const sx = x + j * (1 + Math.floor(rl() * 2)), hh = 3 + Math.floor(rl() * 4);
          const cat = rl() < 0.4, lean = rl() < 0.3 ? (rl() < 0.5 ? -1 : 1) : 0;
          dot(f, P.reed, sx, base - hh + 2, 1, hh - 1);
          dot(f, P.reed, sx + lean, base - hh + 1);
          if (cat) { dot(f, P.cattail, sx + lean, base - hh - 1, 1, 2); }
        }
      }
      // Water lilies on the calmer, nearer water.
      const lilies = Math.max(1, Math.round((W - lx0) / 22));
      for (let i = 0; i < lilies; i++) {
        const x = Math.floor(lx0 + lh + rl() * (W - lx0 - lh));
        const y = top + Math.floor(lh * (0.5 + rl() * 0.4));
        const bloom = rl() < 0.35;
        if (P.frozen || !isWater(x - 1, y) || !isWater(x + 1, y)) { continue; }
        dot(f, P.lily, x - 1, y, 3, 1);
        if (bloom) { dot(f, P.lilyFlower, x, y - 1); }
      }
      // A log where a turtle suns itself (left out of the water mask: no shimmer on it).
      log = null;
      const ly = top + Math.round(lh * 0.35), lx = Math.floor(left(ly) + lh + rl() * Math.max(1, W - left(ly) - lh - 12));
      if (lh >= 5 && isWater(lx, ly) && isWater(lx + 8, ly) && isWater(lx, ly + 1) && isWater(lx + 8, ly + 1)) {
        blit(f, ['.LLLLLLL.', 'lllllllll'], { L: mix(P.trunk, '#ffffff', 0.18), l: P.trunk }, lx, ly);
        for (let x = lx; x < lx + 9; x++) { water[ly * W + x] = 0; water[(ly + 1) * W + x] = 0; }
        log = { x: lx, y: ly };
      }
      // Shimmer spots for the animated surface (the ice has none).
      const n = P.frozen ? 0 : Math.round((W * lh) / 45);
      for (let i = 0; i < n; i++) {
        const x = Math.floor(rl() * W), y = top + Math.floor(rl() * lh);
        const len = 1 + Math.floor(rl() * 3), p = rl() * 6.283, s = 0.05 + rl() * 0.08;
        if (isWater(x, y) && isWater(x + len - 1, y)) { shimmer.push({ x, y, len, p, s }); }
      }
    }

    // ------------------------------------------------------------ drawing

    function drawSky() {
      for (const c of clouds) {
        sc.drawImage(c.cv, Math.round(c.x), c.y);
        if (anim) { c.x += c.v; if (c.x > W) { c.x = -c.cv.width; } }
      }
      const bats = world.holiday === 'halloween' && mode === 'night' && !P.wet;
      if ((P.bird || bats) && !birds && anim && Math.random() < 1 / 500) {
        const d = Math.random() < 0.5 ? 1 : -1;
        birds = {
          x: d > 0 ? -6 : W + 6, d, n: 1 + Math.floor(Math.random() * 3),
          y: 2 + Math.floor(Math.random() * Math.max(1, horizon * 0.45)),
        };
      }
      if (birds) {
        for (let k = 0; k < birds.n; k++) {
          const frame = (bats ? BAT : BIRD)[(Math.floor(t / (bats ? 2 : 3)) + k) % 2];
          const bx = Math.round(birds.x - birds.d * 6 * k) - 2;
          const by = Math.round(birds.y + (k % 2 ? -2 : 2) * Math.ceil(k / 2) + Math.sin(t * 0.2 + k));
          blit(sc, frame, { x: bats ? '#4a3a5a' : P.bird }, bx, by);
        }
        birds.x += birds.d * 0.3;
        if (birds.x < -6 - 6 * birds.n || birds.x > W + 6 + 6 * birds.n) { birds = null; }
      }
      for (const s of stars) {
        const lv = clamp(Math.floor((Math.sin(t * s.s + s.p) + 1) * 1.5), 0, 2);
        dot(sc, P.star[lv], s.x, s.y);
        if (s.big && lv === 2) {
          dot(sc, P.star[1], s.x - 1, s.y); dot(sc, P.star[1], s.x + 1, s.y);
          dot(sc, P.star[1], s.x, s.y - 1); dot(sc, P.star[1], s.x, s.y + 1);
        }
      }
      if (P.meteors && !meteor && anim && Math.random() < 1 / 900) {
        meteor = {
          x: W * (0.2 + Math.random() * 0.6), y: 1 + Math.random() * horizon * 0.3,
          vx: Math.random() < 0.5 ? -1 : 1, life: 16,
        };
      }
      if (meteor) {
        const m = meteor;
        for (let k = 4; k >= 0; k--) {
          const c = k === 0 ? P.star[2] : k < 3 ? P.star[1] : P.star[0];
          dot(sc, c, Math.round(m.x - m.vx * k), Math.round(m.y - 0.5 * k));
        }
        m.x += m.vx; m.y += 0.5;
        if (--m.life <= 0 || m.y > horizon - 2) { meteor = null; }
      }
      drawFireworks();
      drawLightning();
    }

    // New Year's night: bursts of coloured pixels over the hills.
    function drawFireworks() {
      if (world.holiday !== 'newyear' || mode !== 'night' || P.wet || !anim) { return; }
      if (fireworks.length < 3 && Math.random() < 1 / 70) {
        fireworks.push({
          x: Math.round(W * (0.15 + Math.random() * 0.7)), y: Math.round(horizon * (0.15 + Math.random() * 0.35)),
          c: CONFETTI[Math.floor(Math.random() * CONFETTI.length)], age: 0,
        });
      }
      fireworks = fireworks.filter((fw) => {
        const r = Math.min(7, fw.age * 0.7), fade = fw.age > 14;
        for (let i = 0; i < 10; i++) {
          if (fade && (i + fw.age) % 2) { continue; }
          const a = (i / 10) * 6.283;
          dot(sc, i % 3 ? fw.c : '#ffffff', Math.round(fw.x + Math.cos(a) * r), Math.round(fw.y + Math.sin(a) * r * 0.8 + fw.age * 0.15));
        }
        return ++fw.age < 20;
      });
    }

    // Storms: now and then a jagged bolt behind the hills (and a soft flash).
    function drawLightning() {
      if (!P.storm || !anim) { return; }
      if (!bolt && Math.random() < 1 / 350) {
        const pts = [];
        let x = W * (0.15 + Math.random() * 0.7);
        for (let y = 0; y < horizon * 0.85; y++) { x += Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0; pts.push(Math.round(x)); }
        bolt = { pts, life: 7 };
        sfx('thunder');
      }
      if (bolt) {
        if (bolt.life > 3 || bolt.life % 2) { bolt.pts.forEach((x, y) => dot(sc, '#fffbe0', x, y)); }
        if (--bolt.life <= 0) { bolt = null; }
      }
    }

    function drawWater() {
      if (!lake) { return; }
      drawVisitors();
      if (P.frozen) { return; }
      for (const s of shimmer) {
        if (Math.sin(t * s.s + s.p) > 0.55) { dot(sc, P.shimmer, s.x, s.y, s.len, 1); }
      }
      // Glittering path of light under the sun / moon, widening towards us.
      for (let k = 0; body.light > 0.2 && k < lake.lh; k += 1) {
        if ((k + (t >> 2)) % 2) { continue; }
        const y = lake.top + k, hw = Math.max(1, Math.round(body.R * 0.4)) + (k >> 2);
        const off = (((t >> 3) + k) % 3) - 1;
        for (let x = body.cx - hw + off; x <= body.cx + hw + off; x++) {
          if (isWater(x, y) && dith(x, y, 0.6)) { dot(sc, P.glitter, x, y); }
        }
      }
      // Now and then a fish jumps: a splash and an expanding ring.
      if (!ripple && anim && shimmer.length && Math.random() < 1 / 260) {
        const s = shimmer[Math.floor(Math.random() * shimmer.length)];
        ripple = { x: s.x, y: s.y, age: 0 };
      }
      if (ripple) {
        const a = ripple.age, rr = 1 + (a >> 2);
        if (a < 3) { dot(sc, P.shimmer, ripple.x, ripple.y - 1 - (a === 1 ? 1 : 0)); }
        for (let dx = -2 * rr; dx <= 2 * rr; dx++) {
          const dy = Math.round(Math.sqrt(Math.max(0, 1 - (dx / (2 * rr)) ** 2)) * rr * 0.5);
          for (const y of [ripple.y - dy, ripple.y + dy]) {
            const x = ripple.x + dx;
            if (isWater(x, y) && dith(x, y, 0.75)) { dot(sc, P.shimmer, x, y); }
          }
        }
        if (anim && ++ripple.age > 16) { ripple = null; }
      }
      // Raindrops hitting the water: tiny rings popping here and there.
      if (P.rain && anim && shimmer.length) {
        for (let i = 0; i < (P.storm ? 4 : 2); i++) {
          const s = shimmer[Math.floor(Math.random() * shimmer.length)];
          dot(sc, P.shimmer, s.x - 1, s.y); dot(sc, P.shimmer, s.x + 1, s.y);
        }
      }
    }

    // A duck family crossing the lake now and then, and a turtle sunning on its log.
    function drawVisitors() {
      const calmDay = (mode === 'scene' || mode === 'sunset') && !P.frozen && !P.storm;
      if (!ducks && calmDay && anim && lake.lh >= 5 && Math.random() < 1 / 1500) {
        const y = lake.top + Math.max(2, Math.round(lake.lh * 0.3));
        ducks = { x: W + 2, y, dir: -1, n: 1 + Math.floor(Math.random() * 3) };
        sfx('quack');
      }
      if (ducks) {
        const d = ducks;
        if (anim) {
          d.x += d.dir * 0.12;
          if (d.dir < 0 && d.x <= lake.left(d.y) + 3) { d.dir = 1; }
          if (d.dir > 0 && d.x > W + 8 + d.n * 6) { ducks = null; }
        }
        if (ducks) {
          const x = Math.round(d.x), flip = d.dir < 0;
          blit(sc, DUCK, DUCK_C, x, d.y - 3, flip);
          for (let k = 0; k < d.n; k++) {
            const bob = (t >> 3) % 2 === k % 2 ? 0 : 1;
            blit(sc, DUCKLING, DUCKLING_C, x - d.dir * (8 + 5 * k), d.y - 1 + bob, flip);
          }
          if ((t >> 1) % 3 === 0) { dot(sc, P.shimmer, flip ? x + 7 : x - 1, d.y + 1); }
        }
      }
      if (log) {
        // Out on sunny, calm days; it slips into the water when it rains or the capybara swims by.
        const sunny = calmDay && !P.wet;
        const near = swimmer && Math.abs(swimmer.x + SWIM_W / 2 - (log.x + 4)) < 12;
        if (near && turtleAway <= 0 && sunny) { ripple = { x: log.x + 4, y: log.y + 2, age: 0 }; turtleAway = 400; }
        if (turtleAway > 0 && anim) { turtleAway--; }
        if (sunny && turtleAway <= 0) { blit(sc, TURTLE, TURTLE_C, log.x + 2, log.y - 2); }
      }
    }

    function drawFireflies() {
      for (const fl of flies) {
        if (anim) { fl.bx += 0.01; if (fl.bx > W + 6) { fl.bx = -6; } }
        if (Math.sin(t * 0.11 + fl.p * 3) < 0.1) { continue; } // blinking off
        const x = Math.round(fl.bx + Math.sin(t * 0.025 + fl.p) * 5);
        const y = Math.round(fl.by + Math.sin(t * 0.047 + fl.p * 1.7) * 2);
        sc.fillStyle = P.glow;
        sc.fillRect(x - 1, y, 3, 1);
        sc.fillRect(x, y - 1, 1, 3);
        dot(sc, P.firefly, x, y);
      }
    }

    // Spring petals / autumn leaves drifting down from the trees.
    function drawFalling() {
      if (!P.falling || !trees.length) { return; }
      if (anim && falling.length < 14 && Math.random() < 0.08) {
        const tr = trees[Math.floor(Math.random() * trees.length)];
        falling.push({
          x: tr.x + (Math.random() - 0.5) * tr.r * 2, y: tr.y + (Math.random() - 0.5) * tr.r,
          p: Math.random() * 6.283, c: P.falling[Math.floor(Math.random() * P.falling.length)],
          end: horizon + 2 + Math.random() * (pathTop - horizon - 2),
        });
      }
      falling = falling.filter((lf) => {
        if (anim) { lf.y += 0.12; lf.x += Math.sin(t * 0.1 + lf.p) * 0.2 - 0.03; }
        dot(sc, lf.c, Math.round(lf.x), Math.round(lf.y));
        return lf.y < lf.end;
      });
    }

    function drawFog() {
      if (!fog) { return; }
      const off = anim ? Math.floor(t * 0.05) % 32 : 0;
      sc.drawImage(fog.cv, -off, fog.top);
    }

    function drawSwimmer() {
      if (!swimmer) { return; }
      const sw = swimmer;
      if (anim) {
        sw.x += sw.face * 0.1;
        if (sw.x <= swimMin) { sw.x = swimMin; sw.face = 1; }
        else if (sw.x >= swimMax) { sw.x = swimMax; sw.face = -1; }
        else if (Math.random() < 1 / 260) { sw.face = -sw.face; }
      }
      const bob = anim && (t >> 3) % 2 ? 1 : 0; // bobbing: one pixel under, then up
      const x = Math.round(sw.x);
      blit(sc, SWIM.slice(0, SWIM.length - bob), FUR, x, swimY - 6 + bob, sw.face < 0);
      if (baby) { // the baby rides on her back
        // Sits right above her back line (row 3, columns 1-7 when facing right).
        const rx = sw.face > 0 ? x + 1 : x + SWIM_W - 1 - BABY.ride[0].length;
        blit(sc, BABY.ride, FUR, rx, swimY - 7 + bob, sw.face < 0);
      }
      // Broken waterline along the body and a wake trailing behind it.
      for (let i = 1; i < SWIM_W - 1; i++) {
        if ((i + (t >> 1)) % 3) { dot(sc, P.shimmer, x + i, swimY + 1); }
      }
      const back = sw.face > 0 ? x - 1 : x + SWIM_W;
      for (let k = 1; k <= 8; k++) {
        if ((k + (t >> 1)) % 3 === 0) { dot(sc, P.shimmer, back - sw.face * k, swimY + 1 + (k > 4 ? 1 : 0)); }
      }
    }

    // Hard-edged, pixel ellipse under the feet (replaces the blurry drop-shadow).
    // The baby follows its mum: walks behind her, runs when she runs, naps next to
    // her, hops when she celebrates and presses close when she gets scared.
    function updateBaby(p) {
      if (!o.baby || !p) { baby = null; return; }
      const mL = p.x / PX, mW = o.pet / PX, foot = row(o.feet);
      if (!baby) { baby = { x: mL + (p.face > 0 ? 0 : mW - BABY_W), face: p.face, step: 0 }; }
      const b = baby;
      if (swimmer) { b.riding = true; return; }
      if (b.riding) { b.riding = false; b.x = p.face > 0 ? mL : mL + mW - BABY_W; } // hops off her back
      const rear = p.face > 0 ? mL + mW * 0.14 : mL + mW * 0.86; // the mother's rear end
      let target = p.face > 0 ? rear - BABY_W + 3 : rear - 3, face = p.face;
      if (p.state === 'scared') { target += p.face > 0 ? 4 : -4; } // hides right behind her
      if (p.state === 'eat' && food) { // shares the watermelon, from the other side
        const fx = food.x;
        target = fx > mL + mW / 2 ? fx + 5 : fx - BABY_W - 5;
        face = fx > target ? 1 : -1;
      }
      target = clamp(target, 0, W - BABY_W);
      // Trots behind her; runs when she runs or when it has fallen far behind.
      const d = target - b.x, speed = p.state === 'run' || Math.abs(d) > BABY_W * 2 ? 1.8 : 0.8;
      b.moving = anim && Math.abs(d) > 1 && p.state !== 'sleep';
      if (b.moving) { b.x += Math.sign(d) * Math.min(Math.abs(d), speed); b.face = Math.sign(d); b.step++; }
      else { b.face = face; }
      b.pose = p.state === 'sleep' && !b.moving ? 'sleep' : b.moving ? 'walk' : 'stand';
      b.hop = p.state === 'celebrate' && anim && (t >> 1) % 4 < 2 ? 2 : 0;
      b.foot = foot;
    }

    function drawBaby() {
      const b = baby;
      if (!b || b.riding) { return; }
      const bm = b.pose === 'walk' ? BABY.walk[(b.step >> 2) % 2] : BABY[b.pose];
      const x = Math.round(b.x), top = b.foot - bm.length + 1 - b.hop;
      sc.fillStyle = P.shadow;
      sc.fillRect(x + 1, b.foot, BABY_W - 4, 1);
      blit(sc, bm, FUR, x, top, b.face < 0);
    }

    // The watermelon (on #fx, in front of the mouth): falls from the sky, bounces
    // once, then gets eaten bite by bite.
    function drawFood() {
      if (!food) { return; }
      const f = food, floor = row(o.feet) - MELON.length + 1;
      if (anim && !f.landed) {
        f.vy += 0.2; f.y += f.vy;
        if (f.y >= floor) {
          f.y = floor;
          if (f.vy > 1.2) { f.vy = -f.vy * 0.3; } else { f.landed = true; f.vy = 0; }
          if (!f.thud) { f.thud = true; sfx('thud'); }
        }
      }
      const rows = MELON.slice(Math.min(MELON.length, f.bites));
      if (f.gone > 0) { if (--f.gone === 0) { food = null; } if (f.gone % 2) { return; } }
      blit(fc, rows, MELON_C, Math.round(f.x) - 3, Math.round(f.y) + MELON.length - rows.length);
    }

    function drawShadow(p) {
      if (!p || swimmer) { return; }
      const lift = p.shadowAt !== undefined ? Math.max(0, baseOf(p) - p.shadowAt) : 0;
      const k = clamp(1 - lift / Math.max(1, H * PX), 0.3, 1);
      const cx = (p.x + o.pet / 2) / PX, rx = (o.pet * (o.shadowW || 0.34) * k) / PX;
      const cy = row((p.shadowAt !== undefined ? p.shadowAt : o.base) + o.feet - o.base);
      sc.fillStyle = P.shadow;
      sc.fillRect(Math.round(cx - rx * 0.8), cy - 1, Math.round(rx * 1.6), 1);
      sc.fillRect(Math.round(cx - rx), cy, Math.round(rx * 2), 1);
      sc.fillRect(Math.round(cx - rx * 0.7), cy + 1, Math.round(rx * 1.4), 1);
    }

    function drawScene(p) {
      sc.clearRect(0, 0, W, H);
      if (scenic && back) {
        sc.drawImage(back, 0, 0);
        drawSky();
        sc.drawImage(front, 0, 0);
        drawAndes();
        drawFalling();
        drawWater();
        drawSwimmer();
        drawFog();
        if (P.firefly) { drawFireflies(); }
        if (bolt && bolt.life > 5) { sc.fillStyle = 'rgba(255,255,240,0.16)'; sc.fillRect(0, 0, W, H); }
      }
      drawShadow(p);
      updateBaby(p);
      drawBaby();
    }

    // Rain and snow fall in front of everything, the capybara included.
    function drawPrecip() {
      for (const d of drops) {
        if (anim) {
          d.y += d.v; d.x -= d.v * 0.3;
          if (d.y > H) { d.y -= H + 2; d.x = Math.random() * (W + 10); }
        }
        dot(fc, P.rain, Math.round(d.x), Math.round(d.y), 1, 2);
      }
      for (const f of flakes) {
        if (anim) {
          f.y += f.v; f.x += Math.sin(t * 0.05 + f.p) * 0.25;
          if (f.y > H) { f.y = -1; f.x = Math.random() * W; }
        }
        dot(fc, P.snow, Math.round(f.x), Math.round(f.y), f.big ? 2 : 1, 1);
      }
    }

    // ---------------------------------------------------------- particles

    function geo(p) {
      const L = p.x / PX, w = o.pet / PX, b = baseOf(p);
      return {
        L, w, cx: L + w / 2, foot: row(b + o.feet - o.base),
        head: L + w * (p.face > 0 ? 0.68 : 0.32),
        top: row(b + o.pet * 0.6),
      };
    }

    const rand = (a, b) => a + Math.random() * (b - a);
    const add = (q) => { q.max = q.life; parts.push(q); };

    function dust(p, n, side) {
      const g = geo(p);
      for (let i = 0; i < n; i++) {
        const dir = side || (i % 2 ? 1 : -1);
        const x = side ? g.L + g.w * (side < 0 ? 0.2 : 0.8) : g.cx + dir * g.w * 0.3;
        add({
          k: 'dust', x: x + rand(-1, 1), y: g.foot - rand(0, 1.5),
          vx: dir * rand(0.12, 0.35), vy: -rand(0.04, 0.18),
          life: Math.round(rand(6, 10)), c: P.dust[i % 2],
        });
      }
    }

    function splash(x, y) {
      if (!anim) { return; }
      sfx('splash');
      for (let i = 0; i < 10; i++) {
        add({
          k: 'splash', x: x + rand(-3, 3), y: y - 1, vx: rand(-0.5, 0.5), vy: -rand(0.5, 1.2),
          g: 0.12, life: Math.round(rand(8, 12)), c: i % 3 ? DROP_C.b : DROP_C.w,
        });
      }
      ripple = { x: Math.round(x), y, age: 0 };
    }

    function stepPart(q) {
      if (--q.life < 0) { return false; }
      const age = q.max - q.life;
      if (q.k === 'heart') { q.vx = Math.sin(age * 0.6) * 0.3; }
      if (q.k === 'steam') { q.vx = Math.sin(age * 0.8 + q.p) * 0.25; }
      if (q.k === 'feather') { // sways as it drifts down, then rests on the ground
        if (q.y >= q.floor) { q.vx = 0; q.vy = 0; q.y = q.floor; }
        else { q.vx = Math.sin(age * 0.12 + q.p) * 0.35; }
      }
      q.x += q.vx || 0; q.y += q.vy || 0; q.vy += q.g || 0;
      if (q.k === 'fruit' && q.y >= q.floor) { q.y = q.floor; q.vy = -q.vy * 0.45; q.vx *= 0.6; }
      const x = Math.round(q.x), y = Math.round(q.y);
      const blink = q.life > 4 || q.life % 2 === 1; // flicker out, retro style
      switch (q.k) {
        case 'dust': {
          const s = q.life > q.max / 2 ? 2 : 1;
          dot(fc, q.c, x, y, s, s);
          break;
        }
        case 'confetti': {
          const flip = (age >> 1) % 2; // tumbling 2x1 <-> 1x2
          if (blink) { dot(fc, q.c, x, y, flip ? 2 : 1, flip ? 1 : 2); }
          break;
        }
        case 'sparkle': {
          dot(fc, SPARK[1], x, y);
          if (age > 1 && q.life > 1) {
            dot(fc, SPARK[0], x - 1, y); dot(fc, SPARK[0], x + 1, y);
            dot(fc, SPARK[0], x, y - 1); dot(fc, SPARK[0], x, y + 1);
          }
          if (age > 2 && q.life > 2) {
            dot(fc, SPARK[1], x - 2, y); dot(fc, SPARK[1], x + 2, y);
            dot(fc, SPARK[1], x, y - 2); dot(fc, SPARK[1], x, y + 2);
          }
          break;
        }
        case 'heart':
          if (blink) { blit(fc, HEART, HEART_C, x - 3, y - 3); }
          break;
        case 'zz':
          if (blink) { blit(fc, age > 9 ? Z_BIG : Z_SMALL, { x: P.ink }, x, y); }
          break;
        case 'steam':
          if (blink) { dot(fc, STEAM, x, y); }
          break;
        case 'sweat':
          blit(fc, DROP, DROP_C, x, y);
          break;
        case 'note':
          if (blink) { blit(fc, NOTE, { x: P.ink }, x, y); }
          break;
        case 'fruit':
          if (blink) {
            if (condor) { blitK(fc, CHULLO, CHULLO_C, x - 3 * HK, y - 6 * HK, false, HK); }
            else { blit(fc, ORANGE, ORANGE_C, x - 2, y - 4); }
          }
          break;
        case 'splash':
        case 'drip':
          dot(fc, q.c, x, y);
          break;
        case 'feather':
          if (blink || q.life > 30) { blit(fc, FEATHER[(age >> 3) % 2], { o: '#1c1c26' }, x, y); }
          break;
        case 'alert':
          if (blink) { blit(fc, ALERT, ALERT_C, x - 1, y - 7 - (age < 3 ? age % 2 : 0)); }
          break;
      }
      return true;
    }

    // Where something can sit on the capybara's head: canvas column of its
    // centre and the row right above it (null for poses without a spot).
    function headAnchor(p) {
      if (swimmer) {
        const bob = anim && (t >> 3) % 2 ? 1 : 0;
        const col = swimmer.face > 0 ? SWIM_HEAD : SWIM_W - 1 - SWIM_HEAD;
        return { x: Math.round(swimmer.x) + col, y: swimY - 6 + bob, small: true };
      }
      const h = p && (o.heads ? o.heads[p.pose] : HEAD[p.state]);
      if (!h) { return null; }
      const col = p.face > 0 ? h[0] : GRID - 1 - h[0];
      return { x: Math.round(p.x / PX + col), y: row(baseOf(p) + (GRID - h[1]) * PX), small: false };
    }

    // A bird lands on the head while the capybara is calm (not at night) and
    // flies off when it runs, jumps or gets scared.
    function updateBird(p, a) {
      const calm = !!a && (!!swimmer || !p.moving || p.state === 'walk');
      if (!perch) {
        if (calm && anim && !condor && mode !== 'night' && !P.wet && !orange && !orangeWait && Math.random() < 1 / 700) {
          const from = Math.random() < 0.5 ? -1 : 1;
          perch = { phase: 'in', x: a.x + from * 40, y: Math.max(1, a.y - 25), face: -from, sit: 0 };
        }
        return;
      }
      if (perch.phase === 'in') {
        if (!calm) { perch.phase = 'out'; return; }
        const dx = a.x - perch.x, dy = a.y - perch.y, d = Math.hypot(dx, dy);
        if (d <= 0.8) { perch.phase = 'sit'; perch.sit = 350 + Math.floor(Math.random() * 400); }
        else { perch.x += (dx / d) * 0.8; perch.y += (dy / d) * 0.8; perch.face = dx >= 0 ? 1 : -1; }
      } else if (perch.phase === 'sit') {
        if (!calm || --perch.sit <= 0) { perch.phase = 'out'; perch.face = Math.random() < 0.5 ? -1 : 1; return; }
        perch.x = a.x; perch.y = a.y;
        if (Math.random() < 1 / 150) {
          add({ k: 'note', x: a.x + 2, y: a.y - 6, vy: -0.15, vx: 0.05, life: 14 });
          sfx('chirp');
        }
      } else {
        perch.x += perch.face * 0.8; perch.y -= 0.5;
        if (perch.y < -6 || perch.x < -8 || perch.x > W + 8) { perch = null; }
      }
    }

    // The mandarin stays on while the pose has a head spot; otherwise it falls off.
    function updateOrange(p, a) {
      if (orangeWait > 0) { // just given (maybe mid-hop): put it on as soon as possible
        if (a) { orange = 900; orangeWait = 0; }
        else { orangeWait--; }
      }
      if (orange > 0) {
        if (a) { lastHead = a; if (--orange === 0 && anim) { fruitFalls(p, a); } }
        else { if (anim && lastHead) { fruitFalls(p, lastHead); } orange = 0; }
      }
    }

    function fruitFalls(p, a) {
      add({
        k: 'fruit', x: a.x, y: a.y - 3, vx: -(p.face || 1) * 0.35, vy: -0.7, g: 0.1,
        floor: row(o.feet) - 3 * (condor ? HK : 1), life: 34,
      });
    }

    function drawFx(p) {
      const a = headAnchor(p);
      updateOrange(p, a);
      updateBird(p, a);
      const hat = world.holiday === 'christmas' && !orange && !!a;
      const precip = drops.length > 0 || flakes.length > 0;
      if (!parts.length && !fxDirty && !perch && !orange && !hat && !precip && !food) { return; }
      fc.clearRect(0, 0, W, H);
      drawFood();
      if (orange > 0 && a) {
        const bm = condor ? CHULLO : a.small ? ORANGE_S : ORANGE, k = condor ? HK : 1;
        blitK(fc, bm, condor ? CHULLO_C : ORANGE_C, a.x - ((bm[0].length * k) >> 1), a.y - bm.length * k + 1, p.face < 0, k);
      } else if (hat) {
        const bm = a.small ? HAT_S : HAT;
        blitK(fc, bm, HAT_C, a.x - ((bm[0].length * HK) >> 1), a.y - bm.length * HK + 1, (swimmer ? swimmer.face : p.face) < 0, HK);
      }
      if (perch) {
        const x = Math.round(perch.x), y = Math.round(perch.y);
        if (perch.phase === 'sit') {
          const lift = (orange > 0 || hat) && a ? (a.small ? 3 : 5) : 0; // perched on the mandarin / hat
          blit(fc, PERCH, PERCH_C, x - 2, y - 3 - lift, (p && p.face) < 0);
        } else {
          blit(fc, BIRD[(t >> 1) % 2], { x: PERCH_C.b }, x - 2, y - 2);
        }
      }
      parts = parts.filter(stepPart);
      if (precip) { drawPrecip(); }
      fxDirty = parts.length > 0 || !!perch || orange > 0 || hat || precip || !!food;
    }

    // Automatic effects driven by the pet's state.
    function react(p) {
      const g = geo(p);
      const hd = condor ? headAnchor(p) : null; // the condor's head, for its effects
      if (p.state !== prevState) {
        if (p.state === 'celebrate') {
          for (let i = 0; i < 24; i++) {
            add({
              k: 'confetti', x: g.cx + rand(-2, 2), y: g.top,
              vx: rand(-0.8, 0.8), vy: -rand(0.5, 1.4), g: 0.07,
              life: Math.round(rand(18, 28)), c: CONFETTI[i % CONFETTI.length],
            });
          }
        } else if (p.state === 'scared') {
          add(hd ? { k: 'alert', x: hd.x, y: hd.y - 3, life: 16 } : { k: 'alert', x: g.head, y: row(o.base + o.pet * 0.72) - 1, life: 16 });
        }
        if (prevState === 'jump' && !(p.alt > 1)) { dust(p, 6); } // landing puff
        prevState = p.state;
      }
      if (p.state === 'celebrate' && t % 4 === 0) {
        add({ k: 'sparkle', x: g.L + rand(0, g.w), y: g.top + rand(-4, (g.foot - g.top) * 0.6), life: 7 });
      }
      // The sprites carry no loose details (zzz, steam, sweat): drawn here instead.
      const side = (f) => g.L + g.w * (p.face > 0 ? f : 1 - f);
      if (p.state === 'sleep' && t % 20 === 0) {
        add(hd ? { k: 'zz', x: hd.x + 4 * p.face, y: hd.y - 6, vx: 0.12 * p.face, vy: -0.16, life: 26 }
          : { k: 'zz', x: side(0.8), y: row(o.base + o.pet * 0.5) - 4, vx: 0.12 * p.face, vy: -0.16, life: 26 });
      }
      if (p.state === 'coffee' && !condor && t % 4 === 0) {
        add({ k: 'steam', x: side(0.82) + rand(-0.5, 0.5), y: row(o.base + o.pet * 0.36), vy: -0.25, life: 12, p: rand(0, 6) });
      }
      if (p.state === 'scared' && t % 9 === 0) {
        add({
          k: 'sweat', x: hd ? hd.x + 3 * p.face : side(0.74), y: hd ? hd.y + 3 : row(o.base + o.pet * 0.66),
          vx: p.face * rand(0.15, 0.35), vy: -rand(0.3, 0.5), g: 0.07, life: 12,
        });
      }
      if (dripFor > 0 && !swimmer) { // just out of the water: dripping
        dripFor--;
        if (t % 2 === 0) {
          add({
            k: 'drip', x: g.L + g.w * rand(0.2, 0.8), y: g.top + rand(2, (g.foot - g.top) * 0.7),
            vy: 0.1, g: 0.06, life: 9, c: DROP_C.b,
          });
        }
      }
      const onGround = !(p.alt > 1); // no dust in the air
      // The condor loses a feather now and then when it flaps hard or gets a fright.
      if (condor && p.pose === 'fly' && Math.random() < (p.state === 'scared' ? 1 / 8 : p.state === 'run' ? 1 / 70 : 0)) {
        add({
          k: 'feather', x: g.cx + rand(-4, 4), y: g.foot - o.pet / PX * 0.35, vx: rand(-0.2, 0.2), vy: 0.12,
          life: 160, p: rand(0, 6), floor: row(o.feet) + 1,
        });
      }
      if (onGround && p.moving && p.state === 'run' && t % 3 === 0) { dust(p, 2, -p.face); }
      if (onGround && p.moving && p.state === 'walk' && t % 14 === 0) { dust(p, 1, -p.face); }
    }

    // ------------------------------------------------------------- resize

    function resize() {
      const w = Math.max(1, Math.ceil(stage.clientWidth / PX));
      const h = Math.max(1, Math.ceil(stage.clientHeight / PX));
      if (w === W && h === H) { return; }
      W = w; H = h;
      for (const c of [sceneCv, fxCv]) {
        c.width = W; c.height = H;
        c.style.width = W * PX + 'px';
        c.style.height = H * PX + 'px';
      }
      if (scenic) { build(); }
      parts = []; fxDirty = false;
      if (swimmer) {
        if (swimMax < swimMin) { swimmer = null; } // the lake no longer fits
        else { swimmer.x = clamp(swimmer.x, swimMin, swimMax); }
      }
      drawScene(last);
    }

    let raf = 0;
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (!raf) { raf = requestAnimationFrame(() => { raf = 0; resize(); }); }
      }).observe(stage);
    }
    resize();
    report();

    return {
      // Called once per pet tick with { x, face, state, moving }.
      frame(p) {
        last = p;
        // About once a minute: has the time of day, weather, season or date changed?
        if (++clock >= 850) {
          clock = 0;
          const m = baseMode(), wd = worldNow();
          if (m !== mode || wd.weather !== world.weather || wd.season !== world.season ||
              wd.holiday !== world.holiday || wd.day !== world.day || wd.dawn !== world.dawn) {
            mode = m; world = wd; P = adjust(palFor(m, wd), m, wd);
            if (swimmer && P.frozen) { swimmer = null; } // the lake froze over
            W = H = 0; resize(); report();
          }
        }
        if (anim) { t++; react(p); }
        drawScene(p);
        drawFx(p);
      },
      // A pixel heart floating up from the pet (petting) — or from the swimmer.
      heart(p) {
        if (!anim) { return; }
        if (swimmer) {
          add({ k: 'heart', x: swimmer.x + SWIM_W / 2, y: swimY - 9, vy: -0.35, life: 18 });
          return;
        }
        const g = geo(p);
        add({ k: 'heart', x: g.cx, y: g.top - 2, vy: -0.35, life: 18 });
      },
      // Where the pet's left edge (CSS px) may stand to jump into the lake, or null.
      lake() {
        if (!scenic || P.frozen || swimMax < swimMin) { return null; }
        return { from: (swimMin + SWIM_W / 2) * PX - o.pet / 2, to: (swimMax + SWIM_W / 2) * PX - o.pet / 2 };
      },
      swimming() { return !!swimmer; },
      // Jump in: the DOM pet hides and the swimmer appears in the lake above it.
      swimStart(p) {
        if (!this.lake()) { return false; }
        const cx = (p.x + o.pet / 2) / PX;
        swimmer = { x: clamp(cx - SWIM_W / 2, swimMin, swimMax), face: p.face || 1 };
        splash(swimmer.x + SWIM_W / 2, swimY);
        dust(p, 4);
        return true;
      },
      // Climb out: returns where the pet reappears ({ x: CSS left, face }).
      swimEnd() {
        if (!swimmer) { return null; }
        const cx = swimmer.x + SWIM_W / 2, face = swimmer.face;
        splash(cx, swimY);
        swimmer = null; dripFor = 40;
        return { x: cx * PX - o.pet / 2, face };
      },
      // Bubble anchor above the swimmer (CSS px: centre x, bottom offset).
      swimmerAt() {
        if (!swimmer) { return null; }
        return { cx: (swimmer.x + SWIM_W / 2) * PX, top: (H - (swimY - 6)) * PX };
      },
      // A puff of dust at the pet's feet (the condor touching down).
      puff(p) { if (anim) { dust(Object.assign({}, p, { bottom: 4, alt: 0 }), 6); } },
      // The condor's rock: centre x and the CSS bottom offset of its top, or null.
      thermal() { return habitat === 'andes' ? thermalX() : null; },
      perch() {
        if (habitat !== 'andes' || !perchSpot || !scenic) { return null; }
        return { x: perchSpot.x * PX, bottom: (H - perchSpot.y) * PX };
      },
      // Easter egg: a mandarin on the head.
      orange() { orangeWait = 40; },
      // Feeding: drop a watermelon slice at x (CSS px); eat it bite by bite.
      dropFood(xCss) {
        food = { x: clamp(xCss / PX, 4, W - 4), y: Math.max(-8, row(o.feet) - 45), vy: 0, bites: 0, landed: !anim, gone: 0 };
        if (!anim) { food.y = row(o.feet) - MELON.length + 1; }
      },
      foodLanded() { return !!food && food.landed; },
      bite() {
        if (!food) { return true; }
        food.bites++;
        for (let i = 0; i < 3; i++) { // seeds and juice flying off
          add({
            k: 'splash', x: food.x + rand(-2, 2), y: food.y + food.bites, vx: rand(-0.5, 0.5), vy: -rand(0.3, 0.8),
            g: 0.1, life: 8, c: i ? MELON_C.r : MELON_C.k,
          });
        }
        if (food.bites >= MELON.length - 1) { food.gone = 6; return true; } // only crumbs left
        return false;
      },
      dropFoodNow() { if (food) { food.gone = 6; } }, // abandoned: it fades away
    };
  }

  window.PixelArt = { create };
})();
