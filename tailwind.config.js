/** @type {import('tailwindcss').Config} */

/** 主题令牌 → Tailwind 颜色。带 -rgb 三元组的支持 /alpha 透明度修饰符 */
const solid = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;
/** 令牌本身已是半透明色（如细线、悬停底），默认用原值，只有显式写 /alpha 时才换算 */
const translucent = (name, triplet) => ({ opacityValue }) =>
  opacityValue === undefined ? `var(--${name})` : `rgb(var(${triplet}) / ${opacityValue})`;

const scale = (prefix, keys) =>
  Object.fromEntries(keys.map((k) => [k, solid(`${prefix}-${k}`)]));

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
        line: translucent('line', '--line-rgb'),
        'line-blur': 'var(--line-blur)',
        overlay: 'var(--overlay)',
        /* 交互填充（替代原先的 bg-black/[0.04] 一类硬编码） */
        tint: translucent('hover', '--bg-offset-rgb'),
        'tint-strong': translucent('active', '--bg-offset-rgb'),
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
