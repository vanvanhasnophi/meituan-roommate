import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Check,
  History,
  Minus,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  activeMembers,
  formatMoney,
  friendlyDate,
  memberById,
  supplyForecast,
  supplyForecasts,
  supplyHeadline,
  supplySubline,
  todayStr,
} from '../../shared/logic';
import { SUPPLY_CATEGORIES } from '../../shared/meta';
import type { Supply, SupplyCategory } from '../../shared/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionHeader,
  Textarea,
  cn,
  tint,
} from '../components/ui';
import { useStore } from '../store/useStore';

const EMOJI_CHOICES = ['🧻', '🧴', '🫧', '🗑️', '🧽', '💧', '🧪', '🧼', '🪣', '🧹', '🍚', '🫙', '🧂', '🔋', '💡', '🪥'];

const LEVEL_STYLE: Record<string, { chip: string; tone: string }> = {
  out: { chip: 'bg-danger-50 text-danger-700', tone: 'var(--danger-500)' },
  soon: { chip: 'bg-brand-50 text-brand-700', tone: 'var(--brand-600)' },
  ok: { chip: 'bg-pos-50 text-pos-700', tone: 'var(--pos-600)' },
  unknown: { chip: 'bg-tint text-ink-mute', tone: 'var(--ink-mute)' },
};

