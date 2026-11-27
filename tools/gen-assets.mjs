// Sinh toan bo asset pixel trong assets/ tu palette.mjs + font.mjs + data/*.json.
//
//   node tools/gen-assets.mjs            # dung data dang commit -> output byte-stable
//   node tools/gen-assets.mjs --refresh  # keo so lieu moi tu GitHub API roi sinh lai
//
// Animation chi dung SMIL khai bao (animate/animateTransform) vi SVG tai qua <img>
// tren GitHub bi chan JS va chan nap font ben ngoai.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DARK, LIGHT, SEASONS, SCENES, monthSeason } from './palette.mjs';
import { textToRows, GH, GW } from './font.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'assets');
const DATA = join(HERE, 'data');

// ---------------------------------------------------------------- grid helpers

function grid(w, h) {
  return Array.from({ length: h }, () => new Array(w).fill(null));
}

function fill(g, x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = x + i, py = y + j;
    if (px < 0 || py < 0 || px >= g[0].length || py >= g.length) {
      throw new Error(`fill vuot vuong: ${px},${py} > ${g[0].length}x${g.length}`);
    }
    g[py][px] = c;
  }
}

function outline(g, x, y, w, h, c) {
  fill(g, x, y, w, 1, c);
  fill(g, x, y + h - 1, w, 1, c);
  fill(g, x, y, 1, h, c);
  fill(g, x + w - 1, y, 1, h, c);
}

// Ve chu bang font 5x7; scale = so pixel that cho moi diem anh cua glyph.
function text(g, x, y, str, c, { scale = 1, tracking = 1 } = {}) {
  const { rows } = textToRows(str, { tracking });
  for (let ry = 0; ry < rows.length; ry++) {
    for (let rx = 0; rx < rows[ry].length; rx++) {
      if (rows[ry][rx] !== '1') continue;
      fill(g, x + rx * scale, y + ry * scale, scale, scale, c);
    }
  }
  return (rows[0].length) * scale;
}

function sprite(g, x, y, rows, map, { scale = 1 } = {}) {
  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const c = map[ch];
      if (!c) return;
      fill(g, x + rx * scale, y + ry * scale, scale, scale, c);
    });
  });
}

