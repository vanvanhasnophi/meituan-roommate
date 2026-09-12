import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  Trash2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  activeMembers,
  addMonths,
  computeBalances,
  expenseShares,
  formatMoney,
  formatSigned,
  friendlyDate,
  memberById,
  monthExpenses,
  monthKey,
  monthLabel,
  settlePlan,
  startOfMonth,
  todayStr,
} from '../../shared/logic';
import { EXPENSE_CATEGORIES, SPLIT_MODES } from '../../shared/meta';
import type { Expense, ExpenseCategory, ID, SplitMode } from '../../shared/types';
import { Avatar, Button, Card, Chip, EmptyState, Field, Input, MemberPill, Modal, Progress, SectionHeader, Segmented, Textarea, cn } from '../components/ui';
import { useStore } from '../store/useStore';

const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

interface PartDraft {
  memberId: ID;
  on: boolean;
  weight: number;
}

export default function Expenses() {
  const state = useStore((s) => s.state);
  const me = state.members.find((m) => m.id === state.currentMemberId) ?? state.members[0];
  const addExpense = useStore((s) => s.addExpense);
  const updateExpense = useStore((s) => s.updateExpense);
  const removeExpense = useStore((s) => s.removeExpense);
  const settleTransfer = useStore((s) => s.settleTransfer);
  const undoLastSettlement = useStore((s) => s.undoLastSettlement);
  const showToast = useStore((s) => s.showToast);

  const [month, setMonth] = useState(() => monthKey(todayStr()));
  const [editing, setEditing] = useState<Expense | null>(null);
  const [creating, setCreating] = useState(false);

  const today = todayStr();
  const people = activeMembers(state);

  const view = useMemo(() => {
    const list = monthExpenses(state, month);
    const total = list.reduce((s, e) => s + e.amount, 0);
    const balances = computeBalances(state, month);
    const plan = settlePlan(balances);
    const byCategory = CATEGORY_KEYS.map((key) => ({
      key,
      amount: list.filter((e) => e.category === key).reduce((s, e) => s + e.amount, 0),
    }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const my = balances[me?.id ?? ''] ?? { net: 0, paid: 0, owed: 0 };
    const periodSettlements = state.settlements.filter((s) => monthKey(s.date) === month);
    return { list, total, balances, plan, byCategory, my, periodSettlements };
  }, [state, month, me?.id]);

  const isCurrentMonth = month === monthKey(today);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">账单与 AA 分摊</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-mute">
            谁垫付、谁参与、每人该出多少，系统算好；结算时只转最少的几笔钱。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1">
            <button
              type="button"
              className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/[0.05]"
              onClick={() => setMonth((m) => monthKey(addMonths(startOfMonth(`${m}-01`), -1)))}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="num min-w-[86px] text-center text-[13px] font-medium">{monthLabel(month)}</span>
            <button
              type="button"
              className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/[0.05] disabled:opacity-30"
              disabled={isCurrentMonth}
              onClick={() => setMonth((m) => monthKey(addMonths(startOfMonth(`${m}-01`), 1)))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> 记一笔
          </Button>
        </div>
      </div>

      {/* 指标 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">本月共同支出</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight">{formatMoney(view.total)}</div>
          <p className="mt-1 text-[12.5px] text-ink-mute">{view.list.length} 笔账单</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">人均</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight text-ink">
            {formatMoney(view.total / Math.max(1, people.length))}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-mute">{people.length} 位室友共同承担</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">我垫付</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight text-accent-600">{formatMoney(view.my.paid)}</div>
          <p className="mt-1 text-[12.5px] text-ink-mute">我该承担 {formatMoney(view.my.owed)}</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">{view.my.net >= 0 ? '我应收' : '我应付'}</span>
          <div
            className={cn(
              'num mt-2 text-2xl font-semibold tracking-tight',
              view.my.net >= 0 ? 'text-accent-600' : 'text-brand-600',
            )}
          >
            {formatMoney(Math.abs(view.my.net))}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-mute">每月 {state.settleDay} 日结算</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* 结算方案 */}
        <Card className="card-pad">
          <SectionHeader
            title="最优结算方案"
            subtitle="多角债务自动压缩，只保留最少转账笔数"
            icon={<HandCoins size={17} />}
            action={<Chip className="bg-black/[0.04] text-ink-mute">{view.plan.length} 笔转账</Chip>}
          />
          {view.plan.length === 0 ? (
            <p className="rounded-xl bg-accent-50 px-3 py-5 text-center text-[13.5px] text-accent-700">
              本期账目已平，谁都不欠谁 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {view.plan.map((t, i) => {
                const from = memberById(state, t.fromId);
                const to = memberById(state, t.toId);
                const mine = t.fromId === me?.id;
                return (
                  <div key={`${t.fromId}-${t.toId}-${i}`} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5">
                    <Avatar member={from} size="sm" />
                    <span className="text-[13.5px] font-medium">{from?.name}</span>
                    <ArrowRight size={14} className="text-ink-mute" />
                    <Avatar member={to} size="sm" />
                    <span className="text-[13.5px] font-medium">{to?.name}</span>
                    <span className="num ml-auto text-[15px] font-semibold text-brand-600">{formatMoney(t.amount)}</span>
                    <Button
                      size="xs"
                      variant={mine ? 'primary' : 'ghost'}
                      onClick={() => {
                        settleTransfer(t);
                        showToast(`已记录：${from?.name} 转给 ${to?.name} ${formatMoney(t.amount)}`, 'success');
                      }}
                    >
                      标记已转
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {view.periodSettlements.length > 0 ? (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-medium text-ink-soft">本期已结算 {view.periodSettlements.length} 笔</p>
                <button type="button" className="text-[12px] text-ink-mute underline" onClick={undoLastSettlement}>
                  撤销最近一笔
                </button>
              </div>
              <div className="space-y-1.5">
                {view.periodSettlements.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg bg-accent-50/70 px-3 py-2 text-[12.5px] text-accent-700">
                    <BadgeCheck size={14} />
                    {memberById(state, s.fromId)?.name} → {memberById(state, s.toId)?.name}
                    <span className="num ml-auto font-medium">{formatMoney(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        {/* 分类 + 余额 */}
        <Card className="card-pad">
          <SectionHeader title="支出结构" subtitle="看清钱花在哪里，才能谈怎么省" icon={<CircleDollarSign size={17} />} />
          {view.byCategory.length === 0 ? (
            <p className="rounded-xl bg-black/[0.03] px-3 py-5 text-center text-[13px] text-ink-mute">本月还没有账单</p>
          ) : (
            <div className="space-y-3">
              {view.byCategory.map((c) => {
                const meta = EXPENSE_CATEGORIES[c.key];
                return (
                  <div key={c.key}>
                    <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                      <span>{meta.emoji}</span>
                      <span className="font-medium">{meta.label}</span>
                      <span className="num ml-auto text-ink-mute">
                        {formatMoney(c.amount)} · {view.total > 0 ? Math.round((c.amount / view.total) * 100) : 0}%
                      </span>
                    </div>
                    <Progress value={view.total > 0 ? c.amount / view.total : 0} color={meta.color} />
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
              <Users size={14} className="text-brand-500" /> 每人净额
            </p>
            <div className="space-y-1.5">
              {state.members.map((m) => {
                const b = view.balances[m.id];
                if (!b) return null;
                return (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                    <Avatar member={m} size="sm" />
                    <span className="flex-1 text-[13.5px]">
                      {m.name}
                      {m.id === me?.id ? <span className="ml-1.5 text-[11.5px] text-brand-600">我</span> : null}
                      {m.movedOutAt ? <span className="ml-1.5 text-[11.5px] text-ink-mute">已搬离</span> : null}
                    </span>
                    <span className="num text-[12px] text-ink-mute">垫付 {formatMoney(b.paid)}</span>
                    <span
                      className={cn('num w-20 text-right text-[13.5px] font-medium', b.net >= 0 ? 'text-accent-600' : 'text-brand-600')}
                    >
                      {formatSigned(b.net)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* 账单明细 */}
      <Card className="card-pad">
        <SectionHeader
          title="账单明细"
          subtitle={`${monthLabel(month)} · ${view.list.length} 笔`}
          icon={<Receipt size={17} />}
          action={
            <Button variant="ghost" size="xs" onClick={() => setCreating(true)}>
              <Plus size={14} /> 新增
            </Button>
          }
        />
        {view.list.length === 0 ? (
          <EmptyState
            icon={<Receipt size={20} />}
            title="这个月还没有账目"
            hint="记一笔房租、水电或者一起买的菜，系统会自动算好每个人该出多少。"
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus size={15} /> 记第一笔
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            {groupByDate(view.list).map(([date, items]) => (
              <div key={date}>
                <div className="mb-2 flex items-center gap-2">
                  <CalendarDays size={13} className="text-ink-mute" />
                  <span className="text-[12.5px] font-medium text-ink-mute">{friendlyDate(date, today)}</span>
                  <span className="num text-[12px] text-ink-mute">
                    {formatMoney(items.reduce((s, e) => s + e.amount, 0))}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((e) => {
                    const meta = EXPENSE_CATEGORIES[e.category];
                    const shares = expenseShares(e);
                    const per = e.splitMode === 'even' ? e.amount / Math.max(1, e.participants.length) : null;
                    return (
                      <div key={e.id} className="group rounded-2xl border border-line bg-white px-3.5 py-3">
                        <div className="flex items-start gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                            style={{ backgroundColor: `${meta.color}14` }}
                          >
                            {meta.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[14.5px] font-medium">{e.title}</p>
                              {e.recurring === 'monthly' ? (
                                <Chip className="bg-accent-50 text-accent-700">
                                  <Repeat size={11} /> 每月
                                </Chip>
                              ) : null}
                              {e.source ? <Chip className="bg-brand-50 text-brand-700">来自物品补货</Chip> : null}
                            </div>
                            <p className="mt-0.5 text-[12.5px] text-ink-mute">
                              {memberById(state, e.paidBy)?.name} 垫付 · {meta.label} ·{' '}
                              {SPLIT_MODES[e.splitMode].label}
                              {per !== null ? `（每人 ${formatMoney(per)}）` : ''} · {e.participants.length} 人参与
                            </p>
                            {e.note ? <p className="mt-1 text-[12px] text-ink-mute/90">备注：{e.note}</p> : null}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {e.participants.map((p) => {
                                const m = memberById(state, p.memberId);
                                return (
                                  <span
                                    key={p.memberId}
                                    className="inline-flex items-center gap-1 rounded-full bg-black/[0.035] py-0.5 pl-0.5 pr-2 text-[11.5px] text-ink-soft"
                                  >
                                    <Avatar member={m} size="xs" />
                                    {m?.name}
                                    <span className="num text-ink-mute">{formatMoney(shares[p.memberId] ?? 0)}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className="num text-[16px] font-semibold tracking-tight">{formatMoney(e.amount)}</span>
                            <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 sm:opacity-100">
                              <button
                                type="button"
                                className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/[0.05] hover:text-ink"
                                onClick={() => setEditing(e)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-1.5 text-ink-mute transition hover:bg-danger-50 hover:text-danger-500"
                                onClick={() => removeExpense(e.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <ExpenseModal
          key={editing?.id ?? 'new'}
          expense={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={(draft) => {
            if (editing) {
              updateExpense(editing.id, draft);
              showToast('账单已更新', 'success');
            } else {
              addExpense(draft);
              showToast('已记账，分摊金额自动算好', 'success');
            }
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function groupByDate(list: Expense[]): [string, Expense[]][] {
  const map = new Map<string, Expense[]>();
  for (const e of list) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

/* ------------------------------------------------------------- 记账弹窗 */

function ExpenseModal({
  expense,
  onClose,
  onSubmit,
}: {
  expense: Expense | null;
  onClose: () => void;
  onSubmit: (draft: {
    title: string;
    amount: number;
    category: ExpenseCategory;
    paidBy: ID;
    date: string;
    splitMode: SplitMode;
    participants: { memberId: ID; weight: number }[];
    note?: string;
    recurring?: 'monthly' | null;
  }) => void;
}) {
  const state = useStore((s) => s.state);
  const me = state.members.find((m) => m.id === state.currentMemberId) ?? state.members[0];
  const people = activeMembers(state);

  const [title, setTitle] = useState(expense?.title ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'grocery');
  const [paidBy, setPaidBy] = useState<ID>(expense?.paidBy ?? me?.id ?? '');
  const [date, setDate] = useState(expense?.date ?? todayStr());
  const [splitMode, setSplitMode] = useState<SplitMode>(expense?.splitMode ?? 'even');
  const [note, setNote] = useState(expense?.note ?? '');
  const [recurring, setRecurring] = useState(expense?.recurring === 'monthly');
  const [parts, setParts] = useState<PartDraft[]>(() =>
    people.map((m) => {
      const existing = expense?.participants.find((p) => p.memberId === m.id);
      return {
        memberId: m.id,
        on: expense ? Boolean(existing) : true,
        weight: existing ? existing.weight : 1,
      };
    }),
  );

  const amountNum = Number(amount) || 0;
  const selected = parts.filter((p) => p.on);
  const preview = useMemo(() => {
    const pseudo: Expense = {
      id: 'preview',
      title,
      amount: amountNum,
      category,
      paidBy,
      date,
      splitMode,
      participants: selected.map((p) => ({ memberId: p.memberId, weight: p.weight })),
      createdAt: '',
    };
    return expenseShares(pseudo);
  }, [amountNum, category, date, paidBy, selected, splitMode, title]);

  const valid = title.trim().length > 0 && amountNum > 0 && selected.length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? '编辑账单' : '记一笔共同支出'}
      subtitle="填写金额与参与人，分摊结果实时预览"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                amount: Number(amountNum.toFixed(2)),
                category,
                paidBy,
                date,
                splitMode,
                participants: selected.map((p) => ({
                  memberId: p.memberId,
                  weight: splitMode === 'even' ? 1 : Number(p.weight.toFixed(2)),
                })),
                note: note.trim() || undefined,
                recurring: recurring ? 'monthly' : null,
              })
            }
          >
            {expense ? '保存修改' : '确认记账'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
          <Field label="账单名称">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：6 月房租 / 周末火锅食材" />
          </Field>
          <Field label="金额（元）">
            <Input
              value={amount}
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0.00"
            />
          </Field>
        </div>

        <Field label="类别">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_KEYS.map((k) => {
              const meta = EXPENSE_CATEGORIES[k];
              const active = category === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCategory(k)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] transition',
                    active ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-soft hover:border-brand-200',
                  )}
                >
                  <span>{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="谁垫付的">
            <div className="flex flex-wrap gap-2">
              {people.map((m) => (
                <MemberPill key={m.id} member={m} active={paidBy === m.id} onClick={() => setPaidBy(m.id)} />
              ))}
            </div>
          </Field>
          <Field label="发生日期" hint={recurring ? '标记为每月账单后，下月可一键复制' : undefined}>
            <div className="flex gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button
                type="button"
                onClick={() => setRecurring((v) => !v)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[13px] transition',
                  recurring ? 'border-accent-300 bg-accent-50 text-accent-700' : 'border-line bg-white text-ink-mute',
                )}
              >
                <Repeat size={14} /> 每月
              </button>
            </div>
          </Field>
        </div>

        <Field label="分摊方式" hint={SPLIT_MODES[splitMode].hint}>
          <Segmented
            value={splitMode}
            onChange={(v) => setSplitMode(v)}
            options={[
              { value: 'even' as SplitMode, label: '均分' },
              { value: 'shares' as SplitMode, label: '按份数' },
              { value: 'custom' as SplitMode, label: '自定义金额' },
            ]}
          />
        </Field>

        <Field label="参与分摊的人">
          <div className="space-y-2">
            {parts.map((p, idx) => {
              const m = state.members.find((x) => x.id === p.memberId);
              return (
                <div key={p.memberId} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      setParts((prev) => prev.map((x, i) => (i === idx ? { ...x, on: !x.on } : x)))
                    }
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] transition',
                      p.on ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white text-transparent',
                    )}
                  >
                    ✓
                  </button>
                  <Avatar member={m} size="sm" />
                  <span className="flex-1 text-[13.5px]">{m?.name}</span>
                  {splitMode !== 'even' ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        className="w-20 py-1.5 text-right text-[13px]"
                        inputMode="decimal"
                        value={String(p.weight)}
                        onChange={(e) => {
                          const v = Number(e.target.value.replace(/[^\d.]/g, '')) || 0;
                          setParts((prev) => prev.map((x, i) => (i === idx ? { ...x, weight: v } : x)));
                        }}
                        disabled={!p.on}
                      />
                      <span className="text-[12px] text-ink-mute">{splitMode === 'shares' ? '份' : '元'}</span>
                    </div>
                  ) : null}
                  <span className="num w-20 text-right text-[13.5px] font-medium text-brand-600">
                    {p.on ? formatMoney(preview[p.memberId] ?? 0) : '不参与'}
                  </span>
                </div>
              );
            })}
          </div>
        </Field>

        <Field label="备注（可选）">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="说明特殊情况，避免日后争执" />
        </Field>

        <div className="rounded-2xl bg-brand-50 px-4 py-3">
          <p className="text-[12.5px] text-brand-700">
            合计 <span className="num font-semibold">{formatMoney(amountNum)}</span> 由 {selected.length} 人分摊
            {splitMode === 'even' && selected.length > 0 ? (
              <>
                ，每人约 <span className="num font-semibold">{formatMoney(amountNum / selected.length)}</span>
              </>
            ) : null}
            。金额按「分」做整数运算，不会出现差一分钱的情况。
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- 记账弹窗 */
