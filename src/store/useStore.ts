import { create } from 'zustand';

import { activeMembers, clone, todayStr, uid, type Transfer } from '../../shared/logic';
import { createSeedState } from '../../shared/seed';
import type {
  ActivityKind,
  ChoreOverride,
  DateStr,
  Expense,
  ExpenseCategory,
  HouseholdState,
  ID,
  PactCategory,
  PactVote,
  SplitEntry,
  SplitMode,
  Supply,
  SupplyCategory,
  VoteValue,
} from '../../shared/types';
import { DEFAULT_CODE, fetchHousehold, pushHousehold, resetHousehold, type StorageDriver } from '../lib/api';

const LS_KEY = 'tongwu.household.v2';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline';

export interface Toast {
  id: string;
  text: string;
  tone: 'default' | 'success' | 'warn';
  action?: { label: string; run: () => void };
}

interface Store {
  state: HouseholdState;
  ready: boolean;
  driver: StorageDriver;
  hint?: string;
  sync: SyncStatus;
  toast: Toast | null;

  bootstrap: () => Promise<void>;
  setCurrentMember: (id: ID) => void;
  showToast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: () => void;

  setMemberMovedOut: (id: ID, movedOut: boolean) => void;
  addMember: (input: { name: string; avatar: string; color: string }) => void;

  addExpense: (input: NewExpense) => void;
  updateExpense: (id: ID, patch: Partial<Expense>) => void;
  removeExpense: (id: ID) => void;
  settleTransfer: (t: Transfer) => void;
  undoLastSettlement: () => void;

  completeChore: (key: string) => void;
  reopenChore: (key: string) => void;
  skipChore: (key: string, note?: string) => void;
  requestSwap: (key: string, toMemberId: ID) => void;
  resolveSwap: (key: string, accept: boolean) => void;
  reassignChore: (key: string, memberId: ID) => void;

  addSupply: (input: NewSupply) => void;
  updateSupply: (id: ID, patch: Partial<Supply>) => void;
  removeSupply: (id: ID) => void;
  consumeSupply: (id: ID, qty: number, memberId?: ID) => void;
  restockSupply: (id: ID, input: { qty: number; cost: number; paidBy: ID; note?: string }) => void;

  proposePact: (input: { title: string; category: PactCategory; content: string }) => void;
  votePact: (id: ID, vote: VoteValue, comment?: string) => void;
  revisePact: (id: ID, content: string, summary: string) => void;
  addBreach: (id: ID, memberId: ID, note: string) => void;

  renameHousehold: (name: string) => void;
  resetDemo: () => Promise<void>;
}

export interface NewExpense {
  title: string;
  amount: number;
  category: ExpenseCategory;
  paidBy: ID;
  date: DateStr;
  splitMode: SplitMode;
  participants: SplitEntry[];
  note?: string;
  recurring?: 'monthly' | null;
}

export interface NewSupply {
  name: string;
  emoji: string;
  category: SupplyCategory;
  unit: string;
  stock: number;
  lowStockThreshold: number;
  capacity: number;
  cycleDays?: number | null;
  note?: string;
}

/* ------------------------------------------------------------ 本地持久化 */

function readLocal(): HouseholdState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HouseholdState;
    if (!parsed || !Array.isArray(parsed.members)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(state: HouseholdState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式或超出配额时静默降级 */
  }
}

/* ---------------------------------------------------------- 远端同步节流 */

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pending: HouseholdState | null = null;

function schedulePush(state: HouseholdState, onResult: (driver: StorageDriver) => void): void {
  pending = state;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const snapshot = pending;
    pending = null;
    pushTimer = null;
    if (!snapshot) return;
    const res = await pushHousehold(snapshot);
    onResult(res.ok ? res.driver : 'local');
  }, 600);
}

/* ------------------------------------------------------------------ store */

