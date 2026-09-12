/**
 * 同屋 · 合租生活管家 —— 领域模型
 *
 * 设计原则：
 * 1. 「事实」与「派生」分离。账单/打卡/消耗是事实，余额、结算方案、排班是派生结果，
 *    派生结果一律由 shared/logic.ts 计算，不落库，避免数据不一致。
 * 2. 排班不产生 N 条记录：轮值规则 + 少量「变更记录」(打卡/换班/跳过) 即可还原整张日历。
 * 3. 所有时间统一 ISO 字符串（日期 YYYY-MM-DD，时间戳用完整 ISO），便于 JSON 序列化与跨端比较。
 */

export type ID = string;
/** YYYY-MM-DD */
export type DateStr = string;

/* ------------------------------------------------------------------ 成员 */

export interface Member {
  id: ID;
  name: string;
  /** 头像 emoji，避免依赖图片资源 */
  avatar: string;
  /** 主题色（十六进制），用于头像底色与图表着色 */
  color: string;
  role: 'admin' | 'member';
  joinedAt: DateStr;
  /** 若已搬离，排班与分摊自动跳过该成员 */
  movedOutAt?: DateStr | null;
}

/* ------------------------------------------------------------------ 账单 */

export type ExpenseCategory = 'rent' | 'utility' | 'internet' | 'grocery' | 'supply' | 'service' | 'other';

export type SplitMode = 'even' | 'shares' | 'custom';

export interface SplitEntry {
  memberId: ID;
  /** even 模式忽略；shares 模式为权重；custom 模式为金额（元） */
  weight: number;
}

export interface Expense {
  id: ID;
  title: string;
  /** 金额，单位：元 */
  amount: number;
  category: ExpenseCategory;
  /** 垫付人 */
  paidBy: ID;
  date: DateStr;
  splitMode: SplitMode;
  /** 参与分摊的人；未列出者不参与（如中途搬入/搬出） */
  participants: SplitEntry[];
  note?: string;
  /** 周期性账单标记：MVP 仅做展示与「一键复制上月」，不做服务端定时任务 */
  recurring?: 'monthly' | null;
  /** 由其他模块自动生成的来源，如物品补货 */
  source?: { type: 'supply'; id: ID; label: string } | null;
  createdBy?: ID;
  createdAt: string;
}

export interface Settlement {
  id: ID;
  fromId: ID;
  toId: ID;
  amount: number;
  date: DateStr;
  note?: string;
  createdAt: string;
}

/* -------------------------------------------------------------- 清洁值日 */

export type Cadence = 'daily' | 'weekly';

export interface ChoreTask {
  id: ID;
  area: string;
  emoji: string;
  /** 一句话说明「做到什么程度算完成」，避免扯皮 */
  standard: string;
  cadence: Cadence;
  /** weekly 时生效，0=周日 … 6=周六 */
  weekday: number;
  /** 轮值顺序（成员 id 列表），按周/日顺延 */
  rotation: ID[];
  /** 轮值锚点：该日期由 rotation[0] 值日，其余日期按周期推算 */
  anchor: DateStr;
  color: string;
  active: boolean;
}

export type ChoreStatus = 'pending' | 'done' | 'skipped';

/** 变更记录：仅记录「与轮值规则不同」的那一天 */
export interface ChoreOverride {
  status?: ChoreStatus;
  /** 换班后的实际值日人 */
  memberId?: ID;
  doneAt?: string | null;
  /** 由谁完成（可能是帮忙代做的人） */
  doneBy?: ID;
  note?: string;
  /** 换班请求：待对方确认 */
  swapRequest?: { toMemberId: ID; requestedBy: ID; at: string } | null;
}

/** 派生结果：某一天、某个区域的值日安排 */
export interface ChoreOccurrence {
  key: string;
  taskId: ID;
  date: DateStr;
  memberId: ID | null;
  status: ChoreStatus;
  doneAt?: string | null;
  doneBy?: ID;
  note?: string;
  swapRequest?: ChoreOverride['swapRequest'];
  isToday: boolean;
}

/* ------------------------------------------------------ 公共物品与提醒 */

export type SupplyCategory = '清洁' | '厨房' | '日用' | '耗材';

export interface Supply {
  id: ID;
  name: string;
  emoji: string;
  category: SupplyCategory;
  unit: string;
  stock: number;
  /** 低于该值触发补货提醒 */
  lowStockThreshold: number;
  /** 满配数量，用于画库存条 */
  capacity: number;
  /** 更换周期（天），如滤芯、抹布；到点提醒更换 */
  cycleDays?: number | null;
  lastRestockedAt?: DateStr | null;
  note?: string;
  /** 默认分摊方式（补货时带入账单） */
  defaultSplit: SplitMode;
}

export type SupplyLogType = 'consume' | 'restock' | 'adjust';

export interface SupplyLog {
  id: ID;
  supplyId: ID;
  type: SupplyLogType;
  /** 变动数量，正数；consume 表示减少 */
  qty: number;
  memberId: ID;
  date: DateStr;
  /** 补货花的钱（元），会自动生成一笔 AA 账单 */
  cost?: number;
  expenseId?: ID;
  note?: string;
  createdAt: string;
}

/* -------------------------------------------------------------- 室友公约 */

export type PactCategory = '作息' | '卫生' | '访客' | '费用' | '宠物' | '其他';
export type PactStatus = 'proposed' | 'active' | 'rejected';
export type VoteValue = 'agree' | 'oppose' | 'abstain';

export interface PactVote {
  memberId: ID;
  vote: VoteValue;
  at: string;
  comment?: string;
}

export interface PactRevision {
  version: number;
  content: string;
  changedAt: string;
  changedBy: ID;
  summary: string;
}

export interface PactArticle {
  id: ID;
  title: string;
  category: PactCategory;
  content: string;
  status: PactStatus;
  version: number;
  proposedBy: ID;
  proposedAt: string;
  /** 生效需全体同意；达到票数即自动生效 */
  effectiveAt?: string | null;
  votes: PactVote[];
  history: PactRevision[];
  /** 违约记录（轻量，仅用于提醒与复盘） */
  breaches?: { id: ID; memberId: ID; date: DateStr; note: string }[];
}

/* -------------------------------------------------------------- 动态流 */

export type ActivityKind =
  | 'expense'
  | 'settlement'
  | 'chore'
  | 'supply'
  | 'pact'
  | 'member'
  | 'system';

export interface ActivityEvent {
  id: ID;
  kind: ActivityKind;
  memberId?: ID | null;
  text: string;
  at: string;
  meta?: Record<string, string | number>;
}

/* -------------------------------------------------------------- 聚合根 */

export interface HouseholdState {
  schemaVersion: number;
  /** 邀请码 / 房间码：室友凭此加入同一个「屋」 */
  code: string;
  name: string;
  address?: string;
  /** 每月结算日，用于提醒 */
  settleDay: number;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  choreTasks: ChoreTask[];
  choreOverrides: Record<string, ChoreOverride>;
  supplies: Supply[];
  supplyLogs: SupplyLog[];
  pacts: PactArticle[];
  activity: ActivityEvent[];
  /** 演示用：当前「我」是谁 */
  currentMemberId: ID;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------ 接口契约 */

export interface HouseholdResponse {
  ok: true;
  state: HouseholdState | null;
  source: 'db' | 'memory' | 'none';
  /** 提醒：数据库未配置时返回值 */
  storage: 'libsql' | 'memory';
}

export interface ApiError {
  ok: false;
  error: string;
}
