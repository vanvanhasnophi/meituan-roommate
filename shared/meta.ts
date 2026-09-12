import type { ExpenseCategory, PactCategory, SplitMode, SupplyCategory } from './types';

export const EXPENSE_CATEGORIES: Record<
  ExpenseCategory,
  { label: string; emoji: string; color: string; hint: string }
> = {
  rent: { label: '房租', emoji: '🏠', color: 'var(--cat-rent)', hint: '每月固定，通常按房间面积或均分' },
  utility: { label: '水电燃气', emoji: '💡', color: 'var(--cat-utility)', hint: '按账单周期录入，人均分摊' },
  internet: { label: '宽带网费', emoji: '📶', color: 'var(--cat-internet)', hint: '包年账单建议按月摊销' },
  grocery: { label: '食材日用', emoji: '🛒', color: 'var(--cat-grocery)', hint: '一起买菜、囤零食' },
  supply: { label: '公共物品', emoji: '🧻', color: 'var(--cat-supply)', hint: '由物品补货自动生成' },
  service: { label: '家政维修', emoji: '🧰', color: 'var(--cat-service)', hint: '钟点工、疏通、换锁' },
  other: { label: '其他', emoji: '📦', color: 'var(--cat-other)', hint: '' },
};

export const SPLIT_MODES: Record<SplitMode, { label: string; hint: string }> = {
  even: { label: '均分', hint: '所有参与人均摊，最常用' },
  shares: { label: '按份数', hint: '如两人间 2 份、单人间 1 份' },
  custom: { label: '自定义金额', hint: '逐人填写金额，适合有人不用某项' },
};

export const SUPPLY_CATEGORIES: SupplyCategory[] = ['清洁', '厨房', '日用', '耗材'];

export const PACT_CATEGORIES: PactCategory[] = ['作息', '卫生', '访客', '费用', '宠物', '其他'];

export const PACT_CATEGORY_STYLE: Record<PactCategory, { color: string; emoji: string }> = {
  作息: { color: 'var(--pact-作息)', emoji: '🌙' },
  卫生: { color: 'var(--pact-卫生)', emoji: '🧽' },
  访客: { color: 'var(--pact-访客)', emoji: '🚪' },
  费用: { color: 'var(--pact-费用)', emoji: '💰' },
  宠物: { color: 'var(--pact-宠物)', emoji: '🐾' },
  其他: { color: 'var(--pact-其他)', emoji: '📌' },
};

/** 默认值日标准 —— 把「干净」这种主观词翻译成可验收的标准，是减少矛盾的关键 */
export const CHORE_STANDARDS = [
  { area: '厨房', emoji: '🍳', standard: '台面无油渍、水槽无残渣、灶台擦净、垃圾清空' },
  { area: '卫生间', emoji: '🚿', standard: '马桶内壁洁净、地面无积水头发、镜面无水渍' },
  { area: '客厅', emoji: '🛋️', standard: '地面吸尘拖净、茶几归位、沙发无杂物' },
  { area: '垃圾清运', emoji: '🗑️', standard: '湿垃圾每日清空、垃圾桶套新袋、桶身擦拭' },
  { area: '阳台洗衣区', emoji: '🧺', standard: '洗衣机胶圈擦拭、滤网清理、地面无积水' },
];
