import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tongwu.theme';

/**
 * 主题机制与 Chronicle 一致：
 *   · <html data-theme="light|dark"> 切换，全部颜色由 CSS 令牌自动翻转
 *   · 用户显式选择写入 localStorage；未选择时跟随系统 prefers-color-scheme
 *   · 首帧由 index.html 里的内联脚本先行设置，避免闪白（FOUC）
 */
export function resolveInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);
  /** 用户是否已显式选择（未选择时继续跟随系统） */
  const [explicit, setExplicit] = useState<boolean>(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 未显式选择时，跟随系统主题变化
  useEffect(() => {
    if (explicit) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setThemeState(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [explicit]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    setExplicit(true);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 隐私模式忽略 */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
