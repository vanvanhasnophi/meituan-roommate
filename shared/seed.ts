/**
 * 演示数据（种子）。
 * 全部相对「今天」生成，保证任何时候打开看到的都是一个鲜活、正在使用中的合租小屋，
 * 而不是一堆写死的历史日期。
 */

import {
  addDays,
  monthKey,
  overrideKey,
  startOfMonth,
  todayStr,
  weekdayOf,
  addMonths,
} from './logic';
import { CHORE_STANDARDS } from './meta';
import type {
  ActivityEvent,
  ChoreOverride,
  ChoreTask,
  Expense,
  HouseholdState,
  Member,
  PactArticle,
  Supply,
  SupplyLog,
  DateStr,
} from './types';

const MEMBERS: Member[] = [
  { id: 'm1', name: '林小满', avatar: '🐱', color: 'var(--member-1)', role: 'admin', joinedAt: '2023-09-01' },
  { id: 'm2', name: '陈屿', avatar: '🐳', color: 'var(--member-2)', role: 'member', joinedAt: '2023-09-01' },
  { id: 'm3', name: '周哲', avatar: '🦊', color: 'var(--member-3)', role: 'member', joinedAt: '2024-03-15' },
  { id: 'm4', name: '苏念', avatar: '🐰', color: 'var(--member-4)', role: 'member', joinedAt: '2024-11-01' },
];

function buildChoreTasks(anchor: DateStr): ChoreTask[] {
  const rotation = MEMBERS.map((m) => m.id);
  const mk = (
    id: string,
    index: number,
    cadence: 'daily' | 'weekly',
    weekday: number,
    color: string,
  ): ChoreTask => {
    const std = CHORE_STANDARDS[index];
    return {
      id,
      area: std.area,
      emoji: std.emoji,
      standard: std.standard,
      cadence,
      weekday,
      // 用不同起点错开轮值，避免总是同一个人做同一件事
      rotation: [...rotation.slice(index % rotation.length), ...rotation.slice(0, index % rotation.length)],
      anchor,
      color,
      active: true,
    };
  };
  return [
    mk('c1', 3, 'daily', 0, 'var(--chore-1)'), // 垃圾清运
    mk('c2', 0, 'weekly', 3, 'var(--chore-2)'), // 厨房 周三
    mk('c3', 1, 'weekly', 6, 'var(--chore-3)'), // 卫生间 周六
    mk('c4', 2, 'weekly', 0, 'var(--chore-4)'), // 客厅 周日
    mk('c5', 4, 'weekly', 4, 'var(--chore-5)'), // 阳台 周四
  ];
}

/** 回填过去 24 天的打卡记录：大部分完成、少数跳过，让统计与积分榜有内容 */
function buildOverrides(tasks: ChoreTask[], today: DateStr): Record<string, ChoreOverride> {
  const overrides: Record<string, ChoreOverride> = {};
  for (let back = 24; back >= 1; back -= 1) {
    const date = addDays(today, -back);
    for (const t of tasks) {
      if (t.cadence === 'weekly' && weekdayOf(date) !== t.weekday) continue;
      const idx = ((Math.floor((back * 7 + t.area.length) % t.rotation.length) + t.rotation.length) % t.rotation.length);
      const memberId = t.rotation[idx];
      // 大约每 8 天出现一次跳过，制造真实感
      const skipped = back % 8 === 0;
      overrides[overrideKey(t.id, date)] = skipped
        ? { status: 'skipped', memberId, note: '当天出差，已和室友说明' }
        : { status: 'done', memberId, doneAt: `${date}T21:30:00.000Z`, doneBy: memberId };
    }
  }
  // 今天的一半留作待办，另一半已完成，制造「今天还有事要做」的代入感
  for (const t of tasks) {
    if (t.cadence === 'weekly' && weekdayOf(today) !== t.weekday) continue;
    if (t.id === 'c1' || t.id === 'c2') continue;
    const idx = Math.floor((t.area.length * 3) % t.rotation.length);
    const memberId = t.rotation[idx];
    overrides[overrideKey(t.id, today)] = {
      status: 'done',
      memberId,
      doneAt: `${today}T10:05:00.000Z`,
      doneBy: memberId,
    };
  }
  // 一条待确认的换班请求（产品亮点：换班需对方点头）
  const tomorrow = addDays(today, 1);
  const swapTask = tasks[0];
  const swapMember = swapTask.rotation[(weekdayOf(tomorrow) + 1) % swapTask.rotation.length];
  const target = swapTask.rotation[(weekdayOf(tomorrow) + 2) % swapTask.rotation.length];
  overrides[overrideKey(swapTask.id, tomorrow)] = {
    memberId: swapMember,
    swapRequest: { toMemberId: target, requestedBy: swapMember, at: `${today}T09:12:00.000Z` },
  };
  return overrides;
}

