# 同屋 · 合租生活管家

> 合租的矛盾大多不来自「人不好」，而来自**信息不对称**：谁垫了钱、谁该值日、卷纸还剩几卷、约定到底是怎么说的。
> 同屋把这些模糊地带变成清晰、可查、可追溯的事实 —— 让分摊不用开口催，让值日不用靠自觉，让公约不靠记性。

**在线访问：`<你的域名>/room-mate`** ｜ 技术栈：React 18 + TypeScript + Vite + Tailwind ｜ 设计语言：Chronicle 玻璃拟态 · 水绿主题 · 深浅双模式 ｜ 部署：Vercel（静态站点 + Serverless Function + SQLite）

---

## 一、产品设计

### 1. 痛点 → 对策

| 真实场景 | 设计对策 |
| --- | --- |
| 水电账单来了，谁该出多少算不清，最后「差不多得了」 | **分摊引擎**：均分 / 按份数 / 自定义金额三种模式，金额按「分」做整数运算，保证每人金额之和恰好等于总额 |
| 你欠我、我欠他，一串多角债要转好几轮 | **最优结算**：计算每人净额后「最大债权 ↔ 最大债务」贪心配对，把多角债压缩到最多 n−1 笔转账 |
| 值日表贴在冰箱上，第三天就没人看了 | **规则化排班**：不手排日历，只维护「轮值规则 + 锚点」，日历自动生成并可无限延伸 |
| 「打扫干净」各人理解不同，做完还被嫌弃 | **可验收标准**：每个区域写死完成清单（厨房＝台面无油渍、水槽无残渣、灶台擦净、垃圾清空） |
| 卷纸用完了没人管；买了也不好意思要钱 | **库存 + 自动 AA**：低于阈值即提醒，按近 30 天消耗速率预估剩余天数；补货填金额后自动生成 AA 账单 |
| 口头约定说变就变，翻旧账谁也说不清 | **公约版本化**：提案 → 全员表决 → 生效 → 修订留痕，保留历史版本、修改人与修改原因 |

### 2. 功能结构

```
概览（今天该做什么）
├── 待办聚合：把提醒变成可点击的下一步（打卡 / 去补货 / 去表决 / 处理换班）
├── 四个核心指标：本月共同支出 · 我应收应付 · 值日完成率 · 待补货件数
└── 小屋动态时间线

① 费用 AA 分摊   账单录入（三种分摊模式 + 实时预览）· 最优结算方案 · 支出结构 · 每人净额
② 清洁值日排班   周视图日历 · 打卡 / 跳过 / 换班（需对方确认）· 轮值规则 · 值日积分榜
③ 公共物品提醒   库存与阈值可视化 · 消耗速率预估 · 耗材更换周期 · 补货自动生成账单
④ 室友公约       提案 → 表决 → 生效 → 修订 · 版本历史 · 违约记录
⑤ 设计说明       产品设计思路的产品化呈现，评审者可直接在产品内查看
```

### 3. 模块联动（这是「管家」而不是「电子表格」的关键）

```
🧻 物品补货  →  💰 自动生成 AA 账单  →  📊 计入我的应收应付
🧽 值日打卡  →  🏆 更新积分榜        →  📌 概览待办实时变化
📜 公约违约  →  关联到具体条款，形成可复盘的记录
🔔 所有动作  →  写入小屋动态，账目与责任有据可查
```

### 4. 关键设计决策

1. **「事实」与「派生」分离**：账单 / 打卡 / 消耗是事实，余额、结算方案、排班日历一律实时计算、不落库 —— 永远不会出现缓存与实际不一致。
2. **排班不逐条落库**：5 个区域 × 365 天会产生上千条记录。只存轮值规则与少量「变更记录」，日历按需展开，规则一改全局立即生效。
3. **金额一律用「分」**：先转整数分，余数分配给最后一位参与人，杜绝浮点误差引发的 AA 扯皮。
4. **降低记录成本**：高频操作都在两步内 —— 消耗一键 −1、打卡一键完成、结算一键标记。合租工具最大的敌人不是功能少，而是没人愿意填表。
5. **冲突前置而非事后追责**：事前写清「做到什么程度算完成」「谁参与分摊」，产品不评判对错，只负责让事实清晰。

