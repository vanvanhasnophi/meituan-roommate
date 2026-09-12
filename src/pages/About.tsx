import {
  ArrowRight,
  Boxes,
  Bug,
  Database,
  GitBranch,
  Layers,
  Lightbulb,
  Link2,
  ListChecks,
  Rocket,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';

import { Card, Chip, SectionHeader, cn } from '../components/ui';
import { useStore } from '../store/useStore';

type Route = 'dashboard' | 'expenses' | 'chores' | 'supplies' | 'pacts' | 'about';

const PAIN_POINTS = [
  {
    pain: '水电账单来了，谁该出多少算不清，最后总有人「差不多得了」',
    answer: '分摊引擎',
    detail:
      '支持均分 / 按份数 / 自定义金额三种模式；金额按「分」做整数运算，保证每人金额之和恰好等于总额，不会出现差一分钱的糊涂账。',
    color: '#D4613A',
  },
  {
    pain: '你欠我、我欠他，一串多角债，转账要转好几轮',
    answer: '最优结算',
    detail:
      '自动计算每人净额，用「最大债权 ↔ 最大债务」贪心配对，把 n 个人的多角债压缩成最多 n−1 笔转账，一键标记已转。',
    color: '#D99423',
  },
  {
    pain: '值日表贴在冰箱上，第三天就没人看了',
    answer: '规则化排班',
    detail:
      '不手排日历：只维护「轮值规则 + 锚点」，日历自动生成并可无限延伸。打卡、换班、跳过作为「变更记录」单独存储，规则与事实分离。',
    color: '#2E8C81',
  },
  {
    pain: '「打扫干净」各人理解不一致，做完还是被嫌弃',
    answer: '可验收标准',
    detail:
      '每个区域写死完成标准，例如厨房＝台面无油渍、水槽无残渣、灶台擦净、垃圾清空。把形容词变成清单，验收不再靠嗓门。',
    color: '#7C6BB0',
  },
  {
    pain: '卷纸用完了没人管，临时抓瞎；买了也不好意思要钱',
    answer: '库存 + 自动 AA',
    detail:
      '登记库存与消耗，低于阈值即提醒，还会按近 30 天消耗速率预估「还能用几天」；补货时填入金额，自动生成一笔 AA 账单并关联来源。',
    color: '#4E8AB8',
  },
  {
    pain: '口头约定说变就变，翻旧账时谁也说不清',
    answer: '公约版本化',
    detail:
      '提案 → 全员表决 → 生效 → 修订留痕，每一次内容变化都保留历史版本、修改人与修改原因；违约记录公开但不打分，用于复盘。',
    color: '#C9483C',
  },
];

const MODULES = [
  {
    name: '概览',
    icon: Target,
    lines: ['今日待办聚合，把提醒变成可点击的下一步', '本月支出 / 我的应收应付 / 值日完成率 / 待补货', '小屋动态时间线，所有操作留痕'],
  },
  {
    name: '账单与 AA',
    icon: Layers,
    lines: ['三种分摊模式 + 实时预览', '最优结算方案，最少转账笔数', '周期账单标记、账期切换、支出结构分析'],
  },
  {
    name: '值日排班',
    icon: ListChecks,
    lines: ['周视图日历，点击即可打卡/换班', '换班需对方确认，跳过需留原因', '值日积分榜，轻激励不施压'],
  },
  {
    name: '公共物品',
    icon: Boxes,
    lines: ['库存 / 阈值 / 满配可视化', '消耗速率预估剩余天数、耗材更换周期提醒', '补货自动生成 AA 账单（模块联动）'],
  },
  {
    name: '室友公约',
    icon: ShieldCheck,
    lines: ['提案、表决、生效、修订全流程', '版本历史 + 修订原因可追溯', '违约记录轻量留痕'],
  },
];

const DECISIONS = [
  {
    title: '「事实」与「派生」分离',
    body: '账单、打卡、消耗记录是事实，余额、结算方案、排班日历都是派生结果，一律实时计算、不落库。这样永远不会出现「缓存和实际不一致」的经典 bug。',
  },
  {
    title: '排班不逐条落库',
    body: '5 个区域 × 一年 365 天会产生上千条排班记录。本方案只存轮值规则和少量变更记录，日历按需展开，数据量小且规则调整后立即全局生效。',
  },
  {
    title: '金额一律用「分」',
    body: '浮点数算钱必然出现 0.1+0.2 的误差。所有金额先转成整数分，余数分配给最后一位参与人，保证「每人金额之和 = 账单总额」。',
  },
  {
    title: '模块之间必须联动',
    body: '补货 → 自动记账，打卡 → 影响积分榜与概览待办，违约 → 关联到具体公约。孤立的功能只是电子表格，联动才叫「管家」。',
  },
  {
    title: '降低记录成本',
    body: '所有高频操作控制在两步内：消耗一键 -1、打卡一键完成、结算一键标记。合租工具最大的敌人不是功能少，而是没人愿意填表。',
  },
  {
    title: '冲突前置而非事后追责',
    body: '把「做到什么程度算完成」「谁参与分摊」在事前写清楚，并在公约里版本化。产品不评判对错，只负责让事实清晰。',
  },
];

export default function About({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const driver = useStore((s) => s.driver);

  return (
    <div className="space-y-6">
      <section className="animate-fade-up">
        <Chip className="bg-brand-50 text-brand-700">
          <Lightbulb size={12} /> 产品设计说明
        </Chip>
        <h2 className="mt-3 text-[26px] font-semibold tracking-tight sm:text-[32px]">
          同屋 · 合租生活管家
        </h2>
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-soft">
          合租的矛盾大多不来自「人不好」，而来自
          <span className="font-medium text-ink">信息不对称</span>：
          谁垫了钱、谁该值日、卷纸还剩几卷、约定到底是怎么说的。
          同屋要做的，是把这些模糊地带变成清晰、可查、可追溯的事实 ——
          让分摊不用开口催，让值日不用靠自觉，让公约不靠记性。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip className="bg-black/[0.04] text-ink-mute">费用 AA 分摊</Chip>
          <Chip className="bg-black/[0.04] text-ink-mute">清洁值日排班</Chip>
          <Chip className="bg-black/[0.04] text-ink-mute">公共物品登记与提醒</Chip>
          <Chip className="bg-black/[0.04] text-ink-mute">室友公约管理</Chip>
        </div>
      </section>

      {/* 痛点 → 对策 */}
      <section>
        <SectionHeader
          title="从痛点出发，而不是从功能出发"
          subtitle="每条设计都对应一个真实会吵架的场景"
          icon={<Bug size={17} />}
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {PAIN_POINTS.map((p) => (
            <Card key={p.pain} className="card-pad">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold"
                  style={{ backgroundColor: `${p.color}14`, color: p.color }}
                >
                  ?
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] leading-relaxed text-ink-soft">{p.pain}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <ArrowRight size={13} style={{ color: p.color }} />
                    <span className="text-[13.5px] font-semibold" style={{ color: p.color }}>
                      {p.answer}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">{p.detail}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 功能结构 */}
      <section>
        <SectionHeader
          title="功能结构"
          subtitle="一个概览 + 四个核心模块，模块之间互相咬合"
          icon={<Layers size={17} />}
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Card key={m.name} className="card-pad">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon size={17} />
                  </span>
                  <h3 className="text-[15px] font-semibold tracking-tight">{m.name}</h3>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {m.lines.map((l) => (
                    <li key={l} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-mute">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-300" />
                      {l}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}

          <Card className="card-pad border-accent-300/60 bg-accent-50/50">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-accent-600">
                <Link2 size={17} />
              </span>
              <h3 className="text-[15px] font-semibold tracking-tight">模块联动</h3>
            </div>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-accent-700">
              <li>🧻 物品补货 → 💰 自动生成 AA 账单 → 📊 计入我的应收应付</li>
              <li>🧽 值日打卡 → 🏆 更新积分榜 → 📌 概览待办实时变化</li>
              <li>📜 公约违约 → 关联到具体条款，形成可复盘的记录</li>
              <li>🔔 所有动作 → 写入小屋动态，账目与责任有据可查</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* 关键设计决策 */}
      <section>
        <SectionHeader
          title="关键设计决策"
          subtitle="这些取舍决定了它好不好用"
          icon={<Lightbulb size={17} />}
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {DECISIONS.map((d, i) => (
            <Card key={d.title} className="card-pad">
              <div className="flex items-start gap-3">
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-[12.5px] font-semibold text-ink-mute">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[14px] font-semibold tracking-tight">{d.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">{d.body}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 技术架构 */}
      <section>
        <SectionHeader
          title="技术架构"
          subtitle="MVP 的取舍：先保证公开链接打开即用，再逐步接上持久化"
          icon={<Database size={17} />}
        />
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="card-pad">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Layers size={16} />
              </span>
              <h3 className="text-[14px] font-semibold">前端</h3>
            </div>
            <ul className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-ink-mute">
              <li>React 18 + TypeScript + Vite + Tailwind</li>
              <li>Zustand 单 store，领域逻辑抽到 shared/ 纯函数</li>
              <li>hash 路由，站点挂载在 /room-mate 下可深链分享</li>
              <li>移动端优先，桌面端双栏；响应式适配</li>
            </ul>
          </Card>
          <Card className="card-pad">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                <GitBranch size={16} />
              </span>
              <h3 className="text-[14px] font-semibold">服务端</h3>
            </div>
            <ul className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-ink-mute">
              <li>Vercel Serverless Function：/api/household</li>
              <li>GET 拉取小屋状态，PUT 整体保存（含字段校验与体积保护）</li>
              <li>以「小屋码」为聚合根，支持多屋隔离</li>
              <li>未部署数据库时自动降级，接口永不报错阻塞演示</li>
            </ul>
          </Card>
          <Card className="card-pad">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-warn-50 text-warn-700">
                <Database size={16} />
              </span>
              <h3 className="text-[14px] font-semibold">存储（可插拔）</h3>
            </div>
            <ul className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-ink-mute">
              <li>
                配置 <code className="rounded bg-black/[0.05] px-1">TURSO_DATABASE_URL</code> → 托管 SQLite，
                线上持久化
              </li>
              <li>本地开发 → 单文件 SQLite（libSQL file: 协议）</li>
              <li>未配置 → 内存 + 浏览器 localStorage 镜像，公开链接零配置可用</li>
              <li>前端采用「本地先写 + 节流推送」，弱网也不会卡住操作</li>
            </ul>
            <div className="mt-3 flex items-center gap-1.5">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  driver === 'libsql' ? 'bg-accent-500' : driver === 'memory' ? 'bg-warn-500' : 'bg-ink-mute',
                )}
              />
              <span className="text-[11.5px] text-ink-mute">
                当前：{driver === 'libsql' ? 'SQLite 已连接' : driver === 'memory' ? '内存模式（可配置数据库）' : '纯本地模式'}
              </span>
            </div>
          </Card>
        </div>
      </section>

      {/* 路线图 */}
      <section>
        <SectionHeader title="迭代路线" subtitle="MVP 之后最有价值的几件事" icon={<Rocket size={17} />} />
        <Card className="card-pad">
          <ol className="space-y-3">
            {[
              { q: '共享与协作', a: '室友通过链接/小屋码加入、操作级权限、实时同步（当前为整屋快照保存，下一步拆成细粒度接口）。' },
              { q: '账单智能化', a: '拍照 OCR 识别水电账单、按实际居住天数自动折算、支持按房间面积分摊房租。' },
              { q: '提醒触达', a: '接入微信/飞书机器人或 Web Push：值日前一天提醒、结算日提醒、低库存提醒。' },
              { q: '信任与激励', a: '值日信用分、履约记录可视化；公共支出趋势与预算提醒。' },
              { q: '多屋与租期', a: '一人多屋、租期起止自动处理中途搬入搬出的费用折算与排班顺延。' },
            ].map((item, i) => (
              <li key={item.q} className="flex items-start gap-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[12px] font-semibold text-brand-600">
                  P{i}
                </span>
                <div>
                  <p className="text-[13.5px] font-medium">{item.q}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-mute">{item.a}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {/* 体验引导 */}
      <section>
        <SectionHeader title="3 分钟体验路径" subtitle="按这个顺序点一遍，能看清全部设计" icon={<Users size={17} />} />
        <Card className="card-pad">
          <ol className="space-y-2.5">
            {[
              { r: 'dashboard' as Route, t: '概览', d: '右上角切换身份，看不同室友视角下「待办」如何变化' },
              { r: 'expenses' as Route, t: '账单分摊', d: '点「记一笔」，试着切换均分/按份数/自定义，观察分摊实时预览与最优结算' },
              { r: 'chores' as Route, t: '值日排班', d: '点日历任意一格：打卡、跳过、向室友发起换班（需对方同意）' },
              { r: 'supplies' as Route, t: '公共物品', d: '对「厨房纸」补货并填入金额，回到账单页看自动生成的 AA 账单' },
              { r: 'pacts' as Route, t: '室友公约', d: '给待表决的公约投票，切三个身份投满是同意，看它自动生效' },
            ].map((s, i) => (
              <li key={s.t} className="flex items-start gap-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-[12px] font-semibold text-ink-mute">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => onNavigate(s.r)}
                    className="text-[13.5px] font-medium text-brand-600 underline decoration-brand-200 underline-offset-2"
                  >
                    {s.t}
                  </button>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-mute">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-[12.5px] leading-relaxed text-brand-700">
            演示数据是一间真实的四人合租小屋（望江府 1802），你可以随意修改；侧栏底部可随时「重置演示数据」。
          </p>
        </Card>
      </section>
    </div>
  );
}