function buildSupplies(today: DateStr): Supply[] {
  // 只记「上次补货时间 / 数量」和「最近报告的剩余」，
  // 剩余天数由这两者推算，不再维护满配与精确出入库。
  const mk = (
    id: string,
    name: string,
    emoji: string,
    category: Supply['category'],
    unit: string,
    stock: number,
    restockDaysAgo: number | null,
    restockQty: number | null,
    note?: string,
  ): Supply => ({
    id,
    name,
    emoji,
    category,
    unit,
    stock,
    lastRestockedAt: restockDaysAgo === null ? null : addDays(today, -restockDaysAgo),
    lastRestockQty: restockQty,
    alertDays: 3,
    note,
  });

  // 每件都给出自洽的「补货时间 + 采购量 + 历次报告」，
  // 这样界面上每张卡片都能显示一个算得出来的天数，而不是一片「数据不足」。
  return [
    mk('s1', '卷纸', '🧻', '日用', '卷', 3, 18, 12, '放在玄关储物柜第二层'),
    mk('s2', '洗洁精', '🧴', '厨房', '瓶', 1, 40, 2),
    mk('s3', '洗衣液', '🫧', '清洁', '袋', 1, 12, 2),
    mk('s4', '垃圾袋', '🗑️', '日用', '包', 1, 21, 10),
    // 已用完：报告「用完」后库存归零，这是个独立状态
    mk('s5', '厨房纸', '🧽', '厨房', '卷', 0, 33, 4, '陈屿上次说这周补'),
    mk('s6', '净水器滤芯', '💧', '耗材', '支', 1, 96, 2, '建议 3 个月更换一次'),
    mk('s7', '消毒液', '🧪', '清洁', '瓶', 1, 55, 3),
  ];
}

function buildSupplyLogs(today: DateStr): SupplyLog[] {
  const logs: SupplyLog[] = [];
  const push = (log: Omit<SupplyLog, 'createdAt'>) =>
    logs.push({ ...log, createdAt: `${log.date}T12:00:00.000Z` });

  // 补货记录：带上「这一次买了多少」，作为速率的兜底依据
  push({
    id: 'sl_r1',
    supplyId: 's1',
    type: 'restock',
    qty: 12,
    memberId: 'm3',
    date: addDays(today, -18),
    cost: 42.8,
    expenseId: 'e_supply_1',
    note: '618 囤了一箱',
  });
  push({
    id: 'sl_r3',
    supplyId: 's6',
    type: 'restock',
    qty: 2,
    memberId: 'm2',
    date: addDays(today, -96),
    cost: 138,
    note: '换滤芯，一次买了两支',
  });
  push({
    id: 'sl_r2',
    supplyId: 's3',
    type: 'restock',
    qty: 2,
    memberId: 'm2',
    date: addDays(today, -12),
    cost: 59.9,
    expenseId: 'e_supply_2',
  });

  // 「报告剩余」的采样点：两次之间就能算出真实消耗速率
  const reports: { id: string; supplyId: string; member: string; daysAgo: number; qty: number }[] = [
    { id: 's1', supplyId: 's1', member: 'm1', daysAgo: 16, qty: 11 },
    { id: 's1', supplyId: 's1', member: 'm1', daysAgo: 9, qty: 7 },
    { id: 's1', supplyId: 's1', member: 'm4', daysAgo: 3, qty: 3 },
    { id: 's2', supplyId: 's2', member: 'm2', daysAgo: 26, qty: 2 },
    { id: 's2', supplyId: 's2', member: 'm2', daysAgo: 6, qty: 1 },
    { id: 's3', supplyId: 's3', member: 'm3', daysAgo: 10, qty: 2 },
    { id: 's4', supplyId: 's4', member: 'm1', daysAgo: 18, qty: 8 },
    { id: 's4', supplyId: 's4', member: 'm1', daysAgo: 5, qty: 2 },
    { id: 's7', supplyId: 's7', member: 'm4', daysAgo: 20, qty: 2 },
    { id: 's7', supplyId: 's7', member: 'm4', daysAgo: 7, qty: 1 },
  ];
  for (const r of reports) {
    push({
      id: `sl_${r.supplyId}_${r.daysAgo}`,
      supplyId: r.supplyId,
      type: 'report',
      qty: r.qty,
      memberId: r.member,
      date: addDays(today, -r.daysAgo),
    });
  }

  // 「报告用完」是独立动作
  push({
    id: 'sl_empty_s5',
    supplyId: 's5',
    type: 'empty',
    qty: 0,
    memberId: 'm2',
    date: addDays(today, -1),
    note: '最后一卷用完了',
  });

  return logs.sort((a, b) => (a.date < b.date ? 1 : -1));
}


