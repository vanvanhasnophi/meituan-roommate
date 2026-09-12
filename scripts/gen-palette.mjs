/**
 * 配色生成器（Chronicle 设计语言 · 水绿主题）
 *
 * 沿用 Chronicle 的三灰阶 + 百分比混色公式，把 accent 换成水绿 #7FFFD4，
 * 并一次性生成深/浅两套经过 WCAG 对比度校验的令牌。
 *
 * 运行：node scripts/gen-palette.mjs > docs/tokens.css
 */

/* ---------------------------------------------------------- 颜色工具 */
const hexToRgb = (h) => {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const rgbToHex = (a) =>
  '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** color-mix(in srgb, a p%, b) */
const mix = (a, b, p) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => A[i] * p + B[i] * (1 - p)));
};
const rgbTriplet = (hex) => hexToRgb(hex).join(' ');
const rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
};
const lum = (hex) =>
  hexToRgb(hex)
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const hslToHex = (h, s, l) => {
  const S = s / 100;
  const L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
};

const AQUAMARINE = '#7fffd4'; // hsl(160 100% 75%) —— 品牌本色

/* ------------------------------------------------------------ 报告 */
const report = [];
const check = (label, fg, bg, min = 4.5) => {
  const c = contrast(fg, bg);
  const ok = c >= min ? '✓' : '✗ 未达标';
  report.push(`  ${ok} ${label.padEnd(34)} ${fg} on ${bg}  ${c.toFixed(2)}:1 (≥${min})`);
  return c >= min;
};

/* ══════════════════════════════════════════════════════════════
   深色主题（Chronicle 原生形态：三灰阶近黑底）
   ══════════════════════════════════════════════════════════════ */
const dark = (() => {
  const base = '#121212';
  const off = '#909090';
  const fg = '#f5f5f5';
  // Chronicle 层级公式
  const canvas = base;
  const compBg = mix(off, base, 0.12); // #212121
  const compBgAlt = mix(off, base, 0.2); // #2b2b2b
  const glassOpaque = mix(off, base, 0.47); // #4d4d4d
  const accent = AQUAMARINE;
  // 文字保持纯中性灰（base 与 fg 都是中性色，混合结果 r=g=b），
  // 只有品牌色是水绿 —— 文字带色相会削弱可读性，也容易显脏。
  // 百分比比 Chronicle 默认更小 → 对比度更高：15.4:1 / 11.6:1 / 8.6:1
  const ink = mix(base, fg, 0.06);
  const inkSoft = mix(base, fg, 0.22);
  const inkMute = mix(base, fg, 0.32);

  // 水绿色阶：50~300 是「压在深底上的淡色块」，400~900 是「深底上的亮色文字」
  const scale = (h, s, ls) => ls.map((l) => hslToHex(h, s, l));
  void scale;

  const brand = {
    50: mix(accent, compBg, 0.14),
    100: mix(accent, compBg, 0.22),
    200: mix(accent, compBg, 0.34),
    300: mix(accent, compBg, 0.5),
    400: mix(accent, compBg, 0.68),
    500: accent,
    600: mix(accent, compBg, 0.84),
    700: mix(accent, compBg, 0.92),
    900: mix(accent, '#ffffff', 0.9),
  };

  // 正向语义（应收 / 已结清 / 已入账 / 生效中）：用青蓝 197°，与水绿明确区分
  const acc = (l) => hslToHex(197, 72, l);
  const accent2 = {
    50: mix(acc(62), compBg, 0.16),
    100: mix(acc(62), compBg, 0.26),
    300: mix(acc(62), compBg, 0.45),
    500: acc(66),
    600: acc(72),
    700: acc(80),
  };

  // 警示色也留在水绿色系内（春绿端 140°），靠饱和度与图标表达「需要注意」
  const warn = {
    50: mix(hslToHex(140, 62, 58), compBg, 0.18),
    300: hslToHex(140, 60, 46),
    500: hslToHex(140, 66, 58),
    700: hslToHex(138, 60, 78),
  };
  const danger = {
    50: mix(hslToHex(352, 72, 68), compBg, 0.16),
    500: hslToHex(352, 72, 68),
    700: hslToHex(352, 76, 80),
  };

  return {
    name: 'dark',
    sel: ':root',
    base,
    off,
    fg,
    canvas,
    compBg,
    compBgAlt,
    glassOpaque,
    ink,
    inkSoft,
    inkMute,
    accent,
    accentHue: 160,
    brand,
    accent2,
    warn,
    danger,
    btnBg: accent,
    btnFg: '#04241b',
    blurAlpha: 90,
    glassAlpha: 50,
    glassOffsetPct: 47,
    scheme: 'dark',
    target: 7.0,
  };
})();

