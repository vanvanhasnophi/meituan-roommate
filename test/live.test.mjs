/**
 * 线上站点实况检查：直接打开线上 URL，读取真实计算后的文字颜色，
 * 判断线上到底跑的是新版（动态变量）还是旧版（硬编码暖色）。
 */
import { chromium } from 'playwright-core';

// 默认只测本地（先跑 npm run serve:dist）；需要测线上时传 TARGET=https://...
const URL_ = process.env.TARGET || 'http://localhost:4173/room-mate';
const EXE =
  process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';

const OLD = { '241F1A': [36, 31, 26], '5C534A': [92, 83, 74], '8B8078': [139, 128, 120] };

const browser = await chromium.launch({ executablePath: EXE });

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    const probe = (cls) => {
      const el = document.createElement('span');
      el.className = cls;
      document.body.appendChild(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    };
    const body = getComputedStyle(document.body);
    return {
      title: document.title,
      theme: document.documentElement.getAttribute('data-theme'),
      ink: v('--ink'),
      inkSoft: v('--ink-soft'),
      inkMute: v('--ink-mute'),
      inkRgb: v('--ink-rgb'),
      inkSoftRgb: v('--ink-soft-rgb'),
      inkMuteRgb: v('--ink-mute-rgb'),
      textInk: probe('text-ink'),
      textSoft: probe('text-ink-soft'),
      textMute: probe('text-ink-mute'),
      bodyBg: body.backgroundColor,
      bodyImage: body.backgroundImage,
      hasThemeToggle: !!document.querySelector('button[aria-label*="浅色"], button[aria-label*="深色"]'),
    };
  });

  console.log(`\n┌─ ${URL_} [${scheme}] ─────────────────`);
  console.log(`│ 标题          ${info.title}`);
  console.log(`│ data-theme    ${info.theme}`);
  console.log(`│ 页面底色      ${info.bodyBg}   背景图 ${info.bodyImage.slice(0, 24)}`);
  console.log(`│ 主题切换按钮  ${info.hasThemeToggle ? '有 ✓' : '无 ✗'}`);
  console.log(`│ --ink         ${info.ink.padEnd(9)} rgb三元组 ${info.inkRgb}`);
  console.log(`│ --ink-soft    ${info.inkSoft.padEnd(9)} rgb三元组 ${info.inkSoftRgb}`);
  console.log(`│ --ink-mute    ${info.inkMute.padEnd(9)} rgb三元组 ${info.inkMuteRgb}`);

  const hits = [];
  for (const [name, [r, g, b]] of Object.entries(OLD)) {
    for (const [k, val] of [['text-ink', info.textInk], ['text-ink-soft', info.textSoft], ['text-ink-mute', info.textMute]]) {
      const m = val.match(/\d+/g)?.map(Number);
      if (m && m[0] === r && m[1] === g && m[2] === b) hits.push(`${k} = 旧色 #${name}`);
    }
  }
  console.log(`│ 实际渲染      text-ink ${info.textInk}`);
  console.log(`│               text-ink-soft ${info.textSoft}`);
  console.log(`│               text-ink-mute ${info.textMute}`);
  console.log(`└─ 命中旧色    ${hits.length ? '❌ ' + hits.join(', ') : '0 处 ✓ 全部为动态变量'}`);

  await ctx.close();
}

await browser.close();
