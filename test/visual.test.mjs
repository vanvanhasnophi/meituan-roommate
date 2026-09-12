/**
 * 视觉与布局自检：确认 Tailwind 主题真的生效、没有横向溢出、关键元素尺寸正常。
 * 这些检查能发现「类名写错导致样式丢失」「移动端撑破布局」这类看不见的问题。
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

/* ---------------------------------------------------- 桌面端 */
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await desktop.newPage();
await page.goto(ENTRY, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
// 概览页不一定有表单控件，切到账单页做主题细节检查
await page.goto(`${ENTRY}#/expenses`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

console.log('\n[主题生效]');
const theme = await page.evaluate(() => {
  const body = getComputedStyle(document.body);
  const card = document.querySelector('.card');
  const cs = card ? getComputedStyle(card) : null;
  // 探测组件类：直接把类名挂到临时元素上，验证 Tailwind 是否真的编译出了这些规则
  const probe = (cls) => {
    const el = document.createElement('span');
    el.className = cls;
    el.textContent = 'probe';
    document.body.appendChild(el);
    const s = getComputedStyle(el);
    const out = { fontSize: s.fontSize, color: s.color, backgroundColor: s.backgroundColor, borderRadius: s.borderRadius };
    el.remove();
    return out;
  };
  return {
    bodyBg: body.backgroundColor,
    bodyColor: body.color,
    fontFamily: body.fontFamily,
    cardBg: cs?.backgroundColor,
    cardRadius: cs?.borderRadius,
    cardShadow: cs?.boxShadow,
    btn: probe('btn-primary'),
    label: probe('label'),
    chip: probe('chip'),
    field: probe('field'),
  };
});
check('body 使用主题底色 #FAF7F3', theme.bodyBg === 'rgb(250, 247, 243)', theme.bodyBg);
check('正文颜色为主题墨色', theme.bodyColor === 'rgb(36, 31, 26)', theme.bodyColor);
check('卡片为白底', theme.cardBg === 'rgb(255, 255, 255)', theme.cardBg);
check('卡片有圆角', theme.cardRadius !== '0px', theme.cardRadius);
check('卡片有阴影', theme.cardShadow !== 'none', theme.cardShadow);
check('.btn-primary 使用品牌色 #D4613A', theme.btn.backgroundColor === 'rgb(212, 97, 58)', theme.btn.backgroundColor);
check('.btn-primary 文字为白色', theme.btn.color === 'rgb(255, 255, 255)', theme.btn.color);
check('.label 字号为 13px', theme.label.fontSize === '13px', theme.label.fontSize);
check('.chip 有圆角胶囊样式', parseFloat(theme.chip.borderRadius) >= 999 || theme.chip.borderRadius.includes('9999'), theme.chip.borderRadius);
check('.field 输入框有圆角', parseFloat(theme.field.borderRadius) >= 10, theme.field.borderRadius);
check('中文字体栈包含 PingFang/微软雅黑', /PingFang|Microsoft YaHei|Noto Sans SC/.test(theme.fontFamily), theme.fontFamily);

console.log('\n[布局]');
await page.goto(ENTRY, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const layout = await page.evaluate(() => ({
  docScrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  sidebarVisible: (() => {
    const el = document.querySelector('aside');
    return el ? getComputedStyle(el).display !== 'none' : false;
  })(),
  bottomNavVisible: (() => {
    const el = document.querySelector('nav.fixed');
    return el ? getComputedStyle(el).display !== 'none' : false;
  })(),
  cardCount: document.querySelectorAll('.card').length,
  statsCount: document.querySelectorAll('.card').length,
}));
check('桌面端无横向溢出', layout.docScrollWidth <= layout.innerWidth + 1, `${layout.docScrollWidth} vs ${layout.innerWidth}`);
check('桌面端显示左侧栏', layout.sidebarVisible);
check('桌面端隐藏底部导航', !layout.bottomNavVisible);
check('概览页渲染出多个卡片', layout.cardCount >= 6, `cards=${layout.cardCount}`);

const overflowers = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > window.innerWidth + 2 && getComputedStyle(el).position !== 'fixed') {
      bad.push(`${el.tagName}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`);
    }
  });
  return bad.slice(0, 5);
});
check('没有元素超出视口右边界', overflowers.length === 0, overflowers.join(' | '));

console.log('\n[字体与可读性]');
const typo = await page.evaluate(() => {
  const h = document.querySelector('h2');
  const num = document.querySelector('.num');
  return {
    h2Size: h ? parseFloat(getComputedStyle(h).fontSize) : 0,
    h2Weight: h ? getComputedStyle(h).fontWeight : '',
    numVariant: num ? getComputedStyle(num).fontVariantNumeric : '',
  };
});
check('主标题字号 ≥ 26px', typo.h2Size >= 26, String(typo.h2Size));
check('主标题为半粗体', Number(typo.h2Weight) >= 600, typo.h2Weight);
check('数字使用等宽数字（对齐）', /tabular-nums/.test(typo.numVariant), typo.numVariant);

/* ---------------------------------------------------- 移动端 */
console.log('\n[移动端 390px]');
const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const m = await mobileCtx.newPage();
await m.goto(ENTRY, { waitUntil: 'networkidle' });
await m.waitForTimeout(600);
const ml = await m.evaluate(() => ({
  docScrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  sidebarVisible: (() => {
    const el = document.querySelector('aside');
    return el ? getComputedStyle(el).display !== 'none' : false;
  })(),
  bottomNavVisible: (() => {
    const el = document.querySelector('nav.fixed');
    return el ? getComputedStyle(el).display !== 'none' : false;
  })(),
  navButtons: document.querySelectorAll('nav.fixed button').length,
}));
check('移动端无横向溢出', ml.docScrollWidth <= ml.innerWidth + 1, `${ml.docScrollWidth} vs ${ml.innerWidth}`);
check('移动端隐藏侧栏', !ml.sidebarVisible);
check('移动端显示底部导航', ml.bottomNavVisible);
check('底部导航 5 个入口', ml.navButtons === 5, String(ml.navButtons));

const mOverflow = await m.evaluate(() => {
  const bad = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > window.innerWidth + 2 && getComputedStyle(el).position !== 'fixed') {
      bad.push(`${el.tagName}.${String(el.className).slice(0, 50)}`);
    }
  });
  return bad.slice(0, 5);
});
check('移动端无元素溢出', mOverflow.length === 0, mOverflow.join(' | '));

// 每个路由在移动端都不应溢出
for (const route of ['expenses', 'chores', 'supplies', 'pacts', 'about']) {
  await m.goto(`${ENTRY}#/${route}`, { waitUntil: 'networkidle' });
  await m.waitForTimeout(400);
  const w = await m.evaluate(() => document.documentElement.scrollWidth);
  check(`移动端 #/${route} 不溢出`, w <= 391, `${w}px`);
}

await browser.close();
console.log(failed === 0 ? '\n✅ 视觉/布局自检通过\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