function buildExpenses(today: DateStr): Expense[] {
  const thisMonth = startOfMonth(today);
  const lastMonth = startOfMonth(addMonths(today, -1));
  const d = (monthStart: DateStr, day: number) => addDays(monthStart, day - 1);
  const all = MEMBERS.map((m) => m.id);
  const even = (ids: string[]) => ids.map((id) => ({ memberId: id, weight: 1 }));
  const rentShares = [
    { memberId: 'm1', weight: 1.2 },
    { memberId: 'm2', weight: 1.2 },
    { memberId: 'm3', weight: 1 },
    { memberId: 'm4', weight: 1 },
  ];

  const list: Expense[] = [];
  // 注意：不记录「谁垫付」—— 记账的人不等于付钱的人。
  // 垫付在结算时用计算器一次性录入。
  const add = (e: Omit<Expense, 'createdAt'>) => list.push({ ...e, createdAt: `${e.date}T09:00:00.000Z` });

  // 上月
  add({
    id: 'e_lm_rent',
    title: '房租',
    amount: 6800,
    category: 'rent',
    date: d(lastMonth, 1),
    splitMode: 'shares',
    participants: rentShares,
    recurring: 'monthly',
    note: '主卧带阳台按 1.2 份计',
  });
  add({
    id: 'e_lm_util',
    title: '水电燃气（上月账期）',
    amount: 386.5,
    category: 'utility',
    date: d(lastMonth, 8),
    splitMode: 'even',
    participants: even(['m1', 'm2', 'm3']),
    note: '苏念上月 20 号才搬进来，不计入',
  });
  add({
    id: 'e_lm_net',
    title: '宽带续费（年付 1440，按 4 人月摊）',
    amount: 120,
    category: 'internet',
    date: d(lastMonth, 10),
    splitMode: 'even',
    participants: even(all),
  });

  // 本月
  add({
    id: 'e_rent',
    title: '房租',
    amount: 6800,
    category: 'rent',
    date: d(thisMonth, 1),
    splitMode: 'shares',
    participants: rentShares,
    recurring: 'monthly',
    note: '每月 1 号交，已设为周期账单',
  });
  add({
    id: 'e_util',
    title: '水电燃气',
    amount: 342.6,
    category: 'utility',
    date: d(thisMonth, 8),
    splitMode: 'even',
    participants: even(all),
  });
  add({
    id: 'e_grocery_1',
    title: '周末火锅食材',
    amount: 268,
    category: 'grocery',
    date: addDays(today, -9),
    splitMode: 'even',
    participants: even(all),
    note: '三个人吃了，苏念那天加班没赶上',
  });
  add({
    id: 'e_service',
    title: '厨房下水道疏通',
    amount: 150,
    category: 'service',
    date: addDays(today, -6),
    splitMode: 'even',
    participants: even(all),
  });
  add({
    id: 'e_supply_1',
    title: '公共物品补货 · 卷纸',
    amount: 42.8,
    category: 'supply',
    date: addDays(today, -18),
    splitMode: 'even',
    participants: even(all),
    source: { type: 'supply', id: 's1', label: '卷纸 ×12 卷' },
  });
  add({
    id: 'e_supply_2',
    title: '公共物品补货 · 洗衣液',
    amount: 59.9,
    category: 'supply',
    date: addDays(today, -12),
    splitMode: 'even',
    participants: even(all),
    source: { type: 'supply', id: 's3', label: '洗衣液 ×2 袋' },
  });
  add({
    id: 'e_grocery_2',
    title: '一起囤的牛奶麦片',
    amount: 96.4,
    category: 'grocery',
    date: addDays(today, -3),
    splitMode: 'custom',
    participants: [
      { memberId: 'm1', weight: 36.4 },
      { memberId: 'm2', weight: 30 },
      { memberId: 'm3', weight: 30 },
    ],
    note: '苏念乳糖不耐受，不参与',
  });
  return list.sort((a, b) => (a.date < b.date ? 1 : -1));
}


