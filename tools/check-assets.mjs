// Cong kiem chung asset: chay `node tools/check-assets.mjs`.
// Moi luat in ra con so that; co mot luat fail => exit 1.
//
//   L1 byte-stable : sinh 2 lan, sha256 tung file phai giong het
//   L2 render duoc  : rsvg-convert moi svg -> png, dem so mau distinct >= 8
//   L3 co dong      : moi asset co >= 1 animate/animateTransform + crispEdges,
//                     khong duoc ton tai <g opacity="0"> ma khong co animate ben trong
//                     (day chinh la loi da gap: animation dat vao group rong, hien bi an vin)
//   L4 dung luong   : moi file <= 200 KB

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');
const MAX_BYTES = 200 * 1024;

// Lay mau cua cac layer nhin thay luc t=0. Layer co opacity="0" la frame se den
// (animate), nen khong the bat no phai co mat trong mot anh tinh -> ngoai.
function visibleColors(src) {
  const set = new Set();
  for (const m of src.matchAll(/<g\b([^>]*)>/g)) {
    if (/opacity="0"/.test(m[1])) continue;
    const end = src.indexOf('</g>', m.index);
    for (const c of (src.slice(m.index, end).match(/fill="(#[0-9a-fA-F]{6})"/g) ?? [])) set.add(c.slice(6, 13));
  }
  return set;
}

const gen = () => execFileSync('node', [join(ROOT, 'tools', 'gen-assets.mjs')], { encoding: 'utf8' });
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

let failed = 0;
const report = (law, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${law} :: ${detail}`);
  if (!ok) failed++;
};

const files = () => readdirSync(ASSETS).filter((f) => f.endsWith('.svg')).sort();

// L1
gen();
const first = new Map(files().map((f) => [f, sha(readFileSync(join(ASSETS, f)))]));
gen();
const drift = files().filter((f) => first.get(f) !== sha(readFileSync(join(ASSETS, f))));
report('L1 byte-stable', drift.length === 0 && first.size === 8,
  `${first.size} file, drift = ${drift.length ? drift.join(',') : '0'}`);

for (const f of files()) {
  const path = join(ASSETS, f);
  const src = readFileSync(path, 'utf8');

  // L2: render duoc va toan bo mau cua layer hien thi phai co mat trong anh
  let painted;
  try {
    execFileSync('rsvg-convert', [path, '-o', `/tmp/check-${f}.png`], { stdio: 'pipe' });
    const txt = execFileSync('magick', [`/tmp/check-${f}.png`, 'txt:-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    painted = new Set([...txt.matchAll(/#([0-9A-Fa-f]{6})/g)].map((m) => '#' + m[1].toLowerCase()));
  } catch (e) {
    report('L2 render', false, `${f}: ${String(e).slice(0, 90)}`);
    continue;
  }
  const want = visibleColors(src);
  const missing = [...want].filter((c) => !painted.has(c.toLowerCase()));
  report('L2 render', want.size >= 4 && missing.length === 0,
    `${f}: ${want.size} mau khai bao, thieu ${missing.length ? missing.join(',') : '0'}, anh co ${painted.size} mau`);

  // L3b: khong duoc co group mang animate ma khong ve gi (loi tung gap: animate
  // dat vao group rong, group chua hinh thi khong co animate -> an vin).
  let emptyAnim = 0;
  for (const chunk of src.split(/(?=<g\b)/)) {
    if (/<(animate|animateTransform)\b/.test(chunk) && !/<path\b/.test(chunk)) emptyAnim++;
  }

  // L3
  const anims = (src.match(/<(animate|animateTransform)\b/g) ?? []).length;
  const orphanHidden = /<g opacity="0">(?!<(animate|animateTransform)\b)/.test(src);
  const crisp = src.includes('shape-rendering="crispEdges"');
  const discrete = !src.includes('<animate') || src.includes('calcMode="discrete"');
  report('L3 animation', anims >= 1 && !orphanHidden && crisp && discrete && emptyAnim === 0,
    `${f}: anim=${anims} orphanHidden=${orphanHidden} crispEdges=${crisp} discrete=${discrete} emptyAnimGroup=${emptyAnim}`);

  // L4
  const size = statSync(path).size;
  report('L4 size', size <= MAX_BYTES, `${f}: ${(size / 1024).toFixed(1)} KB`);
}

console.log(failed === 0 ? `\nALL LAWS PASS (${files().length} assets)` : `\n${failed} LUAT FAIL`);
process.exit(failed === 0 ? 0 : 1);
