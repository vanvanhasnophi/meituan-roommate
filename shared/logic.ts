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

/** 每人本期「应承担」的金额 —— 完全由账单的分摊规则推出，与谁垫付无关 */
export function computeOwed(state: HouseholdState, month: string | null = null): Record<ID, number> {
  const owed: Record<ID, number> = {};
  state.members.forEach((m) => {
    owed[m.id] = 0;
  });
  for (const e of state.expenses) {
    if (month && monthKey(e.date) !== month) continue;
    const shares = expenseShares(e);
    for (const [memberId, amount] of Object.entries(shares)) {
      owed[memberId] = toYuan(toCents(owed[memberId] ?? 0) + toCents(amount));
    }
  }
  return owed;
}

export interface SettlementRow {
  memberId: ID;
  /** 本期应承担（由账单分摊推出） */
  owed: number;
  /** 本期实际垫付（结算时人工输入） */
  paid: number;
  /** 正数=应收，负数=应付 */
  net: number;
}

export interface Transfer {
  fromId: ID;
  toId: ID;
  amount: number;
}

/**
 * 结算计算器：把「每人垫付」与「每人应承担」对账，
 * 再用「最大债权 ↔ 最大债务」贪心配对，压缩出最少的转账笔数。
 *
 * 垫付金额由调用方传入（临时输入），因为账单里不存「谁付的钱」。
 */
export function settlementRows(
  members: Member[],
  owed: Record<ID, number>,
  paid: Record<ID, number>,
): SettlementRow[] {
  return members.map((m) => {
    const o = toYuan(toCents(owed[m.id] ?? 0));
    const p = toYuan(toCents(paid[m.id] ?? 0));
    return { memberId: m.id, owed: o, paid: p, net: toYuan(toCents(p) - toCents(o)) };
  });
}

/** 由净额数组推出最少笔数的转账方案 */
export function settlePlan(rows: SettlementRow[]): Transfer[] {
  const creditors: { id: ID; cents: number }[] = [];
  const debtors: { id: ID; cents: number }[] = [];
  for (const r of rows) {
    const cents = toCents(r.net);
    if (cents > 0) creditors.push({ id: r.memberId, cents });
    else if (cents < 0) debtors.push({ id: r.memberId, cents: -cents });
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
    if (pay > 0) transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amount: toYuan(pay) });
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

/**
 * 物品不需要台账，只需要回答一个问题：**还有几天要用完了？**
 *
 * 速率从两个地方推：
 *   1. 最近两次「报告剩余」的差值（最准）
 *   2. 上一次补货的数量与时间（补货量 - 当前库存）/ 天数
 * 两者都没有时，就诚实地显示「数据不足」，而不是编一个数出来。
 */
export type SupplyLevel = 'ok' | 'soon' | 'out' | 'unknown';

export interface SupplyForecast {
  supply: Supply;
  level: SupplyLevel;
  /** 预估还能用几天；数据不足时为 null */
  daysLeft: number | null;
  /** 预计用完的日期 */
  runOutDate: DateStr | null;
  /** 估算用的日均消耗 */
  dailyUsage: number | null;
  /** 速率来源，用于在界面上解释这个数是怎么来的 */
  basis: 'reports' | 'restock' | 'none';
  /** 距上次补货天数 */
  daysSinceRestock: number | null;
  /** 是否建议现在补货 */
  needsRestock: boolean;
}

/** 用两个采样点之间的差值算日均消耗 */
function rateFromPoints(points: { date: DateStr; qty: number }[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = daysBetween(first.date, last.date);
  const used = first.qty - last.qty;
  if (days <= 0 || used <= 0) return null;
  return used / days;
}

export function supplyForecast(
  state: HouseholdState,
  supply: Supply,
  today = todayStr(),
): SupplyForecast {
  const logs = state.supplyLogs.filter((l) => l.supplyId === supply.id);
  const reports = logs
    .filter((l) => l.type === 'report' || l.type === 'empty')
    .map((l) => ({ date: l.date, qty: l.type === 'empty' ? 0 : l.qty }));

  // 没报告过的，用「补货时的当前库存」当作第一天采样点
  const anchor =
    supply.lastRestockedAt && supply.lastRestockQty != null
      ? [{ date: supply.lastRestockedAt, qty: supply.lastRestockQty }, ...reports]
      : reports;

  const daysSinceRestock = supply.lastRestockedAt ? daysBetween(supply.lastRestockedAt, today) : null;
  const nowPoint = { date: today, qty: supply.stock };

  // 有真实报告点才算「按报告推」；只有补货基准点时算「按补货量推」
  let dailyUsage = rateFromPoints([...anchor.filter((p) => p.date < today), nowPoint]);
  let basis: SupplyForecast['basis'] = reports.length > 0 ? 'reports' : 'restock';
  if (dailyUsage === null) {
    // 退回用补货量推算
    if (supply.lastRestockedAt && supply.lastRestockQty != null && daysSinceRestock && daysSinceRestock > 0) {
      const used = supply.lastRestockQty - supply.stock;
      if (used > 0) {
        dailyUsage = used / daysSinceRestock;
        basis = 'restock';
      }
    }
    if (dailyUsage === null) basis = 'none';
  }

  const out = supply.stock <= 0;
  const daysLeft = out ? 0 : dailyUsage && dailyUsage > 0 ? Math.floor(supply.stock / dailyUsage) : null;
  const alertDays = supply.alertDays ?? 3;

  let level: SupplyLevel;
  if (out) level = 'out';
  else if (daysLeft === null) level = 'unknown';
  else if (daysLeft <= alertDays) level = 'soon';
  else level = 'ok';

  return {
    supply,
    level,
    daysLeft,
    runOutDate: daysLeft === null ? null : addDays(today, daysLeft),
    dailyUsage,
    basis,
    daysSinceRestock,
    needsRestock: out || (daysLeft !== null && daysLeft <= alertDays),
  };
}

export function supplyForecasts(state: HouseholdState, today = todayStr()): SupplyForecast[] {
  return state.supplies.map((s) => supplyForecast(state, s, today));
}

/** 需要补货的条目，最紧急的排前面（已用完 > 剩余天数少 > 数据不足） */
export function activeAlerts(state: HouseholdState, today = todayStr()): SupplyForecast[] {
  const rank = (f: SupplyForecast) => {
    if (f.level === 'out') return -1;
    if (f.daysLeft !== null) return f.daysLeft;
    return 9999;
  };
  return supplyForecasts(state, today)
    .filter((f) => f.needsRestock)
    .sort((a, b) => rank(a) - rank(b));
}

/** 大字号文案：这个物品还有几天要用完 */
export function supplyHeadline(f: SupplyForecast): string {
  if (f.level === 'out') return '已用完';
  if (f.daysLeft === null) return '数据不足';
  if (f.daysLeft <= 0) return '今天用完';
  return `${f.daysLeft} 天后需补货`;
}

/** 小字号文案：库存 */
export function supplySubline(f: SupplyForecast): string {
  if (f.level === 'out') return '库存 0';
  return `库存 ${f.supply.stock} ${f.supply.unit}`;
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
