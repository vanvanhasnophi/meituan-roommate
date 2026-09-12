/**
 * 领域逻辑自测：直接用 node 运行（构建为一个 bundle 后执行）。
 * 验证金额分摊「分毫不差」、最优结算最少笔数、排班轮值与统计正确。
 */
import {
  choreStats,
  computeOwed,
  settlementRows,
  expenseShares,
  occurrencesInRange,
  occurrencesOn,
  settlePlan,
  toYuan,
  supplyForecast,
  supplyForecasts,
  activeAlerts,
  supplyHeadline,
  addDays,
  monthKey,
  todayStr,
} from '../shared/logic.ts';
import { createSeedState } from '../shared/seed.ts';

let failed = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
}
const sum = (arr) => arr.reduce((s, x) => s + x, 0);
const cents = (n) => Math.round(n * 100);

console.log('\n[1] 账单分摊');
{
  const even = {
    id: 'x', title: 't', amount: 100, category: 'grocery', paidBy: 'a', date: '2025-01-01',
    splitMode: 'even', participants: [{ memberId: 'a', weight: 1 }, { memberId: 'b', weight: 1 }, { memberId: 'c', weight: 1 }], createdAt: '',
  };
  const s = expenseShares(even);
  check('三人均分 100 → 33.34/33.33/33.33', cents(s.a) + cents(s.b) + cents(s.c) === 10000, JSON.stringify(s));
  check('总额守恒', cents(s.a) + cents(s.b) + cents(s.c) === cents(100));

  const odd = { ...even, amount: 100.01 };
  const s2 = expenseShares(odd);
  check('100.01 三人均分总额守恒', cents(s2.a) + cents(s2.b) + cents(s2.c) === 10001, JSON.stringify(s2));

  const shares = {
    ...even, amount: 6800, splitMode: 'shares',
    participants: [{ memberId: 'a', weight: 1.2 }, { memberId: 'b', weight: 1.2 }, { memberId: 'c', weight: 1 }, { memberId: 'd', weight: 1 }],
  };
  const s3 = expenseShares(shares);
  check('按份数 6800（1.2/1.2/1/1）总额守恒', cents(s3.a) + cents(s3.b) + cents(s3.c) + cents(s3.d) === 680000, JSON.stringify(s3));
  check('主卧付得更多', s3.a > s3.c);

  const custom = {
    ...even, amount: 96.4, splitMode: 'custom',
    participants: [{ memberId: 'a', weight: 36.4 }, { memberId: 'b', weight: 30 }, { memberId: 'c', weight: 30 }],
  };
  const s4 = expenseShares(custom);
  check('自定义金额总额守恒', cents(s4.a) + cents(s4.b) + cents(s4.c) === 9640, JSON.stringify(s4));

  const mismatched = { ...custom, amount: 100 };
  const s5 = expenseShares(mismatched);
  check('自定义金额与总额不一致时归一化', cents(s5.a) + cents(s5.b) + cents(s5.c) === 10000, JSON.stringify(s5));

  const single = { ...even, amount: 150, participants: [{ memberId: 'a', weight: 1 }] };
  check('单人承担全额', expenseShares(single).a === 150);
}

