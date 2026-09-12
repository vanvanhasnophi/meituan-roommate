/**
 * 主题切换实况验证：在**同一个页面**里点击切换按钮，
 * 逐个比对真实元素的 computed 颜色是否随变量翻转。
 *
 * 这能区分两种情况：
 *   A. 变量生效   → 切换后真实元素颜色变化，且等于浅/深两套令牌的预期值
 *   B. 变量未生效 → 切换后颜色不变（说明样式里是硬编码，或令牌没加载）
 *
 * 用法：npm run serve:dist  →  npm run test:theme
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
await page.goto(`${BASE}/room-mate`, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1200);

/** 采样一批真实元素 + 探测类的 computed 颜色 */
const sample = () =>
  page.evaluate(() => {
    const probe = (cls) => {
      const el = document.createElement('span');
      el.className = cls;
      el.textContent = 'x';
      document.body.appendChild(el);
      const s = getComputedStyle(el);
      const out = { color: s.color, bg: s.backgroundColor, border: s.borderColor };
      el.remove();
      return out;
    };
    // 页面上真实存在的元素
    const realMute = document.querySelector('.text-ink-mute');
    const realCard = document.querySelector('.card');
    const realBtn = document.querySelector('.btn-primary');
    const cs = getComputedStyle(document.documentElement);
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      realMute: realMute ? getComputedStyle(realMute).color : null,
      realMuteText: realMute ? realMute.textContent.trim().slice(0, 14) : null,
      realCardBg: realCard ? getComputedStyle(realCard).backgroundColor : null,
      realBtnBg: realBtn ? getComputedStyle(realBtn).backgroundColor : null,
      realBtnFg: realBtn ? getComputedStyle(realBtn).color : null,
      probeInk: probe('text-ink'),
      probeSoft: probe('text-ink-soft'),
      probeMute: probe('text-ink-mute'),
      probeBrandBg: probe('bg-brand-50'),
      probeLine: probe('border-line'),
      // 主按钮不一定出现在概览页（取决于待办状态），用探测元素保证确定性
      probeBtn: probe('btn btn-primary'),
      vars: {
        inkRgb: cs.getPropertyValue('--ink-rgb').trim(),
        inkSoftRgb: cs.getPropertyValue('--ink-soft-rgb').trim(),
        inkMuteRgb: cs.getPropertyValue('--ink-mute-rgb').trim(),
        brand50Rgb: cs.getPropertyValue('--brand-50-rgb').trim(),
        brand600Rgb: cs.getPropertyValue('--brand-600-rgb').trim(),
        lineRgb: cs.getPropertyValue('--line-rgb').trim(),
        accentBtn: cs.getPropertyValue('--accent-btn').trim(),
      },
    };
  });

const show = (label, s) => {
  console.log(`\n┌─ ${label}（data-theme=${s.theme}）`);
  console.log(`│ 变量   --ink-rgb=${s.vars.inkRgb}  --brand-50-rgb=${s.vars.brand50Rgb}  --line-rgb=${s.vars.lineRgb}`);
  console.log(`│ 真实元素  .text-ink-mute → ${s.realMute}   「${s.realMuteText}」`);
  console.log(`│          .card 背景      → ${s.realCardBg}`);
  console.log(`│          .btn-primary    → 底 ${s.realBtnBg} / 字 ${s.realBtnFg}`);
  console.log(`│          body 背景        → ${s.bodyBg}`);
  console.log(`│ 探测类   text-ink=${s.probeInk.color}`);
  console.log(`│          text-ink-soft=${s.probeSoft.color}`);
  console.log(`│          text-ink-mute=${s.probeMute.color}`);
  console.log(`│          bg-brand-50=${s.probeBrandBg.bg}`);
  console.log(`└─`);
};

console.log('\n[1] 浅色模式采样');
const light = await sample();
show('浅色', light);

