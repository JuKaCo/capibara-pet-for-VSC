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
  const HEAD = { walk: [25.5, 19], coffee: [19, 14], sleep: [25.5, 24] };

  // A little bird (yellow belly, like the ones that ride capybaras), facing right.
  const PERCH = ['..hh.', '.hhek', 'bbyy.', '..f..'];
  const PERCH_C = { h: '#7a7f8c', e: '#0a0502', k: '#f2a03d', b: '#565a66', y: '#f7d148', f: '#3a2a10' };
  const NOTE = ['.xx', '.x.', 'xx.'];

  // The mandarin (the capybara-in-a-hot-spring meme); a smaller one for the swimmer.
  const ORANGE = ['..gl.', '.ooo.', 'ohooo', 'ooood', '.ddd.'];
  const ORANGE_S = ['.l.', 'hoo', 'ood'];
  const ORANGE_C = { o: '#f28a1e', h: '#ffd08a', d: '#c4620e', g: '#4a7a2a', l: '#7cc444' };

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
      };
    }
    let mode = baseMode(), world = worldNow();
    let P = adjust(PAL[mode], mode, world);
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
    // World life: trees (for falling leaves), weather particles, lake visitors.
    let trees = [], falling = [], drops = [], flakes = [], fog = null, bolt = null;
    let ducks = null, log = null, turtleAway = 0, fireworks = [], pumpkins = [];

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
      const cx = Math.round(W * (sunset ? 0.7 : 0.8));
      // The setting sun sits on the horizon, half hidden behind the hills.
      const cy = sunset ? horizon - Math.round(R * 0.4) : Math.max(R + 2, Math.round(horizon * 0.3));
      body = { cx, cy, R, light: 1 };
      if (P.hideBody) { body = { cx: -99, cy: 0, R: 0, light: 0 }; return; } // behind the rain clouds
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
      blit(sc, SWIM.slice(0, SWIM.length - bob), SWIM_C, x, swimY - 6 + bob, sw.face < 0);
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
    function drawShadow(p) {
      if (!p || swimmer) { return; }
      const cx = (p.x + o.pet / 2) / PX, rx = (o.pet * 0.34) / PX, cy = row(o.feet);
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
        drawFalling();
        drawWater();
        drawSwimmer();
        drawFog();
        if (P.firefly) { drawFireflies(); }
        if (bolt && bolt.life > 5) { sc.fillStyle = 'rgba(255,255,240,0.16)'; sc.fillRect(0, 0, W, H); }
      }
      drawShadow(p);
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
      const L = p.x / PX, w = o.pet / PX;
      return {
        L, w, cx: L + w / 2, foot: row(o.feet),
        head: L + w * (p.face > 0 ? 0.68 : 0.32),
        top: row(o.base + o.pet * 0.6),
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
          if (blink) { blit(fc, ORANGE, ORANGE_C, x - 2, y - 4); }
          break;
        case 'splash':
        case 'drip':
          dot(fc, q.c, x, y);
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
      const h = p && HEAD[p.state];
      if (!h) { return null; }
      const col = p.face > 0 ? h[0] : GRID - 1 - h[0];
      return { x: Math.round(p.x / PX + col), y: row(o.base + (GRID - h[1]) * PX), small: false };
    }

    // A bird lands on the head while the capybara is calm (not at night) and
    // flies off when it runs, jumps or gets scared.
    function updateBird(p, a) {
      const calm = !!a && (!!swimmer || !p.moving || p.state === 'walk');
      if (!perch) {
        if (calm && anim && mode !== 'night' && !P.wet && !orange && !orangeWait && Math.random() < 1 / 700) {
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
        if (Math.random() < 1 / 150) { add({ k: 'note', x: a.x + 2, y: a.y - 6, vy: -0.15, vx: 0.05, life: 14 }); }
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
        floor: row(o.feet) - 3, life: 34,
      });
    }

    function drawFx(p) {
      const a = headAnchor(p);
      updateOrange(p, a);
      updateBird(p, a);
      const hat = world.holiday === 'christmas' && !orange && !!a;
      const precip = drops.length > 0 || flakes.length > 0;
      if (!parts.length && !fxDirty && !perch && !orange && !hat && !precip) { return; }
      fc.clearRect(0, 0, W, H);
      if (orange > 0 && a) {
        const bm = a.small ? ORANGE_S : ORANGE;
        blit(fc, bm, ORANGE_C, a.x - (bm[0].length >> 1), a.y - bm.length + 1);
      } else if (hat) {
        const bm = a.small ? HAT_S : HAT;
        blit(fc, bm, HAT_C, a.x - (bm[0].length >> 1), a.y - bm.length + 1, (swimmer ? swimmer.face : p.face) < 0);
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
      fxDirty = parts.length > 0 || !!perch || orange > 0 || hat || precip;
    }

    // Automatic effects driven by the pet's state.
    function react(p) {
      const g = geo(p);
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
          add({ k: 'alert', x: g.head, y: row(o.base + o.pet * 0.72) - 1, life: 16 });
        }
        if (prevState === 'jump') { dust(p, 6); } // landing puff
        prevState = p.state;
      }
      if (p.state === 'celebrate' && t % 4 === 0) {
        add({ k: 'sparkle', x: g.L + rand(0, g.w), y: g.top + rand(-4, (g.foot - g.top) * 0.6), life: 7 });
      }
      // The sprites carry no loose details (zzz, steam, sweat): drawn here instead.
      const side = (f) => g.L + g.w * (p.face > 0 ? f : 1 - f);
      if (p.state === 'sleep' && t % 20 === 0) {
        add({ k: 'zz', x: side(0.8), y: row(o.base + o.pet * 0.5) - 4, vx: 0.12 * p.face, vy: -0.16, life: 26 });
      }
      if (p.state === 'coffee' && t % 4 === 0) {
        add({ k: 'steam', x: side(0.82) + rand(-0.5, 0.5), y: row(o.base + o.pet * 0.36), vy: -0.25, life: 12, p: rand(0, 6) });
      }
      if (p.state === 'scared' && t % 9 === 0) {
        add({
          k: 'sweat', x: side(0.74), y: row(o.base + o.pet * 0.66),
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
      if (p.moving && p.state === 'run' && t % 3 === 0) { dust(p, 2, -p.face); }
      if (p.moving && p.state === 'walk' && t % 14 === 0) { dust(p, 1, -p.face); }
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
              wd.holiday !== world.holiday || wd.day !== world.day) {
            mode = m; world = wd; P = adjust(PAL[m], m, wd);
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
      // Easter egg: a mandarin on the head.
      orange() { orangeWait = 40; },
    };
  }

  window.PixelArt = { create };
})();
