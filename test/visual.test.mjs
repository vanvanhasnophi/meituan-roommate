/**
 * 设计语言自检：Chronicle 玻璃材质 + 水绿主题 + 深浅双模式。
 *
 * 重点验证四件事：
 *  1. 令牌真的生效（三灰阶、水绿 accent、玻璃半透明表面）
 *  2. 深浅两套模式的文字对比度都达到 WCAG AA
 *  3. 没有使用 glowable / scalable 效果（无发光、无 transform: scale）
 *  4. 布局与 MVP 一致（无横向溢出、侧栏/底部导航断点正确）
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ENTRY = `${BASE}/room-mate`;
const EXECUTABLE =
  process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';

let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

const browser = await chromium.launch({ executablePath: EXECUTABLE });

/** WCAG 对比度（浏览器内）；令牌值可能是 hex，先经浏览器解析成 rgb */
const CONTRAST_FN = `
  (function(){
    const parse = (c) => {
      const m = c.match(/rgba?\\(([^)]+)\\)/);
      if (!m) return null;
      const p = m[1].split(',').map((v) => parseFloat(v));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const resolve = (v) => {
      const el = document.createElement('span');
      el.style.color = v;
      document.body.appendChild(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    window.__contrast = (fgStr, bgStr) => {
      let fg = parse(resolve(fgStr));
      let bg = parse(resolve(bgStr));
      if (!fg || !bg) return null;
      if (bg.a < 1) bg = over(bg, parse(resolve('#ffffff')));
      if (fg.a < 1) fg = over(fg, bg);
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    };
  })();
`;

/* ══════════════════════════════ 浅色模式 ══════════════════════════════ */
console.log('\n[浅色模式]');
const lightCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const page = await lightCtx.newPage();
await page.goto(ENTRY, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(ENTRY, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.evaluate(CONTRAST_FN);

const light = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const body = getComputedStyle(document.body);
  const nav = document.querySelector('header');
  const card = document.querySelector('.card');
  const btn = document.querySelector('.btn-primary');
  return {
    theme: document.documentElement.getAttribute('data-theme'),
    colorScheme: cs.colorScheme,
    bgBase: v('--bg-base'),
    accent: v('--accent'),
    accentVivid: v('--accent-vivid'),
    accentBtn: v('--accent-btn'),
    bodyBg: body.backgroundColor,
    bodyImage: body.backgroundImage,
    navBackdrop: nav ? getComputedStyle(nav).backdropFilter || getComputedStyle(nav).webkitBackdropFilter : '',
    cardBg: card ? getComputedStyle(card).backgroundColor : '',
    cardShadow: card ? getComputedStyle(card).boxShadow : '',
    cardRadius: card ? getComputedStyle(card).borderRadius : '',
    btnBg: btn ? getComputedStyle(btn).backgroundColor : '',
    btnFg: btn ? getComputedStyle(btn).color : '',
    btnRadius: (() => {
      const el = document.createElement('button');
      el.className = 'btn btn-primary';
      document.body.appendChild(el);
      const r = getComputedStyle(el).borderRadius;
      el.remove();
      return r;
    })(),
    chipRadius: (() => {
      const el = document.createElement('span');
      el.className = 'chip';
      document.body.appendChild(el);
      const r = getComputedStyle(el).borderRadius;
      el.remove();
      return r;
    })(),
  };
});

