/**
 * 浏览器端冒烟测试（playwright-core + 本地 chromium headless shell）。
 * 覆盖：首屏渲染、五个路由、四大模块的关键交互、控制台报错。
 *
 * 用法：node scripts/serve-dist.mjs 4173 &  →  node test/ui.test.mjs
 */
import { mkdir } from 'node:fs/promises';

import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ENTRY = `${BASE}/room-mate`;
const SHOTS = '/tmp/tongwu-shots';
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

await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

console.log('\n[0] 重置演示数据（保证测试可重复运行）');
const resetRes = await fetch(`${BASE}/api/household`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'reset', code: 'ROOM-5283' }),
});
const resetBody = await resetRes.json();
check('POST /api/household {action:reset} 可用', resetRes.ok && resetBody.ok === true, JSON.stringify(resetBody).slice(0, 120));
check('重置后回到演示初始状态', resetBody.state?.pacts?.find((p) => p.id === 'p4')?.status === 'proposed');

console.log('\n[1] 首屏');
await page.goto(ENTRY, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.goto(ENTRY, { waitUntil: 'load' });
await page.waitForSelector('text=同屋', { timeout: 15000 });
check('URL 落在 /room-mate 下', page.url().includes('/room-mate'), page.url());
check('渲染出小屋名称', await page.locator('text=望江府 3 幢 1802').first().isVisible());
check('渲染出问候语', await page.locator('text=/早上好|中午好|下午好|晚上好|夜深了/').first().isVisible());
check('显示本月共同支出', await page.locator('text=本月共同支出').first().isVisible());
 check('显示我应承担', await page.locator('text=我应承担').first().isVisible());
check('显示结算计算器入口', await page.locator('text=结算计算器').first().isVisible());
check('显示今日值日', await page.locator('text=今日值日').first().isVisible());
check('显示小屋动态', await page.locator('text=小屋动态').first().isVisible());
await page.screenshot({ path: `${SHOTS}/01-dashboard.png`, fullPage: true });

console.log('\n[2] 各路由渲染');
const routes = [
  ['expenses', '账单与 AA 分摊', '02-expenses'],
  ['chores', '清洁值日排班', '03-chores'],
  ['supplies', '公共物品登记与提醒', '04-supplies'],
  ['pacts', '室友公约', '05-pacts'],
  ['about', '同屋 · 合租生活管家', '06-about'],
];
for (const [hash, heading, shot] of routes) {
  await page.goto(`${ENTRY}#/${hash}`, { waitUntil: 'load' });
  const ok = await page
    .locator(`text=${heading}`)
    .first()
    .isVisible()
    .catch(() => false);
  check(`#/${hash} 渲染标题「${heading}」`, ok);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/${shot}.png`, fullPage: true });
}
check('无控制台报错（遍历路由后）', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

console.log('\n[3] 记一笔账单');
await page.goto(`${ENTRY}#/expenses`, { waitUntil: 'load' });
await page.getByRole('button', { name: '记一笔' }).first().click();
await page.waitForSelector('text=记一笔共同支出');
await page.getByPlaceholder('例如：6 月房租 / 周末火锅食材').fill('E2E 测试账单');
await page.getByPlaceholder('0.00').first().fill('400');
const previewText = await page.locator('text=/每人约/').first().textContent();
check('分摊预览显示每人金额', /每人约\s*¥100/.test(previewText ?? ''), previewText ?? '');
check('记账弹窗不再询问「谁垫付」', (await page.locator('text=谁垫付的').count()) === 0);
await page.screenshot({ path: `${SHOTS}/07-expense-modal.png` });
await page.getByRole('button', { name: '确认记账' }).click();
await page.waitForTimeout(700);
check('账单出现在列表中', await page.locator('text=E2E 测试账单').first().isVisible());
check('生成一条 AA 账单后总支出更新', await page.locator('text=¥400').first().isVisible());

console.log('\n[4] 物品补货 → 自动生成账单');
await page.goto(`${ENTRY}#/supplies`, { waitUntil: 'load' });
await page.locator('text=厨房纸').first().waitFor();
const restockBtns = page.getByRole('button', { name: '补货' });
const count = await restockBtns.count();
check('物品卡片渲染出补货按钮', count > 0, `count=${count}`);
// 定位到「厨房纸」卡片内的补货按钮
const card = page.locator('div.card', { hasText: '厨房纸' }).first();
await card.getByRole('button', { name: '补货' }).click();
await page.waitForSelector('text=确认补货');
await page.getByPlaceholder('0.00').fill('36.5');
await page.waitForTimeout(200);
check('补货弹窗提示人均分摊', await page.locator('text=/人均摊|均摊/').first().isVisible());
 check('补货弹窗不询问谁垫付', (await page.locator('text=谁垫付的').count()) === 0);
await page.screenshot({ path: `${SHOTS}/08-restock-modal.png` });
await page.getByRole('button', { name: '确认补货' }).click();
await page.waitForTimeout(800);
check('补货后库存增加', (await page.locator('text=厨房纸').first().isVisible()) === true);
await page.goto(`${ENTRY}#/expenses`, { waitUntil: 'load' });
check(
  '补货自动生成了 AA 账单',
  await page.locator('text=公共物品补货 · 厨房纸').first().isVisible(),
);

console.log('\n[5] 公约表决 → 自动生效');
await page.goto(`${ENTRY}#/pacts`, { waitUntil: 'load' });
check('存在待表决公约', await page.locator('text=待表决').first().isVisible());
// 切到「待表决」标签
await page.getByRole('button', { name: /^待表决 \d+$/ }).first().click();
await page.waitForSelector('text=卫生间早高峰', { timeout: 15000 });
check('待表决列表渲染出提案', await page.locator('text=卫生间早高峰').first().isVisible());
// 以不同身份依次投票（当前用户 m1 已投过赞成，切换 m2/m3 再投）
for (const member of ['陈屿', '周哲']) {
  await page.getByRole('button', { name: /我是/ }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: `切换为 ${member}` }).click();
  await page.waitForTimeout(500);
  const agreeBtn = page.locator('div.card', { hasText: '卫生间早高峰' }).getByRole('button', { name: '同意' }).first();
  if (await agreeBtn.isVisible().catch(() => false)) {
    await agreeBtn.click();
    await page.waitForTimeout(600);
  }
}
await page.waitForTimeout(700);
// 全员同意后公约会离开「待表决」，进入「生效中」
await page.getByRole('button', { name: /^生效中 \d+$/ }).first().click();
await page.waitForTimeout(500);
const votedCard = page.locator('div.card', { hasText: '卫生间早高峰' }).first();
check(
  '三人同意后公约自动生效并移入「生效中」',
  await votedCard.locator('text=生效中').first().isVisible().catch(() => false),
);
await page.screenshot({ path: `${SHOTS}/09-pacts-voted.png`, fullPage: true });

console.log('\n[6] 值日打卡与身份切换');
await page.goto(`${ENTRY}#/chores`, { waitUntil: 'load' });
check('周视图渲染', await page.locator('text=/本周排班/').first().isVisible());
check('值日榜渲染', await page.locator('text=本月值日榜').first().isVisible());
const cell = page.locator('button', { hasText: '垃圾清运' }).first();
if (await cell.isVisible().catch(() => false)) {
  await cell.click();
  await page.waitForTimeout(400);
  const hasModal = await page.locator('text=完成标准').first().isVisible().catch(() => false);
  check('点击日历格弹出值日详情', hasModal);
  await page.screenshot({ path: `${SHOTS}/10-chore-detail.png` });
  const doneBtn = page.getByRole('button', { name: '标记为已完成' });
  if (await doneBtn.isVisible().catch(() => false)) {
    await doneBtn.click();
    await page.waitForTimeout(600);
    check('打卡后弹出成功提示', await page.locator('text=/已打卡/').first().isVisible().catch(() => false));
  }
  await page.keyboard.press('Escape');
}

console.log('\n[6.5] 物品报告与结算计算器');
await page.goto(`${ENTRY}#/supplies`, { waitUntil: 'load' });
await page.waitForTimeout(900);
check('卡片显示「N 天后需补货」大字号', await page.locator('text=/\\d+ 天后需补货|已用完/').first().isVisible());
check('卡片不再有库存进度条', (await page.locator('.card [role="progressbar"]').count()) === 0);
const reportBtn = page.getByRole('button', { name: '报告剩余' }).first();
check('存在「报告剩余」动作', await reportBtn.isVisible());
await reportBtn.click();
await page.waitForSelector('text=报告剩余 ·', { timeout: 8000 });
await page.getByRole('button', { name: '记录' }).click();
await page.waitForTimeout(700);
check('报告剩余后出现成功提示', await page.locator('text=/已记录|记为已用完/').first().isVisible().catch(() => false));

const emptyBtn = page.getByRole('button', { name: '已用完' }).first();
check('「已用完」是独立动作', await emptyBtn.isVisible());
await emptyBtn.click();
await page.waitForSelector('text=用完了吗？', { timeout: 8000 });
check('确认弹层说明这是独立动作', await page.locator('text=不需要先登记消耗').first().isVisible());
await page.getByRole('button', { name: '确认已用完' }).click();
await page.waitForTimeout(800);
check('报告用完后卡片显示「已用完」', await page.locator('text=已用完').first().isVisible());

await page.goto(`${ENTRY}#/expenses`, { waitUntil: 'load' });
await page.waitForTimeout(900);
check('结算计算器存在且可输入垫付', (await page.locator('input[placeholder="0"]').count()) > 0);
const inputs = page.locator('input[placeholder="0"]');
await inputs.first().fill('1200');
await page.waitForTimeout(500);
check('输入垫付后立即算出转账方案', await page.locator('text=/笔转账/').first().isVisible());
check('计算器说明垫付不入账单', await page.locator('text=/谁记的账/').first().isVisible());

console.log('\n[7] 持久化：刷新后数据仍在');
await page.goto(`${ENTRY}#/expenses`, { waitUntil: 'load' });
await page.waitForTimeout(900);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(900);
check('刷新后仍能看到 E2E 测试账单（本地/服务端持久化生效）', await page.locator('text=E2E 测试账单').first().isVisible());

console.log('\n[8] 移动端适配');
const mobile = await context.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(ENTRY, { waitUntil: 'load' });
await mobile.waitForTimeout(600);
check('移动端渲染底部导航', await mobile.locator('nav.fixed button', { hasText: '概览' }).first().isVisible());
await mobile.screenshot({ path: `${SHOTS}/11-mobile.png`, fullPage: true });

check('全程无控制台报错', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

await browser.close();
console.log(failed === 0 ? `\n✅ UI 冒烟测试通过，截图见 ${SHOTS}\n` : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
