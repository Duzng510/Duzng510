// Cong kiem chung README.md: `node tools/check-readme.mjs [--live]`
//
//   L4 render : day toan bo README qua GitHub Markdown API (mode=gfm), ket qua
//               khong duoc con sot thu HTML bi sanitizer cat
//   L5 anh    : moi URL anh phai la https va hoac (a) live 200 + image/* khi --live,
//               hoac (b) toi mot file co that trong assets/ (truoc khi push thi
//               raw.githubusercontent.com chua the 200, nen that la FAIL chu khong skip)
//   L6 alt    : 100% <img> co alt khong rong
//   L7 scheme : moi widget transparent phai co ca 2 bien the dark/light

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = 'https://raw.githubusercontent.com/Duzng510/Duzng510/main/';
const LIVE = process.argv.includes('--live');

let failed = 0;
const report = (law, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${law} :: ${detail}`);
  if (!ok) failed++;
};

const md = readFileSync(join(ROOT, 'README.md'), 'utf8');

// L4
const token = execSync('gh auth token', { encoding: 'utf8' }).trim();
const res = await fetch('https://api.github.com/markdown', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'User-Agent': 'check-readme' },
  body: JSON.stringify({ mode: 'gfm', text: md }),
});
const html = await res.text();
report('L4 render', res.status === 200, `markdown API ${res.status}, ${html.length} byte HTML`);

const banned = [
  ['&lt;style', 'style block bi thoai hoa thanh text'],
  ['<marquee', 'marquee bi cat'],
  ['<svg', 'svg inline bi cat'],
  ['data:image', 'data-uri bi cat src'],
  ['<font', 'font color bi cat'],
  ['bgcolor=', 'bgcolor bi cat'],
];
const leftovers = banned.filter(([needle]) => html.toLowerCase().includes(needle));
report('L4 no-stripped-html', leftovers.length === 0, leftovers.map(([n, why]) => `${n} (${why})`).join(' | ') || 'khong con sot the bi cam');

// L6
const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
const noAlt = imgs.filter((t) => !/\salt="[^"]{2,}"/.test(t));
report('L6 alt', imgs.length > 0 && noAlt.length === 0, `${imgs.length} img, thieu alt = ${noAlt.length}`);

// L5
const srcs = [...html.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/gi)].map((m) => m[1]);
const badScheme = srcs.filter((s) => !s.startsWith('https://'));
report('L5 https', badScheme.length === 0, badScheme.join(',') || `toan bo ${srcs.length} src la https`);

const localRefs = [...md.matchAll(/srcset="([^"]+)"|src="([^"]+)"/g)].flatMap((m) => [m[1], m[2]])
  .filter((u) => u && u.startsWith(RAW));
const missing = localRefs.filter((u) => !existsSync(join(ROOT, u.slice(RAW.length))));
if (LIVE) {
  const dead = [];
  for (const u of localRefs) {
    const r = await fetch(u, { method: 'HEAD' });
    if (!r.ok) dead.push(`${u} ${r.status}`);
  }
  report('L5 asset-live', localRefs.length > 0 && dead.length === 0, `${localRefs.length} asset, dead = ${dead.join(',') || 0}`);
} else {
  report('L5 asset-mapped', localRefs.length > 0 && missing.length === 0,
    `${localRefs.length} URL raw, file thieu = ${missing.length ? missing.join(',') : 0} (chua push: verify bang --live sau khi push)`);
}

// L7: moi widget phai xuat hien trong <picture> co source dark
const pictures = (md.match(/<picture>/g) ?? []).length;
const sources = (md.match(/media="\(prefers-color-scheme: dark\)"/g) ?? []).length;
const imgTags = (md.match(/<img /g) ?? []).length;
report('L7 dual-theme', pictures > 0 && sources === pictures && imgTags === pictures,
  `picture=${pictures} darkSource=${sources} img=${imgTags}`);

console.log(failed === 0 ? '\nREADME LAWS PASS' : `\n${failed} LUAT FAIL`);
process.exit(failed === 0 ? 0 : 1);