check('data-theme = light（跟随系统偏好）', light.theme === 'light', light.theme);
check('color-scheme 已同步', light.colorScheme === 'light', light.colorScheme);
check('页面底色 = #f9f9f9（Chronicle 浅色 bg-base）', light.bodyBg === 'rgb(249, 249, 249)', light.bodyBg);
check('accent 已从 #7FFFD4 压暗以保证可读', light.accent !== light.accentVivid && light.accent !== '', `${light.accent} vs ${light.accentVivid}`);
check('保留品牌本色 --accent-vivid = #7fffd4', light.accentVivid === '#7fffd4', light.accentVivid);
check('存在水绿氛围底（玻璃需要背景层次）', light.bodyImage.includes('radial-gradient'), light.bodyImage.slice(0, 40));
check('导航使用毛玻璃 backdrop-filter blur', /blur\(16px\)/.test(light.navBackdrop), light.navBackdrop);
check('卡片表面为半透明（玻璃前提）', /rgba\(/.test(light.cardBg) && !/^rgb\(/.test(light.cardBg), light.cardBg);
check('卡片带顶部内高光（Chronicle glass-shadow）', light.cardShadow.includes('inset'), light.cardShadow.slice(0, 60));
check('卡片圆角 = 14px（Chronicle 流卡）', light.cardRadius === '14px', light.cardRadius);
check('主按钮圆角 = 8px（Chronicle 按钮）', light.btnRadius === '8px', light.btnRadius);
check('标签圆角 = 6px（Chronicle 标签）', light.chipRadius === '6px', light.chipRadius);

const lightContrast = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const toRgb = (x) => {
    const el = document.createElement('span');
    el.style.color = x;
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c.match(/\d+/g).map(Number);
  };
  const bodyBg = v('--canvas');
  const cardBg = v('--glass-opaque');
  return {
    ink: window.__contrast(v('--ink'), bodyBg),
    soft: window.__contrast(v('--ink-soft'), bodyBg),
    mute: window.__contrast(v('--ink-mute'), bodyBg),
    brandOnCard: window.__contrast(v('--brand-600'), cardBg),
    btn: window.__contrast(v('--accent-btn-fg'), v('--accent-btn')),
    inkRgb: toRgb(v('--ink')),
    softRgb: toRgb(v('--ink-soft')),
    muteRgb: toRgb(v('--ink-mute')),
  };
});
const isNeutral = ([r, g, b]) => r === g && g === b;
check(
  `浅色文字为纯中性色 ink=${lightContrast.inkRgb.join(',')} soft=${lightContrast.softRgb.join(',')} mute=${lightContrast.muteRgb.join(',')}`,
  isNeutral(lightContrast.inkRgb) && isNeutral(lightContrast.softRgb) && isNeutral(lightContrast.muteRgb),
  `r=g=b 才通过`,
);
check(`正文对比度 ${lightContrast.ink?.toFixed(2)}:1 ≥ 4.5`, lightContrast.ink >= 4.5);
check(`次级文字对比度 ${lightContrast.soft?.toFixed(2)}:1 ≥ 4.5`, lightContrast.soft >= 4.5);
check(`弱化文字对比度 ${lightContrast.mute?.toFixed(2)}:1 ≥ 4.5`, lightContrast.mute >= 4.5);
check(`主色文字对比度 ${lightContrast.brandOnCard?.toFixed(2)}:1 ≥ 4.5`, lightContrast.brandOnCard >= 4.5);
check(`按钮文字对比度 ${lightContrast.btn?.toFixed(2)}:1 ≥ 4.5`, lightContrast.btn >= 4.5);

await page.screenshot({ path: '/tmp/tongwu-shots/20-light-dashboard.png', fullPage: true });

/* ══════════════════════════════ 深色模式 ══════════════════════════════ */
console.log('\n[深色模式]');
await page.getByRole('button', { name: '切换到深色模式' }).click();
await page.waitForTimeout(400);

