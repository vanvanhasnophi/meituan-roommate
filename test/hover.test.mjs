/**
 * hover 反馈审计：逐个找出带 hover: 类的真实元素，
 * 比对 hover 前后的 computed 样式，统计「悬停后毫无变化」的元素。
 *
 * 用法：npm run serve:dist  →  node test/hover.test.mjs
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const EXE =
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

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const page = await ctx.newPage();

const ROUTES = ['dashboard', 'expenses', 'chores', 'supplies', 'pacts'];
const PROPS = ['backgroundColor', 'borderTopColor', 'color', 'boxShadow', 'opacity'];

console.log('\n[逐个 hover 元素实测]');
const noFeedback = [];

for (const route of ROUTES) {
  await page.goto(`${BASE}/room-mate#/${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const handles = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach((el, i) => {
      const cls = String(el.className || '');
      if (!/\bhover:/.test(cls)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      el.setAttribute('data-hover-probe', String(i));
      // group-hover 类要悬停祖先 .group，而不是元素自身
      const isGroup = /group-hover:/.test(cls);
      out.push({ i, tag: el.tagName, cls: cls.slice(0, 60), isGroup });
    });
    return out;
  });

  for (const info of handles) {
    const sel = `[data-hover-probe="${info.i}"]`;
    const loc = page.locator(sel);
    if ((await loc.count()) === 0) continue;
    // group-hover 的生效条件是悬停祖先
    const target = info.isGroup ? page.locator(`${sel} >> xpath=ancestor::*[contains(@class,"group")][1]`) : loc;
    const useTarget = (await target.count()) > 0 ? target : loc;
    const measure = () =>
      loc.evaluate((el, props) => {
        const s = getComputedStyle(el);
        return Object.fromEntries(props.map((p) => [p, s[p]]));
      }, PROPS);

    await page.mouse.move(5, 5);
    await page.waitForTimeout(80);
    const before = await measure();
    await useTarget.first().hover({ force: true }).catch(() => {});
    await page.waitForTimeout(220);
    const after = await measure();
    const changed = PROPS.filter((p) => before[p] !== after[p]);
    // 桌面断点下 sm:opacity-100 已经生效，group-hover 自然不再产生变化 —— 这是对的，跳过
    const alreadyApplied = info.cls.includes('group-hover:opacity-100') && before.opacity === '1';
    if (changed.length === 0 && !alreadyApplied) {
      noFeedback.push(`#/${route}  <${info.tag}> ${info.cls}${info.isGroup ? ' [group]' : ''}`);
    }
    await page.mouse.move(5, 5);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() =>
    document.querySelectorAll('[data-hover-probe]').forEach((e) => e.removeAttribute('data-hover-probe')),
  );
}

check(
  `所有带 hover: 类的元素在悬停后都产生了变化（共扫描 ${ROUTES.length} 个路由）`,
  noFeedback.length === 0,
  `\n      ${noFeedback.slice(0, 10).join('\n      ')}`,
);

/* ── 灰色 hover 的强度是否可见 ── */
console.log('\n[hover 强度实测]');
await page.goto(`${BASE}/room-mate#/expenses`, { waitUntil: 'load' });
await page.waitForTimeout(900);
const sel = 'button.hover\\:bg-neutral-tint\\/25';
const count = await page.locator(sel).count();
check('找到使用中性 hover 的元素', count > 0, String(count));
if (count > 0) {
  const el = page.locator(sel).first();
  const rest = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
  await el.hover({ force: true });
  await page.waitForTimeout(300);
  const hov = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
  const alpha = Number((hov.match(/,\s*([\d.]+)\)$/) ?? [0, '1'])[1]);
  console.log(`      ${rest} → ${hov}`);
  check('hover 后 alpha = 0.25', Math.abs(alpha - 0.25) < 0.001, String(alpha));
  check('hover 前后确实不同', rest !== hov);
}

/* ── 玻璃卡片是否具备悬停升档（Chronicle .mtl-surface.interactive）── */
console.log('\n[可交互卡片的 hover 升档]');
await page.goto(`${BASE}/room-mate#/supplies`, { waitUntil: 'load' });
await page.waitForTimeout(900);

const cardHover = await page.evaluate(() => {
  const el = document.querySelector('.card.interactive');
  return el
    ? { found: true, shadow: getComputedStyle(el).boxShadow, bg: getComputedStyle(el).backgroundColor }
    : { found: false };
});
check('.interactive 已挂到卡片上（不再是无用代码）', cardHover.found, JSON.stringify(cardHover));

if (cardHover.found) {
  const card = page.locator('.card.interactive').first();
  const rest = await card.evaluate((e) => {
    const s = getComputedStyle(e);
    return { bg: s.backgroundColor, shadow: s.boxShadow };
  });
  await card.hover({ force: true });
  await page.waitForTimeout(350);
  const hov = await card.evaluate((e) => {
    const s = getComputedStyle(e);
    return { bg: s.backgroundColor, shadow: s.boxShadow };
  });
  console.log(`      背景 ${rest.bg} → ${hov.bg}`);
  console.log(`      投影 ${rest.shadow.slice(0, 46)}… → ${hov.shadow.slice(0, 46)}…`);
  check('悬停后卡片底色提亮', rest.bg !== hov.bg);
  check('悬停后投影升档', rest.shadow !== hov.shadow);
}

/* ── 列表行的 hover ── */
console.log('\n[列表行 hover]');
const rowCount = await page.locator('.row').count();
check('.row 元素存在', rowCount > 0, String(rowCount));
if (rowCount > 0) {
  const row = page.locator('.row').first();
  const rest = await row.evaluate((e) => getComputedStyle(e).backgroundColor);
  await row.hover({ force: true });
  await page.waitForTimeout(350);
  const hov = await row.evaluate((e) => getComputedStyle(e).backgroundColor);
  console.log(`      ${rest} → ${hov}`);
  check('悬停后行底色提亮', rest !== hov);
}

await browser.close();
console.log(failed === 0 ? '\n✅ hover 审计通过\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
