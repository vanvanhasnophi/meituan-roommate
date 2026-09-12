/**
 * 本地颜色审计：把构建产物里**每一条**带颜色的 CSS 声明都过一遍，
 * 只允许出现 var(...) / transparent / inherit / currentColor。
 *
 * 用法：npm run build && node test/colors.test.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist/assets';
const files = readdirSync(DIST).filter((f) => f.endsWith('.css'));

let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

console.log(`\n[扫描 ${files.length} 个 CSS 文件]`);

const ALLOWED = /^(var\(|transparent$|inherit$|currentColor$|color-mix\(|none$|#0000$|#00000000$)/;

/** 抓出所有「颜色属性: 值」声明 */
const COLOR_PROPS = [
  'color',
  'background-color',
  'background-image',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'fill',
  'stroke',
  'box-shadow',
  'caret-color',
  'accent-color',
];

let total = 0;
const offenders = [];

for (const file of files) {
  const css = readFileSync(join(DIST, file), 'utf8');
  // 逐条规则解析，便于定位是哪个类
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css))) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    for (const decl of m[2].split(';')) {
      const idx = decl.indexOf(':');
      if (idx < 0) continue;
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      if (!COLOR_PROPS.includes(prop)) continue;
      if (!value) continue;
      total += 1;
      // box-shadow / background-image 里可能含颜色，也可能只是 none
      const colorsInValue =
        prop === 'box-shadow' || prop === 'background-image'
          ? value.match(/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/g) ?? []
          : [value];
      for (const c of colorsInValue) {
        const v = c.trim();
        // var() 包在 rgb() 里的写法：rgb(var(--x) / ...) 视为合规
        if (/var\(/.test(v)) continue;
        if (ALLOWED.test(v)) continue;
        offenders.push(`${selector}  { ${prop}: ${v} }`);
      }
    }
  }
}

console.log(`  共检查 ${total} 条带颜色的声明`);
check('构建产物中不存在硬编码颜色', offenders.length === 0, `\n      ${offenders.slice(0, 12).join('\n      ')}`);

/* ── 逐个令牌确认深浅两套都在 ── */
console.log('\n[令牌完整性]');
const all = files.map((f) => readFileSync(join(DIST, f), 'utf8')).join('\n');
const need = ['--ink-rgb', '--ink-soft-rgb', '--ink-mute-rgb', '--brand-50-rgb', '--brand-600-rgb', '--pos-600-rgb', '--warn-700-rgb', '--danger-500-rgb'];
for (const t of need) {
  const hits = (all.match(new RegExp(`${t}:`, 'g')) ?? []).length;
  check(`${t} 存在（深/浅各一份）`, hits >= 2, `出现 ${hits} 次`);
}

const lightBlock = all.match(/:root\[data-theme=(?:"light"|light)\]/g) ?? [];
check('存在浅色主题覆盖块', lightBlock.length >= 1, String(lightBlock.length));

/* ── Tailwind 配置里不留死常量 ── */
console.log('\n[Tailwind 配置卫生]');
const config = readFileSync('tailwind.config.js', 'utf8');
const declared = [...config.matchAll(/^const\s+([A-Za-z_$][\w$]*)\s*=/gm)].map((m) => m[1]);
const dead = declared.filter((name) => {
  const uses = (config.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length;
  return uses <= 1; // 只出现在声明处
});
check(
  `配置里没有「声明了却没用」的常量（共 ${declared.length} 个）`,
  dead.length === 0,
  dead.join(', '),
);

/* 悬浮透明度是写死在标记里的（Tailwind 需要字面类名），用断言钉住。
   类名里的 /25 表示 25%，对应 CSS 里的 alpha = .25 */
const hoverTintClasses = [...all.matchAll(/hover\\:bg-[a-z-]+-tint\\\/([0-9.]+)/g)].map(
  (m) => Number(m[1]) / 100,
);
check(
  `hover 透明度统一为 0.25（发现 ${hoverTintClasses.length} 条规则）`,
  hoverTintClasses.length > 0 && hoverTintClasses.every((v) => Math.abs(v - 0.25) < 1e-6),
  [...new Set(hoverTintClasses)].join(', '),
);

/* ── 每个被引用的令牌都必须在深/浅两套里都有定义 ── */
console.log('\n[令牌齐备性（穷举）]');

const referenced = new Set();
for (const m of all.matchAll(/var\((--[a-z0-9-]+)/g)) referenced.add(m[1].replace(/^--/, ''));

const grabBlock = (selectorRe) => {
  const m = all.match(selectorRe);
  if (!m) return null;
  const start = m.index + m[0].length;
  const end = all.indexOf('}', start);
  return new Set([...all.slice(start, end).matchAll(/--([a-z0-9-]+)\s*:/g)].map((x) => x[1]));
};
const darkTokens = grabBlock(/:root\s*\{/);
const lightTokens = grabBlock(/:root\[data-theme=(?:"light"|light)\]\s*\{/);

check('解析出深色令牌块', Boolean(darkTokens && darkTokens.size > 0), String(darkTokens?.size));
check('解析出浅色令牌块', Boolean(lightTokens && lightTokens.size > 0), String(lightTokens?.size));

if (darkTokens && lightTokens) {
  /** 两套共有的常量类令牌，不需要翻转 */
  const THEME_CONSTANT = new Set([
    'glass-alpha',
    'blur-alpha',
    'accent-vivid',
    'color-scheme',
    'app-wash',
    'glass-inner',
    'shadow-1',
    'shadow-2',
    'shadow-3',
    'canvas-rgb',
  ]);

  const missingDark = [];
  const missingLight = [];
  for (const name of referenced) {
    if (THEME_CONSTANT.has(name)) continue;
    if (!darkTokens.has(name) && !lightTokens.has(name)) continue; // 两套都没有：不是主题令牌
    if (!darkTokens.has(name)) missingDark.push(name);
    if (!lightTokens.has(name)) missingLight.push(name);
  }

  check(
    `没有「只在浅色定义」的令牌（深色缺失 ${missingDark.length} 个）`,
    missingDark.length === 0,
    missingDark.map((n) => `--${n}`).join(', '),
  );
  check(
    `没有「只在深色定义」的令牌（浅色缺失 ${missingLight.length} 个）`,
    missingLight.length === 0,
    missingLight.map((n) => `--${n}`).join(', '),
  );

  const scaleShades = (tokens) =>
    new Set(
      [...tokens].filter((n) => /^(brand|pos|warn|danger)-\d+-rgb$/.test(n)).map((n) => n.replace('-rgb', '')),
    );
  const dScale = scaleShades(darkTokens);
  const lScale = scaleShades(lightTokens);
  const onlyLight = [...lScale].filter((n) => !dScale.has(n));
  const onlyDark = [...dScale].filter((n) => !lScale.has(n));
  check(
    `色阶档位两套一致（共 ${dScale.size} 档）`,
    onlyLight.length === 0 && onlyDark.length === 0,
    `仅浅色: ${onlyLight.join(', ') || '无'} | 仅深色: ${onlyDark.join(', ') || '无'}`,
  );
}

console.log(failed === 0 ? '\n✅ 颜色审计通过：全站颜色均走变量\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
