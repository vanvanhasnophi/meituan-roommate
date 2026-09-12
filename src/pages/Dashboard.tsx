import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  Package,
  ScrollText,
  Sparkles,
  TrendingUp,
  Vote,
} from 'lucide-react';
import { useMemo } from 'react';

import {
  activeAlerts,
  activeMembers,
  choreStats,
  computeBalances,
  formatMoney,
  formatSigned,
  friendlyDate,
  memberById,
  monthExpenses,
  monthKey,
  occurrencesOn,
  pactProgress,
  parseDate,
  settlePlan,
  startOfMonth,
  todayStr,
  WEEKDAY_LABELS,
} from '../../shared/logic';
import { Avatar, Button, Card, Chip, Progress, SectionHeader, StatTile, cn } from '../components/ui';
import { useStore } from '../store/useStore';

type Route = 'dashboard' | 'expenses' | 'chores' | 'supplies' | 'pacts' | 'about';

export default function Dashboard({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const state = useStore((s) => s.state);
  const completeChore = useStore((s) => s.completeChore);
  const votePact = useStore((s) => s.votePact);

  const today = todayStr();
  const me = state.members.find((m) => m.id === state.currentMemberId) ?? state.members[0];
  const month = monthKey(today);

  const data = useMemo(() => {
    const balances = computeBalances(state, month);
    const myBalance = balances[me?.id ?? ''] ?? { net: 0, paid: 0, owed: 0 };
    const plan = settlePlan(balances);
    const monthList = monthExpenses(state, month);
    const total = monthList.reduce((s, e) => s + e.amount, 0);

    const todayChores = occurrencesOn(state, today);
    const myChores = todayChores.filter((o) => o.memberId === me?.id);
    const stats = choreStats(state, startOfMonth(today), today);
    const myStats = stats[me?.id ?? ''] ?? { done: 0, pending: 0, skipped: 0, rate: 1, points: 0 };
    const alerts = activeAlerts(state, today);

    const myTransfers = plan.filter((t) => t.fromId === me?.id || t.toId === me?.id);
    const pendingSwaps = Object.entries(state.choreOverrides).filter(
      ([, ov]) => ov.swapRequest && ov.swapRequest.toMemberId === me?.id,
    );
    const votablePacts = state.pacts.filter(
      (p) => p.status === 'proposed' && !p.votes.some((v) => v.memberId === me?.id),
    );

    return {
      balances,
      myBalance,
      plan,
      monthList,
      total,
      todayChores,
      myChores,
      myStats,
      alerts,
      myTransfers,
      pendingSwaps,
      votablePacts,
      monthCount: monthList.length,
    };
  }, [state, me?.id, month, today]);

  const hour = new Date().getHours();
  const greeting = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  /** 待我处理：把「提醒」变成「可点击的下一步」 */
  const todos: { id: string; icon: typeof AlertTriangle; text: string; sub: string; action: () => void; label: string; tone: 'brand' | 'warn' }[] = [];
  if (data.pendingSwaps.length > 0) {
    const [key] = data.pendingSwaps[0];
    const [taskId, date] = key.split(':');
    const task = state.choreTasks.find((t) => t.id === taskId);
    todos.push({
      id: 'swap',
      icon: CalendarCheck,
      text: `${memberById(state, state.choreOverrides[key]?.swapRequest?.requestedBy)?.name ?? '室友'} 想把 ${friendlyDate(date, today)} 的「${task?.area}」换给你`,
      sub: '确认后你将成为当天的值日人',
      action: () => onNavigate('chores'),
      label: '去处理',
      tone: 'warn',
    });
  }
  const myPendingToday = data.myChores.filter((o) => o.status === 'pending');
  if (myPendingToday.length > 0) {
    const first = myPendingToday[0];
    const task = state.choreTasks.find((t) => t.id === first.taskId);
    todos.push({
      id: 'chore',
      icon: CalendarCheck,
      text: `今天轮到你做「${task?.area}」`,
      sub: task?.standard ?? '',
      action: () => completeChore(first.key),
      label: '标记完成',
      tone: 'brand',
    });
  }
  if (data.votablePacts.length > 0) {
    todos.push({
      id: 'pact',
      icon: Vote,
      text: `公约「${data.votablePacts[0].title}」等待你表决`,
      sub: '全体同意后自动生效',
      action: () => onNavigate('pacts'),
      label: '去表决',
      tone: 'warn',
    });
  }
  const lowSupplies = data.alerts.filter((a) => a.level === 'out' || a.level === 'low');
  if (lowSupplies.length > 0) {
    todos.push({
      id: 'supply',
      icon: Package,
      text: `${lowSupplies.length} 件公共物品需要补货`,
      sub: lowSupplies
        .slice(0, 3)
        .map((a) => a.supply.name)
        .join('、'),
      action: () => onNavigate('supplies'),
      label: '去补货',
      tone: 'warn',
    });
  }

  return (
    <div className="space-y-6">
      {/* 问候 */}
      <section className="animate-fade-up">
        <p className="text-[13px] text-ink-mute">
          {parseDate(today).getMonth() + 1} 月 {parseDate(today).getDate()} 日 · {WEEKDAY_LABELS[parseDate(today).getDay()]}
        </p>
        <h2 className="mt-1 text-[26px] font-semibold tracking-tight sm:text-[30px]">
          {greeting}，{me?.name} {me?.avatar}
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
          {todos.length > 0 ? (
            <>
              今天有 <span className="font-semibold text-brand-600">{todos.length}</span> 件事等你就手处理，
              处理完就可以安心躺平了。
            </>
          ) : (
            <>
              今天没有待办事项，小屋运转得很顺 <Sparkles size={13} className="mb-0.5 inline" />
            </>
          )}
        </p>
      </section>

      {/* 待办 */}
      {todos.length > 0 ? (
        <section className="space-y-2.5">
          {todos.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-4 py-3.5',
                  t.tone === 'warn' ? 'border-warn-300/60 bg-warn-50' : 'border-brand-200 bg-brand-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    t.tone === 'warn' ? 'bg-white/70 text-warn-700' : 'bg-white/70 text-brand-600',
                  )}
                >
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-snug text-ink">{t.text}</p>
                  {t.sub ? <p className="mt-0.5 truncate text-[12.5px] text-ink-mute">{t.sub}</p> : null}
                </div>
                <Button size="xs" variant={t.tone === 'warn' ? 'ghost' : 'primary'} onClick={t.action} className="shrink-0">
                  {t.label}
                </Button>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* 核心指标 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="本月共同支出"
          value={formatMoney(data.total)}
          sub={`${data.monthCount} 笔 · 人均约 ${formatMoney(data.total / Math.max(1, activeMembers(state).length))}`}
          icon={<CircleDollarSign size={16} />}
        />
        <StatTile
          label={data.myBalance.net >= 0 ? '我应收' : '我应付'}
          value={formatMoney(Math.abs(data.myBalance.net))}
          sub={data.myBalance.net >= 0 ? '室友需要转给我' : '需要在结算日转出'}
          tone={data.myBalance.net >= 0 ? 'accent' : 'brand'}
          icon={<HandCoins size={16} />}
        />
        <StatTile
          label="我的值日完成率"
          value={`${Math.round(data.myStats.rate * 100)}%`}
          sub={`本月 ${data.myStats.done} 次完成 · 值日积分 ${data.myStats.points}`}
          icon={<BadgeCheck size={16} />}
        />
        <StatTile
          label="待补货物品"
          value={`${data.alerts.length} 件`}
          sub={data.alerts.filter((a) => a.level === 'out').length > 0 ? '其中有物品已用完' : '低于安全库存'}
          tone={data.alerts.length > 0 ? 'warn' : 'default'}
          icon={<Package size={16} />}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 今日值日 */}
        <Card className="card-pad">
          <SectionHeader
            title="今日值日"
            subtitle={data.todayChores.length > 0 ? `共 ${data.todayChores.length} 项` : '今天没有排班任务'}
            icon={<CalendarCheck size={17} />}
            action={
              <Button variant="quiet" size="xs" onClick={() => onNavigate('chores')}>
                排班表 <ArrowRight size={13} />
              </Button>
            }
          />
          <div className="space-y-2">
            {data.todayChores.length === 0 ? (
              <p className="rounded-xl bg-black/[0.03] px-3 py-6 text-center text-[13px] text-ink-mute">
                今天没有固定值日，保持随手清洁就好 ✨
              </p>
            ) : (
              data.todayChores.map((o) => {
                const task = state.choreTasks.find((t) => t.id === o.taskId);
                const who = memberById(state, o.memberId);
                const mine = o.memberId === me?.id;
                return (
                  <div
                    key={o.key}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                      o.status === 'done'
                        ? 'border-accent-100 bg-accent-50/60'
                        : mine
                          ? 'border-brand-200 bg-white'
                          : 'border-line bg-white',
                    )}
                  >
                    <span className="text-lg">{task?.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[14px] font-medium">
                        {task?.area}
                        {mine ? <Chip className="bg-brand-100 text-brand-700">我</Chip> : null}
                      </p>
                      <p className="truncate text-[12px] text-ink-mute">{task?.standard}</p>
                    </div>
                    <Avatar member={who} size="sm" />
                    {o.status === 'done' ? (
                      <span className="flex items-center gap-1 text-[12.5px] font-medium text-accent-600">
                        <CheckCircle2 size={14} /> 已完成
                      </span>
                    ) : o.status === 'skipped' ? (
                      <span className="text-[12.5px] text-ink-mute">已跳过</span>
                    ) : mine ? (
                      <Button size="xs" onClick={() => completeChore(o.key)}>
                        打卡
                      </Button>
                    ) : (
                      <span className="text-[12.5px] text-ink-mute">待完成</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* 我的账单 */}
        <Card className="card-pad">
          <SectionHeader
            title="我的账单"
            subtitle={`${monthKey(today).slice(0, 4)} 年 ${Number(month)} 月账期 · 每月 ${state.settleDay} 日结算`}
            icon={<CircleDollarSign size={17} />}
            action={
              <Button variant="quiet" size="xs" onClick={() => onNavigate('expenses')}>
                明细 <ArrowRight size={13} />
              </Button>
            }
          />
          <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-white p-4">
            <p className="text-[12.5px] text-ink-mute">
              {data.myBalance.net >= 0 ? '本月你垫付多于应付，应收回' : '本月你应付多于垫付，应转出'}
            </p>
            <p
              className={cn(
                'num mt-1 text-[28px] font-semibold tracking-tight',
                data.myBalance.net >= 0 ? 'text-accent-600' : 'text-brand-600',
              )}
            >
              {formatSigned(data.myBalance.net)}
            </p>
            <div className="mt-3 flex gap-4 text-[12.5px] text-ink-mute">
              <span>
                我垫付 <span className="num font-medium text-ink-soft">{formatMoney(data.myBalance.paid)}</span>
              </span>
              <span>
                我应付 <span className="num font-medium text-ink-soft">{formatMoney(data.myBalance.owed)}</span>
              </span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
              <TrendingUp size={14} className="text-brand-500" /> 最优结算方案
              {data.plan.length > 0 ? <Chip className="bg-black/[0.04] text-ink-mute">只需 {data.plan.length} 笔转账</Chip> : null}
            </p>
            {data.plan.length === 0 ? (
              <p className="rounded-xl bg-accent-50 px-3 py-4 text-center text-[13px] text-accent-700">
                本期账目已平，谁都不欠谁 🎉
              </p>
            ) : (
              <div className="space-y-1.5">
                {(data.myTransfers.length > 0 ? data.myTransfers : data.plan.slice(0, 2)).map((t, i) => {
                  const from = memberById(state, t.fromId);
                  const to = memberById(state, t.toId);
                  const involvesMe = t.fromId === me?.id || t.toId === me?.id;
                  return (
                    <div
                      key={`${t.fromId}-${t.toId}-${i}`}
                      className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[13px]"
                    >
                      <Avatar member={from} size="xs" />
                      <span className="font-medium">{from?.name}</span>
                      <ArrowRight size={13} className="text-ink-mute" />
                      <Avatar member={to} size="xs" />
                      <span className="font-medium">{to?.name}</span>
                      <span className="num ml-auto font-semibold text-brand-600">{formatMoney(t.amount)}</span>
                      {involvesMe ? <Chip className="bg-brand-100 text-brand-700">涉及我</Chip> : null}
                    </div>
                  );
                })}
                {data.myTransfers.length === 0 ? (
                  <p className="pt-1 text-[12px] text-ink-mute">以上是与本期结算相关的转账，与你无关的已省略。</p>
                ) : null}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 物品提醒 */}
        <Card className="card-pad">
          <SectionHeader
            title="公共物品提醒"
            subtitle={data.alerts.length > 0 ? `${data.alerts.length} 项需要关注` : '库存充足'}
            icon={<Package size={17} />}
            action={
              <Button variant="quiet" size="xs" onClick={() => onNavigate('supplies')}>
                管理 <ArrowRight size={13} />
              </Button>
            }
          />
          {data.alerts.length === 0 ? (
            <p className="rounded-xl bg-accent-50 px-3 py-4 text-center text-[13px] text-accent-700">
              所有物品库存正常，无需操心 ✅
            </p>
          ) : (
            <div className="space-y-2">
              {data.alerts.slice(0, 4).map((a) => (
                <div key={a.supply.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                  <span className="text-lg">{a.supply.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{a.supply.name}</p>
                    <p className="text-[12px] text-ink-mute">
                      剩 {a.supply.stock} {a.supply.unit}
                      {a.daysLeft !== null ? ` · 预计还能用 ${a.daysLeft} 天` : ''}
                      {a.dueForReplacement ? ' · 已到更换周期' : ''}
                    </p>
                  </div>
                  <Chip
                    color={a.level === 'out' ? '#C9483C' : a.level === 'due' ? '#D99423' : '#D4613A'}
                  >
                    {a.level === 'out' ? '已用完' : a.level === 'due' ? '该更换' : '偏低'}
                  </Chip>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 公约 */}
        <Card className="card-pad">
          <SectionHeader
            title="室友公约"
            subtitle={`${state.pacts.filter((p) => p.status === 'active').length} 条生效中 · ${state.pacts.filter((p) => p.status === 'proposed').length} 条待表决`}
            icon={<ScrollText size={17} />}
            action={
              <Button variant="quiet" size="xs" onClick={() => onNavigate('pacts')}>
                全部 <ArrowRight size={13} />
              </Button>
            }
          />
          <div className="space-y-2">
            {state.pacts
              .filter((p) => p.status === 'proposed')
              .map((p) => {
                const prog = pactProgress(p, state.members);
                const voted = p.votes.some((v) => v.memberId === me?.id);
                return (
                  <div key={p.id} className="rounded-xl border border-warn-300/60 bg-warn-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-medium leading-snug">{p.title}</p>
                      <Chip className="bg-white/70 text-warn-700">待表决</Chip>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={prog.progress} color="#D99423" className="flex-1" />
                      <span className="num text-[12px] text-warn-700">
                        {prog.agree}/{prog.total} 同意
                      </span>
                    </div>
                    {!voted ? (
                      <div className="mt-2.5 flex gap-2">
                        <Button size="xs" onClick={() => votePact(p.id, 'agree')}>
                          同意
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => votePact(p.id, 'oppose')}>
                          反对
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-warn-700">你已表决，等待其他室友…</p>
                    )}
                  </div>
                );
              })}
            {state.pacts
              .filter((p) => p.status === 'active')
              .slice(0, 3)
              .map((p) => (
                <div key={p.id} className="rounded-xl border border-line bg-white px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="shrink-0 text-accent-500" />
                    <p className="flex-1 truncate text-[13.5px] font-medium">{p.title}</p>
                    <span className="text-[11.5px] text-ink-mute">v{p.version}</span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* 动态 */}
      <Card className="card-pad">
        <SectionHeader title="小屋动态" subtitle="所有操作留痕，账目与责任都有据可查" icon={<Sparkles size={17} />} />
        <ol className="relative space-y-4 border-l border-line pl-5">
          {state.activity.slice(0, 7).map((a) => {
            const who = memberById(state, a.memberId);
            return (
              <li key={a.id} className="relative">
                <span className="absolute -left-[26px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-canvas bg-brand-300" />
                <div className="flex items-start gap-2.5">
                  {who ? <Avatar member={who} size="xs" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-snug text-ink-soft">{a.text}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-mute">
                      {friendlyDate(a.at.slice(0, 10), today)} · {a.at.slice(11, 16) || ''}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