// Gom pixel cung mau thanh doan ngang roi moi xuat rect: file nho hon nhieu so voi
// mot rect cho tung pixel.
function serialize(g, T) {
  const byColor = new Map();
  for (let y = 0; y < g.length; y++) {
    let x = 0;
    while (x < g[0].length) {
      const c = g[y][x];
      if (!c) { x++; continue; }
      let run = 1;
      while (x + run < g[0].length && g[y][x + run] === c) run++;
      if (!byColor.has(c)) byColor.set(c, []);
      byColor.get(c).push([x, y, run]);
      x += run;
    }
  }
  const parts = [];
  for (const [c, runs] of [...byColor.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const d = runs.map(([x, y, w]) => `M${x} ${y}h${w}v1h-${w}z`).join('');
    parts.push(`<path fill="${c}" d="${d}"/>`);
  }
  return parts.join('');
}

function layer(name, cells, { opacity, anim = null, anims = null } = {}) {
  return { name, body: serialize(cells.grid, cells.T), anim, anims, opacity };
}

// Anims cua mot group: ap duoc nhieu animate len cung <g> (vd opacity discrete
// cho vong doi mua + animateTransform linear cho hat roi). Mot group phai chua
// <path> (L3b) nen khong tach opacity sang <g> trung gian.
function animsOf(L) {
  return L.anims ?? (L.anim ? [L.anim] : []);
}

// Mot keyframe bang. a.calcMode = 'discrete' (mac dinh, hop chat 8-bit va L3)
// hoac 'linear' (minh chuyen dong cho hat). discrete dung keyTimes dang git gia
// tri den ket tiep; linear phan bo deu tu 0->1.
function smil(a) {
  const cm = a.calcMode ?? 'discrete';
  const n = a.values.length;
  const kt = (a.keyTimes ?? (cm === 'linear' && n > 1
    ? a.values.map((_, i) => i / (n - 1))
    : a.values.map((_, i) => i / n))).map((k) => k.toFixed(4));
  const common = ` keyTimes="${kt.join(';')}" calcMode="${cm}" dur="${a.dur}s" repeatCount="indefinite"`;
  if (a.attr === 'opacity') return `<animate attributeName="opacity" values="${a.values.join(';')}"${common}/>`;
  return `<animateTransform attributeName="transform" type="translate" values="${a.values.join(';')}"${common}/>`;
}

// SNAP=gio (giay): tinh frame tinh le, de xuat SVG tinh -> dung ra PNG xem tung frame.
const SNAP = process.env.SNAP !== undefined ? Number(process.env.SNAP) : null;

function snapValue(a, t) {
  const cm = a.calcMode ?? 'discrete';
  const phase = (((t % a.dur) + a.dur) % a.dur) / a.dur;
  const n = a.values.length;
  const kt = a.keyTimes ?? (cm === 'linear' && n > 1
    ? a.values.map((_, i) => i / (n - 1))
    : a.values.map((_, i) => i / n));
  if (cm === 'linear' && n > 1) {
    let i = 0; while (i < n - 1 && phase >= kt[i + 1]) i++;
    const span = (kt[i + 1] - kt[i]) || 1;
    const f = Math.min(1, Math.max(0, (phase - kt[i]) / span));
    if (a.attr === 'opacity') return +( +a.values[i] + (+a.values[i + 1] - +a.values[i]) * f ).toFixed(3);
    const [x0, y0] = a.values[i].split(/\s+/).map(Number);
    const [x1, y1] = a.values[i + 1].split(/\s+/).map(Number);
    return `${(x0 + (x1 - x0) * f).toFixed(2)} ${(y0 + (y1 - y0) * f).toFixed(2)}`;
  }
  let idx = 0;
  kt.forEach((k, i) => { if (phase + 1e-9 >= k) idx = i; });
  return a.values[idx];
}

function svg({ w, h, cell, layers, title, desc }) {
  const W = w * cell, H = h * cell;
  const inner = layers.map((L) => {
    const anims = animsOf(L);
    const attrs = [];
    if (L.opacity !== undefined) attrs.push(`opacity="${L.opacity}"`);
    let animStr = '';
    if (SNAP === null) {
      animStr = anims.map(smil).join('');
    } else {
      for (const a of anims) {
        const v = snapValue(a, SNAP);
        if (a.attr === 'opacity') {
          const oi = attrs.findIndex((x) => x.startsWith('opacity='));
          if (oi >= 0) attrs[oi] = `opacity="${v}"`; else attrs.push(`opacity="${v}"`);
        } else attrs.push(`transform="translate(${v})"`);
      }
    }
    const open = attrs.length ? `<g ${attrs.join(' ')}>` : '<g>';
    return `${open}${animStr}${L.body}</g>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"`,
    `     shape-rendering="crispEdges" role="img" aria-labelledby="${title}-t">`,
    `<title id="${title}-t">${esc(title)}</title>`,
    `<desc>${esc(desc)}</desc>`,
    `<g transform="scale(${cell})">`,
    inner.join('\n'),
    `</g>`,
    `</svg>`,
    '',
  ].join('\n');
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------- sprite data

const SOFA = [
  '................',
  '..BBBBBBBBBB....',
  '.BHHHHHHHHHHB...',
  '.BCCCCCCCCCCB...',
  '.BCCDCCCCDCCB...',
  '.BHHHHHHHHHHB...',
  'BBBBBBBBBBBBBBB.',
  'BDDBBBBBBBBBBBDB',
  'BLLLLLLLLLLLLLB.',
  '.LL..LL..LL..LL.',
];

const SOFA2 = [
  '................',
  '................',
  '..BBBBBBBBBB....',
  '.BHHHHHHHHHHB...',
  '.BCCCCCCCCCCB...',
  '.BCCDCCCCDCCB...',
  'BBBBBBBBBBBBBBB.',
  'BDDBBBBBBBBBBBDB',
  'BLLLLLLLLLLLLLB.',
  '.LL..LL..LL..LL.',
];

const SMILE = ['....', '.##.', '.##.', '..#.'];

function paletteMap(T) {
  return {
    B: T.orange, D: T.orangeDeep, H: T.cream, C: T.blue, L: T.border,
    S: T.green, W: T.ink, K: T.bg, P: T.panel, N: T.dim, Y: T.cyan, '#': T.cream,
  };
}

// ---------------------------------------------------------------- hero 4 mua
// Mot scene pixel tu vong lap xuan -> ha -> thu -> dong. Base (than cay, nguoi)
// ve 1 lan; rieng 4 bo nen/tron/hat doi bang opacity discrete dung mot o, hat roi
// translate linear (minh chuyen dong, khong phinh <path>).

const put = (g, x, y, c) => {
  if (x >= 0 && y >= 0 && x < g[0].length && y < g.length) g[y][x] = c;
};
function disc(g, cx, cy, r, c) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) put(g, cx + x, cy + y, c);
}
function blob(g, cx, cy, rx, ry, c) {
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) put(g, cx + x, cy + y, c);
}

