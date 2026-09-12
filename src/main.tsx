import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

/**
 * 启动自检：确认「工具类 → CSS 变量 → 实际颜色」这条链路真的通了。
 *
 * 三种典型故障各有明确提示：
 *   1. 令牌未定义        → 样式表没加载，或跑的是硬编码颜色的旧版本
 *   2. 令牌有但工具类没跟上 → dev server 里是旧的 Tailwind 配置（改了
 *      tailwind.config.js 后必须重启 npm run dev；原子写文件可能让 watcher 收不到变更）
 *   3. 全部一致          → 正常
 */
(function selfCheck() {
  const root = getComputedStyle(document.documentElement);
  const theme = document.documentElement.getAttribute('data-theme');
  const inkRgb = root.getPropertyValue('--ink-rgb').trim();
  const brand50Rgb = root.getPropertyValue('--brand-50-rgb').trim();

  if (!inkRgb) {
    console.error(
      `[同屋] 主题令牌未定义（--ink-rgb 为空）· 构建 ${__BUILD_ID__} ·\n` +
        `  说明样式表未加载，或你打开的是硬编码颜色的旧版本。`,
    );
    return;
  }

  // 工具类是否真的指向了令牌？这是「变量未生效」最隐蔽的一种
  const probe = (cls: string) => {
    const el = document.createElement('span');
    el.className = cls;
    el.textContent = 'x';
    el.style.position = 'absolute';
    el.style.opacity = '0';
    document.body.appendChild(el);
    const s = getComputedStyle(el);
    const value = { color: s.color, background: s.backgroundColor };
    el.remove();
    return value;
  };

  const expected = (rgb: string) => `rgb(${rgb.split(' ').join(', ')})`;
  const actualInk = probe('text-ink');
  const actualBrand = probe('bg-brand-50');
  const expectInk = expected(inkRgb);
  const expectBrand = expected(brand50Rgb);

  const mismatch: string[] = [];
  if (actualInk.color !== expectInk) mismatch.push(`text-ink → ${actualInk.color}（应为 ${expectInk}）`);
  if (actualBrand.background !== expectBrand)
    mismatch.push(`bg-brand-50 → ${actualBrand.background}（应为 ${expectBrand}）`);

  if (mismatch.length > 0) {
    console.warn(
      `[同屋] 工具类没有跟随主题令牌 · 构建 ${__BUILD_ID__}\n  ${mismatch.join('\n  ')}\n` +
        `  → 多半是 dev server 仍在用旧的 Tailwind 配置。请重启：` +
        `Ctrl+C 后重新 npm run dev（并 rm -rf node_modules/.vite）。`,
    );
    return;
  }

  console.info(
    `[同屋] 构建 ${__BUILD_ID__} · 主题令牌链路正常 · data-theme=${theme} · ` +
      `--ink-rgb=${inkRgb} · --brand-50-rgb=${brand50Rgb} · text-ink=${actualInk.color}`,
  );
})();

const container = document.getElementById('root');
if (!container) throw new Error('#root 未找到');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