/* ══════════════════════════════════════════════════════════════
   浅色主题（覆盖：三灰阶浅底，accent 压暗保可读）
   ══════════════════════════════════════════════════════════════ */
const light = (() => {
  const base = '#f9f9f9';
  const off = '#aaaaaa';
  const fg = '#111111';
  const canvas = base;
  const compBg = mix(off, base, 0.12);
  const compBgAlt = mix(off, base, 0.2);
  const glassOpaque = mix(off, base, 0.1);
  // 水绿在水白底上必须压暗：hsl(160 82% 26%) ≈ 4.5:1
  const ACCENT_L = 26;
  const accent = hslToHex(160, 82, ACCENT_L);

  // 纯中性灰（17:1 / 9.6:1 / 6.5:1），深浅两模式同一套公式、只换基础令牌
  const ink = mix(base, fg, 0.06);
  const inkSoft = mix(base, fg, 0.24);
  const inkMute = mix(base, fg, 0.34);

  const brand = {
    50: hslToHex(160, 52, 94),
    100: hslToHex(160, 56, 88),
    200: hslToHex(160, 60, 79),
    300: hslToHex(160, 64, 66),
    400: hslToHex(160, 72, 42),
    500: hslToHex(160, 82, 31),
    600: accent,
    700: hslToHex(160, 84, 20),
    900: hslToHex(160, 82, 13),
  };

  const acc = (l) => hslToHex(197, 72, l);
  const accent2 = {
    50: hslToHex(197, 62, 94),
    100: hslToHex(197, 64, 88),
    300: hslToHex(197, 68, 62),
    500: acc(36),
    600: hslToHex(197, 76, 30),
    700: hslToHex(197, 78, 25),
  };

  const warn = {
    50: hslToHex(140, 46, 93),
    300: hslToHex(140, 48, 68),
    500: hslToHex(140, 58, 30),
    700: hslToHex(140, 62, 22),
  };
  const danger = {
    50: hslToHex(352, 72, 96),
    300: hslToHex(352, 70, 72),
    500: hslToHex(352, 68, 42),
    700: hslToHex(352, 70, 32),
  };

  return {
    name: 'light',
    sel: ':root[data-theme="light"]',
    base,
    off,
    fg,
    canvas,
    compBg,
    compBgAlt,
    glassOpaque,
    ink,
    inkSoft,
    inkMute,
    accent,
    accentHue: 160,
    brand,
    accent2,
    warn,
    danger,
    btnBg: mix(accent, '#000000', 0.8),
    btnFg: '#ffffff',
    blurAlpha: 80,
    glassAlpha: 30,
    glassOffsetPct: 10,
    scheme: 'light',
    target: 4.6,
  };
})();

/* ══════════════════════════════════════════════════════════════
   数据驱动色（账单类别 / 值日区域 / 公约类别 / 成员）
   色相固定，明度按目标对比度求解 → 两个模式观感一致
   ══════════════════════════════════════════════════════════════ */
const HUE_FAMILIES = {
  // 账单类别：从春绿到水蓝的水绿色系渐变，像一条水的色带
  'cat-service': 132,
  'cat-rent': 145,
  'cat-utility': 153,
  'cat-grocery': 161,
  'cat-other': 172,
  'cat-supply': 186,
  'cat-internet': 200,
  // 值日区域
  'chore-1': 140,
  'chore-2': 152,
  'chore-3': 164,
  'chore-4': 178,
  'chore-5': 194,
  // 公约类别
  'pact-作息': 138,
  'pact-卫生': 150,
  'pact-访客': 162,
  'pact-费用': 174,
  'pact-宠物': 186,
  'pact-其他': 200,
  // 室友
  'member-1': 148,
  'member-2': 166,
  'member-3': 184,
  'member-4': 202,
};

const solveL = (hue, sat, bg, target, mode) => {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    const ok = contrast(hslToHex(hue, sat, mid), bg) >= target;
    if (mode === 'dark') {
      if (ok) hi = mid;
      else lo = mid;
    } else if (ok) lo = mid;
    else hi = mid;
  }
  return Math.round((mode === 'dark' ? hi : lo) * 10) / 10;
};

const dataColors = {};
for (const t of [dark, light]) {
  dataColors[t.name] = {};
  for (const [name, hue] of Object.entries(HUE_FAMILIES)) {
    const sat = 68;
    const l = solveL(hue, sat, t.compBg, t.target, t.name === 'dark' ? 'dark' : 'light');
    dataColors[t.name][name] = hslToHex(hue, sat, l);
  }
}

