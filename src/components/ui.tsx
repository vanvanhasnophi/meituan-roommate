import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import type { Member } from '../../shared/types';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * 把颜色令牌（hex 或 var(--x)）转成「掺入透明」的混合色。
 * 不能用 `${color}14` 这种方式拼接——令牌是 CSS 变量，只有 color-mix 能作用于它，
 * 这样同一份数据在深浅两个模式下都能自动拿到正确的底色。
 */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/* --------------------------------------------------------------- 头像 */

export function Avatar({
  member,
  size = 'md',
  ring = false,
  title,
}: {
  member?: Member;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  ring?: boolean;
  title?: string;
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[11px]',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-lg',
    lg: 'h-12 w-12 text-xl',
  };
  const color = member?.color ?? 'var(--ink-mute)';
  return (
    <span
      title={title ?? member?.name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full',
        sizes[size],
        ring && 'ring-2 ring-canvas',
      )}
      style={{ backgroundColor: tint(color, 22), color, border: `1px solid ${tint(color, 34)}` }}
    >
      {member?.avatar ?? '🙂'}
    </span>
  );
}

export function MemberPill({ member, active, onClick }: { member: Member; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition',
        active ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-comp text-ink-soft hover:border-brand-200',
      )}
    >
      <Avatar member={member} size="sm" />
      <span className="font-medium">{member.name}</span>
    </button>
  );
}

/* --------------------------------------------------------------- 容器 */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card', className)}>{children}</div>;
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-mute">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- 按钮 */

type BtnVariant = 'primary' | 'ghost' | 'quiet';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: {
  variant?: BtnVariant;
  size?: 'xs' | 'md';
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<BtnVariant, string> = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    quiet: 'btn-quiet',
  };
  return (
    <button type="button" className={cn(variants[variant], size === 'xs' && 'btn-xs', className)} {...rest}>
      {children}
    </button>
  );
}

export function Chip({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn('chip', className)}
      style={
        color
          ? { backgroundColor: tint(color, 14), color, border: `1px solid ${tint(color, 26)}` }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function Progress({ value, color = 'var(--brand-600)', className }: { value: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-xl bg-tint-strong p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[13px] font-medium transition',
            value === o.value ? 'bg-comp text-ink shadow-glass' : 'text-ink-mute hover:text-ink-soft',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- 表单 */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-mute">{hint}</p> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('field', props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('field resize-none leading-relaxed', props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('field appearance-none bg-comp pr-9', props.className)} />;
}

/* --------------------------------------------------------------- 弹层 */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 sm:items-center sm:p-6">
      <button type="button" aria-label="关闭" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        className={cn(
          'glass-panel relative z-10 max-h-[92vh] w-full animate-fade-up overflow-y-auto rounded-t-panel sm:rounded-panel',
          width,
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line-blur px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-[13px] text-ink-mute">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-mute transition hover:bg-neutral-tint/25 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-line-blur px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 其他 */

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">{icon}</div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink-mute">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'brand' | 'accent' | 'warn';
  icon?: ReactNode;
}) {
  const tones = {
    default: 'text-ink',
    brand: 'text-brand-600',
    accent: 'text-pos-600',
    warn: 'text-warn-700',
  };
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-mute">{label}</span>
        {icon ? <span className="text-ink-mute/70">{icon}</span> : null}
      </div>
      <div className={cn('num mt-2 text-2xl font-semibold tracking-tight', tones[tone])}>{value}</div>
      {sub ? <p className="mt-1 text-[12.5px] leading-relaxed text-ink-mute">{sub}</p> : null}
    </div>
  );
}