// opacity discrete: sang duy nhat trong o thu i tren n o, vong `dur`.
function seasonWindow(i, n, dur) {
  const a = i / n, b = (i + 1) / n;
  if (i === 0) return { attr: 'opacity', values: ['1', '0', '0'], keyTimes: [0, b, 1], dur };
  return { attr: 'opacity', values: ['0', '1', '0', '0'], keyTimes: [0, a, b, 1], dur };
}

const TRUNK = { dark: '#5a3f2a', light: '#7a5230' };
const PERSON = {
  dark: { hair: '#2a1e12', skin: '#e8c39e', shirt: '#3a6ea5', pants: '#22304d' },
  light: { hair: '#241a10', skin: '#e8b88a', shirt: '#0969da', pants: '#3a2f2f' },
};

function hero(T, SC4) {
  const W = 200, H = 88, HZ = 60, TRX = 70, n = SEASONS.length, DUR = 20;
  const P = PERSON[T.name], TC = TRUNK[T.name];
  const win = (i) => seasonWindow(i, n, DUR);

  // nen tro/dat/matt troi + chu tinh theo tung mua (ve 4 lan, chen nhieu <path>)
  const bgLayers = SEASONS.map((name, i) => {
    const sc = SC4[name]; const g = grid(W, H);
    fill(g, 0, 0, W, HZ - 16, sc.skyTop);
    fill(g, 0, HZ - 16, W, 16, sc.skyLo);
    disc(g, 150, 16, 6, sc.sun); disc(g, 150, 16, 4, sc.sun);
    for (let x = 0; x < W; x++) {
      const y = Math.round(HZ - 11 - 6 * Math.sin(x / 26) - 3 * Math.sin(x / 9));
      put(g, x, y, sc.hillFar); put(g, x, y + 1, sc.hillFar);
    }
    fill(g, 0, HZ, W, H - HZ, sc.ground);
    fill(g, 0, H - 8, W, 8, sc.groundDeep);
    text(g, 6, 78, 'LOCALHOST // AFK', sc.text, { scale: 1 });
    return layer('bg-' + name, { grid: g, T }, { opacity: i === 0 ? 1 : 0, anim: win(i) });
  });

  const trunkG = grid(W, H);
  fill(trunkG, TRX - 2, 32, 5, HZ - 32, TC);
  fill(trunkG, TRX - 9, 40, 8, 2, TC);
  fill(trunkG, TRX + 4, 37, 9, 2, TC);
  fill(trunkG, TRX - 2, 29, 5, 4, TC);
  const trunkLayer = layer('trunk', { grid: trunkG, T });

  const canopyLayers = SEASONS.map((name, i) => {
    const sc = SC4[name]; const g = grid(W, H);
    if (name !== 'winter') {
      blob(g, TRX, 22, 30, 16, sc.canopy);
      blob(g, TRX - 11, 15, 13, 8, sc.canopyHi);
      blob(g, TRX + 12, 27, 13, 8, sc.canopyLo);
    } else {
      fill(g, TRX - 3, 28, 7, 1, sc.particle);   // tuyet ngon cay
      fill(g, TRX - 9, 39, 8, 1, sc.particle);   // tuyet canh trai
      fill(g, TRX + 4, 36, 9, 1, sc.particle);   // tuyet canh phai
    }
    return layer('canopy-' + name, { grid: g, T }, { opacity: i === 0 ? 1 : 0, anim: win(i) });
  });

  const px = TRX + 7;
  const personG = grid(W, H);
  fill(personG, px + 1, 47, 4, 3, P.hair);
  fill(personG, px + 1, 50, 4, 3, P.skin);
  fill(personG, px, 53, 6, 6, P.shirt);
  fill(personG, px + 4, 58, 7, 2, P.pants);
  const personLayer = layer('person', { grid: personG, T });

  const detailLayers = SEASONS.map((name, i) => {
    const sc = SC4[name]; const g = grid(W, H);
    if (name === 'spring') { put(g, px + 2, 45, sc.canopyHi); put(g, px + 3, 46, sc.particle); }
    if (name === 'summer') { fill(g, px + 7, 54, 2, 3, sc.accent); }
    if (name === 'autumn') { fill(g, px + 1, 46, 4, 2, sc.canopyLo); }
    if (name === 'winter') { fill(g, px, 52, 6, 2, sc.accent); put(g, px + 8, 49, sc.glow); put(g, px + 9, 47, sc.glow); }
    return layer('det-' + name, { grid: g, T }, { opacity: i === 0 ? 1 : 0, anim: win(i) });
  });

  const DOTS = {
    spring: [[46, 12], [58, 8], [80, 10], [92, 14]],
    summer: [[40, 40], [52, 46], [86, 44], [96, 48]],
    autumn: [[44, 10], [60, 7], [78, 12], [94, 9]],
    winter: [[42, 8], [54, 5], [68, 10], [82, 6], [92, 11], [100, 5]],
  };
  const particleLayers = SEASONS.map((name, i) => {
    const sc = SC4[name]; const g = grid(W, H);
    DOTS[name].forEach(([x, y]) => fill(g, x, y, 2, 2, name === 'summer' ? sc.glow : sc.particle));
    const fall = name === 'summer'
      ? { attr: 'translate', values: ['0 0', '0 -3', '0 0', '0 3'], dur: 4, calcMode: 'linear' }
      : { attr: 'translate', values: ['0 0', '0 ' + (HZ + 4)], dur: DUR / n, calcMode: 'linear' };
    return layer('part-' + name, { grid: g, T }, { opacity: i === 0 ? 1 : 0, anims: [win(i), fall] });
  });

  return svg({
    w: W, h: H, cell: 5, title: 'hero-' + T.name,
    desc: 'Pixel scene: goc cay va nguoi ngoi duoi tu vong lap qua 4 mua xuan ha thu dong.',
    layers: [...bgLayers, trunkLayer, ...canopyLayers, personLayer, ...detailLayers, ...particleLayers],
  });
}

