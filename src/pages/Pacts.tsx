import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileSignature,
  Gavel,
  History,
  MinusCircle,
  PencilLine,
  Plus,
  ScrollText,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { friendlyDate, pactProgress, todayStr } from '../../shared/logic';
import { PACT_CATEGORIES, PACT_CATEGORY_STYLE } from '../../shared/meta';
import type { PactArticle, PactCategory, VoteValue } from '../../shared/types';
import { Avatar, Button, Card, Chip, EmptyState, Field, Input, Modal, Progress, Textarea, cn, tint } from '../components/ui';
import { useStore } from '../store/useStore';

type Tab = 'active' | 'proposed' | 'all';

export default function Pacts() {
  const state = useStore((s) => s.state);
  const votePact = useStore((s) => s.votePact);
  const addBreach = useStore((s) => s.addBreach);
  const me = state.members.find((m) => m.id === state.currentMemberId) ?? state.members[0];
  const today = todayStr();

  const [tab, setTab] = useState<Tab>('active');
  const [proposing, setProposing] = useState(false);
  const [revising, setRevising] = useState<PactArticle | null>(null);
  const [breaching, setBreaching] = useState<PactArticle | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const view = useMemo(() => {
    const active = state.pacts.filter((p) => p.status === 'active');
    const proposed = state.pacts.filter((p) => p.status === 'proposed');
    const list = tab === 'active' ? active : tab === 'proposed' ? proposed : state.pacts;
    return { active, proposed, list };
  }, [state.pacts, tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">室友公约</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-mute">
            口头约定靠记忆，公约靠版本和表决。提案 → 全员同意 → 生效 → 修订留痕，
            吵架之前先翻公约。
          </p>
        </div>
        <Button onClick={() => setProposing(true)}>
          <Plus size={16} /> 发起提案
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">生效中</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight text-pos-600">{view.active.length}</div>
          <p className="mt-1 text-[12.5px] text-ink-mute">全体室友已同意</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">待表决</span>
          <div className={cn('num mt-2 text-2xl font-semibold tracking-tight', view.proposed.length > 0 ? 'text-warn-700' : 'text-ink')}>
            {view.proposed.length}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-mute">等室友投票</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">违约记录</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight">
            {state.pacts.reduce((s, p) => s + (p.breaches?.length ?? 0), 0)}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-mute">用于复盘，不用于指责</p>
        </Card>
      </div>

      <div className="inline-flex rounded-xl bg-tint-strong p-1">
        {(
          [
            { key: 'active' as Tab, label: `生效中 ${view.active.length}` },
            { key: 'proposed' as Tab, label: `待表决 ${view.proposed.length}` },
            { key: 'all' as Tab, label: `全部 ${state.pacts.length}` },
          ]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition',
              tab === t.key ? 'bg-comp text-ink shadow-glass' : 'text-ink-mute hover:text-ink-soft',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view.list.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={20} />}
          title="还没有公约"
          hint="把「几点后不要吵」「访客要不要提前说」这类共识写下来，大家都有据可依。"
          action={
            <Button onClick={() => setProposing(true)}>
              <Plus size={15} /> 发起第一条公约
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {view.list.map((p) => {
            const style = PACT_CATEGORY_STYLE[p.category];
            const prog = pactProgress(p, state.members);
            const myVote = p.votes.find((v) => v.memberId === me?.id);
            const isOpen = expanded === p.id;
            return (
              <Card key={p.id} className="interactive overflow-hidden">
                <div className="card-pad">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ backgroundColor: tint(style.color, 14) }}
                    >
                      {style.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15.5px] font-semibold tracking-tight">{p.title}</h3>
                        <Chip color={style.color}>{p.category}</Chip>
                        {p.status === 'active' ? (
                          <Chip className="bg-pos-50 text-pos-700">
                            <CheckCircle2 size={11} /> 生效中
                          </Chip>
                        ) : p.status === 'proposed' ? (
                          <Chip className="bg-warn-50 text-warn-700">待表决</Chip>
                        ) : (
                          <Chip className="bg-tint-strong text-ink-mute">未通过</Chip>
                        )}
                        <span className="num text-[11.5px] text-ink-mute">v{p.version}</span>
                      </div>

                      <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">{p.content}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-mute">
                        <span className="flex items-center gap-1.5">
                          <UserRound size={12} /> 由 {state.members.find((m) => m.id === p.proposedBy)?.name} 发起
                        </span>
                        <span>发起于 {friendlyDate(p.proposedAt.slice(0, 10), today)}</span>
                        {p.effectiveAt ? <span>生效于 {friendlyDate(p.effectiveAt.slice(0, 10), today)}</span> : null}
                      </div>
                    </div>
                  </div>

                  {/* 表决区 */}
                  <div className="mt-4 rounded-2xl bg-tint px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Progress
                        value={prog.progress}
                        color={p.status === 'active' ? 'var(--pos-600)' : 'var(--warn-500)'}
                        className="flex-1"
                      />
                      <span className="num shrink-0 text-[12.5px] text-ink-mute">
                        {prog.agree}/{prog.total} 同意
                        {prog.oppose > 0 ? ` · ${prog.oppose} 反对` : ''}
                        {prog.abstain > 0 ? ` · ${prog.abstain} 弃权` : ''}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {state.members.map((m) => {
                        const v = p.votes.find((x) => x.memberId === m.id);
                        return (
                          <span
                            key={m.id}
                            title={v?.comment}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[11.5px]',
                              v?.vote === 'agree'
                                ? 'bg-pos-50 text-pos-700'
                                : v?.vote === 'oppose'
                                  ? 'bg-danger-50 text-danger-700'
                                  : v?.vote === 'abstain'
                                    ? 'bg-tint-strong text-ink-mute'
                                    : 'bg-tint text-ink-mute/70',
                            )}
                          >
                            <Avatar member={m} size="xs" />
                            {m.name}
                            {v?.vote === 'agree' ? <Check size={11} /> : v?.vote === 'oppose' ? <X size={11} /> : <MinusCircle size={11} />}
                          </span>
                        );
                      })}
                    </div>

                    {p.votes.some((v) => v.comment) ? (
                      <div className="mt-2.5 space-y-1">
                        {p.votes
                          .filter((v) => v.comment)
                          .map((v) => (
                            <p key={v.memberId} className="text-[12px] leading-relaxed text-ink-mute">
                              <span className="font-medium text-ink-soft">
                                {state.members.find((m) => m.id === v.memberId)?.name}
                              </span>
                              ：{v.comment}
                            </p>
                          ))}
                      </div>
                    ) : null}

                    {p.status === 'proposed' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(
                          [
                            { v: 'agree' as VoteValue, label: '同意', icon: ThumbsUp },
                            { v: 'oppose' as VoteValue, label: '反对', icon: ThumbsDown },
                            { v: 'abstain' as VoteValue, label: '弃权', icon: MinusCircle },
                          ]
                        ).map(({ v, label, icon: Icon }) => (
                          <Button
                            key={v}
                            size="xs"
                            variant={myVote?.vote === v ? 'primary' : 'ghost'}
                            onClick={() => votePact(p.id, v, v === 'oppose' ? '有顾虑，建议再讨论' : undefined)}
                          >
                            <Icon size={13} /> {label}
                          </Button>
                        ))}
                        <span className="self-center text-[11.5px] text-ink-mute">
                          全体 {prog.total} 人同意后自动生效
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* 违约记录 */}
                  {(p.breaches?.length ?? 0) > 0 ? (
                    <div className="mt-3 rounded-2xl border border-warn-300/50 bg-warn-50 px-4 py-3">
                      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-warn-700">
                        <AlertTriangle size={13} /> 违约记录（{p.breaches?.length}）
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {p.breaches?.map((b) => (
                          <p key={b.id} className="text-[12px] leading-relaxed text-warn-700/90">
                            {b.date.slice(5)} · {state.members.find((m) => m.id === b.memberId)?.name}：{b.note}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* 操作 */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    {p.history.length > 0 ? (
                      <Button size="xs" variant="quiet" onClick={() => setExpanded(isOpen ? null : p.id)}>
                        <History size={13} /> 修订历史 {p.history.length}
                      </Button>
                    ) : null}
                    <Button size="xs" variant="quiet" onClick={() => setRevising(p)}>
                      <PencilLine size={13} /> 提议修订
                    </Button>
                    {p.status === 'active' ? (
                      <Button size="xs" variant="quiet" onClick={() => setBreaching(p)}>
                        <Gavel size={13} /> 记录违约
                      </Button>
                    ) : null}
                  </div>

                  {isOpen ? (
                    <ol className="mt-3 space-y-2 border-l border-line pl-4">
                      {p.history.map((h) => (
                        <li key={`${h.version}-${h.changedAt}`} className="relative">
                          <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-brand-200" />
                          <p className="text-[12.5px] font-medium text-ink-soft">
                            v{h.version} · {h.summary}
                          </p>
                          <p className="text-[12px] text-ink-mute">
                            {friendlyDate(h.changedAt.slice(0, 10), today)} 由{' '}
                            {state.members.find((m) => m.id === h.changedBy)?.name} 修改
                          </p>
                          <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-ink-mute/90">{h.content}</p>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {proposing ? <ProposeModal onClose={() => setProposing(false)} /> : null}
      {revising ? <ReviseModal pact={revising} onClose={() => setRevising(null)} /> : null}
      {breaching ? (
        <BreachModal
          pact={breaching}
          onClose={() => setBreaching(null)}
          onSubmit={(memberId, note) => {
            addBreach(breaching.id, memberId, note);
            setBreaching(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- 发起提案 */

function ProposeModal({ onClose }: { onClose: () => void }) {
  const proposePact = useStore((s) => s.proposePact);
  const showToast = useStore((s) => s.showToast);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PactCategory>('卫生');
  const [content, setContent] = useState('');

  const valid = title.trim().length > 0 && content.trim().length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title="发起公约提案"
      subtitle="提案会进入「待表决」，全体室友同意后自动生效"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              proposePact({ title: title.trim(), category, content: content.trim() });
              showToast('提案已发起，等待室友表决', 'success');
              onClose();
            }}
          >
            <FileSignature size={15} /> 提交提案
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="公约标题">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：夜间安静时段 23:30 - 07:00" />
        </Field>
        <Field label="类别">
          <div className="flex flex-wrap gap-2">
            {PACT_CATEGORIES.map((c) => {
              const style = PACT_CATEGORY_STYLE[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] transition',
                    category === c ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-comp text-ink-soft hover:border-brand-200',
                  )}
                >
                  <span>{style.emoji}</span>
                  {c}
                </button>
              );
            })}
          </div>
        </Field>
        <Field
          label="具体内容"
          hint="越具体越不容易扯皮：写清时间、范围、例外情况和执行方式"
        >
          <Textarea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="例如：23:30 后公共区域请使用耳机，洗衣机/吸尘器不在此时段使用；加班晚归请在群里说一声。"
          />
        </Field>
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-[12.5px] leading-relaxed text-brand-700">
          提案者自动投出「同意」票，其余室友收到待表决提醒；任意一人反对则继续讨论，不会强行通过。
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- 修订 */

function ReviseModal({ pact, onClose }: { pact: PactArticle; onClose: () => void }) {
  const revisePact = useStore((s) => s.revisePact);
  const [content, setContent] = useState(pact.content);
  const [summary, setSummary] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title={`提议修订 · ${pact.title}`}
      subtitle={`当前为 v${pact.version}，修订后将生成 v${pact.version + 1} 并重新表决`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={content.trim().length === 0 || content === pact.content}
            onClick={() => {
              revisePact(pact.id, content.trim(), summary.trim() || '内容修订');
              onClose();
            }}
          >
            提交修订
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-tint px-4 py-3">
          <p className="text-[12px] font-medium text-ink-mute">当前版本 v{pact.version}</p>
          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{pact.content}</p>
        </div>
        <Field label="修订内容">
          <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
        <Field label="修订说明" hint="写清为什么改，方便日后翻旧账时对得上">
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="例如：把安静时段从 23:00 顺延到 23:30" />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- 违约记录 */

function BreachModal({
  pact,
  onClose,
  onSubmit,
}: {
  pact: PactArticle;
  onClose: () => void;
  onSubmit: (memberId: string, note: string) => void;
}) {
  const state = useStore((s) => s.state);
  const people = state.members.filter((m) => !m.movedOutAt);
  const [memberId, setMemberId] = useState(people[0]?.id ?? '');
  const [note, setNote] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title={`记录违约 · ${pact.title}`}
      subtitle="记录是为了复盘和改进，不是为了指责"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!note.trim()} onClick={() => onSubmit(memberId, note.trim())}>
            保存记录
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="涉及室友">
          <div className="flex flex-wrap gap-2">
            {people.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberId(m.id)}
                className={cn(
                  'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] transition',
                  memberId === m.id ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-comp text-ink-soft',
                )}
              >
                <Avatar member={m} size="sm" />
                {m.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="情况说明">
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：朋友临时来住一晚未提前说，已在群里致歉"
          />
        </Field>
        <p className="rounded-xl bg-tint px-3 py-2.5 text-[12px] leading-relaxed text-ink-mute">
          公开记录会显示在公约卡片中，所有室友可见。
        </p>
      </div>
    </Modal>
  );
}