check('令牌已定义（--ink-rgb 非空）', light.vars.inkRgb !== '', `"${light.vars.inkRgb}"`);
check('浅色 text-ink 解析为变量值', light.probeInk.color === 'rgb(31, 31, 31)', light.probeInk.color);
check('浅色 text-ink-mute 解析为变量值', light.probeMute.color === 'rgb(96, 96, 96)', light.probeMute.color);
check('浅色 bg-brand-50 解析为变量值', light.probeBrandBg.bg === 'rgb(232, 248, 242)', light.probeBrandBg.bg);
check('页面上的真实元素也吃到了令牌', light.realMute !== null && light.realMute !== 'rgb(0, 0, 0)', String(light.realMute));

console.log('\n[2] 点击切换按钮 → 深色');
await page.getByRole('button', { name: '切换到深色模式' }).click();
await page.waitForTimeout(700);
const dark = await sample();
show('深色', dark);

check('切换后 data-theme=dark', dark.theme === 'dark', dark.theme);
check('变量已翻转 --ink-rgb', dark.vars.inkRgb === '231 231 231', dark.vars.inkRgb);
check('深色 text-ink 解析为新值', dark.probeInk.color === 'rgb(231, 231, 231)', dark.probeInk.color);
check('深色 text-ink-mute 解析为新值', dark.probeMute.color === 'rgb(172, 172, 172)', dark.probeMute.color);
check('深色 bg-brand-50 解析为新值', dark.probeBrandBg.bg === 'rgb(46, 64, 58)', dark.probeBrandBg.bg);

console.log('\n[3] 真实元素确实随主题改变（这才是「变量生效」的铁证）');
check(`页面真实文字颜色变化  ${light.realMute} → ${dark.realMute}`, light.realMute !== dark.realMute);
check(`卡片背景变化          ${light.realCardBg} → ${dark.realCardBg}`, light.realCardBg !== dark.realCardBg);
check(`body 背景变化         ${light.bodyBg} → ${dark.bodyBg}`, light.bodyBg !== dark.bodyBg);
check(
  `主按钮配色变化        ${light.probeBtn.bg} → ${dark.probeBtn.bg}`,
  light.probeBtn.bg === 'rgb(10, 97, 67)' && dark.probeBtn.bg === 'rgb(127, 255, 212)',
  '（水绿主题的关键：浅色压暗、深色用本色，两套都从 --accent-btn 来）',
);

console.log('\n[4] 每个变量都必须在深浅两套里都有定义');
const coverage = await page.evaluate(() => {
  const wanted = [
    'ink-rgb', 'ink-soft-rgb', 'ink-mute-rgb', 'line-rgb', 'canvas-rgb',
    'brand-50-rgb', 'brand-100-rgb', 'brand-200-rgb', 'brand-300-rgb', 'brand-500-rgb',
    'brand-600-rgb', 'brand-700-rgb', 'brand-900-rgb',
    'pos-50-rgb', 'pos-600-rgb', 'pos-700-rgb',
    'warn-50-rgb', 'warn-700-rgb', 'danger-50-rgb', 'danger-500-rgb',
    'glass-rgb', 'comp-bg-rgb',
  ];
  const html = document.documentElement;
  const readBoth = () => {
    const out = {};
    const prev = html.getAttribute('data-theme');
    for (const t of ['light', 'dark']) {
      html.setAttribute('data-theme', t);
      const cs = getComputedStyle(html);
      out[t] = Object.fromEntries(wanted.map((w) => [w, cs.getPropertyValue(`--${w}`).trim()]));
    }
    html.setAttribute('data-theme', prev);
    return out;
  };
  const both = readBoth();
  const missing = [];
  const same = [];
  for (const w of wanted) {
    if (!both.light[w] || !both.dark[w]) missing.push(w);
    else if (both.light[w] === both.dark[w]) same.push(w);
  }
  return { missing, same, both };
});
check('没有缺失的变量', coverage.missing.length === 0, coverage.missing.join(', '));
check('每个变量在深/浅两套里的值都不同（真的会翻转）', coverage.same.length === 0, coverage.same.join(', '));

await browser.close();
console.log(failed === 0 ? '\n✅ 变量在运行时确实生效，且随主题翻转\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
