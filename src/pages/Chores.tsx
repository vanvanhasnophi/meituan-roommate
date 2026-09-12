import {
  ArrowLeftRight,
  BadgeCheck,
  CalendarCheck,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Info,
  RotateCcw,
  Trophy,
  UserRoundPlus,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  addDays,
  choreStats,
  daysBetween,
  memberById,
  occurrencesInRange,
  occurrencesOn,
  startOfMonth,
  todayStr,
  WEEKDAY_LABELS,
  weekdayOf,
} from '../../shared/logic';
import type { ChoreOccurrence } from '../../shared/types';
import { Avatar, Button, Card, Chip, Modal, Progress, SectionHeader, cn, tint } from '../components/ui';
import { useStore } from '../store/useStore';

function startOfWeek(dateStr: string): string {
  const offset = (weekdayOf(dateStr) + 6) % 7; // 周一为一周起点
  return addDays(dateStr, -offset);
}

export default function Chores() {
  const state = useStore((s) => s.state);
  const completeChore = useStore((s) => s.completeChore);
  const reopenChore = useStore((s) => s.reopenChore);
  const skipChore = useStore((s) => s.skipChore);
  const requestSwap = useStore((s) => s.requestSwap);
  const resolveSwap = useStore((s) => s.resolveSwap);
  const reassignChore = useStore((s) => s.reassignChore);

  const today = todayStr();
  const me = state.members.find((m) => m.id === state.currentMemberId) ?? state.members[0];
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [detail, setDetail] = useState<ChoreOccurrence | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);

  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const data = useMemo(() => {
    const byDate = week.map((d) => ({ date: d, items: occurrencesOn(state, d) }));
    const stats = choreStats(state, startOfMonth(today), today);
    const ranking = state.members
      .map((m) => ({ member: m, stat: stats[m.id] }))
      .filter((r) => r.stat)
      .sort((a, b) => b.stat.done - a.stat.done || b.stat.points - a.stat.points);

    const minePending = occurrencesInRange(state, addDays(today, -7), addDays(today, 7)).filter(
      (o) => o.memberId === me?.id && o.status === 'pending' && o.date <= today,
    );
    const incomingSwaps = Object.entries(state.choreOverrides)
      .filter(([, ov]) => ov.swapRequest && ov.swapRequest.toMemberId === me?.id)
      .map(([key]) => key);
    const outgoingSwaps = Object.entries(state.choreOverrides)
      .filter(([, ov]) => ov.swapRequest && ov.swapRequest.requestedBy === me?.id)
      .map(([key]) => key);
    const todayMine = occurrencesOn(state, today).filter((o) => o.memberId === me?.id);
    return { byDate, ranking, minePending, incomingSwaps, outgoingSwaps, todayMine };
  }, [state, week, me?.id, today]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">清洁值日排班</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-mute">
            排班由轮值规则自动生成，不需要手动排表；临时有事可以换班、跳过并留痕，
            每个区域都写清「做到什么程度算完成」。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-line bg-comp p-1">
            <button
              type="button"
              className="rounded-lg p-1.5 text-ink-mute transition hover:bg-tint-strong"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-ink-soft transition hover:bg-tint-strong"
              onClick={() => setWeekStart(startOfWeek(today))}
            >
              回到本周
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-ink-mute transition hover:bg-tint-strong"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 需要我的动作 */}
      {(data.incomingSwaps.length > 0 || data.minePending.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.incomingSwaps.map((key) => {
            const [taskId, date] = key.split(':');
            const task = state.choreTasks.find((t) => t.id === taskId);
            const ov = state.choreOverrides[key];
            const from = memberById(state, ov?.swapRequest?.requestedBy);
            return (
              <Card key={key} className="card-pad border-warn-300/60 bg-warn-50">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-glass/70 text-warn-700">
                    <ArrowLeftRight size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">
                      {from?.name} 想和你换班：{date.slice(5)} {task?.area}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-warn-700/90">
                      同意后你将成为当天的值日人，对方自动从排班中移除。
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button size="xs" onClick={() => resolveSwap(key, true)}>
                        接受换班
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => resolveSwap(key, false)}>
                        婉拒
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {data.minePending.length > 0 ? (
            <Card className="card-pad border-brand-200 bg-brand-50">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-glass/70 text-brand-600">
                  <CalendarCheck size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">
                    你有 {data.minePending.length} 项值日待完成
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-brand-700/90">
                    {data.minePending
                      .slice(0, 3)
                      .map((o) => {
                        const t = state.choreTasks.find((x) => x.id === o.taskId);
                        return `${o.date.slice(5)} ${t?.area}`;
                      })
                      .join('、')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.minePending.slice(0, 3).map((o) => {
                      const t = state.choreTasks.find((x) => x.id === o.taskId);
                      return (
                        <Button key={o.key} size="xs" onClick={() => completeChore(o.key)}>
                          <Check size={13} /> 完成 {t?.area}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {/* 周视图 */}
      <Card className="card-pad">
        <SectionHeader
          title={`本周排班 · ${weekStart.slice(5)} ~ ${week[6].slice(5)}`}
          subtitle="点击任意一格可以打卡、跳过或换班"
          icon={<CalendarRange size={17} />}
          action={<Chip className="bg-tint text-ink-mute">{state.choreTasks.filter((t) => t.active).length} 个区域</Chip>}
        />
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="grid min-w-[720px] grid-cols-7 gap-2 px-1">
            {data.byDate.map(({ date, items }) => {
              const isToday = date === today;
              const past = date < today;
              return (
                <div
                  key={date}
                  className={cn(
                    'rounded-2xl border p-2.5 transition',
                    isToday ? 'border-brand-300 bg-brand-50/70' : past ? 'border-line bg-tint' : 'border-line bg-comp',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className={cn('text-[12px] font-medium', isToday ? 'text-brand-700' : 'text-ink-mute')}>
                      {WEEKDAY_LABELS[weekdayOf(date)]}
                    </span>
                    <span className={cn('num text-[12px]', isToday ? 'font-semibold text-brand-700' : 'text-ink-mute')}>
                      {date.slice(8)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {items.length === 0 ? (
                      <p className="py-3 text-center text-[11.5px] text-ink-mute/70">—</p>
                    ) : (
                      items.map((o) => {
                        const task = state.choreTasks.find((t) => t.id === o.taskId);
                        const who = memberById(state, o.memberId);
                        return (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => setDetail(o)}
                            className={cn(
                              'w-full rounded-xl border px-2 py-1.5 text-left transition hover:border-brand-300',
                              o.status === 'done'
                                ? 'border-pos-100 bg-pos-50/70'
                                : o.status === 'skipped'
                                  ? 'border-line bg-tint'
                                  : o.swapRequest
                                    ? 'border-warn-300/70 bg-warn-50'
                                    : 'border-line bg-comp',
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px]">{task?.emoji}</span>
                              <span className="truncate text-[11.5px] font-medium text-ink-soft">{task?.area}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <Avatar member={who} size="xs" />
                              <span className="truncate text-[11px] text-ink-mute">
                                {o.status === 'done' ? '已完成' : o.status === 'skipped' ? '已跳过' : who?.name}
                              </span>
                            </div>
                            {o.swapRequest ? (
                              <span className="mt-1 block text-[10.5px] text-warn-700">换班待确认</span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* 轮值规则 */}
        <Card className="card-pad">
          <SectionHeader
            title="轮值规则"
            subtitle="规则固定下来，就不会每次都「谁去倒垃圾」吵一架"
            icon={<RotateCcw size={17} />}
          />
          <div className="space-y-3">
            {state.choreTasks.map((t) => (
              <div key={t.id} className="rounded-2xl border border-line bg-comp px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: tint(t.color, 14) }}>
                    {t.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{t.area}</p>
                    <p className="text-[12px] text-ink-mute">
                      {t.cadence === 'daily' ? '每天轮换' : `每周${WEEKDAY_LABELS[t.weekday]}轮换`} · {t.rotation.length} 人轮值
                    </p>
                  </div>
                  <div className="flex items-center">
                    {t.rotation.map((id, i) => (
                      <span key={id} className={cn(i > 0 && '-ml-2')}>
                        <Avatar member={memberById(state, id)} size="xs" ring />
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-mute">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  {t.standard}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* 排行榜 */}
        <Card className="card-pad">
          <SectionHeader
            title="本月值日榜"
            subtitle="完成 +10 分，跳过 -5 分；轻激励，不制造压力"
            icon={<Trophy size={17} />}
          />
          <div className="space-y-3">
            {data.ranking.map((r, i) => (
              <div key={r.member.id} className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold',
                    i === 0 ? 'bg-warn-300/40 text-warn-700' : 'bg-tint text-ink-mute',
                  )}
                >
                  {i + 1}
                </span>
                <Avatar member={r.member} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium">{r.member.name}</span>
                    {r.member.id === me?.id ? <Chip className="bg-brand-50 text-brand-700">我</Chip> : null}
                    <span className="num ml-auto text-[12.5px] text-ink-mute">
                      {r.stat.done} 次完成 · {r.stat.skipped} 次跳过
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={r.stat.rate} color={r.member.color} className="flex-1" />
                    <span className="num w-14 text-right text-[12px] text-ink-mute">
                      {Math.round(r.stat.rate * 100)}%
                    </span>
                    <span className="num w-14 text-right text-[12px] font-medium text-brand-600">
                      {r.stat.points} 分
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-tint px-4 py-3">
            <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-soft">
              <BadgeCheck size={14} className="mt-0.5 shrink-0 text-pos-500" />
              连续两周完成率 100% 的室友，可以在「公共物品」里优先选择下次补货的分摊方式
              —— 让付出被看见，比罚款有效。
            </p>
          </div>
        </Card>
      </div>

      {detail ? (
        <ChoreDetailModal
          occurrence={detail}
          onClose={() => {
            setDetail(null);
            setReassignOpen(false);
          }}
          reassignOpen={reassignOpen}
          setReassignOpen={setReassignOpen}
          onComplete={() => {
            completeChore(detail.key);
            setDetail(null);
          }}
          onReopen={() => {
            reopenChore(detail.key);
            setDetail(null);
          }}
          onSkip={() => {
            skipChore(detail.key, '当天临时有事');
            setDetail(null);
          }}
          onSwap={(id) => {
            requestSwap(detail.key, id);
            setDetail(null);
          }}
          onReassign={(id) => {
            reassignChore(detail.key, id);
            setDetail(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ChoreDetailModal({
  occurrence,
  onClose,
  reassignOpen,
  setReassignOpen,
  onComplete,
  onReopen,
  onSkip,
  onSwap,
  onReassign,
}: {
  occurrence: ChoreOccurrence;
  onClose: () => void;
  reassignOpen: boolean;
  setReassignOpen: (v: boolean) => void;
  onComplete: () => void;
  onReopen: () => void;
  onSkip: () => void;
  onSwap: (memberId: string) => void;
  onReassign: (memberId: string) => void;
}) {
  const state = useStore((s) => s.state);
  const task = state.choreTasks.find((t) => t.id === occurrence.taskId);
  const who = memberById(state, occurrence.memberId);
  const me = state.members.find((m) => m.id === state.currentMemberId);
  const others = state.members.filter((m) => !m.movedOutAt && m.id !== occurrence.memberId);
  const overdue = occurrence.status === 'pending' && daysBetween(occurrence.date, todayStr()) > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${task?.emoji} ${task?.area}`}
      subtitle={`${occurrence.date} · ${WEEKDAY_LABELS[weekdayOf(occurrence.date)]}`}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-comp px-4 py-3">
          <Avatar member={who} size="md" />
          <div className="flex-1">
            <p className="text-[14px] font-medium">
              {who?.name}
              {who?.id === me?.id ? <span className="ml-1.5 text-[12px] text-brand-600">（我）</span> : null}
            </p>
            <p className="text-[12.5px] text-ink-mute">
              {occurrence.status === 'done'
                ? `已于 ${occurrence.doneAt?.slice(11, 16)} 完成`
                : occurrence.status === 'skipped'
                  ? '已跳过，原因已记录'
                  : overdue
                    ? '已逾期未完成'
                    : '待完成'}
            </p>
          </div>
          <Chip
            color={occurrence.status === 'done' ? 'var(--pos-600)' : occurrence.status === 'skipped' ? 'var(--ink-mute)' : overdue ? 'var(--danger-500)' : 'var(--brand-600)'}
          >
            {occurrence.status === 'done' ? '已完成' : occurrence.status === 'skipped' ? '已跳过' : overdue ? '逾期' : '待完成'}
          </Chip>
        </div>

        <div className="rounded-2xl bg-brand-50 px-4 py-3">
          <p className="mb-1 text-[12.5px] font-medium text-brand-700">完成标准</p>
          <p className="text-[13px] leading-relaxed text-brand-700/90">{task?.standard}</p>
        </div>

        {occurrence.swapRequest ? (
          <p className="rounded-xl bg-warn-50 px-3 py-2 text-[12.5px] text-warn-700">
            已向 {memberById(state, occurrence.swapRequest.toMemberId)?.name} 发起换班，等待对方确认。
          </p>
        ) : null}

        {reassignOpen ? (
          <div>
            <p className="label mb-2">把这次值日交给谁</p>
            <div className="grid grid-cols-2 gap-2">
              {state.members
                .filter((m) => !m.movedOutAt)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onReassign(m.id)}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-comp px-3 py-2.5 text-left transition hover:border-brand-300"
                  >
                    <Avatar member={m} size="sm" />
                    <span className="text-[13.5px] font-medium">{m.name}</span>
                    {m.id === occurrence.memberId ? (
                      <span className="ml-auto text-[11px] text-ink-mute">当前</span>
                    ) : null}
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {occurrence.status === 'done' ? (
              <Button variant="ghost" className="w-full" onClick={onReopen}>
                <RotateCcw size={15} /> 撤销打卡
              </Button>
            ) : (
              <Button className="w-full" onClick={onComplete}>
                <Check size={15} /> 标记为已完成
              </Button>
            )}

            {others.length > 0 ? (
              <>
                <p className="label pt-1">或者让室友帮个忙</p>
                <div className="grid grid-cols-2 gap-2">
                  {others.map((m) => (
                    <div key={m.id} className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSwap(m.id)}
                        className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-comp px-2.5 py-2 text-left transition hover:border-brand-300"
                      >
                        <Avatar member={m} size="xs" />
                        <span className="flex-1 truncate text-[12.5px]">{m.name}</span>
                        <ArrowLeftRight size={12} className="text-ink-mute" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[11.5px] text-ink-mute">
                  「换班」会发送请求，对方同意后才生效；管理员也可以直接指派。
                </p>
              </>
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="xs" onClick={() => setReassignOpen(true)}>
                <UserRoundPlus size={13} /> 直接指派
              </Button>
              {occurrence.status !== 'skipped' ? (
                <Button variant="quiet" size="xs" onClick={onSkip}>
                  <CircleSlash size={13} /> 今天做不了
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