// ---------------------------------------------------------------- log block

const LOG_LINES = [
  '> MODE: AFK',
  '> PUSH: 22:00',
  '> BUILD: PASS',
  '> BUGS: WONTFIX',
  '> BED: WARM',
];

function logBlock(T, SC4) {
  const W = 176, H = 12 + LOG_LINES.length * 10 + 8, n = SEASONS.length, DUR = 20;
  const frame = grid(W, H);
  fill(frame, 0, 0, W, H, T.panel);
  outline(frame, 0, 0, W, H, T.border);
  fill(frame, 1, 1, W - 2, 7, T.dim);
  text(frame, 18, 3, 'VIBE.LOG', T.ink, { scale: 1 });

  const rows = LOG_LINES.map((ln, i) => {
    const g = grid(W, H);
    text(g, 6, 12 + i * 10, ln, T.ink, { scale: 1 });
    return layer(`line${i}`, { grid: g, T }, {
      opacity: 0, anim: reveal(i, LOG_LINES.length + 2, 7.2),
    });
  });

  const caret = grid(W, H);
  const lastY = 12 + LOG_LINES.length * 10;
  fill(caret, 6, lastY, 3, 7, T.cyan);
  rows.push(layer('caret', { grid: caret, T }, {
    opacity: 0, anim: { attr: 'opacity', values: ['1', '0'], keyTimes: [0, 0.5], dur: 1 },
  }));

  // 3 cham "cua so" doi mau theo mua (dong bo hero) — lop rieng de khong doi
  // hai animate opacity tren cung group (reveal cua dong log o tren).
  const dotLayers = SEASONS.map((name, i) => {
    const sc = SC4[name]; const g = grid(W, H);
    fill(g, 3, 3, 2, 2, sc.accent); fill(g, 7, 3, 2, 2, sc.particle); fill(g, 11, 3, 2, 2, sc.sun);
    return layer('dots-' + name, { grid: g, T }, { opacity: i === 0 ? 1 : 0, anim: seasonWindow(i, n, DUR) });
  });

  return svg({
    w: W, h: H, cell: 6, title: 'log-' + T.name,
    desc: 'Pixel terminal log: 5 dong log tinh co hien dan, 3 cham cua so doi mau theo 4 mua.',
    layers: [layer('frame', { grid: frame, T }), ...rows, ...dotLayers],
  });
}

