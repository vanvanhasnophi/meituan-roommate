import {
  CalendarCheck,
  ChevronDown,
  Info,
  LayoutDashboard,
  Package,
  Receipt,
  RotateCcw,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { activeMembers } from '../shared/logic';
import { Avatar, Chip, cn } from './components/ui';
import About from './pages/About';
import Chores from './pages/Chores';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Pacts from './pages/Pacts';
import Supplies from './pages/Supplies';
import { useStore } from './store/useStore';

type Route = 'dashboard' | 'expenses' | 'chores' | 'supplies' | 'pacts' | 'about';

const NAV: { key: Route; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { key: 'dashboard', label: '概览', icon: LayoutDashboard, hint: '今天该做什么' },
  { key: 'expenses', label: '账单分摊', icon: Receipt, hint: 'AA 与结算' },
  { key: 'chores', label: '值日排班', icon: CalendarCheck, hint: '轮值与打卡' },
  { key: 'supplies', label: '公共物品', icon: Package, hint: '库存与提醒' },
  { key: 'pacts', label: '室友公约', icon: ScrollText, hint: '提案与表决' },
  { key: 'about', label: '设计说明', icon: Info, hint: '产品思路' },
];

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const found = NAV.find((n) => n.key === raw);
  return found ? found.key : 'dashboard';
}

function navigate(route: Route) {
  window.location.hash = `#/${route}`;
}

export default function App() {
  const state = useStore((s) => s.state);
  const ready = useStore((s) => s.ready);
  const driver = useStore((s) => s.driver);
  const sync = useStore((s) => s.sync);
  const hint = useStore((s) => s.hint);
  const toast = useStore((s) => s.toast);
  const bootstrap = useStore((s) => s.bootstrap);
  const setCurrentMember = useStore((s) => s.setCurrentMember);
  const resetDemo = useStore((s) => s.resetDemo);
  const dismissToast = useStore((s) => s.dismissToast);

  const [route, setRoute] = useState<Route>(parseHash);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [dismissedHint, setDismissedHint] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/dashboard';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const me = useMemo(
    () => state.members.find((m) => m.id === state.currentMemberId) ?? state.members[0],
    [state.members, state.currentMemberId],
  );
  const roommates = activeMembers(state);

  const storageLabel =
    driver === 'libsql' ? 'SQLite 已连接' : driver === 'memory' ? '演示模式' : '本地模式';
  const syncLabel = sync === 'saving' ? '保存中…' : sync === 'saved' ? '已同步' : sync === 'offline' ? '仅本地' : '';

  return (
    <div className="min-h-screen lg:flex">
      {/* 桌面侧栏 */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-canvas/80 px-4 py-6 backdrop-blur lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg shadow-sm">🏠</span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight">同屋</div>
            <div className="truncate text-[11.5px] text-ink-mute">合租生活管家</div>
          </div>
        </div>

        <nav className="mt-7 flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = route === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.key)}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                  active ? 'bg-white text-ink shadow-card' : 'text-ink-soft hover:bg-white/70',
                )}
              >
                <Icon size={18} className={active ? 'text-brand-500' : 'text-ink-mute'} />
                <span className="flex-1">
                  <span className="block text-[14px] font-medium">{item.label}</span>
                  <span className="block text-[11.5px] text-ink-mute">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 px-2">
          <div className="rounded-2xl border border-line bg-white/70 p-3">
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-mute">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  driver === 'libsql' ? 'bg-accent-500' : driver === 'memory' ? 'bg-warn-500' : 'bg-ink-mute',
                )}
              />
              存储：{storageLabel}
            </div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-ink-mute">
              小屋码 <span className="num font-medium text-ink-soft">{state.code}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void resetDemo()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-ink-mute transition hover:bg-white/70 hover:text-ink-soft"
          >
            <RotateCcw size={14} /> 重置演示数据
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-base lg:hidden">🏠</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-semibold tracking-tight">{state.name}</h1>
                <Chip className="hidden bg-black/[0.04] text-ink-mute sm:inline-flex">小屋码 {state.code}</Chip>
              </div>
              <p className="truncate text-[11.5px] text-ink-mute">
                {state.address || '合租小屋'} · {roommates.length} 位室友
                {syncLabel ? ` · ${syncLabel}` : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('about')}
              aria-label="产品设计说明"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-mute transition hover:border-brand-200 hover:text-brand-600 lg:hidden',
                route === 'about' && 'border-brand-300 text-brand-600',
              )}
            >
              <Info size={17} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSwitcherOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-2.5 text-sm transition hover:border-brand-200"
              >
                <Avatar member={me} size="sm" />
                <span className="hidden font-medium sm:inline">我是 {me?.name}</span>
                <ChevronDown size={14} className="text-ink-mute" />
              </button>
              {switcherOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="关闭"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setSwitcherOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-60 animate-scale-in rounded-2xl border border-line bg-white p-2 shadow-pop">
                    <p className="px-2 py-1.5 text-[11.5px] text-ink-mute">切换身份，体验不同室友视角</p>
                    {roommates.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-label={`切换为 ${m.name}`}
                        onClick={() => {
                          setCurrentMember(m.id);
                          setSwitcherOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm transition',
                          m.id === me?.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-black/[0.04]',
                        )}
                      >
                        <Avatar member={m} size="sm" />
                        <span className="flex-1 font-medium">{m.name}</span>
                        {m.role === 'admin' ? <span className="text-[11px] text-ink-mute">管理员</span> : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        {hint && !dismissedHint ? (
          <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6">
            <div className="flex items-start gap-2.5 rounded-2xl border border-warn-300/60 bg-warn-50 px-4 py-3 text-[13px] leading-relaxed text-warn-700">
              <Sparkles size={16} className="mt-0.5 shrink-0" />
              <p className="flex-1">{hint}</p>
              <button type="button" className="text-[12px] underline" onClick={() => setDismissedHint(true)}>
                知道了
              </button>
            </div>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-12">
          {!ready ? (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink-mute">正在打开小屋…</div>
          ) : (
            <>
              {route === 'dashboard' ? <Dashboard onNavigate={navigate} /> : null}
              {route === 'expenses' ? <Expenses /> : null}
              {route === 'chores' ? <Chores /> : null}
              {route === 'supplies' ? <Supplies /> : null}
              {route === 'pacts' ? <Pacts /> : null}
              {route === 'about' ? <About onNavigate={navigate} /> : null}
            </>
          )}
        </main>
      </div>

      {/* 移动底部导航：5 个核心模块，说明入口放在顶栏 */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl">
          {NAV.filter((n) => n.key !== 'about').map((item) => {
            const Icon = item.icon;
            const active = route === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.key)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] transition',
                  active ? 'text-brand-600' : 'text-ink-mute',
                )}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 轻提示 */}
      {toast ? (
        <div className="pointer-events-none fixed bottom-24 left-0 right-0 z-50 flex justify-center px-4 lg:bottom-8">
          <div className="pointer-events-auto flex animate-fade-up items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[13.5px] text-white shadow-pop">
            <span>{toast.text}</span>
            {toast.action ? (
              <button
                type="button"
                className="rounded-lg bg-white/15 px-2.5 py-1 text-[12.5px] font-medium transition hover:bg-white/25"
                onClick={() => {
                  toast.action?.run();
                  dismissToast();
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
