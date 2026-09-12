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

console.log(failed === 0 ? '\n✅ 颜色审计通过：全站颜色均走变量\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