export const useStore = create<Store>((set, get) => {
  /** 统一的变更入口：克隆 → 修改 → 落本地 → 节流推送 */
  const commit = (
    recipe: (draft: HouseholdState) => void,
    activity?: { kind: ActivityKind; text: string; memberId?: ID | null },
  ) => {
    const draft = clone(get().state);
    recipe(draft);
    if (activity) {
      draft.activity = [
        {
          id: uid('a'),
          kind: activity.kind,
          text: activity.text,
          memberId: activity.memberId ?? draft.currentMemberId,
          at: new Date().toISOString(),
        },
        ...draft.activity,
      ].slice(0, 120);
    }
    draft.updatedAt = new Date().toISOString();
    writeLocal(draft);
    set({ state: draft, sync: 'saving' });
    schedulePush(draft, (driver) => set({ driver, sync: driver === 'local' ? 'offline' : 'saved' }));
  };

  const memberName = (id: ID | null | undefined) =>
    get().state.members.find((m) => m.id === id)?.name ?? '某位室友';

  return {
    state: createSeedState(),
    ready: false,
    driver: 'local',
    sync: 'idle',
    toast: null,

    async bootstrap() {
      const local = readLocal();
      if (local) set({ state: local });

      const remote = await fetchHousehold(local?.code ?? DEFAULT_CODE);
      const remoteState = remote.state;

      if (remoteState) {
        const localTime = local ? Date.parse(local.updatedAt || local.createdAt || '') || 0 : 0;
        const remoteTime = Date.parse(remoteState.updatedAt || remoteState.createdAt || '') || 0;
        // 远端更新（可能是其他室友改的）则采用远端；否则把本地未同步的改动推上去
        if (!local || remoteTime > localTime) {
          writeLocal(remoteState);
          set({ state: remoteState, ready: true, driver: remote.driver, hint: remote.hint, sync: 'idle' });
          return;
        }
        set({ ready: true, driver: remote.driver, hint: remote.hint, sync: 'saving' });
        const res = await pushHousehold(local);
        set({ sync: res.ok ? 'saved' : 'offline', driver: res.ok ? res.driver : 'local' });
        return;
      }

      if (remote.offline) {
        set({ ready: true, driver: 'local', sync: 'offline', hint: '当前为本地模式：数据保存在这台设备的浏览器里。' });
        return;
      }
      set({ ready: true, driver: remote.driver, hint: remote.hint, sync: 'idle' });
    },

    setCurrentMember(id) {
      commit((d) => {
        d.currentMemberId = id;
      });
    },

    showToast(text, tone = 'default', action) {
      const id = uid('t');
      set({ toast: { id, text, tone, action } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, action ? 8000 : 3200);
    },

    dismissToast() {
      set({ toast: null });
    },

    /* ------------------------------------------------------------ 成员 */

    setMemberMovedOut(id, movedOut) {
      commit(
        (d) => {
          const m = d.members.find((x) => x.id === id);
          if (!m) return;
          m.movedOutAt = movedOut ? todayStr() : null;
        },
        {
          kind: 'member',
          text: movedOut ? `${memberName(id)} 已搬离，自动退出后续排班与分摊` : `${memberName(id)} 重新加入小屋`,
        },
      );
    },

    addMember({ name, avatar, color }) {
      const id = uid('m');
      commit(
        (d) => {
          d.members.push({ id, name, avatar, color, role: 'member', joinedAt: todayStr() });
          d.choreTasks.forEach((t) => t.rotation.push(id));
        },
        { kind: 'member', text: `${name} 加入了小屋，已自动排入值日轮值` },
      );
    },

    /* ------------------------------------------------------------ 账单 */

    addExpense(input) {
      const id = uid('e');
      commit(
        (d) => {
          d.expenses.unshift({
            id,
            title: input.title,
            amount: input.amount,
            category: input.category,
            paidBy: input.paidBy,
            date: input.date,
            splitMode: input.splitMode,
            participants: input.participants,
            note: input.note,
            recurring: input.recurring ?? null,
            source: null,
            createdBy: d.currentMemberId,
            createdAt: new Date().toISOString(),
          });
        },
        {
          kind: 'expense',
          text: `记了一笔「${input.title}」¥${input.amount.toFixed(2)}，${input.participants.length} 人参与分摊`,
        },
      );
    },

    updateExpense(id, patch) {
      commit((d) => {
        const i = d.expenses.findIndex((e) => e.id === id);
        if (i >= 0) d.expenses[i] = { ...d.expenses[i], ...patch };
      });
    },

    removeExpense(id) {
      const title = get().state.expenses.find((e) => e.id === id)?.title ?? '账单';
      commit(
        (d) => {
          d.expenses = d.expenses.filter((e) => e.id !== id);
          d.supplyLogs = d.supplyLogs.map((l) => (l.expenseId === id ? { ...l, expenseId: undefined } : l));
        },
        { kind: 'expense', text: `删除了账单「${title}」` },
      );
    },

    settleTransfer(t) {
      const id = uid('s');
      const from = memberName(t.fromId);
      const to = memberName(t.toId);
      commit(
        (d) => {
          d.settlements.unshift({
            id,
            fromId: t.fromId,
            toId: t.toId,
            amount: t.amount,
            date: todayStr(),
            note: '按最优结算方案结清',
            createdAt: new Date().toISOString(),
          });
        },
        { kind: 'settlement', text: `${from} 转账给 ${to} ¥${t.amount.toFixed(2)}`, memberId: t.fromId },
      );
    },

    undoLastSettlement() {
      commit(
        (d) => {
          const last = d.settlements[0];
          if (last) {
            d.settlements = d.settlements.slice(1);
            d.activity = [
              ...d.activity,
              { id: uid('a'), kind: 'settlement', text: `撤销了一笔转账记录`, at: new Date().toISOString() },
            ];
          }
        },
        { kind: 'settlement', text: '撤销了最近一笔转账记录' },
      );
    },

    /* ---------------------------------------------------------- 值日 */

    completeChore(key) {
      const st = get().state;
      const [taskId, date] = key.split(':');
      const task = st.choreTasks.find((t) => t.id === taskId);
      const prev = st.choreOverrides[key];
      const who = prev?.memberId ?? task?.rotation[0] ?? st.currentMemberId;
      commit(
        (d) => {
          d.choreOverrides[key] = {
            ...(d.choreOverrides[key] ?? {}),
            status: 'done',
            doneAt: new Date().toISOString(),
            doneBy: st.currentMemberId,
            memberId: prev?.memberId ?? who,
          };
        },
        {
          kind: 'chore',
          text: `${memberName(st.currentMemberId)} 完成 ${date} 的「${task?.area ?? '值日'}」`,
        },
      );
      get().showToast(`已打卡：${task?.area ?? '值日'} ✅`, 'success');
    },

    reopenChore(key) {
      commit((d) => {
        const ov = d.choreOverrides[key];
        if (ov) {
          ov.status = 'pending';
          ov.doneAt = null;
          ov.doneBy = undefined;
        }
      });
    },

    skipChore(key, note) {
      const st = get().state;
      const [taskId] = key.split(':');
      const task = st.choreTasks.find((t) => t.id === taskId);
      commit(
        (d) => {
          d.choreOverrides[key] = { ...(d.choreOverrides[key] ?? {}), status: 'skipped', note, doneAt: null };
        },
        { kind: 'chore', text: `跳过了「${task?.area ?? '值日'}」，已记录原因` },
      );
    },

    requestSwap(key, toMemberId) {
      const mine = get().state.currentMemberId;
      const target = memberName(toMemberId);
      commit(
        (d) => {
          d.choreOverrides[key] = {
            ...(d.choreOverrides[key] ?? {}),
            swapRequest: { toMemberId, requestedBy: mine, at: new Date().toISOString() },
          };
        },
        { kind: 'chore', text: `向 ${target} 发起了换班请求`, memberId: mine },
      );
      get().showToast(`已发送换班请求给 ${target}`, 'success');
    },

    resolveSwap(key, accept) {
      const st = get().state;
      const [taskId] = key.split(':');
      const task = st.choreTasks.find((t) => t.id === taskId);
      const ov = st.choreOverrides[key];
      const target = ov?.swapRequest?.toMemberId;
      commit(
        (d) => {
          const cur = d.choreOverrides[key];
          if (!cur?.swapRequest) return;
          if (accept && target) {
            cur.memberId = target;
            cur.status = 'pending';
          }
          cur.swapRequest = null;
        },
        {
          kind: 'chore',
          text: accept
            ? `${memberName(target)} 接下了「${task?.area ?? '值日'}」的换班`
            : `${memberName(target)} 拒绝了换班请求`,
        },
      );
      get().showToast(accept ? '换班已确认，排班已更新' : '已拒绝换班请求', accept ? 'success' : 'warn');
    },

    reassignChore(key, memberId) {
      commit(
        (d) => {
          const cur: ChoreOverride = d.choreOverrides[key] ?? {};
          d.choreOverrides[key] = { ...cur, memberId, status: 'pending', doneAt: null, swapRequest: null };
        },
        { kind: 'chore', text: `把值日调整给 ${memberName(memberId)}` },
      );
    },

    /* ---------------------------------------------------------- 物品 */

    addSupply(input) {
      const id = uid('sp');
      commit(
        (d) => {
          d.supplies.push({
            id,
            name: input.name,
            emoji: input.emoji,
            category: input.category,
            unit: input.unit,
            stock: input.stock,
            lowStockThreshold: input.lowStockThreshold,
            capacity: Math.max(input.capacity, input.stock, 1),
            cycleDays: input.cycleDays ?? null,
            lastRestockedAt: todayStr(),
            note: input.note,
            defaultSplit: 'even',
          });
        },
        { kind: 'supply', text: `登记了新的公共物品「${input.name}」` },
      );
    },

    updateSupply(id, patch) {
      commit((d) => {
        const i = d.supplies.findIndex((s) => s.id === id);
        if (i >= 0) d.supplies[i] = { ...d.supplies[i], ...patch };
      });
    },

    removeSupply(id) {
      const name = get().state.supplies.find((s) => s.id === id)?.name ?? '物品';
      commit(
        (d) => {
          d.supplies = d.supplies.filter((s) => s.id !== id);
          d.supplyLogs = d.supplyLogs.filter((l) => l.supplyId !== id);
        },
        { kind: 'supply', text: `移除了物品「${name}」` },
      );
    },

    consumeSupply(id, qty, memberId) {
      const st = get().state;
      const supply = st.supplies.find((s) => s.id === id);
      if (!supply || qty <= 0) return;
      const who = memberId ?? st.currentMemberId;
      const nextStock = Math.max(0, supply.stock - qty);
      const willAlert = nextStock <= supply.lowStockThreshold;
      commit(
        (d) => {
          const s = d.supplies.find((x) => x.id === id);
          if (s) s.stock = nextStock;
          d.supplyLogs.unshift({
            id: uid('sl'),
            supplyId: id,
            type: 'consume',
            qty,
            memberId: who,
            date: todayStr(),
            createdAt: new Date().toISOString(),
          });
        },
        { kind: 'supply', text: `${memberName(who)} 用了 ${qty} ${supply.unit}${supply.name}`, memberId: who },
      );
      if (willAlert) {
        get().showToast(`${supply.name} 库存偏低，记得补货 🛒`, 'warn', {
          label: '去补货',
          run: () => {
            window.location.hash = '#/supplies';
          },
        });
      }
    },

    restockSupply(id, { qty, cost, paidBy, note }) {
      const st = get().state;
      const supply = st.supplies.find((s) => s.id === id);
      if (!supply) return;
      const expenseId = cost > 0 ? uid('e') : undefined;
      const sharers = activeMembers(st).map((m) => ({ memberId: m.id, weight: 1 }));
      commit(
        (d) => {
          const s = d.supplies.find((x) => x.id === id);
          if (s) {
            s.stock = s.stock + qty;
            s.lastRestockedAt = todayStr();
            s.capacity = Math.max(s.capacity, s.stock, 1);
          }
          d.supplyLogs.unshift({
            id: uid('sl'),
            supplyId: id,
            type: 'restock',
            qty,
            memberId: paidBy,
            date: todayStr(),
            cost: cost > 0 ? cost : undefined,
            expenseId,
            note,
            createdAt: new Date().toISOString(),
          });
          if (expenseId) {
            d.expenses.unshift({
              id: expenseId,
              title: `公共物品补货 · ${supply.name}`,
              amount: cost,
              category: 'supply',
              paidBy,
              date: todayStr(),
              splitMode: 'even',
              participants: sharers,
              source: { type: 'supply', id, label: `${supply.name} ×${qty}${supply.unit}` },
              createdBy: d.currentMemberId,
              createdAt: new Date().toISOString(),
            });
          }
        },
        {
          kind: 'supply',
          text:
            cost > 0
              ? `${memberName(paidBy)} 补货 ${supply.name} ×${qty}，并自动生成 ¥${cost.toFixed(2)} 的 AA 账单`
              : `${memberName(paidBy)} 补货 ${supply.name} ×${qty}`,
          memberId: paidBy,
        },
      );
      get().showToast(
        cost > 0 ? `已补货，并自动记了一笔 ¥${cost.toFixed(2)} 的 AA 账单` : '已登记补货',
        'success',
      );
    },

    /* ---------------------------------------------------------- 公约 */

    proposePact({ title, category, content }) {
      const id = uid('p');
      commit(
        (d) => {
          d.pacts.unshift({
            id,
            title,
            category,
            content,
            status: 'proposed',
            version: 1,
            proposedBy: d.currentMemberId,
            proposedAt: new Date().toISOString(),
            effectiveAt: null,
            votes: [{ memberId: d.currentMemberId, vote: 'agree', at: new Date().toISOString(), comment: '发起人默认同意' }],
            history: [],
            breaches: [],
          });
        },
        { kind: 'pact', text: `发起公约提案「${title}」，等待室友表决` },
      );
    },

    votePact(id, vote, comment) {
      const st = get().state;
      const me = st.currentMemberId;
      const pact = st.pacts.find((p) => p.id === id);
      const eligible = activeMembers(st);
      const others = pact?.votes.filter((v) => v.memberId !== me) ?? [];
      const agreeAfter =
        others.filter((v) => v.vote === 'agree').length + (vote === 'agree' ? 1 : 0);
      const willPass = agreeAfter >= eligible.length;

      commit(
        (d) => {
          const p = d.pacts.find((x) => x.id === id);
          if (!p) return;
          const v: PactVote = { memberId: me, vote, at: new Date().toISOString(), comment };
          p.votes = [...p.votes.filter((x) => x.memberId !== me), v];
          if (willPass && p.status === 'proposed') {
            p.status = 'active';
            p.effectiveAt = new Date().toISOString();
          }
        },
        {
          kind: 'pact',
          text:
            vote === 'agree'
              ? `同意公约「${pact?.title ?? ''}」`
              : vote === 'oppose'
                ? `反对公约「${pact?.title ?? ''}」`
                : `对公约「${pact?.title ?? ''}」弃权`,
        },
      );
      if (willPass) get().showToast('全体同意，公约已生效 🎉', 'success');
      else get().showToast('已记录你的表决', 'success');
    },

    revisePact(id, content, summary) {
      commit(
        (d) => {
          const p = d.pacts.find((x) => x.id === id);
          if (!p) return;
          p.history = [
            ...p.history,
            {
              version: p.version,
              content: p.content,
              changedAt: new Date().toISOString(),
              changedBy: d.currentMemberId,
              summary: summary || '修订',
            },
          ];
          p.version += 1;
          p.content = content;
          p.status = 'proposed';
          p.effectiveAt = null;
          p.votes = [
            { memberId: d.currentMemberId, vote: 'agree', at: new Date().toISOString(), comment: `第 ${p.version} 版修订` },
          ];
          p.proposedAt = new Date().toISOString();
        },
        { kind: 'pact', text: `发起公约修订，等待重新表决` },
      );
      get().showToast('已提交修订，公约回到「待表决」', 'success');
    },

    addBreach(id, memberId, note) {
      const name = memberName(memberId);
      commit(
        (d) => {
          const p = d.pacts.find((x) => x.id === id);
          if (!p) return;
          p.breaches = [...(p.breaches ?? []), { id: uid('b'), memberId, date: todayStr(), note }];
        },
        { kind: 'pact', text: `记录了一条违约提醒：${name}`, memberId },
      );
    },

    renameHousehold(name) {
      commit((d) => {
        d.name = name;
      });
    },

    async resetDemo() {
      const fresh = await resetHousehold(get().state.code);
      const next = fresh ?? createSeedState();
      writeLocal(next);
      set({ state: next, ready: true });
      get().showToast('演示数据已重置', 'success');
    },
  };
});