const dark = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const body = getComputedStyle(document.body);
  const card = document.querySelector('.card');
  return {
    theme: document.documentElement.getAttribute('data-theme'),
    colorScheme: cs.colorScheme,
    bgBase: v('--bg-base'),
    accent: v('--accent'),
    accentBtn: v('--accent-btn'),
    accentBtnFg: v('--accent-btn-fg'),
    bodyBg: body.backgroundColor,
    cardBg: card ? getComputedStyle(card).backgroundColor : '',
    stored: localStorage.getItem('tongwu.theme'),
  };
});
check('切换后 data-theme = dark', dark.theme === 'dark', dark.theme);
check('页面底色 = #121212（Chronicle 深色 bg-base）', dark.bodyBg === 'rgb(18, 18, 18)', dark.bodyBg);
check('深色下 accent 直接用水绿本色', dark.accent === '#7fffd4', dark.accent);
check('深色按钮 = 水绿底 + 墨绿字（白字会糊）', dark.accentBtn === '#7fffd4' && dark.accentBtnFg !== '#ffffff', `${dark.accentBtn} / ${dark.accentBtnFg}`);
check('主题选择已写入 localStorage', dark.stored === 'dark', String(dark.stored));
check('深色卡片仍为半透明玻璃', /rgba\(/.test(dark.cardBg), dark.cardBg);

const darkContrast = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const toRgb = (x) => {
    const el = document.createElement('span');
    el.style.color = x;
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c.match(/\d+/g).map(Number);
  };
  return {
    ink: window.__contrast(v('--ink'), v('--canvas')),
    soft: window.__contrast(v('--ink-soft'), v('--canvas')),
    mute: window.__contrast(v('--ink-mute'), v('--canvas')),
    brandOnCard: window.__contrast(v('--brand-600'), v('--comp-bg')),
    btn: window.__contrast(v('--accent-btn-fg'), v('--accent-btn')),
    inkRgb: toRgb(v('--ink')),
    softRgb: toRgb(v('--ink-soft')),
    muteRgb: toRgb(v('--ink-mute')),
  };
});
check(
  `深色文字为纯中性色 ink=${darkContrast.inkRgb.join(',')} soft=${darkContrast.softRgb.join(',')} mute=${darkContrast.muteRgb.join(',')}`,
  isNeutral(darkContrast.inkRgb) && isNeutral(darkContrast.softRgb) && isNeutral(darkContrast.muteRgb),
);
check(
  `深色文字对比度均为高对比（≥8:1）`,
  darkContrast.ink >= 8 && darkContrast.soft >= 8 && darkContrast.mute >= 8,
  `${darkContrast.ink.toFixed(1)}/${darkContrast.soft.toFixed(1)}/${darkContrast.mute.toFixed(1)}`,
);
check(`正文对比度 ${darkContrast.ink?.toFixed(2)}:1 ≥ 4.5`, darkContrast.ink >= 4.5);
check(`次级文字对比度 ${darkContrast.soft?.toFixed(2)}:1 ≥ 4.5`, darkContrast.soft >= 4.5);
check(`弱化文字对比度 ${darkContrast.mute?.toFixed(2)}:1 ≥ 4.5`, darkContrast.mute >= 4.5);
check(`主色文字对比度 ${darkContrast.brandOnCard?.toFixed(2)}:1 ≥ 4.5`, darkContrast.brandOnCard >= 4.5);
check(`按钮文字对比度 ${darkContrast.btn?.toFixed(2)}:1 ≥ 4.5`, darkContrast.btn >= 4.5);

await page.screenshot({ path: '/tmp/tongwu-shots/21-dark-dashboard.png', fullPage: true });
for (const [route, name] of [['expenses', '22-dark-expenses'], ['chores', '23-dark-chores'], ['supplies', '24-dark-supplies'], ['pacts', '25-dark-pacts']]) {
  await page.goto(`${ENTRY}#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `/tmp/tongwu-shots/${name}.png`, fullPage: true });
}

/* ══════════════════════════ 主题持久化 ══════════════════════════ */
console.log('\n[主题持久化与无闪白]');
await page.reload({ waitUntil: 'domcontentloaded' });
const early = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
check('刷新后首帧即为 dark（无闪白）', early === 'dark', String(early));
await page.getByRole('button', { name: '切换到浅色模式' }).click();
await page.waitForTimeout(300);
check('可切回浅色', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light');
await page.getByRole('button', { name: '切换到深色模式' }).click();
await page.waitForTimeout(300);

/* ═══════════════════ 不使用 glowable / scalable ═══════════════════ */
console.log('\n[不做发光与缩放]');
await page.goto(`${ENTRY}#/expenses`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const before = await page.evaluate(() => {
  const el = document.querySelector('.card');
  const s = getComputedStyle(el);
  return { transform: s.transform, shadow: s.boxShadow };
});
await page.locator('.card').first().hover();
await page.waitForTimeout(350);
const afterHover = await page.evaluate(() => {
  const el = document.querySelector('.card');
  const s = getComputedStyle(el);
  return { transform: s.transform, shadow: s.boxShadow };
});
check('hover 不产生 transform: scale', afterHover.transform === 'none' || afterHover.transform === before.transform, `${before.transform} → ${afterHover.transform}`);

