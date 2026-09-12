import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Check,
  Droplets,
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
  averageDailyUsage,
  daysBetween,
  formatMoney,
  friendlyDate,
  memberById,
  supplyInsights,
  todayStr,
} from '../../shared/logic';
import { SUPPLY_CATEGORIES } from '../../shared/meta';
import type { Supply, SupplyCategory } from '../../shared/types';
import { Avatar, Button, Card, Chip, EmptyState, Field, Input, MemberPill, Modal, Progress, SectionHeader, Segmented, Textarea, cn } from '../components/ui';
import { useStore } from '../store/useStore';

const EMOJI_CHOICES = ['🧻', '🧴', '🫧', '🗑️', '🧽', '💧', '🧪', '🧼', '🪣', '🧹', '🍚', '🫙', '🧂', '🕯️', '🔋', '💡'];

const LEVEL_STYLE: Record<string, { chip: string; bar: string; label: string }> = {
  out: { chip: 'bg-danger-50 text-danger-700', bar: 'var(--danger-500)', label: '已用完' },
  due: { chip: 'bg-warn-50 text-warn-700', bar: 'var(--warn-500)', label: '该更换了' },
  low: { chip: 'bg-brand-50 text-brand-700', bar: 'var(--brand-600)', label: '库存偏低' },
  ok: { chip: 'bg-pos-50 text-pos-700', bar: 'var(--pos-600)', label: '充足' },
};

