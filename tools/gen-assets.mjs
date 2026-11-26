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
import { DARK, LIGHT } from './palette.mjs';
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

function layer(name, cells, { opacity, anim = null } = {}) {
  return { name, body: serialize(cells.grid, cells.T), anim, opacity };
}

// Mot keyframe bang: attr = 'opacity' | 'translate'.
function smil(a) {
  const kt = (a.keyTimes ?? a.values.map((_, i) => i / a.values.length)).map((k) => k.toFixed(4));
  const common = ` keyTimes="${kt.join(';')}" calcMode="discrete" dur="${a.dur}s" repeatCount="indefinite"`;
  if (a.attr === 'opacity') return `<animate attributeName="opacity" values="${a.values.join(';')}"${common}/>`;
  return `<animateTransform attributeName="transform" type="translate" values="${a.values.join(';')}"${common}/>`;
}

// SNAP=gio (giay): tinh frame tinh le, de xuat SVG tinh -> dung ra PNG xem tung frame.
const SNAP = process.env.SNAP !== undefined ? Number(process.env.SNAP) : null;

function snapValue(a, t) {
  const phase = ((t % a.dur) + a.dur) % a.dur / a.dur;
  const kt = a.keyTimes ?? a.values.map((_, i) => i / a.values.length);
  let idx = 0;
  kt.forEach((k, i) => { if (phase + 1e-9 >= k) idx = i; });
  return a.values[idx];
}