const btnHover = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.btn, button')];
  const bad = [];
  for (const b of btns) {
    const s = getComputedStyle(b);
    if (s.transform && s.transform !== 'none' && !s.transform.startsWith('matrix(1, 0, 0, 1')) bad.push(`${b.className.slice(0, 40)}: ${s.transform}`);
  }
  return bad;
});
check('页面内没有按钮带缩放变换', btnHover.length === 0, btnHover.slice(0, 3).join(' | '));

// 发光 = box-shadow 里出现 accent 色相的彩色光晕；只允许黑白灰投影
const glow = await page.evaluate(() => {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const bad = [];
  document.querySelectorAll('.card, .btn, header, aside, nav, .chip').forEach((el) => {
    const sh = getComputedStyle(el).boxShadow;
    if (!sh || sh === 'none') return;
    // 投影里若出现明显的绿色分量（g 显著大于 r 与 b），即视为发光
    const m = sh.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g) || [];
    for (const c of m) {
      const [r, g, b] = c.match(/\d+/g).map(Number);
      if (g > r + 25 && g > b + 25 && g > 90) bad.push(`${el.className.slice(0, 30)}: ${c}`);
    }
  });
  return { bad: bad.slice(0, 3), accent };
});
check('没有彩色发光投影（只有中性灰投影）', glow.bad.length === 0, glow.bad.join(' | '));

/* ══════════════════════════════ 布局不变 ══════════════════════════════ */
console.log('\n[布局与 MVP 一致]');
const layout = await page.evaluate(() => ({
  docScrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  hasSidebar: (() => {
    const el = document.querySelector('aside');
    return el ? getComputedStyle(el).display !== 'none' : false;
  })(),
  hasBottomNav: (() => {
    const el = document.querySelector('nav.fixed');
    return el ? getComputedStyle(el).display !== 'none' : false;
  })(),
}));
check('桌面端无横向溢出', layout.docScrollWidth <= layout.innerWidth + 1, `${layout.docScrollWidth} vs ${layout.innerWidth}`);
check('桌面端保留左侧栏', layout.hasSidebar);
check('桌面端隐藏底部导航', !layout.hasBottomNav);

const overflowers = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > window.innerWidth + 2 && getComputedStyle(el).position !== 'fixed') {
      bad.push(`${el.tagName}.${String(el.className).slice(0, 50)}`);
    }
  });
  return bad.slice(0, 4);
});
check('无元素溢出视口', overflowers.length === 0, overflowers.join(' | '));

console.log('\n[移动端 390px · 深色]');
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
const m = await mobile.newPage();
await m.goto(ENTRY, { waitUntil: 'networkidle' });
await m.waitForTimeout(600);
const ml = await m.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  scrollWidth: document.documentElement.scrollWidth,
  bottomNav: !!document.querySelector('nav.fixed'),
  sidebarVisible: (() => {
    const el = document.querySelector('aside');
    return el ? getComputedStyle(el).display !== 'none' : false;
  })(),
  navButtons: document.querySelectorAll('nav.fixed button').length,
}));
check('未显式选择时跟随系统深色偏好', ml.theme === 'dark', ml.theme);
check('移动端无横向溢出', ml.scrollWidth <= 391, String(ml.scrollWidth));
check('移动端隐藏侧栏', !ml.sidebarVisible);
check('移动端保留底部导航（5 项）', ml.bottomNav && ml.navButtons === 5, String(ml.navButtons));

if (ml.scrollWidth > 391) {
  const culprits = await m.evaluate(() => {
    const bad = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width > 0 && r.right > window.innerWidth + 1 && s.position !== 'fixed') {
        bad.push(`${el.tagName}.${String(el.className).slice(0, 70)} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
      }
    });
    return bad.slice(0, 8);
  });
  console.log('    溢出元素：\n      ' + culprits.join('\n      '));
}
await m.screenshot({ path: '/tmp/tongwu-shots/26-dark-mobile.png', fullPage: true });

await browser.close();
console.log(failed === 0 ? '\n✅ 设计语言自检通过\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
