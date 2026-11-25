// Palette pixel 8-bit. Mot nguon duy nhat: doi o day, chay `node tools/gen-assets.mjs`
// la toan bo asset trong assets/ ve theo.
//
// LIGHT khong phai "lam sang" cua DARK: giu nguyên hue, giau saturation va toi mau
// nen du tuong phan tren nen trang cua GitHub light theme.

export const ACCENTS = {
  orange: '#ef7d57',
  orangeDeep: '#a83b2a',
  cream: '#ffd9a0',
  blue: '#41c2f3',
  cyan: '#00d1ff',
  green: '#7aee4a',
};

export const DARK = {
  name: 'dark',
  bg: '#0b1020',
  panel: '#101828',
  border: '#223252',
  ink: '#d7e8ff',
  dim: '#56658f',
  orange: ACCENTS.orange,
  orangeDeep: ACCENTS.orangeDeep,
  cream: ACCENTS.cream,
  blue: ACCENTS.blue,
  cyan: ACCENTS.cyan,
  green: ACCENTS.green,
  // mau o contribution grid, thap -> cao
  levels: ['#101828', '#1b3a5c', '#00d1ff', '#41c2f3', '#7aee4a'],
};

export const LIGHT = {
  name: 'light',
  bg: '#f6f8fa',
  panel: '#ffffff',
  border: '#d0d7de',
  ink: '#24292f',
  dim: '#8c959f',
  orange: '#d9480f',
  orangeDeep: '#a83b2a',
  // #ffe8cc tan trang tren nen light, nen day la vang
  cream: '#ffc94d',
  blue: '#0969da',
  cyan: '#0969da',
  green: '#2b8a3e',
  levels: ['#ebedf0', '#abebe0', '#7ee787', '#26a641', '#388c37'],
};

export const THEMES = [DARK, LIGHT];