// Dong i xuat hien tai time i/total, giu den het vong roi reset (vong lap).
function reveal(i, total, dur) {
  return { attr: 'opacity', values: ['0', '0', '1', '1'], keyTimes: [0, i / total, i / total + 0.001, 0.9999], dur };
}

// ---------------------------------------------------------------- trophy strip

function trophyStrip(T, s, SC4) {
  const tiles = [
    [String(s.commits), 'COMMITS'],
    [String(s.prs), 'PRS'],
    [String(s.repos), 'REPOS'],
    [String(s.stars), 'STARS'],
    [String(s.accountDays), 'DAYS'],
  ];
  const TW = 60, H = 42, W = TW * tiles.length, n = SEASONS.length, DUR = 20;
  const frame = grid(W, H);
  fill(frame, 0, 0, W, H, T.bg);
  tiles.forEach((_, i) => {
    fill(frame, i * TW + 3, 3, TW - 6, H - 6, T.panel);
    outline(frame, i * TW + 2, 2, TW - 4, H - 4, T.border);
  });

  const layers = [layer('frame', { grid: frame, T }), ...tiles.map(([val, label], i) => {
    const g = grid(W, H);
    // icon coc: bun kem, quai + day cam, choe xanh (giu nguyen, so doi mau o lop duoi)
    const x = i * TW + 10, y = 8;
    fill(g, x, y, 10, 5, T.cream);
    fill(g, x, y, 10, 1, T.orangeDeep);
    fill(g, x - 1, y + 1, 1, 3, T.orangeDeep);
    fill(g, x + 10, y + 1, 1, 3, T.orangeDeep);
    fill(g, x + 3, y + 5, 4, 3, T.orange);
    fill(g, x + 1, y + 8, 8, 2, T.orangeDeep);
    fill(g, x + 4, y - 3, 2, 2, T.green);
    text(g, i * TW + 8, 33, label, T.ink, { scale: 1 });
    return layer(`tile${i}`, { grid: g, T });
  })];

  // 5 con so doi mau theo mua (4 lop de chong, chi animate opacity mua -> khong
  // trung voi shine blink o duoi).
  SEASONS.forEach((name, i) => {
    const sc = SC4[name]; const g = grid(W, H);
    tiles.forEach(([val], k) => text(g, k * TW + 8, 18, val, sc.accent, { scale: 2 }));
    layers.push(layer('val-' + name, { grid: g, T }, { opacity: i === 0 ? 1 : 0, anim: seasonWindow(i, n, DUR) }));
  });

  const shine = grid(W, H);
  fill(shine, 4 * TW + 10, 8, 10, 5, T.ink);
  layers.push(layer('shine', { grid: shine, T }, {
    opacity: 0, anim: { attr: 'opacity', values: ['0', '1', '0'], keyTimes: [0, 0.5, 0.9], dur: 3 },
  }));

  return svg({
    w: W, h: H, cell: 4, title: 'trophy-' + T.name,
    desc: `Dai hieu anh pixel: ${s.commits} commit, ${s.prs} PR merged, ${s.repos} repo, ${s.stars} star, ${s.accountDays} ngay ton tai.`,
    layers,
  });
}