function buildPacts(today: DateStr): PactArticle[] {
  return [
    {
      id: 'p1',
      title: '夜间安静时段 23:30 - 07:00',
      category: '作息',
      content:
        '23:30 后公共区域请使用耳机，视频/语音通话移步自己房间并关门；洗衣机、吸尘器、料理机不在此时段使用。加班晚归请提前在群里说一声。',
      status: 'active',
      version: 2,
      proposedBy: 'm2',
      proposedAt: `${addDays(today, -120)}T10:00:00.000Z`,
      effectiveAt: `${addDays(today, -118)}T10:00:00.000Z`,
      votes: MEMBERS.map((m) => ({ memberId: m.id, vote: 'agree' as const, at: `${addDays(today, -119)}T10:00:00.000Z` })),
      history: [
        {
          version: 1,
          content: '23:00 后请保持安静。',
          changedAt: `${addDays(today, -120)}T10:00:00.000Z`,
          changedBy: 'm2',
          summary: '初版',
        },
        {
          version: 2,
          content: '把安静时段调整为 23:30 起，并明确列出高噪音家电清单。',
          changedAt: `${addDays(today, -118)}T10:00:00.000Z`,
          changedBy: 'm2',
          summary: '周哲提出 23:00 太早，大家同意顺延半小时',
        },
      ],
      breaches: [],
    },
    {
      id: 'p2',
      title: '公共物品「谁先用完谁登记」',
      category: '费用',
      content:
        '卷纸、洗洁精、垃圾袋等公共消耗品，使用到最后一份时请在「公共物品」里登记消耗并触发补货提醒；补货谁垫付谁录入，系统自动生成 AA 账单，不用再单独记账。',
      status: 'active',
      version: 1,
      proposedBy: 'm1',
      proposedAt: `${addDays(today, -60)}T10:00:00.000Z`,
      effectiveAt: `${addDays(today, -59)}T10:00:00.000Z`,
      votes: MEMBERS.map((m) => ({ memberId: m.id, vote: 'agree' as const, at: `${addDays(today, -59)}T10:00:00.000Z` })),
      history: [
        {
          version: 1,
          content: '公共消耗品由使用者在系统内登记，补货自动 AA。',
          changedAt: `${addDays(today, -60)}T10:00:00.000Z`,
          changedBy: 'm1',
          summary: '初版',
        },
      ],
      breaches: [],
    },
    {
      id: 'p3',
      title: '访客提前 2 小时报备，留宿需全员同意',
      category: '访客',
      content:
        '朋友短期来访请提前 2 小时在群里说明人数与时段；如需留宿，须在公约中发起提案并获得全体同意。访客离开后由邀请人负责恢复公共区域原状。',
      status: 'active',
      version: 1,
      proposedBy: 'm3',
      proposedAt: `${addDays(today, -45)}T10:00:00.000Z`,
      effectiveAt: `${addDays(today, -44)}T10:00:00.000Z`,
      votes: MEMBERS.map((m) => ({ memberId: m.id, vote: 'agree' as const, at: `${addDays(today, -44)}T10:00:00.000Z` })),
      history: [],
      breaches: [{ id: 'b1', memberId: 'm4', date: addDays(today, -5), note: '朋友临时来住一晚未提前说，已在群里致歉' }],
    },
    {
      id: 'p4',
      title: '卫生间早高峰 07:00-08:30 单次不超过 20 分钟',
      category: '卫生',
      content:
        '早高峰时段（07:00-08:30）卫生间单次使用不超过 20 分钟，洗澡请安排在夜间或公司健身房；如遇冲突，可在值日排班里发起换班协商。',
      status: 'proposed',
      version: 1,
      proposedBy: 'm4',
      proposedAt: `${addDays(today, -2)}T21:30:00.000Z`,
      effectiveAt: null,
      votes: [
        { memberId: 'm4', vote: 'agree', at: `${addDays(today, -2)}T21:30:00.000Z`, comment: '我早上总被卡住' },
        { memberId: 'm1', vote: 'agree', at: `${addDays(today, -2)}T22:10:00.000Z` },
        { memberId: 'm3', vote: 'oppose', at: `${addDays(today, -1)}T08:20:00.000Z`, comment: '20 分钟对长发同学太紧张了，建议 25 分钟' },
      ],
      history: [],
      breaches: [],
    },
  ];
}