export default function Supplies() {
  const state = useStore((s) => s.state);
  const removeSupply = useStore((s) => s.removeSupply);
  const today = todayStr();

  const [editing, setEditing] = useState<Supply | null>(null);
  const [creating, setCreating] = useState(false);
  const [restocking, setRestocking] = useState<Supply | null>(null);
  const [reporting, setReporting] = useState<Supply | null>(null);
  const [emptying, setEmptying] = useState<Supply | null>(null);
  const [filter, setFilter] = useState<'all' | 'need'>('all');

  const forecasts = useMemo(() => supplyForecasts(state, today), [state, today]);
  const needRestock = useMemo(
    () =>
      forecasts
        .filter((f) => f.needsRestock)
        .sort((a, b) => {
          const rank = (f: typeof a) => (f.level === 'out' ? -1 : (f.daysLeft ?? 9999));
          return rank(a) - rank(b);
        }),
    [forecasts],
  );
  const shown = filter === 'all' ? forecasts : needRestock;

  const recentLogs = state.supplyLogs.slice(0, 12);
  const monthSpend = state.supplyLogs
    .filter((l) => l.type === 'restock' && l.cost && l.date >= `${today.slice(0, 7)}-01`)
    .reduce((s, l) => s + (l.cost ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">公共物品</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-mute">
            不做台账。日常只有两个动作：快用完时<b className="font-medium text-ink-soft">报告还剩多少</b>，
            用完了<b className="font-medium text-ink-soft">点一下「已用完」</b>。
            剩余天数由「上次补货时间 + 历次报告」自动推算。
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> 登记物品
        </Button>
      </div>

      {/* 概览 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">在册物品</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight">{state.supplies.length}</div>
          <p className="mt-1 text-[12.5px] text-ink-mute">
            共 {new Set(state.supplies.map((s) => s.category)).size} 个类别
          </p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">需要补货</span>
          <div
            className={cn(
              'num mt-2 text-2xl font-semibold tracking-tight',
              needRestock.length > 0 ? 'text-brand-600' : 'text-pos-600',
            )}
          >
            {needRestock.length}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-mute">
            其中 {forecasts.filter((f) => f.level === 'out').length} 件已用完
          </p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">本月补货支出</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight">{formatMoney(monthSpend)}</div>
          <p className="mt-1 text-[12.5px] text-ink-mute">补货时自动进入 AA 账单</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">报告记录</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight">{state.supplyLogs.length}</div>
          <p className="mt-1 text-[12.5px] text-ink-mute">每次报告都会让预估更准</p>
        </Card>
      </div>

      {/* 待补货：单独拎出来，一眼看到 */}
      {needRestock.length > 0 ? (
        <Card className="card-pad border-brand-200">
          <SectionHeader
            title="待补货"
            subtitle="已用完的排最前，点「已买回来」即可记录补货"
            icon={<BellRing size={17} />}
          />
          <div className="space-y-2">
            {needRestock.slice(0, 4).map((f) => (
              <div
                key={f.supply.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border px-3.5 py-3',
                  f.level === 'out' ? 'border-danger-300 bg-danger-50' : 'border-line bg-comp',
                )}
              >
                <span className="text-xl">{f.supply.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{f.supply.name}</p>
                  <p className="text-[12.5px] text-ink-mute">{supplySubline(f)}</p>
                </div>
                <span
                  className={cn('num text-[15px] font-semibold', f.level === 'out' ? 'text-danger-700' : 'text-brand-600')}
                >
                  {supplyHeadline(f)}
                </span>
                <Button size="xs" onClick={() => setRestocking(f.supply)}>
                  <ShoppingCart size={13} /> 已买回来
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="inline-flex rounded-btn bg-tint-strong p-1">
        {[
          { k: 'all' as const, label: `全部 ${forecasts.length}` },
          { k: 'need' as const, label: `待补货 ${needRestock.length}` },
        ].map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setFilter(t.k)}
            className={cn(
              'rounded-tag px-3.5 py-1.5 text-[13px] font-medium transition',
              filter === t.k ? 'bg-comp text-ink shadow-glass' : 'text-ink-mute hover:text-ink-soft',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 物品牌照 */}
      {shown.length === 0 ? (
        <EmptyState
          icon={<Check size={20} />}
          title={filter === 'need' ? '暂时没有需要补货的物品' : '还没有登记公共物品'}
          hint={
            filter === 'need'
              ? '所有物品的预估剩余天数都在提醒线以上。'
              : '把卷纸、洗洁精这类「用完了没人管」的东西登记进来。'
          }
          action={
            filter === 'all' ? (
              <Button onClick={() => setCreating(true)}>
                <Plus size={15} /> 登记第一件
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((f) => {
            const { supply } = f;
            const style = LEVEL_STYLE[f.level];
            return (
              <Card key={supply.id} className="card-pad interactive flex flex-col">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card text-xl"
                    style={{ backgroundColor: tint(style.tone, 14) }}
                  >
                    {supply.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-medium">{supply.name}</p>
                      <Chip className={style.chip}>
                        {f.level === 'out'
                          ? '已用完'
                          : f.level === 'soon'
                            ? '该补了'
                            : f.level === 'ok'
                              ? '充足'
                              : '待估算'}
                      </Chip>
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-mute">{supply.category}</p>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      aria-label={`编辑 ${supply.name}`}
                      className="rounded-btn p-1.5 text-ink-mute transition hover:bg-neutral-tint/25 hover:text-ink"
                      onClick={() => setEditing(supply)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除 ${supply.name}`}
                      className="rounded-btn p-1.5 text-ink-mute transition hover:bg-danger-tint/25 hover:text-danger-500"
                      onClick={() => removeSupply(supply.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* 一个大字号 + 一个小字号：没有填充条，也没有满配 */}
                <div className="mt-4">
                  <p
                    className="num text-[26px] font-semibold leading-none tracking-tight"
                    style={{ color: f.needsRestock ? style.tone : undefined }}
                  >
                    {supplyHeadline(f)}
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-ink-mute">
                    {supplySubline(f)}
                    {f.dailyUsage ? ` · 每天约 ${f.dailyUsage.toFixed(2)} ${supply.unit}` : ''}
                  </p>
                  {f.basis === 'none' ? (
                    <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-mute">
                      <CalendarClock size={11} /> 报告两次剩余后即可预估
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="xs" variant="ghost" onClick={() => setReporting(supply)}>
                    <Minus size={13} /> 报告剩余
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="border-danger-300 text-danger-700 hover:border-danger-500 hover:text-danger-700"
                    onClick={() => setEmptying(supply)}
                  >
                    <AlertTriangle size={13} /> 已用完
                  </Button>
                  <Button size="xs" onClick={() => setRestocking(supply)} className="ml-auto">
                    <ShoppingCart size={13} /> 补货
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 流水 */}
      <Card className="card-pad">
        <SectionHeader
          title="报告与补货记录"
          subtitle="谁报的、什么时候报的、还剩多少，都留痕"
          icon={<History size={17} />}
        />
        {recentLogs.length === 0 ? (
          <p className="rounded-card bg-tint px-3 py-5 text-center text-[13px] text-ink-mute">还没有记录</p>
        ) : (
          <div className="space-y-1.5">
            {recentLogs.map((log) => {
              const supply = state.supplies.find((s) => s.id === log.supplyId);
              const who = memberById(state, log.memberId);
              const label =
                log.type === 'report'
                  ? `报告还剩 ${log.qty} ${supply?.unit ?? ''}`
                  : log.type === 'empty'
                    ? '报告已用完'
                    : `补货${log.qty ? ` ${log.qty} ${supply?.unit ?? ''}` : ''}`;
              return (
                <div key={log.id} className="row flex items-center gap-3 rounded-card border border-line px-3 py-2.5">
                  <span className="text-lg">{supply?.emoji ?? '📦'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px]">
                      <span className="font-medium">{who?.name}</span> {label}
                      <span className="text-ink-mute"> · {supply?.name}</span>
                    </p>
                    <p className="text-[11.5px] text-ink-mute">
                      {friendlyDate(log.date, today)}
                      {log.note ? ` · ${log.note}` : ''}
                      {log.expenseId ? ' · 已生成 AA 账单' : ''}
                    </p>
                  </div>
                  {log.cost ? (
                    <span className="num text-[13.5px] font-medium text-brand-600">{formatMoney(log.cost)}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <SupplyModal
          key={editing?.id ?? 'new'}
          supply={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {restocking ? <RestockModal supply={restocking} onClose={() => setRestocking(null)} /> : null}

      {reporting ? <ReportModal supply={reporting} onClose={() => setReporting(null)} /> : null}

      {emptying ? (
        <ConfirmEmptyModal
          supply={emptying}
          forecast={supplyForecast(state, emptying, today)}
          onClose={() => setEmptying(null)}
        />
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------- 登记物品 */

function SupplyModal({ supply, onClose }: { supply: Supply | null; onClose: () => void }) {
  const addSupply = useStore((s) => s.addSupply);
  const updateSupply = useStore((s) => s.updateSupply);
  const showToast = useStore((s) => s.showToast);

  const [name, setName] = useState(supply?.name ?? '');
  const [emoji, setEmoji] = useState(supply?.emoji ?? '🧻');
  const [category, setCategory] = useState<SupplyCategory>(supply?.category ?? '日用');
  const [unit, setUnit] = useState(supply?.unit ?? '件');
  const [stock, setStock] = useState(String(supply?.stock ?? 1));
  const [alertDays, setAlertDays] = useState(String(supply?.alertDays ?? 3));
  const [note, setNote] = useState(supply?.note ?? '');

  const valid = name.trim().length > 0 && Number(stock) >= 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={supply ? '编辑物品' : '登记公共物品'}
      subtitle="登记后，报告两次剩余就能算出「还有几天用完」"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              const payload = {
                name: name.trim(),
                emoji,
                category,
                unit: unit.trim() || '件',
                stock: Number(stock) || 0,
                alertDays: Number(alertDays) || 3,
                note: note.trim() || undefined,
              };
              if (supply) {
                updateSupply(supply.id, payload);
                showToast('物品信息已更新', 'success');
              } else {
                addSupply(payload);
                showToast('已登记，报告剩余后即可预估用完时间', 'success');
              }
              onClose();
            }}
          >
            <PackagePlus size={15} /> {supply ? '保存' : '登记'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="物品名称">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：卷纸 / 洗洁精" />
          </Field>
          <Field label="图标">
            <div className="flex w-full flex-wrap gap-1.5 sm:w-56">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-btn border text-lg transition',
                    emoji === e ? 'border-brand-400 bg-brand-50' : 'border-line bg-comp hover:border-brand-200',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="类别">
          <div className="flex flex-wrap gap-2">
            {SUPPLY_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-btn border px-3 py-1.5 text-[13px] transition',
                  category === c
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-line bg-comp text-ink-soft hover:border-brand-200',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="单位">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="卷 / 瓶 / 包" />
          </Field>
          <Field label="当前剩余">
            <Input value={stock} inputMode="numeric" onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="提前几天提醒">
            <Input
              value={alertDays}
              inputMode="numeric"
              onChange={(e) => setAlertDays(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        </div>

        <Field label="备注（可选）">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="存放位置、品牌偏好等" />
        </Field>

        <div className="flex items-start gap-2 rounded-card bg-tint px-3 py-2.5 text-[12px] leading-relaxed text-ink-mute">
          <Package size={13} className="mt-0.5 shrink-0" />
          没有「满配数量」—— 每次采购量都可能不同，所以只记录「这次买了多少」，不逼你填一个假的标准容量。
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- 补货 */

function RestockModal({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const restockSupply = useStore((s) => s.restockSupply);
  const state = useStore((s) => s.state);
  const people = activeMembers(state);

  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [withExpense, setWithExpense] = useState(true);

  const qtyNum = qty ? Number(qty) : null;
  const costNum = Number(cost) || 0;
  const after = supply.stock + (qtyNum ?? 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={`补货 · ${supply.emoji} ${supply.name}`}
      subtitle="填了花费会自动生成一笔 AA 账单；数量可以留空"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              restockSupply(supply.id, {
                qty: qtyNum,
                cost: withExpense ? costNum : 0,
                paidBy: state.currentMemberId,
                note: note.trim() || undefined,
              });
              onClose();
            }}
          >
            <ShoppingCart size={15} /> 确认补货
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label={`本次采购量（${supply.unit}，可留空）`}>
            <Input
              value={qty}
              inputMode="numeric"
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
              placeholder="不填也行"
            />
          </Field>
          <Field label="花费金额（元）">
            <Input
              value={cost}
              inputMode="decimal"
              onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0.00"
              disabled={!withExpense}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-btn border border-line bg-comp px-3 py-2.5">
          <input
            type="checkbox"
            checked={withExpense}
            onChange={(e) => setWithExpense(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-[13.5px]">生成 AA 账单，由全体室友均摊</span>
        </label>

        {withExpense && costNum > 0 ? (
          <div className="rounded-card bg-pos-50 px-4 py-3 text-[12.5px] leading-relaxed text-pos-700">
            花费 <span className="num font-semibold">{formatMoney(costNum)}</span>，由 {people.length} 人均摊，每人约{' '}
            <span className="num font-semibold">{formatMoney(costNum / Math.max(1, people.length))}</span>。
            账单只记「这笔怎么分摊」—— 谁垫的钱在<b>结算计算器</b>里一次性对齐，因为记账的人不一定就是付钱的人。
          </div>
        ) : null}

        <Field label="备注（可选）">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：618 囤了一箱" />
        </Field>

        <div className="flex items-start gap-2 rounded-card bg-tint px-3 py-2.5 text-[12px] leading-relaxed text-ink-mute">
          <Package size={13} className="mt-0.5 shrink-0" />
          补货后剩余 {after} {supply.unit}
          {qtyNum ? `（本次 +${qtyNum}）` : '（未填数量，仅记录补货时间）'}；这一刻会成为新的消耗速率基准点。
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------- 报告剩余 */

function ReportModal({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const reportRemaining = useStore((s) => s.reportRemaining);
  const [qty, setQty] = useState(String(supply.stock));
  const qtyNum = Number(qty) || 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={`报告剩余 · ${supply.emoji} ${supply.name}`}
      subtitle="报个数就行，不用记「用了多少」"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              reportRemaining(supply.id, qtyNum);
              onClose();
            }}
          >
            <Check size={15} /> 记录
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={`现在还剩多少（${supply.unit}）`}>
          <Input
            value={qty}
            inputMode="numeric"
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQty(String(n))}
              className={cn(
                'num rounded-btn border px-3 py-1.5 text-[13px] transition',
                qty === String(n) ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-comp text-ink-soft',
              )}
            >
              {n} {supply.unit}
            </button>
          ))}
        </div>
        <div className="flex items-start gap-2 rounded-card bg-tint px-3 py-2.5 text-[12px] leading-relaxed text-ink-mute">
          <CalendarClock size={13} className="mt-0.5 shrink-0" />
          报告两次之后就能算出真实消耗速率，并给出「N 天后需补货」的预估。
          {qtyNum === 0 ? ' 填 0 等同于「已用完」。' : ''}
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------- 报告用完 */

function ConfirmEmptyModal({
  supply,
  forecast,
  onClose,
}: {
  supply: Supply;
  forecast: ReturnType<typeof supplyForecast>;
  onClose: () => void;
}) {
  const reportEmpty = useStore((s) => s.reportEmpty);
  return (
    <Modal
      open
      onClose={onClose}
      title={`${supply.emoji} ${supply.name} 用完了吗？`}
      subtitle="这是一个独立的动作，不需要先登记消耗"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              reportEmpty(supply.id);
              onClose();
            }}
          >
            <AlertTriangle size={15} /> 确认已用完
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-card bg-danger-50 px-4 py-3 text-[13px] leading-relaxed text-danger-700">
          确认后库存记为 0，并在记录里留一条「报告已用完」。之后随时可以点「补货」重新开始计时。
        </div>
        <div className="rounded-card bg-tint px-4 py-3 text-[12.5px] leading-relaxed text-ink-mute">
          当前预估：<span className="font-medium text-ink-soft">{supplyHeadline(forecast)}</span>
          {forecast.dailyUsage ? `，按每天约 ${forecast.dailyUsage.toFixed(2)} ${supply.unit} 估算` : ''}
        </div>
      </div>
    </Modal>
  );
}