function svg({ w, h, cell, layers, title, desc }) {
  const W = w * cell, H = h * cell;
  const inner = layers.map((L) => {
    const attrs = [];
    let animStr = '';
    if (L.anim && SNAP === null) animStr = smil(L.anim);
    if (L.opacity !== undefined) attrs.push(`opacity="${L.opacity}"`);
    if (L.anim && SNAP !== null) {
      const v = snapValue(L.anim, SNAP);
      if (L.anim.attr === 'opacity') attrs[attrs.length - 1] = `opacity="${v}"`;
      else attrs.push(`transform="translate(${v})"`);
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

// ---------------------------------------------------------------- banner

// values cho vong xoay frame: chi frame 'on' sang, cac frame con lai tat.
const rotateOnes = (n, on) => Array.from({ length: n }, (_, i) => (i === on ? 1 : 0)).join(';');

function banner(T) {
  const W = 160, H = 44, M = paletteMap(T);
  const base = grid(W, H);
  fill(base, 0, 0, W, H, T.bg);
  // san + luoi perspective
  fill(base, 0, 34, W, H - 34, T.panel);
  for (let y = 36; y < H; y += 3) for (let x = 0; x < W; x++) if (x % 2 === 0) base[y][x] = T.border;
  for (let x = 0; x < W; x += 10) fill(base, x, 34, 1, H - 34, T.border);
  outline(base, 0, 33, W, 1, T.border);

  // CRT: vien 4..100, man hinh 6..98 (15 ky tu/line), chan de
  fill(base, 4, 6, 96, 26, T.dim);
  fill(base, 6, 8, 92, 20, T.bg);
  fill(base, 6, 8, 92, 1, T.border);
  fill(base, 44, 32, 16, 3, T.dim);
  fill(base, 36, 35, 32, 2, T.border);
  fill(base, 92, 29, 3, 2, T.green);

  // sofa ben phai (108..140) + nguoi ngoi chi tay ve man hinh
  const sofa = grid(W, H);
  // Ve nguoi TRUOC, sofa sau: phan than duoi bi lung sofa che -> doc la "ngoi".
  fill(sofa, 120, 10, 6, 6, T.cream);
  fill(sofa, 121, 12, 1, 1, T.bg);
  fill(sofa, 124, 12, 1, 1, T.bg);
  fill(sofa, 118, 16, 10, 4, T.blue);
  fill(sofa, 114, 14, 5, 2, T.blue);
  sprite(sofa, 108, 16, SOFA, M, { scale: 2 });

  // ba frame noi dung man hinh, moi dong <= 15 ky tu de vua 92 o
  const screens = [
    ['> VIBE MODE ON', '> PROMPT SENT'],
    ['> MODEL: 3 FILES', '> DIFF: LGTM'],
    ['> TEST: GREEN', '> SHIP IT'],
  ].map((lines) => {
    const g = grid(W, H);
    lines.forEach((ln, r) => text(g, 9, 13 + r * 8, ln, r === 0 ? T.cyan : T.ink, { scale: 1 }));
    return g;
  });

  // sparkle xen ke
  const sparks = [grid(W, H), grid(W, H)];
  [[103, 6], [101, 26]].forEach(([x, y], i) => {
    fill(sparks[i], x, y, 1, 3, T.cream);
    fill(sparks[i], x - 1, y + 1, 3, 1, T.cream);
  });
  [[146, 10], [148, 24]].forEach(([x, y], i) => {
    fill(sparks[(i + 1) % 2], x, y, 1, 3, T.cream);
    fill(sparks[(i + 1) % 2], x - 1, y + 1, 3, 1, T.cream);
  });

  const cyc = (vals, dur) => ({ attr: 'opacity', values: vals.split(';'), dur });

  return svg({
    w: W, h: H, cell: 6,
    title: 'banner-' + T.name,
    desc: 'Pixel art: nguoi ngoi sofa cam chi tay ve man hinh CRT dang chay log.',
    layers: [
      layer('base', { grid: base, T }, { opacity: 1 }),
      ...screens.map((g, i) => layer(`screen${i}`, { grid: g, T }, {
        opacity: 0, anim: cyc(rotateOnes(3, i), 3.6),
      })),
      layer('sofa', { grid: sofa, T }, {
        anim: { attr: 'translate', values: ['0 0', '0 1', '0 0', '0 -1'], keyTimes: [0, 0.25, 0.5, 0.75], dur: 2.4 },
      }),
      ...sparks.map((g, i) => layer(`spark${i}`, { grid: g, T }, {
        opacity: 0, anim: cyc(i === 0 ? '1;0;1;0' : '0;1;0;1', 1.6),
      })),
    ],
  });
}

// ---------------------------------------------------------------- log block

const LOG_LINES = [
  '> PROMPT: MAKE IT ALIVE',
  '> MODEL: 3 FILES, 240 LINES',
  '> ME: READS DIFF, SQUINTS',
  '> TEST: GREEN, NO IDEA WHY',
  '> SHIP: 05:00 LOCAL TIME',
  '> TODO: LEARN TO CODE, SURE',
];

function logBlock(T) {
  const W = 176, H = 12 + LOG_LINES.length * 10 + 8;
  const frame = grid(W, H);
  fill(frame, 0, 0, W, H, T.panel);
  outline(frame, 0, 0, W, H, T.border);
  fill(frame, 1, 1, W - 2, 7, T.dim);
  [[3, 3, T.orange], [7, 3, T.cream], [11, 3, T.green]].forEach(([x, y, c]) => fill(frame, x, y, 2, 2, c));
  text(frame, 18, 3, 'VIBE.LOG', T.ink, { scale: 1 });

  const rows = LOG_LINES.map((ln, i) => {
    const g = grid(W, H);
    text(g, 6, 12 + i * 10, ln, i === LOG_LINES.length - 1 ? T.orange : T.ink, { scale: 1 });
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

  return svg({
    w: W, h: H, cell: 6, title: 'log-' + T.name,
    desc: 'Pixel terminal log: 6 dong log ve vong lap prompt -> model -> review -> ship, hien dan.',
    layers: [layer('frame', { grid: frame, T }), ...rows],
  });
}

// Dong i xuat hien tai time i/total, giu den het vong roi reset (vong lap).
function reveal(i, total, dur) {
  return { attr: 'opacity', values: ['0', '0', '1', '1'], keyTimes: [0, i / total, i / total + 0.001, 0.9999], dur };
}

// ---------------------------------------------------------------- trophy strip

function trophyStrip(T, s) {
  const tiles = [
    [String(s.commits), 'COMMITS'],
    [String(s.prs), 'PRS'],
    [String(s.repos), 'REPOS'],
    [String(s.stars), 'STARS'],
    [String(s.accountDays), 'DAYS'],
  ];
  const TW = 60, H = 42, W = TW * tiles.length;
  const frame = grid(W, H);
  fill(frame, 0, 0, W, H, T.bg);
  tiles.forEach((_, i) => {
    fill(frame, i * TW + 3, 3, TW - 6, H - 6, T.panel);
    outline(frame, i * TW + 2, 2, TW - 4, H - 4, T.border);
  });

  const layers = [layer('frame', { grid: frame, T }), ...tiles.map(([val, label], i) => {
    const g = grid(W, H);
    // icon coc: bun kem, quai + day cam, choe xanh
    const x = i * TW + 10, y = 8;
    fill(g, x, y, 10, 5, T.cream);
    fill(g, x, y, 10, 1, T.orangeDeep);
    fill(g, x - 1, y + 1, 1, 3, T.orangeDeep);
    fill(g, x + 10, y + 1, 1, 3, T.orangeDeep);
    fill(g, x + 3, y + 5, 4, 3, T.orange);
    fill(g, x + 1, y + 8, 8, 2, T.orangeDeep);
    fill(g, x + 4, y - 3, 2, 2, T.green);
    text(g, i * TW + 8, 18, val, T.cyan, { scale: 2 });
    text(g, i * TW + 8, 33, label, T.ink, { scale: 1 });
    return layer(`tile${i}`, { grid: g, T });
  })];

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

function snakeGrid(T, cal) {
  const COLS = cal.weeks.length, ROWS = 7;
  const W = (COLS + 2) * 8, H = (ROWS + 5) * 8;
  const base = grid(W, H);
  fill(base, 0, 0, W, H, T.bg);
  outline(base, 0, 0, W, H, T.border);
  text(base, 8, 8, 'CONTRIBUTIONS', T.ink, { scale: 1 });
  // legend do tuong phan
  text(base, 8, H - 10, 'LESS', T.dim, { scale: 1 });
  T.levels.forEach((c, i) => fill(base, 36 + i * 8, H - 10, 7, 7, c));
  text(base, 36 + 5 * 8 + 2, H - 10, 'MORE', T.dim, { scale: 1 });

  cal.weeks.forEach((week, wx) => {
    week.forEach((day, wy) => {
      const x = 8 + (wx + 1) * 8, y = 8 + (wy + 2) * 8;
      fill(base, x, y, 7, 7, T.levels[day.level] ?? T.levels[0]);
    });
  });

  // ran: 4 khuc than, buoc theo cot, calcMode discrete de dung chat vao o pixel
  const snake = grid(W, H);
  const HEAD = 8 + 5 * 8, ROWY = 8 + 4 * 8;
  [[0, T.green], [-1, T.cyan], [-2, T.cyan], [-3, T.blue]].forEach(([dx, c]) => {
    fill(snake, HEAD + dx * 8, ROWY, 7, 7, c);
  });
  fill(snake, HEAD + 2, ROWY + 2, 2, 2, T.bg); // mat

  const steps = COLS - 8;
  const pos = Array.from({ length: steps }, (_, i) => `${i * 8} 0`);
  const kt = Array.from({ length: steps }, (_, i) => i / steps);

  return svg({
    w: W, h: H, cell: 2, title: 'snake-' + T.name,
    desc: `Luoi ${COLS} tuan contribution (${cal.total} commit duong tinh trong 12 thang) voi ran pixel bo ngang.`,
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
    [`banner-${sfx}.svg`]: banner(T),
    [`log-${sfx}.svg`]: logBlock(T),
    [`trophy-strip-${sfx}.svg`]: trophyStrip(T, data.stats),
    [`grid-snake-${sfx}.svg`]: snakeGrid(T, data.calendar),
  };
  for (const [name, body] of Object.entries(writes)) { writeFileSync(join(OUT, name), body); writesCache[name] = 1; }
}
console.log('assets/ da ghi:', Object.keys(writesCache).length, 'file');
console.log('data:', JSON.stringify(data.stats), 'grid total:', data.calendar.total);