export default function Supplies() {
  const state = useStore((s) => s.state);
  const consumeSupply = useStore((s) => s.consumeSupply);
  const removeSupply = useStore((s) => s.removeSupply);
  const today = todayStr();

  const [editing, setEditing] = useState<Supply | null>(null);
  const [creating, setCreating] = useState(false);
  const [restocking, setRestocking] = useState<Supply | null>(null);
  const [consuming, setConsuming] = useState<Supply | null>(null);
  const [filter, setFilter] = useState<'all' | 'alert'>('all');

  const insights = useMemo(() => supplyInsights(state, today), [state, today]);
  const alerts = insights.filter((i) => i.level !== 'ok');
  const shown = filter === 'all' ? insights : alerts;

  const recentLogs = state.supplyLogs.slice(0, 12);
  const monthSpend = state.supplyLogs
    .filter((l) => l.type === 'restock' && l.cost && daysBetween(l.date, today) <= 30)
    .reduce((s, l) => s + (l.cost ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">公共物品登记与提醒</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-mute">
            卷纸、洗洁精这些「用完了没人管」的小事最容易积怨。这里登记库存与消耗，
            快用完自动提醒，补货花的钱一键变成 AA 账单。
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
          <p className="mt-1 text-[12.5px] text-ink-mute">共 {new Set(state.supplies.map((s) => s.category)).size} 个类别</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">需要关注</span>
          <div className={cn('num mt-2 text-2xl font-semibold tracking-tight', alerts.length > 0 ? 'text-brand-600' : 'text-pos-600')}>
            {alerts.length}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-mute">
            {alerts.filter((a) => a.level === 'out').length} 项已用完 · {alerts.filter((a) => a.level === 'due').length} 项待更换
          </p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">近 30 天补货支出</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight">{formatMoney(monthSpend)}</div>
          <p className="mt-1 text-[12.5px] text-ink-mute">全部已自动进入 AA 账单</p>
        </Card>
        <Card className="card-pad">
          <span className="text-[13px] font-medium text-ink-mute">登记记录</span>
          <div className="num mt-2 text-2xl font-semibold tracking-tight">{state.supplyLogs.length}</div>
          <p className="mt-1 text-[12.5px] text-ink-mute">消耗与补货都留痕可查</p>
        </Card>
      </div>

      {alerts.length > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warn-300/60 bg-warn-50 px-4 py-3.5">
          <BellRing size={17} className="mt-0.5 shrink-0 text-warn-700" />
          <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-warn-700">
            <span className="font-medium">{alerts.length} 项提醒：</span>
            {alerts
              .slice(0, 5)
              .map((a) => `${a.supply.emoji}${a.supply.name}（${LEVEL_STYLE[a.level].label}）`)
              .join('、')}
            {alerts.length > 5 ? ` 等 ${alerts.length} 项` : ''}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `全部 ${insights.length}` },
            { value: 'alert', label: `待处理 ${alerts.length}` },
          ]}
        />
      </div>

      {/* 物品卡片 */}
      {shown.length === 0 ? (
        <EmptyState
          icon={<Check size={20} />}
          title="所有物品库存充足"
          hint="当前没有需要补货或更换的物品，小屋运转良好。"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ supply, level, daysLeft, dueForReplacement, daysSinceRestock }) => {
            const style = LEVEL_STYLE[level];
            const ratio = supply.capacity > 0 ? supply.stock / supply.capacity : 0;
            const usage = averageDailyUsage(state.supplyLogs, supply.id, today);
            return (
              <Card key={supply.id} className="card-pad flex flex-col">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tint text-xl">
                    {supply.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-medium">{supply.name}</p>
                      <Chip className={style.chip}>{style.label}</Chip>
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-mute">
                      {supply.category} · 单位「{supply.unit}」· 阈值 {supply.lowStockThreshold}
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-ink-mute transition hover:bg-tint-strong hover:text-ink"
                      onClick={() => setEditing(supply)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-ink-mute transition hover:bg-danger-50 hover:text-danger-500"
                      onClick={() => removeSupply(supply.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="mt-3.5">
                  <div className="flex items-end justify-between">
                    <span className="num text-[20px] font-semibold tracking-tight">
                      {supply.stock}
                      <span className="ml-1 text-[12px] font-normal text-ink-mute">{supply.unit}</span>
                    </span>
                    <span className="num text-[12px] text-ink-mute">满配 {supply.capacity}</span>
                  </div>
                  <Progress value={ratio} color={style.bar} className="mt-2" />
                </div>

                <div className="mt-3 space-y-1 text-[12px] text-ink-mute">
                  <p className="flex items-center gap-1.5">
                    <CalendarClock size={12} />
                    {daysLeft !== null
                      ? `按近期消耗速度，约还能用 ${daysLeft} 天`
                      : '消耗数据不足，暂无法预估'}
                  </p>
                  {supply.cycleDays ? (
                    <p className={cn('flex items-center gap-1.5', dueForReplacement && 'text-warn-700')}>
                      <Droplets size={12} />
                      {daysSinceRestock !== null
                        ? `上次更换 ${daysSinceRestock} 天前（建议每 ${supply.cycleDays} 天）`
                        : `建议每 ${supply.cycleDays} 天更换一次`}
                    </p>
                  ) : null}
                  {usage > 0 ? (
                    <p className="num">
                      日均消耗 {usage.toFixed(2)} {supply.unit}
                    </p>
                  ) : null}
                  {supply.note ? <p className="text-ink-mute/90">备注：{supply.note}</p> : null}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button size="xs" variant="ghost" onClick={() => setConsuming(supply)} disabled={supply.stock <= 0}>
                    <Minus size={13} /> 登记消耗
                  </Button>
                  <Button size="xs" onClick={() => setRestocking(supply)} className="flex-1">
                    <ShoppingCart size={13} /> 补货
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 记录 */}
      <Card className="card-pad">
        <SectionHeader
          title="消耗与补货记录"
          subtitle="谁用的、谁买的、花了多少，一目了然"
          icon={<History size={17} />}
        />
        {recentLogs.length === 0 ? (
          <p className="rounded-xl bg-tint px-3 py-5 text-center text-[13px] text-ink-mute">还没有记录</p>
        ) : (
          <div className="space-y-1.5">
            {recentLogs.map((log) => {
              const supply = state.supplies.find((s) => s.id === log.supplyId);
              const who = memberById(state, log.memberId);
              return (
                <div key={log.id} className="flex items-center gap-3 rounded-xl border border-line bg-comp px-3 py-2.5">
                  <span className="text-lg">{supply?.emoji ?? '📦'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px]">
                      <span className="font-medium">{who?.name}</span>{' '}
                      {log.type === 'restock' ? '补货' : log.type === 'consume' ? '消耗' : '调整'}{' '}
                      <span className="font-medium">{supply?.name}</span>{' '}
                      <span className="num">
                        {log.type === 'consume' ? '-' : '+'}
                        {log.qty} {supply?.unit}
                      </span>
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
                  {log.type === 'restock' && log.cost ? (
                    <Chip className="bg-pos-50 text-pos-700">已入账</Chip>
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

      {consuming ? (
        <ConsumeModal
          supply={consuming}
          onClose={() => setConsuming(null)}
          onSubmit={(qty, memberId) => {
            consumeSupply(consuming.id, qty, memberId);
            setConsuming(null);
          }}
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
  const [threshold, setThreshold] = useState(String(supply?.lowStockThreshold ?? 1));
  const [capacity, setCapacity] = useState(String(supply?.capacity ?? 6));
  const [cycleDays, setCycleDays] = useState(supply?.cycleDays ? String(supply.cycleDays) : '');
  const [note, setNote] = useState(supply?.note ?? '');

  const valid = name.trim().length > 0 && Number(stock) >= 0;

  const submit = () => {
    const payload = {
      name: name.trim(),
      emoji,
      category,
      unit: unit.trim() || '件',
      stock: Number(stock) || 0,
      lowStockThreshold: Number(threshold) || 0,
      capacity: Number(capacity) || Number(stock) || 1,
      cycleDays: cycleDays ? Number(cycleDays) : null,
      note: note.trim() || undefined,
    };
    if (supply) {
      updateSupply(supply.id, payload);
      showToast('物品信息已更新', 'success');
    } else {
      addSupply(payload);
      showToast('已登记新物品', 'success');
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={supply ? '编辑物品' : '登记公共物品'}
      subtitle="设定安全库存后，快用完时系统会自动提醒"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!valid} onClick={submit}>
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
                    'flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition',
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
                  'rounded-xl border px-3 py-1.5 text-[13px] transition',
                  category === c ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-comp text-ink-soft hover:border-brand-200',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="单位">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="卷 / 瓶 / 包" />
          </Field>
          <Field label="当前库存">
            <Input value={stock} inputMode="numeric" onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="提醒阈值">
            <Input value={threshold} inputMode="numeric" onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="满配数量">
            <Input value={capacity} inputMode="numeric" onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>

        <Field label="更换周期（天，可选）" hint="适用于滤芯、抹布等需要定期更换的耗材">
          <Input value={cycleDays} inputMode="numeric" onChange={(e) => setCycleDays(e.target.value.replace(/\D/g, ''))} placeholder="例如 90" />
        </Field>

        <Field label="备注（可选）">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="存放位置、品牌偏好等" />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- 补货 */

function RestockModal({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const restockSupply = useStore((s) => s.restockSupply);
  const state = useStore((s) => s.state);
  const me = state.members.find((m) => m.id === state.currentMemberId) ?? state.members[0];
  const people = activeMembers(state);

  const [qty, setQty] = useState(String(Math.max(1, supply.capacity - supply.stock || 1)));
  const [cost, setCost] = useState('');
  const [paidBy, setPaidBy] = useState(me?.id ?? '');
  const [note, setNote] = useState('');
  const [withExpense, setWithExpense] = useState(true);

  const qtyNum = Number(qty) || 0;
  const costNum = Number(cost) || 0;
  const perHead = costNum > 0 && people.length > 0 ? costNum / people.length : 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={`补货 · ${supply.emoji} ${supply.name}`}
      subtitle="填写花费后，会自动生成一笔 AA 账单，不用再单独记账"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={qtyNum <= 0}
            onClick={() => {
              restockSupply(supply.id, {
                qty: qtyNum,
                cost: withExpense ? costNum : 0,
                paidBy,
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
          <Field label={`补货数量（${supply.unit}）`}>
            <Input value={qty} inputMode="numeric" onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
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

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-comp px-3 py-2.5">
          <input
            type="checkbox"
            checked={withExpense}
            onChange={(e) => setWithExpense(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-[13.5px]">生成 AA 账单，由全体室友均摊</span>
        </label>

        {withExpense ? (
          <>
            <Field label="谁垫付的">
              <div className="flex flex-wrap gap-2">
                {people.map((m) => (
                  <MemberPill key={m.id} member={m} active={paidBy === m.id} onClick={() => setPaidBy(m.id)} />
                ))}
              </div>
            </Field>
            <div className="rounded-2xl bg-pos-50 px-4 py-3 text-[12.5px] leading-relaxed text-pos-700">
              {costNum > 0 ? (
                <>
                  补货 {qtyNum} {supply.unit}，花费 <span className="num font-semibold">{formatMoney(costNum)}</span>，
                  由 {people.length} 人均摊，每人约 <span className="num font-semibold">{formatMoney(perHead)}</span>。
                  账单会同步出现在「账单分摊」里。
                </>
              ) : (
                <>填写金额后会自动计算人均，并同步到账单模块。</>
              )}
            </div>
          </>
        ) : null}

        <Field label="备注（可选）">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：618 囤了一箱" />
        </Field>

        <div className="flex items-start gap-2 rounded-xl bg-tint px-3 py-2.5 text-[12px] leading-relaxed text-ink-mute">
          <Package size={13} className="mt-0.5 shrink-0" />
          当前库存 {supply.stock} {supply.unit}，补货后为{' '}
          <span className="num font-medium text-ink-soft">
            {supply.stock + qtyNum} {supply.unit}
          </span>
          ，低于阈值 {supply.lowStockThreshold} 时才会再次提醒。
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- 消耗 */

function ConsumeModal({
  supply,
  onClose,
  onSubmit,
}: {
  supply: Supply;
  onClose: () => void;
  onSubmit: (qty: number, memberId: string) => void;
}) {
  const state = useStore((s) => s.state);
  const people = activeMembers(state);
  const [qty, setQty] = useState('1');
  const [memberId, setMemberId] = useState(state.currentMemberId);

  const qtyNum = Number(qty) || 0;
  const after = Math.max(0, supply.stock - qtyNum);

  return (
    <Modal
      open
      onClose={onClose}
      title={`登记消耗 · ${supply.emoji} ${supply.name}`}
      subtitle="如实登记，库存与提醒才会准"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button disabled={qtyNum <= 0} onClick={() => onSubmit(qtyNum, memberId)}>
            <Minus size={15} /> 确认消耗
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQty(String(n))}
              className={cn(
                'flex-1 rounded-xl border py-2 text-[13.5px] transition',
                qty === String(n) ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-comp text-ink-soft',
              )}
            >
              -{n} {supply.unit}
            </button>
          ))}
        </div>
        <Field label={`自定义数量（${supply.unit}）`}>
          <Input value={qty} inputMode="numeric" onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="谁使用的">
          <div className="flex flex-wrap gap-2">
            {people.map((m) => (
              <MemberPill key={m.id} member={m} active={memberId === m.id} onClick={() => setMemberId(m.id)} />
            ))}
          </div>
        </Field>
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px]',
            after <= supply.lowStockThreshold ? 'bg-warn-50 text-warn-700' : 'bg-tint text-ink-mute',
          )}
        >
          {after <= supply.lowStockThreshold ? <AlertTriangle size={14} /> : null}
          消耗后剩余 <span className="num font-medium">{after} {supply.unit}</span>
          {after <= supply.lowStockThreshold
            ? `，将低于阈值 ${supply.lowStockThreshold}，会自动提醒补货。`
            : `，仍在安全库存之上。`}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-ink-mute">
          <Avatar member={memberById(state, memberId)} size="xs" />
          记录会写入物品流水，可在下方列表中查看。
        </div>
      </div>
    </Modal>
  );
}