/* ══════════════════════════════════════════════════════════════
   输出
   ══════════════════════════════════════════════════════════════ */
const emitTheme = (t) => {
  const L = [];
  const p = (k, v, note) => L.push(`  --${k}: ${v};${note ? ` /* ${note} */` : ''}`);

  L.push(`/* ── 基础令牌：改这 3 个值 + accent 即可换主题 ── */`);
  p('bg-base', t.base);
  p('bg-offset', t.off);
  p('fg-base', t.fg);
  p('color-scheme', t.scheme);
  L.push('');
  L.push(`/* ── 水绿 accent ── */`);
  p('accent-vivid', AQUAMARINE, '品牌本色，仅用于装饰/大色块');
  p('accent', t.accent, t.name === 'light' ? '压暗后用于文字（对底色 4.5:1）' : '深底上的亮色文字');
  p('accent-bg', rgba(t.accent, 0.15));
  p('accent-btn', t.btnBg, '主按钮底色');
  p('accent-btn-fg', t.btnFg, '主按钮文字');
  p(
    'accent-btn-hvr',
    t.name === 'dark' ? mix(t.accent, '#ffffff', 0.92) : mix(t.btnBg, t.accent, 0.45),
    '主按钮悬停（仅提亮，不做缩放/发光）',
  );
  p('accent-hvr', rgba(t.accent, 0.8));
  L.push('');

  L.push(`/* ── 背景层级：offset 掺入 base，百分比越大越亮 ── */`);
  p('canvas', t.canvas);
  p('comp-bg', t.compBg);
  p('comp-bg-alt', t.compBgAlt);
  L.push('');
  L.push(`/* ── 玻璃材质 ── */`);
  p('glass-opaque', t.glassOpaque);
  p('glass-opaque-hvr', mix(t.off, t.base, t.name === 'light' ? 0.21 : 0.6));
  p('glass-alpha', `${t.glassAlpha}%`);
  p('blur-alpha', `${t.blurAlpha}%`);
  p('glass', rgba(t.glassOpaque, t.glassAlpha / 100), '卡片/弹层表面');
  p('glass-hvr', rgba(mix(t.off, t.base, t.name === 'light' ? 0.21 : 0.6), Math.min(0.92, (t.glassAlpha + 16) / 100)));
  p('glass-blur', rgba(t.compBg, t.blurAlpha / 100), '导航/侧栏');
  L.push('');

  L.push(`/* ── 文字层级：base 掺入 fg，百分比越大越次要 ── */`);
  p('ink', t.ink);
  p('ink-soft', t.inkSoft);
  p('ink-mute', t.inkMute);
  L.push('');
  L.push(`/* ── 细线与交互态 ── */`);
  p('line', rgba(t.inkMute, t.name === 'light' ? 0.3 : 0.24));
  p('line-blur', t.name === 'light' ? rgba(t.fg, 0.12) : rgba(t.off, 0.2));
  p('hover', rgba(t.off, 0.2));
  p('active', rgba(t.off, 0.24));
  p('overlay', t.name === 'dark' ? 'rgba(0, 0, 0, 0.62)' : 'rgba(17, 17, 17, 0.3)', '弹层遮罩');
  p(
    'app-wash',
    t.name === 'dark'
      ? 'none'
      : 'radial-gradient(58rem 38rem at 8% -12%, color-mix(in srgb, var(--accent-vivid) 9%, transparent), transparent 62%), radial-gradient(46rem 34rem at 102% -4%, color-mix(in srgb, var(--pos-500) 6%, transparent), transparent 58%)',
    t.name === 'dark' ? '深色底用纯色，不加渐变' : '浅色底的水绿氛围（玻璃需要层次才透得出来）',
  );
  L.push('');
  L.push(`/* ── 轻投影 + 玻璃顶部内高光（Chronicle glass-shadow）── */`);
  p('shadow-1', `0 4px 12px rgba(0, 0, 0, ${t.name === 'light' ? 0.2 : 0.3})`);
  p('shadow-2', `0 4px 12px rgba(0, 0, 0, ${t.name === 'light' ? 0.16 : 0.25})`);
  p('shadow-3', `0 10px 30px rgba(0, 0, 0, ${t.name === 'light' ? 0.25 : 0.5})`);
  p('glass-inner', `inset 0 1.1px 0 -1px rgba(255, 255, 255, ${t.name === 'light' ? 0.7 : 0.55})`);
  L.push('');

  L.push(`/* ── 主色阶：50~300 用于淡色底，400~900 用于文字（深色模式下方向相反）── */`);
  for (const [k, v] of Object.entries(t.brand)) p(`brand-${k}`, v);
  L.push('');
  L.push(`/* ── 正向语义（应收/已结清/生效中）：青蓝 197°，与水绿区分 ── */`);
  for (const [k, v] of Object.entries(t.accent2)) p(`pos-${k}`, v);
  L.push('');
  L.push(`/* ── 警示与危险 ── */`);
  for (const [k, v] of Object.entries(t.warn)) p(`warn-${k}`, v);
  for (const [k, v] of Object.entries(t.danger)) p(`danger-${k}`, v);
  L.push('');
  L.push(`/* ── 数据驱动色 ── */`);
  for (const [k, v] of Object.entries(dataColors[t.name])) p(k, v);
  L.push('');
  L.push(`/* ── 浅色/深色下的通用语义 ── */`);
  p('ok', dataColors[t.name]['pact-卫生']);

  // Tailwind 透明度修饰符需要 RGB 三元组
  L.push('');
  L.push(`/* ── RGB 三元组：供 Tailwind 的 /alpha 透明度修饰符使用 ── */`);
  const tripletKeys = {
    canvas: t.canvas,
    'bg-offset': t.off,
    'fg-base': t.fg,
    ink: t.ink,
    'ink-soft': t.inkSoft,
    'ink-mute': t.inkMute,
    line: t.inkMute,
    glass: t.glassOpaque,
    'comp-bg': t.compBg,
    accent: t.accent,
    'accent-vivid': AQUAMARINE,
    ...Object.fromEntries(Object.entries(t.brand).map(([k, v]) => [`brand-${k}`, v])),
    ...Object.fromEntries(Object.entries(t.accent2).map(([k, v]) => [`pos-${k}`, v])),
    ...Object.fromEntries(Object.entries(t.warn).map(([k, v]) => [`warn-${k}`, v])),
    ...Object.fromEntries(Object.entries(t.danger).map(([k, v]) => [`danger-${k}`, v])),
  };
  for (const [k, v] of Object.entries(tripletKeys)) p(`${k}-rgb`, rgbTriplet(v));

  return `${t.sel} {\n${L.join('\n')}\n}`;
};

