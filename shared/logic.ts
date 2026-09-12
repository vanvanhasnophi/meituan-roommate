/**
 * 纯函数领域逻辑 —— 前端与 Serverless API 共用。
 * 所有金额计算一律换算成「分」做整数运算，避免浮点误差导致的 AA 扯皮。
 */

import type {
  ChoreOccurrence,
  ChoreTask,
  DateStr,
  Expense,
  HouseholdState,
  ID,
  Member,
  Supply,
  SupplyLog,
} from './types';

/* ------------------------------------------------------------ 日期工具 */

export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toDateStr(d: Date): DateStr {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): DateStr {
  return toDateStr(new Date());
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function addMonths(s: DateStr, n: number): DateStr {
  const d = parseDate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toDateStr(d);
}

export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

export function startOfMonth(s: DateStr): DateStr {
  return `${s.slice(0, 7)}-01`;
}

export function endOfMonth(s: DateStr): DateStr {
  const d = parseDate(startOfMonth(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toDateStr(d);
}

export function monthKey(s: DateStr): string {
  return s.slice(0, 7);
}

export function weekdayOf(s: DateStr): number {
  return parseDate(s).getDay();
}

export const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

export function friendlyDate(s: DateStr, today = todayStr()): string {
  const diff = daysBetween(today, s);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  const d = parseDate(s);
  if (d.getFullYear() === parseDate(today).getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/* ------------------------------------------------------------ 金额工具 */

export function toCents(yuan: number): number {
  return Math.round(yuan * 100);
}

export function toYuan(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatMoney(yuan: number, withSymbol = true): string {
  const v = Math.abs(yuan);
  const fixed = v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);
  const grouped = Number(fixed).toLocaleString('zh-CN', { minimumFractionDigits: fixed.includes('.') ? 2 : 0, maximumFractionDigits: 2 });
  return `${withSymbol ? '¥' : ''}${grouped}`;
}

export function formatSigned(yuan: number): string {
  const sign = yuan > 0 ? '+' : yuan < 0 ? '-' : '';
  return `${sign}${formatMoney(Math.abs(yuan))}`;
}

function roundCents(n: number): number {
  return Math.round(n);
}

/* -------------------------------------------------------- 账单分摊计算 */

/** 把一笔账单拆成 { 成员: 应付金额(元) }，使用整数分运算保证「分毫不差」 */
export function expenseShares(expense: Expense): Record<ID, number> {
  const total = toCents(expense.amount);
  const out: Record<ID, number> = {};
  const parts = expense.participants.filter((p) => p.weight >= 0);
  if (parts.length === 0) return out;

  if (expense.splitMode === 'custom') {
    const sum = parts.reduce((s, p) => s + toCents(p.weight), 0);
    if (sum === 0) return out;
    // 自定义金额与总额不一致时按比例归一，避免「少算/多算」的幽灵差额
    let allocated = 0;
    parts.forEach((p, i) => {
      const cents = i === parts.length - 1 ? total - allocated : roundCents((toCents(p.weight) / sum) * total);
      allocated += cents;
      out[p.memberId] = toYuan(cents);
    });
    return out;
  }

  const weights = expense.splitMode === 'shares' ? parts.map((p) => p.weight) : parts.map(() => 1);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) return out;

  let allocated = 0;
  parts.forEach((p, i) => {
    const cents =
      i === parts.length - 1 ? total - allocated : roundCents((weights[i] / totalWeight) * total);
    allocated += cents;
    out[p.memberId] = toYuan(cents);
  });
  return out;
}

export interface MemberBalance {
  memberId: ID;
  /** 正数=应收（别人欠他），负数=应付（他欠别人） */
  net: number;
  /** 本期总垫付 */
  paid: number;
  /** 本期总应付（自己该承担的部分） */
  owed: number;
}

/**
 * 计算每个人的净额。默认只统计账期内的账单（含账期内的已结算记录）。
 * 若 month 为 null 则统计全部历史。
 */
export function computeBalances(
  state: HouseholdState,
  month: string | null = null,
): Record<ID, MemberBalance> {
  const balances: Record<ID, MemberBalance> = {};
  const ensure = (id: ID): MemberBalance => {
    if (!balances[id]) balances[id] = { memberId: id, net: 0, paid: 0, owed: 0 };
    return balances[id];
  };
  state.members.forEach((m) => ensure(m.id));

  const inMonth = (d: DateStr) => (month ? monthKey(d) === month : true);

  for (const e of state.expenses) {
    if (!inMonth(e.date)) continue;
    const payer = ensure(e.paidBy);
    payer.paid += e.amount;
    payer.net += toCents(e.amount);
    const shares = expenseShares(e);
    for (const [memberId, amount] of Object.entries(shares)) {
      const b = ensure(memberId);
      b.owed += amount;
      b.net -= toCents(amount);
    }
  }

  for (const s of state.settlements) {
    if (!inMonth(s.date)) continue;
    // 转账：付款方债务减轻，收款方债权减少
    ensure(s.fromId).net += toCents(s.amount);
    ensure(s.toId).net -= toCents(s.amount);
  }

  for (const id of Object.keys(balances)) {
    const b = balances[id];
    b.net = toYuan(b.net);
    b.paid = toYuan(toCents(b.paid));
    b.owed = toYuan(toCents(b.owed));
  }
  return balances;
}

export interface Transfer {
  fromId: ID;
  toId: ID;
  amount: number;
}

/**
 * 最优结算方案：用「最大债权 ↔ 最大债务」贪心配对，
 * 把 n 个人之间的多角债压缩成最少的转账笔数（通常 ≤ n-1 笔）。
 */
export function settlePlan(balances: Record<ID, MemberBalance>): Transfer[] {
  const creditors: { id: ID; cents: number }[] = [];
  const debtors: { id: ID; cents: number }[] = [];
  for (const b of Object.values(balances)) {
    const cents = toCents(b.net);
    if (cents > 0) creditors.push({ id: b.memberId, cents });
    else if (cents < 0) debtors.push({ id: b.memberId, cents: -cents });
  }
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  let guard = 0;
  while (i < debtors.length && j < creditors.length && guard < 1000) {
    guard += 1;
    const pay = Math.min(debtors[i].cents, creditors[j].cents);
    if (pay > 0) {
      transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amount: toYuan(pay) });
    }
    debtors[i].cents -= pay;
    creditors[j].cents -= pay;
    if (debtors[i].cents === 0) i += 1;
    if (creditors[j].cents === 0) j += 1;
  }
  return transfers.filter((t) => t.amount > 0);
}

export function monthExpenses(state: HouseholdState, month: string): Expense[] {
  return state.expenses.filter((e) => monthKey(e.date) === month).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ---------------------------------------------------------- 值日排班 */

export function overrideKey(taskId: ID, date: DateStr): string {
  return `${taskId}:${date}`;
}

/** 轮值到第几个周期（可为负，向前回推） */
function rotationIndex(task: ChoreTask, date: DateStr): number {
  const n = task.rotation.length;
  if (n === 0) return -1;
  const offset = daysBetween(task.anchor, date);
  const periods = task.cadence === 'weekly' ? Math.floor(offset / 7) : offset;
  return ((periods % n) + n) % n;
}

export function taskHitsDate(task: ChoreTask, date: DateStr): boolean {
  if (!task.active) return false;
  if (task.cadence === 'daily') return true;
  return weekdayOf(date) === task.weekday;
}

/** 展开某一天的完整值日安排（含换班/打卡后的真实状态） */
export function occurrencesOn(state: HouseholdState, date: DateStr): ChoreOccurrence[] {
  const today = todayStr();
  return state.choreTasks
    .filter((t) => taskHitsDate(t, date))
    .map((t) => {
      const ov = state.choreOverrides[overrideKey(t.id, date)] ?? {};
      const idx = rotationIndex(t, date);
      const planned = idx >= 0 ? t.rotation[idx] : null;
      return {
        key: overrideKey(t.id, date),
        taskId: t.id,
        date,
        memberId: ov.memberId ?? planned,
        status: ov.status ?? 'pending',
        doneAt: ov.doneAt ?? null,
        doneBy: ov.doneBy,
        note: ov.note,
        swapRequest: ov.swapRequest ?? null,
        isToday: date === today,
      };
    });
}

export function occurrencesInRange(state: HouseholdState, from: DateStr, to: DateStr): ChoreOccurrence[] {
  const out: ChoreOccurrence[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 400) {
    out.push(...occurrencesOn(state, cur));
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

export interface ChoreStats {
  memberId: ID;
  done: number;
  pending: number;
  skipped: number;
  /** 完成率 0-1 */
  rate: number;
  /** 值日积分：完成 +10，跳过 -5 */
  points: number;
}

export function choreStats(
  state: HouseholdState,
  from: DateStr,
  to: DateStr,
): Record<ID, ChoreStats> {
  const stats: Record<ID, ChoreStats> = {};
  for (const m of state.members) {
    stats[m.id] = { memberId: m.id, done: 0, pending: 0, skipped: 0, rate: 0, points: 0 };
  }
  for (const o of occurrencesInRange(state, from, to)) {
    if (!o.memberId || !stats[o.memberId]) continue;
    const s = stats[o.memberId];
    if (o.status === 'done') {
      s.done += 1;
      s.points += 10;
    } else if (o.status === 'skipped') {
      s.skipped += 1;
      s.points -= 5;
    } else if (o.date <= todayStr()) {
      s.pending += 1;
    }
  }
  for (const s of Object.values(stats)) {
    const total = s.done + s.skipped + s.pending;
    s.rate = total === 0 ? 1 : s.done / total;
  }
  return stats;
}

/* ------------------------------------------------------- 物品与提醒 */

export type SupplyAlertLevel = 'ok' | 'low' | 'out' | 'due';

export interface SupplyInsight {
  supply: Supply;
  level: SupplyAlertLevel;
  /** 预估还能用几天（基于近 30 天消耗速率），无法估算时为 null */
  daysLeft: number | null;
  /** 距上次补货天数 */
  daysSinceRestock: number | null;
  /** 是否到了更换周期 */
  dueForReplacement: boolean;
  dailyUsage: number;
}

export function averageDailyUsage(logs: SupplyLog[], supplyId: ID, today = todayStr()): number {
  const from = addDays(today, -30);
  const used = logs
    .filter((l) => l.supplyId === supplyId && l.type === 'consume' && l.date >= from && l.date <= today)
    .reduce((s, l) => s + l.qty, 0);
  return used / 30;
}

export function supplyInsights(state: HouseholdState, today = todayStr()): SupplyInsight[] {
  return state.supplies.map((supply) => {
    const dailyUsage = averageDailyUsage(state.supplyLogs, supply.id, today);
    const daysLeft = dailyUsage > 0 ? Math.floor(supply.stock / dailyUsage) : null;
    const daysSinceRestock = supply.lastRestockedAt ? daysBetween(supply.lastRestockedAt, today) : null;
    const dueForReplacement = Boolean(
      supply.cycleDays && supply.lastRestockedAt && (daysSinceRestock ?? 0) >= supply.cycleDays,
    );
    let level: SupplyAlertLevel = 'ok';
    // 优先级：用完 > 该更换 > 库存偏低 > 快用完（按消耗速率预估）
    if (supply.stock <= 0) level = 'out';
    else if (dueForReplacement) level = 'due';
    else if (supply.stock <= supply.lowStockThreshold) level = 'low';
    else if (daysLeft !== null && daysLeft <= 3) level = 'low';
    return { supply, level, daysLeft, daysSinceRestock, dueForReplacement, dailyUsage };
  });
}

/** 触发提醒的条目，按紧急程度排序 */
export function activeAlerts(state: HouseholdState, today = todayStr()): SupplyInsight[] {
  const weight: Record<SupplyAlertLevel, number> = { out: 0, due: 1, low: 2, ok: 3 };
  return supplyInsights(state, today)
    .filter((i) => i.level !== 'ok')
    .sort((a, b) => weight[a.level] - weight[b.level] || (a.daysLeft ?? 99) - (b.daysLeft ?? 99));
}

/* ------------------------------------------------------------ 公约 */

export function pactProgress(pact: HouseholdState['pacts'][number], members: Member[]) {
  const eligible = members.filter((m) => !m.movedOutAt);
  const agree = pact.votes.filter((v) => v.vote === 'agree').length;
  const oppose = pact.votes.filter((v) => v.vote === 'oppose').length;
  const abstain = pact.votes.filter((v) => v.vote === 'abstain').length;
  const voted = agree + oppose + abstain;
  return {
    agree,
    oppose,
    abstain,
    voted,
    total: eligible.length,
    allAgreed: eligible.length > 0 && agree >= eligible.length,
    progress: eligible.length === 0 ? 0 : voted / eligible.length,
  };
}

/* ------------------------------------------------------------ 其他 */

export function memberById(state: HouseholdState, id: ID | null | undefined): Member | undefined {
  if (!id) return undefined;
  return state.members.find((m) => m.id === id);
}

export function activeMembers(state: HouseholdState): Member[] {
  return state.members.filter((m) => !m.movedOutAt);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/** 深拷贝，用于「快照 + 变更」式的状态更新 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
