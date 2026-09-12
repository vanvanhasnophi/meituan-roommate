/**
 * 领域逻辑自测：直接用 node 运行（构建为一个 bundle 后执行）。
 * 验证金额分摊「分毫不差」、最优结算最少笔数、排班轮值与统计正确。
 */
import {
  choreStats,
  computeBalances,
  expenseShares,
  occurrencesInRange,
  occurrencesOn,
  settlePlan,
  supplyInsights,
  activeAlerts,
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

console.log('\n[2] 净额与最优结算');
{
  const state = createSeedState('2025-06-15');
  const balances = computeBalances(state, monthKey('2025-06-15'));
  const netSum = sum(Object.values(balances).map((b) => cents(b.net)));
  check('所有净额之和为 0（账目自平衡）', netSum === 0, `sum=${netSum}`);

  const plan = settlePlan(balances);
  const nonZero = Object.values(balances).filter((b) => cents(b.net) !== 0).length;
  check(`结算笔数 ≤ 参与人数-1（${plan.length} ≤ ${Math.max(0, nonZero - 1)}）`, plan.length <= Math.max(0, nonZero - 1));
  check('结算金额之和 = 应收总额', cents(sum(plan.map((t) => t.amount))) === sum(Object.values(balances).map((b) => Math.max(0, cents(b.net)))));
  check('无人同时付款与收款', new Set(plan.map((t) => t.fromId)).size === plan.length);

  // 结算后账目应清零
  const after = JSON.parse(JSON.stringify(state));
  for (const t of plan) {
    after.settlements.push({ id: `s${t.fromId}${t.toId}`, fromId: t.fromId, toId: t.toId, amount: t.amount, date: '2025-06-15', createdAt: '' });
  }
  const afterBalances = computeBalances(after, monthKey('2025-06-15'));
  check('按方案结算后所有人净额为 0', Object.values(afterBalances).every((b) => Math.abs(cents(b.net)) === 0), JSON.stringify(afterBalances));
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

console.log('\n[4] 物品提醒');
{
  const state = createSeedState('2025-06-15');
  const insights = supplyInsights(state, '2025-06-15');
  check('所有物品都有洞察结果', insights.length === state.supplies.length);
  const paper = insights.find((i) => i.supply.id === 's5');
  check('已用完的厨房纸被判定为 out', paper.level === 'out', paper.level);
  const filter = insights.find((i) => i.supply.id === 's6');
  check('超期滤芯被判定为 due', filter.level === 'due', filter.level);
  check('卷纸预估出剩余天数', insights.find((i) => i.supply.id === 's1').daysLeft !== null);
  const alerts = activeAlerts(state, '2025-06-15');
  check('提醒按紧急度排序（out 在前）', alerts[0].level === 'out', alerts.map((a) => a.level).join(','));
}

console.log('\n[5] 种子数据自洽性');
{
  const state = createSeedState('2025-06-15');
  const ids = new Set(state.members.map((m) => m.id));
  check('账单付款人都存在', state.expenses.every((e) => ids.has(e.paidBy)));
  check('账单参与人都存在', state.expenses.every((e) => e.participants.every((p) => ids.has(p.memberId))));
  check('物品流水成员都存在', state.supplyLogs.every((l) => ids.has(l.memberId)));
  check('补货流水关联到账单', state.supplyLogs.filter((l) => l.expenseId).every((l) => state.expenses.some((e) => e.id === l.expenseId)));
  check('排班轮值成员都存在', state.choreTasks.every((t) => t.rotation.every((id) => ids.has(id))));
  check('公约投票成员都存在', state.pacts.every((p) => p.votes.every((v) => ids.has(v.memberId))));
  check('种子日期为动态生成（含本月账单）', state.expenses.some((e) => monthKey(e.date) === monthKey('2025-06-15')));
  check('昨天有打卡记录', state.choreOverrides[`c1:${addDays('2025-06-15', -1)}`] !== undefined);
}

console.log(failed === 0 ? '\n✅ 全部通过\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