// ---------------------------------------------------------------- contribution snake

function snakeGrid(T, cal, SC4) {
  const COLS = cal.weeks.length, ROWS = 7;
  const W = (COLS + 2) * 8, H = (ROWS + 5) * 8;
  const base = grid(W, H);
  fill(base, 0, 0, W, H, T.bg);
  outline(base, 0, 0, W, H, T.border);
  text(base, 8, 8, 'CONTRIBUTIONS', T.ink, { scale: 1 });

  // Mua cua moi cot = thang cua ngay dau tuan (doc date that, khong can commit > 0).
  const colSeason = cal.weeks.map((w) => monthSeason(Number(w[0].date.slice(5, 7))));

  cal.weeks.forEach((week, wx) => {
    const sc = SC4[colSeason[wx]];
    const ramp = [sc.groundDeep, sc.ground, sc.canopyLo, sc.canopy, sc.canopyHi];
    const x0 = 8 + (wx + 1) * 8;
    fill(base, x0, 16, 7, 2, sc.skyLo);            // dai "tro" theo mua tren dinh cot
    week.forEach((day, wy) => {
      fill(base, x0, 8 + (wy + 2) * 8, 7, 7, ramp[day.level] ?? ramp[0]);
    });
  });

  // legend 4 mua (thay cho ramp LESS/MORE vi du lieu dang flat)
  SEASONS.forEach((name, i) => {
    const sc = SC4[name]; const x = 8 + i * 26;
    fill(base, x, H - 12, 7, 7, sc.canopy);
    text(base, x + 9, H - 11, name.slice(0, 3).toUpperCase(), T.dim, { scale: 1 });
  });

  // ran: 4 khuc than mau trung tinh noi bat tren nen mua, buoc theo cot discrete
  const snake = grid(W, H);
  const HEAD = 8 + 5 * 8, ROWY = 8 + 4 * 8;
  [[0, T.orange], [-1, T.cream], [-2, T.cream], [-3, T.orangeDeep]].forEach(([dx, c]) => {
    fill(snake, HEAD + dx * 8, ROWY, 7, 7, c);
  });
  fill(snake, HEAD + 2, ROWY + 2, 2, 2, T.bg); // mat

  const steps = COLS - 8;
  const pos = Array.from({ length: steps }, (_, i) => `${i * 8} 0`);
  const kt = Array.from({ length: steps }, (_, i) => i / steps);

  return svg({
    w: W, h: H, cell: 2, title: 'snake-' + T.name,
    desc: `Luoi ${COLS} tuan contribution toi thanh dai dat 4 mua theo thang commit, ran pixel bo ngang.`,
    layers: [
      layer('base', { grid: base, T }),
      layer('snake', { grid: snake, T }, { anim: { attr: 'translate', values: pos, keyTimes: kt, dur: steps * 0.12 } }),
    ],
  });
}

