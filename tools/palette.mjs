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

// ---------------------------------------------------------------- 4 mua
// Thu tu vong lap = mot nam. Hero/scene doi mau theo cac bo nay; chu van theo
// DARK/LIGHT o tren vi khung HTML cua README giu nguyen.
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

// Mapping thang duong lich -> mua (Bac ban cau, khi hau): 3-5 xuan, 6-8 ha,
// 9-11 thu, 12/1/2 dong. Dung cho dai contribution (doc date that).
export function monthSeason(month /* 1-12 */) {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// Moi mua mot bo mau canh. LIGHT = ban ngay ro, DAM = ban dem/hon suong.
// Khoa mau dung chung trong gen-assets: skyTop/skyLo = dai tro (2 net),
// sun = mat trang/troi, hillFar/hill = doi, ground/groundDeep = dat,
// canopy/canopyHi/canopyLo = tan la, trunk/branch = than/nganh,
// particle = hat bay, accent = manh vang khoac, glow = diem sang,
// text/line = chu va vien tren nen tro.
export const SCENES = {
  dark: {
    spring: {
      skyTop: '#141a35', skyLo: '#39305f', sun: '#ffe0a3',
      hillFar: '#2a3157', hill: '#274d3f', ground: '#2c6f4f', groundDeep: '#1a4531',
      canopy: '#e88bb6', canopyHi: '#ffd0e2', canopyLo: '#b85c88',
      trunk: '#6b4a33', branch: '#8a6247', particle: '#ffd7e8', accent: '#ff8fb8',
      glow: '#ffe1f0', text: '#fbeaff', line: '#5a4b73',
    },
    summer: {
      skyTop: '#0a1f44', skyLo: '#1f4f8f', sun: '#ffdd55',
      hillFar: '#223a6a', hill: '#1f5c3f', ground: '#2f8f57', groundDeep: '#1a5c39',
      canopy: '#3fbf5f', canopyHi: '#7aee8a', canopyLo: '#1f7a3f',
      trunk: '#6b4a33', branch: '#8a6247', particle: '#fff2a6', accent: '#ffd54f',
      glow: '#fff6b0', text: '#e8f4ff', line: '#2f4a6b',
    },
    autumn: {
      skyTop: '#1a1230', skyLo: '#5c2f22', sun: '#ffb347',
      hillFar: '#3a2f4d', hill: '#4d3326', ground: '#6f4a2c', groundDeep: '#4a2f1c',
      canopy: '#ef7d57', canopyHi: '#ffb347', canopyLo: '#a83b2a',
      trunk: '#5c4030', branch: '#7a5740', particle: '#ff9d4d', accent: '#d9480f',
      glow: '#ffd9a0', text: '#ffe6d0', line: '#6b4b3a',
    },
    winter: {
      skyTop: '#0d1424', skyLo: '#2f3f5c', sun: '#c2d4e6',
      hillFar: '#26324a', hill: '#3b4a63', ground: '#5c6f8a', groundDeep: '#3b4a63',
      canopy: '#8fa3bf', canopyHi: '#c2d4e6', canopyLo: '#5c6f8a',
      trunk: '#4a3d36', branch: '#6b5a4d', particle: '#e8f2ff', accent: '#e05a5a',
      glow: '#ffffff', text: '#e8f2ff', line: '#3b4a63',
    },
  },
  light: {
    spring: {
      skyTop: '#bfe3ff', skyLo: '#e8f7ff', sun: '#ffd54f',
      hillFar: '#a8d8b0', hill: '#7fbf8a', ground: '#7aee4a', groundDeep: '#4caf50',
      canopy: '#f9a8d4', canopyHi: '#ffd0e2', canopyLo: '#ec6ba7',
      trunk: '#8a6247', branch: '#a8785a', particle: '#ffc2dc', accent: '#e0559a',
      glow: '#fff0f7', text: '#5a3d5c', line: '#d9a7c4',
    },
    summer: {
      skyTop: '#5aaef0', skyLo: '#bfe3ff', sun: '#ffcc33',
      hillFar: '#6fbf8a', hill: '#4caf50', ground: '#56c46a', groundDeep: '#2f8f43',
      canopy: '#2b8a3e', canopyHi: '#56c46a', canopyLo: '#1b5e2a',
      trunk: '#8a6247', branch: '#a8785a', particle: '#fff2a6', accent: '#d9480f',
      glow: '#ffe066', text: '#1f4d2e', line: '#4caf50',
    },
    autumn: {
      skyTop: '#ffd9a0', skyLo: '#ffe8cc', sun: '#ff8f00',
      hillFar: '#d9a76a', hill: '#b5772e', ground: '#c98a3a', groundDeep: '#8b5a2a',
      canopy: '#d9480f', canopyHi: '#ff8f00', canopyLo: '#a83b2a',
      trunk: '#6b4a33', branch: '#8a6247', particle: '#ef7d57', accent: '#a83b2a',
      glow: '#ffd9a0', text: '#5a2f1c', line: '#d9a76a',
    },
    winter: {
      skyTop: '#c2d4e6', skyLo: '#e8f2ff', sun: '#e0ebf5',
      hillFar: '#a8bccc', hill: '#8fa3bf', ground: '#c2d4e6', groundDeep: '#8fa3bf',
      canopy: '#b0c4d6', canopyHi: '#e8f2ff', canopyLo: '#8fa3bf',
      trunk: '#5c4d44', branch: '#7a6a5c', particle: '#ffffff', accent: '#c0392b',
      glow: '#ffffff', text: '#2f3f52', line: '#8fa3bf',
    },
  },
};