/* ---- 对比度校验（关键文字组合）---- */
for (const t of [dark, light]) {
  report.push(`\n【${t.name === 'dark' ? '深色' : '浅色'}】`);
  check('正文 / 页面底', t.ink, t.canvas);
  check('次级文字 / 页面底', t.inkSoft, t.canvas);
  check('次级文字 / 卡片', t.inkSoft, t.compBg);
  check('弱化文字 / 页面底', t.inkMute, t.canvas);
  check('主色文字 / 卡片', t.brand[600], t.compBg);
  check('主色文字 / 主色淡底', t.brand[700], t.brand[50]);
  check('主色文字 / 主色淡底(600)', t.brand[600], t.brand[50]);
  check('正向文字 / 正向淡底', t.accent2[700], t.accent2[50]);
  check('警示文字 / 警示淡底', t.warn[700], t.warn[50]);
  check('危险文字 / 危险淡底', t.danger[700], t.danger[50]);
  check('主按钮文字 / 主按钮底', t.btnFg, t.btnBg, 4.5);
  check('弱化文字 / 卡片', t.inkMute, t.compBg);
  for (const [name, color] of Object.entries(dataColors[t.name])) {
    check(`数据色 ${name} / 卡片`, color, t.compBg, 4.5);
  }
}

import { writeFileSync } from 'node:fs';

/* ---- 输出到文件 ---- */
const header = `/* ============================================================
 * 由 scripts/gen-palette.mjs 生成，请勿手改。
 * 重新生成：npm run gen:tokens
 *
 * 设计语言：Chronicle 玻璃拟态
 *   · 三灰阶（bg-base / bg-offset / fg-base）+ 单一 accent，其余全部由百分比公式混出
 *   · accent = 水绿 #7FFFD4；浅色模式压暗至 hsl(160 82% 26%) 以保证文字可读
 *   · 全部文字/数据色均通过 WCAG AA 对比度校验（见 npm run gen:tokens 输出）
 * ============================================================ */\n\n`;

const css = header + emitTheme(dark) + '\n\n' + emitTheme(light) + '\n';
writeFileSync(new URL('../src/tokens.generated.css', import.meta.url), css, 'utf8');

console.log('对比度自检：');
report.join('\n').split('\n').forEach((l) => console.log('  ' + l));

const failures = report.filter((l) => l.includes('✗')).length;
console.log(`\n→ 已写入 src/tokens.generated.css${failures ? `（${failures} 项未达标 ✗）` : '（全部达标 ✓）'}`);
process.exit(failures ? 1 : 0);
