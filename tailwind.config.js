/** @type {import('tailwindcss').Config} */

/** 主题令牌 → Tailwind 颜色。带 -rgb 三元组的支持 /alpha 透明度修饰符 */
const solid = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

const scale = (prefix, keys) =>
  Object.fromEntries(keys.map((k) => [k, solid(`${prefix}-${k}`)]));

/* ── 半透明底的两种做法 ────────────────────────────────────
 * 1) 静态细微填充 tint / tint-strong
 *    值是现算的 color-mix，本身即半透明，不需要再调 alpha
 *    （写成 bg-tint/70 不生效，代码里也从未这样用）。
 * 2) hover 底 neutral-tint / brand-tint / danger-tint
 *    值是可调 alpha 的实色，悬停时在标记里写 /25。
 *
 * 为什么 hover 的 0.25 不抽成常量：Tailwind 是靠扫描源码里的
 * **字面类名** 生成 CSS 的，写成 `hover:bg-neutral-tint/${HOVER_TINT}`
 * 扫不到，类不会生成。所以这个值只能落在标记里，
 * 由 test/theme.test.mjs 与 test/hover.test.mjs 断言钉住。
 */
const STATIC_TINT = 8;
const STATIC_TINT_STRONG = 14;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 主题靠 <html data-theme> 切换；绝大多数样式由 CSS 变量自动翻转，
  // 只有极少数地方才需要 dark: 变体
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* 基底 */
        canvas: solid('canvas'),
        surface: 'var(--glass)',
        glass: solid('glass'),
        comp: solid('comp-bg'),
        /* --line 本身已是半透明细线色，代码里从未写 border-line/<alpha>，
           所以直接用 var，不需要再走一层 alpha 变量 */
        line: 'var(--line)',
        'line-blur': 'var(--line-blur)',
        overlay: 'var(--overlay)',
        /* 交互填充（替代原先的 bg-black/[0.04] 一类硬编码） */
        tint: `color-mix(in srgb, var(--bg-offset) ${STATIC_TINT}%, transparent)`,
        'tint-strong': `color-mix(in srgb, var(--bg-offset) ${STATIC_TINT_STRONG}%, transparent)`,
        /* hover 专用：标记里写 /25 */
        'neutral-tint': solid('bg-offset'),
        'brand-tint': solid('brand-500'),
        'danger-tint': solid('danger-500'),
        /* 文字三层 */
        ink: {
          DEFAULT: solid('ink'),
          soft: solid('ink-soft'),
          mute: solid('ink-mute'),
        },
        /* 水绿主色阶 */
        brand: scale('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        /* 正向语义（青蓝，与水绿区分） */
        pos: scale('pos', [50, 100, 200, 300, 400, 500, 600, 700]),
        /* 警示 / 危险 */
        warn: scale('warn', [50, 100, 200, 300, 400, 500, 600, 700]),
        danger: scale('danger', [50, 100, 200, 300, 400, 500, 600, 700]),
        /* 品牌本色与可读版本 */
        accent: {
          DEFAULT: 'var(--accent)',
          vivid: 'var(--accent-vivid)',
          bg: 'var(--accent-bg)',
          fg: 'var(--accent-btn-fg)',
        },
        /* Tailwind Preflight 的 ::placeholder 取 colors.gray.400，默认写死 #9ca3af，
           这里换成令牌，placeholder 才会跟着深浅模式翻转 */
        gray: { 400: 'var(--ink-mute)' },
      },
      fontFamily: {
        sans: ['var(--app-font-stack)'],
      },
      borderRadius: {
        /* Chronicle 圆角家族：按钮 8 / 标签 6 / 卡片 14 / 弹层 18 */
        none: '0px',
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '8px',
        '2xl': '14px',
        '3xl': '18px',
        btn: '8px',
        tag: '6px',
        card: '14px',
        panel: '18px',
        full: '9999px',
      },
      boxShadow: {
        /* 玻璃 = 顶部内高光 + 轻投影；不要发光 */
        glass: 'var(--glass-inner), var(--shadow-1)',
        'glass-hvr': 'var(--glass-inner), var(--shadow-2)',
        panel: 'var(--shadow-3)',
        pop: 'var(--glass-inner), var(--shadow-3)',
      },
      /* Tailwind Preflight 给 * 设了 border-color: theme(borderColor.DEFAULT)，
         默认是写死的 gray-200 (#e5e7eb)。换成令牌，未显式指定颜色的边框才随主题翻转 */
      borderColor: {
        DEFAULT: 'var(--line)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.24s ease-out both',
        'fade-in': 'fade-in 0.18s ease-out both',
      },
    },
  },
  plugins: [],
};
