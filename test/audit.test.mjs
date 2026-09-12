/**
 * 收尾自检：移动端溢出、深色纯色底、暖色（橘色）文字残留。
 * 用法：node scripts/serve-dist.mjs 4173 &  →  node test/audit.mjs
 */
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ROUTES = ['dashboard', 'expenses', 'chores', 'supplies', 'pacts', 'about'];

let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

const browser = await chromium.launch({ executablePath: EXE });

/* ── 深色：纯色底，无渐变 ── */
console.log('\n[深色模式背景必须是纯色]');
const darkCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
const darkPage = await darkCtx.newPage();
await darkPage.goto(`${BASE}/room-mate`, { waitUntil: 'networkidle' });
await darkPage.evaluate(() => localStorage.setItem('tongwu.theme', 'dark'));
await darkPage.reload({ waitUntil: 'networkidle' });
await darkPage.waitForTimeout(500);

const darkBg = await darkPage.evaluate(() => {
  const b = getComputedStyle(document.body);
  return {
    color: b.backgroundColor,
    image: b.backgroundImage,
    wash: getComputedStyle(document.documentElement).getPropertyValue('--app-wash').trim(),
  };
});
check('深色底色 = #121212', darkBg.color === 'rgb(18, 18, 18)', darkBg.color);
check('深色不使用任何渐变背景', darkBg.image === 'none', darkBg.image);
check('--app-wash 令牌为 none', darkBg.wash === 'none', darkBg.wash);

// 全站不得出现 gradient 背景（深色下）
const gradients = await darkPage.evaluate(() => {
  const bad = [];
  document.querySelectorAll('*').forEach((el) => {
    const s = getComputedStyle(el);
    const img = s.backgroundImage;
    if (img && img !== 'none' && /gradient/.test(img) && el.getBoundingClientRect().width > 0) {
      bad.push(`${el.tagName}.${String(el.className).slice(0, 50)}`);
    }
  });
  return [...new Set(bad)].slice(0, 5);
});
check('深色下没有元素使用渐变背景', gradients.length === 0, gradients.join(' | '));

/* ── 深色：文字已改为水绿倾向，且无暖色 ── */
console.log('\n[深色文字色相]');
const inkInfo = await darkPage.evaluate(() => {
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
  return { ink: v('--ink'), inkRgb: toRgb(v('--ink')), soft: v('--ink-soft'), mute: v('--ink-mute') };
});
check(
  `深色正文为水绿倾向（绿分量 ≥ 红分量）${inkInfo.ink}`,
  inkInfo.inkRgb[1] >= inkInfo.inkRgb[0],
  JSON.stringify(inkInfo.inkRgb),
);

let warmTotal = 0;
const warmByRoute = {};
for (const route of ROUTES) {
  await darkPage.goto(`${BASE}/room-mate#/${route}`, { waitUntil: 'networkidle' });
  await darkPage.waitForTimeout(350);
  const warm = await darkPage.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach((el) => {
      if (el.children.length) return;
      const txt = (el.textContent || '').trim();
      if (!txt || txt.length > 40) return;
      const [r, g, b] = getComputedStyle(el).color.match(/\d+/g).map(Number);
      // 橘色判定：红色分量最高，且绿分量明显高于蓝分量（橘 = 红多 + 绿>蓝）
      if (r > g + 20 && g > b + 8) out.push(`${txt.slice(0, 14)}|rgb(${r},${g},${b})`);
    });
    return [...new Set(out)];
  });
  warmByRoute[route] = warm;
  warmTotal += warm.length;
}
check('全站无橘色文字（红多且绿>蓝的色相）', warmTotal === 0, JSON.stringify(warmByRoute).slice(0, 220));

/* ── 移动端溢出：深浅两模式、全路由 ── */
console.log('\n[移动端 390px 无横向溢出]');
for (const theme of ['dark', 'light']) {
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: theme })).newPage();
  for (const route of ROUTES) {
    await m.goto(`${BASE}/room-mate#/${route}`, { waitUntil: 'networkidle' });
    await m.waitForTimeout(300);
    const res = await m.evaluate(() => {
      const wide = [];
      const inScroller = (el) => {
        let n = el.parentElement;
        while (n && n !== document.body) {
          const ov = getComputedStyle(n).overflowX;
          if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') return true;
          n = n.parentElement;
        }
        return false;
      };
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 392 && getComputedStyle(el).position !== 'fixed' && !inScroller(el)) {
          wide.push(`${el.tagName}.${String(el.className).slice(0, 40)} w=${Math.round(r.width)}`);
        }
      });
      return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, wide: wide.slice(0, 3) };
    });
    check(`[${theme}] #/${route} 不溢出`, res.sw <= res.iw + 1 && res.wide.length === 0, `sw=${res.sw} iw=${res.iw} ${res.wide.join(' | ')}`);
  }
}

/* ── 桌面端仍然正常 ── */
console.log('\n[桌面端]');
await darkPage.goto(`${BASE}/room-mate`, { waitUntil: 'networkidle' });
await darkPage.waitForTimeout(400);
const desk = await darkPage.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  iw: window.innerWidth,
}));
check('桌面端无横向溢出', desk.sw <= desk.iw + 1, `${desk.sw} vs ${desk.iw}`);

await browser.close();
console.log(failed === 0 ? '\n✅ 收尾自检通过\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