---

## 二、设计语言：Chronicle 玻璃拟态

界面材质与配色取自 [Chronicle Aurora](https://github.com/) 的玻璃设计语言（`docs/demo-design-language.md`），**只替换材质与配色，布局结构保持 MVP 原样**。

### 1. 主题机制：改 3 个值 + 1 个 accent

全站层级色**不手挑**，而是按同一套百分比公式从三个基础令牌混出来，所以换主题只需要改这几项：

```css
--bg-base   页面底色        /* 深色 #121212 / 浅色 #f9f9f9 */
--bg-offset 灰阶偏移量       /* 参与所有混色  #909090 / #aaa   */
--fg-base   最亮前景         /* 文字基准      #f5f5f5 / #111   */
--accent    品牌色           /* 水绿 #7FFFD4                    */

/* 派生示例（照抄 Chronicle 公式） */
--comp-bg:      color-mix(in srgb, var(--bg-offset) 12%, var(--bg-base));
--app-text-sec: color-mix(in srgb, var(--bg-base) 33.5%, var(--fg-base));
--border:       color-mix(in srgb, var(--app-text-sec) 20%, transparent);
```

深色为 Chronicle 原生形态，浅色只是 `:root[data-theme="light"]` 的一层覆盖（并微调 `--blur-alpha` / `--glass-alpha`），公式完全复用。

**文字一律是纯中性灰**（`r = g = b`，不含任何色相），只有品牌色是水绿 —— 文字带色相会削弱可读性、也容易显脏。层级比 Chronicle 默认更紧凑以换取更高对比度：

| 令牌 | 深色 | 浅色 | 对底色对比度（深 / 浅） |
| --- | --- | --- | --- |
| `--ink` | `#e7e7e7` | `#1f1f1f` | 15.2:1 / 15.7:1 |
| `--ink-soft` | `#c3c3c3` | `#494949` | 10.6:1 / 8.6:1 |
| `--ink-mute` | `#acacac` | `#606060` | 8.3:1 / 6.0:1 |

三者都通过 CSS 变量 + `-rgb` 三元组暴露，所以 `text-ink-mute/70` 这类透明度修饰符也能随主题自动翻转。

### 2. 水绿主题与浅色可读性

品牌基色是水绿 `#7FFFD4`（`hsl(160 100% 75%)`）。它在深色底上对比度极高，但在浅色底上只有约 1.2:1，完全不可读。因此：

| 令牌 | 深色 | 浅色 | 用途 |
| --- | --- | --- | --- |
| `--accent-vivid` | `#7fffd4` | `#7fffd4` | 品牌本色，仅用于氛围底/装饰 |
| `--accent` | `#7fffd4` | `#0a7d52` | 文字与图标（浅色下压暗到 **4.5:1**） |
| `--accent-btn` / `--accent-btn-fg` | 水绿底 + 墨绿字 | 深水绿底 + 白字 | 主按钮（13.5:1 / 7.5:1） |

> 深色下主按钮是**水绿底 + 深墨绿字**，而不是白字 —— 白字压在亮水绿上只有约 2:1，会糊。

### 3. 全色系收敛到水绿家族

初版曾保留橘色品牌色与暖色分类色，现已**全部移除**：账单类别、值日区域、公约类别、室友标识的色相全部落在 **132°–205°**（春绿 → 水绿 → 水蓝）区间内，靠色相与明度区分。警示色也从琥珀橘(38°)移到春绿端(140°)，靠图标与文案承担「需要注意」的表达；只有真正的错误态保留绯红(352°)。

每一条文字/数据色都经过 **WCAG AA 对比度求解**：明度不是手写的，而是按目标对比度反解出来的（详见下方「配色生成器」）。

### 4. 玻璃材质

```css
/* 卡片：半透明表面 + 1px 低对比细线 + 顶部内高光 + 轻投影 */
.card { background: var(--glass); border: 1px solid var(--line-blur);
        box-shadow: var(--glass-inner), var(--shadow-1); }

/* 导航 / 侧栏 / 弹层：backdrop-filter blur(16px) */
.glass-blur  { background: var(--glass-blur); backdrop-filter: blur(16px); }
.glass-panel { /* 弹层 */ }
.glass-pop   { /* 下拉浮层 */ }
```

**刻意不用** Chronicle 的两个可选交互修饰符：

- `.glowable` → `--card-glow` 彩色发光
- `.scalable` → `transform: scale(1.02)`

悬停反馈只保留「底色提亮 + 投影升一档」（`.interactive`），交互更安静，也不触发重绘。卡片不使用 `backdrop-filter`（只有导航/弹层用），避免移动端大面积模糊带来的掉帧。

### 5. 深浅双模式

- 首次访问**跟随系统** `prefers-color-scheme`；用户点击顶栏切换按钮后写入 `localStorage`
- `index.html` 内联脚本在首帧前设置 `<html data-theme>`，**无闪白**
- 深色底为**纯色 `#121212`**（`--app-wash: none`），不使用任何渐变；浅色底保留一层极淡水绿氛围，让玻璃有层次可透
- 组件样式几乎不需要 `dark:` 变体 —— 令牌自动翻转

### 6. 配色生成器

```bash
npm run gen:tokens   # → src/tokens.generated.css，并打印全量对比度自检
```

`scripts/gen-palette.mjs` 按公式计算两个模式的全部令牌，对每个色相**反解出满足目标对比度的明度**（深色 7:1 / 浅色 4.6:1），输出前逐条校验 WCAG AA。当前 66 项检查全部通过。

---

## 三、技术架构

```
浏览器（React SPA，挂在 /room-mate 下，hash 路由）
   │  本地先写 localStorage（操作零延迟）→ 600ms 节流推送
   ▼
/api/household        Vercel Serverless Function（GET 拉取 / PUT 保存 / POST 重置）
   ▼
存储适配层 api/_lib/store.ts
   ├─ 配置 TURSO_DATABASE_URL → libSQL（托管 SQLite，HTTP 协议）  ← 线上持久化
   ├─ 本地 DATABASE_URL=file:./.data/roommate.db → 单文件 SQLite
   └─ 未配置 → 内存 + 浏览器 localStorage 镜像（公开链接零配置即可完整演示）
```

**为什么线上不能直接用 `.db` 文件？**
Vercel Serverless 的运行目录**只读**，仅 `/tmp` 可写且随实例销毁、不跨实例共享，文件型数据库无法持久化。
所以线上用 **libSQL / Turso**（SQLite 的托管形态，走 HTTP 协议），本地开发仍用真正的单文件 SQLite，两边是同一套 SQL 与同一份代码。

### 目录结构

```
├── api/
│   ├── household.ts          # Serverless 入口：校验 + 读写
│   └── _lib/store.ts         # 可插拔存储驱动（libSQL / 内存降级）
├── shared/                   # 前后端共用的领域层（纯函数）
│   ├── types.ts              # 领域模型
│   ├── logic.ts              # 分摊、最优结算、排班展开、库存预估、公约进度
│   ├── meta.ts               # 类别元数据、值日标准
│   └── seed.ts               # 相对「今天」动态生成的演示数据
├── src/
│   ├── store/useStore.ts     # Zustand：统一 commit → 本地落盘 → 节流推送
│   ├── pages/                # 概览 / 账单 / 值日 / 物品 / 公约 / 设计说明
│   └── components/ui.tsx     # 设计系统基础组件
├── test/                     # 领域逻辑 / API 契约 / 浏览器端冒烟 / 视觉布局自检
├── scripts/serve-dist.mjs    # 本地复刻 Vercel 路由的生产预览服务器
└── vercel.json               # 路由重写、跳转、缓存头、函数配置
```

### 路由约定（重要）

站点固定挂在 **`<domain>/room-mate`**：

- `vercel.json` 中 `/room-mate` 与 `/room-mate/**` 重写到 `/index.html`，`/` 302 跳转到 `/room-mate`
- 应用内部使用 **hash 路由**（如 `/room-mate#/expenses`），因此任意深链可直接分享、刷新不会 404
- 静态资源使用根绝对路径 `/assets/**`，与挂载路径无关

---

## 三、本地运行

```bash
npm install
npm run dev          # → http://localhost:5173/room-mate
```

`npm run dev` 已内置 Serverless 函数中间件，`/api/household` 与线上跑的是同一份代码，无需 `vercel dev`。

生产预览（复刻 Vercel 的路由行为）：

```bash
npm run build
npm run serve:dist   # → http://localhost:4173/room-mate
```

### 测试

```bash
npm run test:logic    # 领域逻辑：分摊守恒、最优结算、排班轮值、库存提醒
npm run test:api      # API 契约：自动播种、校验、413/400/405、小屋隔离
npm run test:ui       # 浏览器端冒烟（需先启动 npm run serve:dist）
npm run test:visual   # 主题是否生效、有无横向溢出、移动端适配
```

SQLite 持久化验证（跨进程读写同一个库文件）：

```bash
DATABASE_URL=file:./.data/roommate.db npm run test:api                    # 写入
DATABASE_URL=file:./.data/roommate.db node .tmp/api.test.mjs sqlite read   # 新进程读出
```

---

## 四、部署到 Vercel

### 1. 导入仓库

Vercel → **Add New → Project → Import Git Repository** → 选择本仓库。
框架会被识别为 **Vite**，构建命令与输出目录已写在 `vercel.json` 里：

| 配置项 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

`api/household.ts` 会被自动识别为 Serverless Function，无需额外配置。

### 2. 访问地址

部署完成后打开 **`https://<你的域名>/room-mate`**。
访问根路径 `/` 会自动 302 跳到 `/room-mate`（由 `vercel.json` 的 redirect 实现）。

### 3. 接入持久化数据库（可选，但推荐）

未配置数据库时也能完整演示（数据存浏览器本地 + 函数内存），配置后即为真正的持久化 SQLite：

1. 在 [turso.tech](https://turso.tech) 创建数据库（libSQL / SQLite），拿到连接串与 token
2. 在 Vercel 项目 **Settings → Environment Variables** 添加：

   | 变量名 | 说明 |
   | --- | --- |
   | `TURSO_DATABASE_URL` | 形如 `libsql://xxx.turso.io` |
   | `TURSO_AUTH_TOKEN` | 数据库访问令牌 |

3. 重新部署。侧栏底部的存储指示会从「演示模式」变为「SQLite 已连接」，数据即可长期保存。

> 首次访问任意小屋码时，服务端会自动建表并铺一份演示数据，因此刚部署完打开就有完整内容可看。

### 4. 常用接口

```bash
GET  /api/household?code=ROOM-5283     # 拉取小屋状态（不存在则自动播种）
PUT  /api/household                    # 保存整屋状态 { code, state }
POST /api/household {action:"reset"}   # 重置演示数据
```

---

## 五、演示数据说明

内置一间四人合租小屋「望江府 3 幢 1802」，所有日期都**相对今天动态生成**，
因此任何时间打开看到的都是一间正在使用中的屋子：本月账单、过去三周的值日打卡、近期消耗流水、一条待表决的公约。

- 右上角切换身份（林小满 / 陈屿 / 周哲 / 苏念），可以看到不同室友视角下待办与账单的变化
- 侧栏底部可随时「重置演示数据」
- 页面内的「设计说明」模块完整呈现了本文的产品思路，方便直接评审

---

## 六、迭代路线

| 优先级 | 方向 | 说明 |
| --- | --- | --- |
| P0 | 共享与协作 | 室友凭链接/小屋码加入、操作级权限、实时同步（当前为整屋快照保存，下一步拆成细粒度接口 + 乐观并发控制） |
| P1 | 账单智能化 | 水电账单拍照 OCR、按实际居住天数折算、按房间面积分摊房租 |
| P1 | 提醒触达 | 接入微信/飞书机器人或 Web Push：值日前一天、结算日、低库存 |
| P2 | 信任与激励 | 值日信用分与履约记录可视化、公共支出趋势与预算提醒 |
| P2 | 多屋与租期 | 一人多屋、租期自动处理中途搬入搬出的费用折算与排班顺延 |
