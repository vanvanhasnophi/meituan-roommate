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

/* 说明：账单**不记录垫付人**。
 * 「谁记的」不等于「谁付的」—— 记账的人常常只是代录，
 * 真正谁垫了钱在结算时一次性输入即可（见 SettlementDraft）。
 * 这样账单只承担「这笔共同支出怎么分摊」这一件事。 */

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

/**
 * 公共物品：不做出入库台账，只保留三件事 ——
 *   1. 上一次报告的剩余数量（stock）
 *   2. 上一次补货的时间与数量（用来估算消耗速率）
 *   3. 报告流水（每次「还剩几瓶」都是速率的一个采样点）
 * 没有「满配」概念：采购量每次都可能不同，固定容量只会逼着人填假数据。
 */
export interface Supply {
  id: ID;
  name: string;
  emoji: string;
  category: SupplyCategory;
  unit: string;
  /** 最近一次报告的剩余数量；0 表示已用完 */
  stock: number;
  /** 上一次补货日期，用于估算消耗速率 */
  lastRestockedAt?: DateStr | null;
  /** 上一次补货数量；采购量会变，所以只记「这一次买了多少」 */
  lastRestockQty?: number | null;
  /** 到 N 天内用完就提醒补货，默认 3 */
  alertDays?: number;
  note?: string;
}

/**
 * 物品流水只记三种事实：
 *   report  报告还剩多少（一个采样点）
 *   empty   报告用完（独立动作，一键完成）
 *   restock 补货（可带花费，自动生成 AA 账单）
 */
export type SupplyLogType = 'report' | 'empty' | 'restock';

export interface SupplyLog {
  id: ID;
  supplyId: ID;
  type: SupplyLogType;
  /** report=报告的剩余数量；restock=本次采购数量；empty=0 */
  qty: number;
  memberId: ID;
  date: DateStr;
  /** 补货花的钱（元），会自动生成一笔 AA 账单 */
  cost?: number;
  expenseId?: ID;
  note?: string;
  createdAt: string;
}

/** 结算计算器的输入：谁垫了多少钱。只存在于前端草稿，不进主数据模型 */
export interface SettlementDraft {
  /** memberId → 本期垫付金额（元） */
  paid: Record<ID, number>;
  updatedAt: string;
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
  /** 2 = 账单去垫付人、物品去满配、结算改为临时计算器 */
  schemaVersion: number;
  /** 邀请码 / 房间码：室友凭此加入同一个「屋」 */
  code: string;
  name: string;
  address?: string;
  /** 每月结算日，用于提醒 */
  settleDay: number;
  members: Member[];
  expenses: Expense[];
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