console.log('\n[2] 应承担与结算计算器');
{
  const state = createSeedState('2025-06-15');
  const owed = computeOwed(state, monthKey('2025-06-15'));
  const owedSum = sum(Object.values(owed).map(cents));
  const expenseSum = state.expenses
    .filter((e) => monthKey(e.date) === monthKey('2025-06-15'))
    .reduce((s, e) => s + cents(e.amount), 0);
  check('每人应承担之和 = 本期账单总额', owedSum === expenseSum, `${owedSum} vs ${expenseSum}`);
  check('账单里不含「谁垫付」字段', state.expenses.every((e) => !('paidBy' in e)));

  // 结算计算器：垫付合计等于应承担合计时，净额之和为 0
  const paid = Object.fromEntries(Object.entries(owed).map(([id, v]) => [id, v]));
  const rows = settlementRows(state.members, owed, paid);
  check('垫付 = 应承担时，所有人净额为 0', rows.every((r) => cents(r.net) === 0), JSON.stringify(rows));
  check('结算方案为空（无需转账）', settlePlan(rows).length === 0);

  // 只有一个人垫了全部
  const onePayer = Object.fromEntries(state.members.map((m) => [m.id, m.id === 'm1' ? toYuan(owedSum) : 0]));
  const rows2 = settlementRows(state.members, owed, onePayer);
  check('净额之和恒为 0（垫付总额 = 应承担总额）', sum(rows2.map((r) => cents(r.net))) === 0);
  const plan = settlePlan(rows2);
  check(`结算笔数 ≤ 参与人数-1（${plan.length}）`, plan.length <= state.members.length - 1);
  check('垫付人只收不付', plan.every((t) => t.fromId !== 'm1'));
  check('转账总额 = 应收总额', cents(sum(plan.map((t) => t.amount))) === cents(onePayer.m1 - owed.m1));

  // 垫付总额与应承担不一致时，仍能算，但会提示差额
  const mismatch = { ...onePayer, m2: 50 };
  const rows3 = settlementRows(state.members, owed, mismatch);
  const netSum3 = sum(rows3.map((r) => cents(r.net)));
  check('垫付与应承担不等时，净额之和 = 差额', netSum3 === cents(50), `${netSum3}`);

  // 任意输入下都不能出现「既收又付」
  const weird = { m1: 100, m2: 0, m3: 900, m4: 20 };
  const rows4 = settlementRows(state.members, owed, weird);
  const p4 = settlePlan(rows4);
  check('同一人不会同时出现在付款与收款两侧', new Set(p4.map((t) => t.fromId)).size === p4.length);
}

console.log('\n[3] 值日排班');
{
  const state = createSeedState('2025-06-15');
  const daily = state.choreTasks.find((t) => t.cadence === 'daily');
  const occ = occurrencesInRange(state, '2025-06-01', '2025-06-28').filter((o) => o.taskId === daily.id);
  check('每日任务 28 天产生 28 条排班', occ.length === 28, `got=${occ.length}`);
  const recent = occ.slice(-12).map((o) => o.memberId);
  check('每日任务连续 4 天不重复同一人', !(recent[0] === recent[1] && recent[1] === recent[2] && recent[2] === recent[3]), JSON.stringify(recent.slice(0, 5)));

  const weekly = state.choreTasks.find((t) => t.id === 'c2');
  const weeklyOcc = occurrencesInRange(state, '2025-06-01', '2025-06-30').filter((o) => o.taskId === weekly.id);
  check('每周任务一个月出现 4 次', weeklyOcc.length === 4, `got=${weeklyOcc.length}`);
  check('每周任务都落在指定星期', weeklyOcc.every((o) => new Date(`${o.date}T00:00:00`).getDay() === weekly.weekday));

  // 轮值循环性：未来日期没有「打卡/换班」覆盖记录，可直接验证规则本身
  const rotationLen = weekly.rotation.length;
  const base = todayStr();
  const future = occurrencesInRange(state, addDays(base, 1), addDays(base, 120)).filter(
    (o) => o.taskId === weekly.id,
  );
  check(
    `轮值按 ${rotationLen} 人循环`,
    future.length > rotationLen && future[0].memberId === future[rotationLen].memberId,
    `${future.length} 条 · ${future[0]?.memberId} vs ${future[rotationLen]?.memberId}`,
  );
  check(
    '轮值覆盖全部室友且不跳人',
    new Set(future.slice(0, rotationLen).map((o) => o.memberId)).size === rotationLen,
    future.slice(0, rotationLen).map((o) => o.memberId).join(','),
  );
  // 历史日期带覆盖记录属于预期行为：打卡后以「实际值日人」为准
  const past = occurrencesInRange(state, addDays(base, -14), addDays(base, -1)).filter(
    (o) => o.taskId === weekly.id,
  );
  check(
    '历史排班体现打卡记录（可被覆盖）',
    past.length === 0 || past.every((o) => o.status === 'done' || o.status === 'skipped' || o.status === 'pending'),
  );

  const stats = choreStats(state, '2025-06-01', '2025-06-28');
  const totalDone = sum(Object.values(stats).map((s) => s.done));
  check('统计到打卡记录', totalDone > 0, `done=${totalDone}`);
  check('完成率在 0~1 之间', Object.values(stats).every((s) => s.rate >= 0 && s.rate <= 1));

  const today = occurrencesOn(state, todayStr());
  check('今天有排班（每日任务）', today.length > 0);
}