function buildActivity(today: DateStr): ActivityEvent[] {
  const events: ActivityEvent[] = [
    { id: 'a1', kind: 'pact', memberId: 'm3', text: '对「卫生间早高峰限时」投了反对票，理由是时间太紧', at: `${addDays(today, -1)}T08:20:00.000Z` },
    { id: 'a2', kind: 'supply', memberId: 'm2', text: '厨房纸已用完，触发了补货提醒', at: `${addDays(today, -1)}T19:05:00.000Z` },
    { id: 'a3', kind: 'chore', memberId: 'm1', text: '完成今日值日：垃圾清运 🗑️', at: `${today}T10:05:00.000Z` },
    { id: 'a4', kind: 'expense', memberId: 'm4', text: '记了一笔「厨房下水道疏通」¥150.00，4 人均分（垫付在结算时再对齐）', at: `${addDays(today, -6)}T18:40:00.000Z` },
    { id: 'a5', kind: 'pact', memberId: 'm4', text: '发起公约提案「卫生间早高峰限时」', at: `${addDays(today, -2)}T21:30:00.000Z` },
    { id: 'a6', kind: 'chore', memberId: 'm2', text: '发起换班请求，等待周哲确认', at: `${today}T09:12:00.000Z` },
    { id: 'a7', kind: 'supply', memberId: 'm3', text: '补货卷纸 ×12，自动生成 AA 账单 ¥42.80', at: `${addDays(today, -18)}T15:20:00.000Z` },
    { id: 'a8', kind: 'system', memberId: 'm1', text: '用结算计算器对齐了上月垫付，算出 3 笔转账', at: `${addMonths(today, -1).slice(0, 8)}02T20:00:00.000Z` },
  ];
  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function createSeedState(today: DateStr = todayStr()): HouseholdState {
  const tasks = buildChoreTasks(addDays(today, -21));
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    code: 'ROOM-5283',
    name: '望江府 3 幢 1802',
    address: '杭州市上城区 · 近地铁 4 号线',
    settleDay: 25,
    members: MEMBERS,
    expenses: buildExpenses(today),
    choreTasks: tasks,
    choreOverrides: buildOverrides(tasks, today),
    supplies: buildSupplies(today),
    supplyLogs: buildSupplyLogs(today),
    pacts: buildPacts(today),
    activity: buildActivity(today),
    currentMemberId: 'm1',
    createdAt: now,
    updatedAt: now,
  };
}

/** 供服务端写入的初始快照（用当前月份，保证任何时候部署都「新鲜」） */
export function seedForMonth(today: DateStr = todayStr()): { state: HouseholdState; month: string } {
  return { state: createSeedState(today), month: monthKey(today) };
}