// ---------------------------------------------------------------- data

function readJson(p, fallback) {
  if (!existsSync(p)) return fallback;
  return JSON.parse(readFileSync(p, 'utf8'));
}

function refreshData() {
  const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 }));
  const q = (s) => execFileSync('gh', ['api', s, '--jq', '.total_count'], { encoding: 'utf8' }).trim();
  const user = gh(['api', 'users/Duzng510']);
  const repos = gh(['api', 'users/Duzng510/repos?per_page=100', '--jq', '[.[] | {name, stars: .stargazers_count}]']);

  let commits = 0;
  for (const r of repos) {
    const head = execFileSync('gh', ['api', `repos/Duzng510/${r.name}/commits?per_page=1`, '-i'], { encoding: 'utf8' });
    const last = /page=(\d+)>; rel="last"/.exec(head);
    commits += last ? Number(last[1]) : gh(['api', `repos/Duzng510/${r.name}/commits?per_page=100`]).length;
  }
  // Search API dem duoc PR squash-merged; dem merge commit thi sot.
  const prs = repos.reduce((n, r) => n + Number(q(`search/issues?q=repo:Duzng510/${r.name}+type:pr+is:merged&per_page=1`)), 0);
  const stars = repos.reduce((n, r) => n + r.stars, 0);
  const cal = gh(['api', 'graphql', '-f',
    'query={viewer{contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionLevel}}}}}}']);
  const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const weeks = cal.data.viewer.contributionsCollection.contributionCalendar.weeks.map((w) =>
    w.contributionDays.map((d) => ({ date: d.date, level: LEVEL[d.contributionLevel] ?? 0 })));

  const created = new Date(user.created_at);
  const stats = {
    commits, prs, repos: repos.length, stars,
    accountDays: Math.floor((Date.now() - created.getTime()) / 86400000),
  };
  const calendar = { total: cal.data.viewer.contributionsCollection.contributionCalendar.totalContributions, weeks };
  mkdirSync(DATA, { recursive: true });
  writeFileSync(join(DATA, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');
  writeFileSync(join(DATA, 'contributions.json'), JSON.stringify(calendar) + '\n');
  return { stats, calendar };
}

// ---------------------------------------------------------------- main

const argv = process.argv.slice(2);
const data = argv.includes('--refresh') ? refreshData() : {
  stats: readJson(join(DATA, 'stats.json'), { commits: 0, prs: 0, repos: 0, stars: 0, accountDays: 0 }),
  calendar: readJson(join(DATA, 'contributions.json'), {
    total: 0,
    weeks: Array.from({ length: 53 }, (_, w) => Array.from({ length: 7 }, (_, d) => ({ date: `w${w}d${d}`, level: 0 }))),
  }),
};

mkdirSync(OUT, { recursive: true });
const writesCache = {};
for (const T of [DARK, LIGHT]) {
  const sfx = T.name;
  const writes = {
    [`hero-${sfx}.svg`]: hero(T, SCENES[T.name]),
    [`log-${sfx}.svg`]: logBlock(T, SCENES[T.name]),
    [`trophy-strip-${sfx}.svg`]: trophyStrip(T, data.stats, SCENES[T.name]),
    [`grid-snake-${sfx}.svg`]: snakeGrid(T, data.calendar, SCENES[T.name]),
  };
  for (const [name, body] of Object.entries(writes)) { writeFileSync(join(OUT, name), body); writesCache[name] = 1; }
}
console.log('assets/ da ghi:', Object.keys(writesCache).length, 'file');
console.log('data:', JSON.stringify(data.stats), 'grid total:', data.calendar.total);