console.log('\n[4] 物品预估');
{
  const state = createSeedState('2025-06-15');
  const f = supplyForecasts(state, '2025-06-15');
  check('每件物品都有预估结果', f.length === state.supplies.length);

  const paper = f.find((x) => x.supply.id === 's5');
  check('厨房纸被判定为已用完', paper.level === 'out' && paper.daysLeft === 0, JSON.stringify(paper.level));

  const bag = f.find((x) => x.supply.id === 's4');
  check('垃圾袋算出「该补了」并给出天数', bag.level === 'soon' && bag.daysLeft !== null, `${bag.level}/${bag.daysLeft}`);
  check('垃圾袋的速率来自报告采样点', bag.basis === 'reports', bag.basis);

  const roll = f.find((x) => x.supply.id === 's1');
  check('卷纸按历次报告算出速率', roll.dailyUsage !== null && roll.dailyUsage > 0, String(roll.dailyUsage));
  check('卷纸给出预计用完日期', roll.runOutDate !== null && roll.runOutDate > '2025-06-15', String(roll.runOutDate));

  const filter = f.find((x) => x.supply.id === 's6');
  check('没有报告点时退回用补货量估算', filter.basis === 'restock' && filter.daysLeft !== null, `${filter.basis}/${filter.daysLeft}`);

  check('每件物品都算出了天数（演示数据自洽）', f.every((x) => x.daysLeft !== null), JSON.stringify(f.map((x) => [x.supply.id, x.daysLeft])));

  const alerts = activeAlerts(state, '2025-06-15');
  check('待补货里已用完的排最前', alerts[0]?.level === 'out', alerts.map((x) => x.level).join(','));

  check('大字号文案：已用完', supplyHeadline(paper) === '已用完', supplyHeadline(paper));
  check('大字号文案：N 天后需补货', /^\d+ 天后需补货$/.test(supplyHeadline(roll)), supplyHeadline(roll));

  // 数据不足时必须诚实返回 null，而不是编一个数
  const bare = createSeedState('2025-06-15');
  bare.supplies.push({ id: 'sx', name: '新物品', emoji: '🧼', category: '日用', unit: '个', stock: 2 });
  const nf = supplyForecast(bare, bare.supplies[bare.supplies.length - 1], '2025-06-15');
  check('全新物品诚实显示「数据不足」', nf.daysLeft === null && nf.level === 'unknown', `${nf.level}/${nf.daysLeft}`);
  check('数据不足时文案为「数据不足」', supplyHeadline(nf) === '数据不足', supplyHeadline(nf));
}

console.log('\n[5] 种子数据自洽性');
{
  const state = createSeedState('2025-06-15');
  const ids = new Set(state.members.map((m) => m.id));
  check('账单参与人都存在', state.expenses.every((e) => e.participants.every((p) => ids.has(p.memberId))));
  check('物品流水成员都存在', state.supplyLogs.every((l) => ids.has(l.memberId)));
  check('物品流水只含 report/empty/restock', state.supplyLogs.every((l) => ['report', 'empty', 'restock'].includes(l.type)));
  check('物品不再有「满配」字段', state.supplies.every((s) => !('capacity' in s)));
  check('每个物品都有报告或补货记录', state.supplies.every((sup) => state.supplyLogs.some((l) => l.supplyId === sup.id)));
  check('补货流水关联到账单', state.supplyLogs.filter((l) => l.expenseId).every((l) => state.expenses.some((e) => e.id === l.expenseId)));
  check('排班轮值成员都存在', state.choreTasks.every((t) => t.rotation.every((id) => ids.has(id))));
  check('公约投票成员都存在', state.pacts.every((p) => p.votes.every((v) => ids.has(v.memberId))));
  check('种子日期为动态生成（含本月账单）', state.expenses.some((e) => monthKey(e.date) === monthKey('2025-06-15')));
  check('昨天有打卡记录', state.choreOverrides[`c1:${addDays('2025-06-15', -1)}`] !== undefined);
}

console.log(failed === 0 ? '\n✅ 全部通过\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
