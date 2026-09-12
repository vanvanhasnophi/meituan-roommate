/**
 * API 契约测试：直接调用 Serverless handler（mock req/res），
 * 并验证 libSQL/SQLite 落盘后「换一个进程也能读到」。
 */
import handler from '../api/household.ts';
import { createSeedState } from '../shared/seed.ts';

let failed = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

const call = async (method, options = {}) => {
  const res = mockRes();
  await handler({ method, query: options.query ?? {}, body: options.body }, res);
  return res;
};

const mode = process.argv[2] ?? 'memory';
const CODE = 'TEST-0001';

console.log(`\n[API 契约测试 · ${mode}]`);

if (mode === 'memory') {
  const get1 = await call('GET', { query: { code: CODE } });
  check('GET 首次访问自动铺演示数据', get1.statusCode === 200 && get1.body.ok === true, JSON.stringify(get1.body).slice(0, 120));
  check('返回 storage 字段', get1.body.storage === 'memory', get1.body.storage);
  check('返回的 state 含 4 位室友', get1.body.state.members.length === 4);
  check('未配置数据库时给出 hint', typeof get1.body.hint === 'string');

  const modified = get1.body.state;
  modified.name = '测试小屋改名';
  modified.expenses.push({
    id: 'e_test', title: '测试账单', amount: 30, category: 'other', paidBy: 'm1',
    date: '2025-06-15', splitMode: 'even',
    participants: [{ memberId: 'm1', weight: 1 }, { memberId: 'm2', weight: 1 }], createdAt: '',
  });

  const put = await call('PUT', { body: { code: CODE, state: modified } });
  check('PUT 保存成功', put.statusCode === 200 && put.body.ok === true, JSON.stringify(put.body));
  check('PUT 返回服务端时间戳', typeof put.body.updatedAt === 'string');

  const get2 = await call('GET', { query: { code: CODE } });
  check('再次 GET 读到修改后的名称', get2.body.state.name === '测试小屋改名', get2.body.state.name);
  check('再次 GET 读到新增账单', get2.body.state.expenses.some((e) => e.id === 'e_test'));

  const bad = await call('PUT', { body: { code: CODE, state: { code: CODE, members: 'nope' } } });
  check('非法 state 被拒绝（400）', bad.statusCode === 400 && bad.body.ok === false, JSON.stringify(bad.body));

  const empty = await call('PUT', { body: { code: CODE, state: { ...get1.body.state, members: [] } } });
  check('空成员列表被拒绝（400）', empty.statusCode === 400, JSON.stringify(empty.body));

  const huge = await call('PUT', { body: { code: CODE, state: { ...get1.body.state, activity: [{ id: 'x', kind: 'system', text: 'x'.repeat(1_600_000), at: '' }] } } });
  check('超大载荷被拒绝（413）', huge.statusCode === 413, String(huge.statusCode));

  const del = await call('DELETE');
  check('DELETE 返回 405', del.statusCode === 405);

  const options = await call('OPTIONS');
  check('OPTIONS 预检返回 204', options.statusCode === 204);

  const other = await call('GET', { query: { code: 'OTHER-999' } });
  check('不同小屋码互相隔离', other.body.state.name !== '测试小屋改名', other.body.state.name);
}

if (mode === 'sqlite') {
  if (process.argv[3] === 'write') {
    const seed = createSeedState('2025-06-15');
    seed.name = '落盘验证小屋';
    seed.expenses.push({
      id: 'e_persist', title: '持久化账单', amount: 88.88, category: 'utility', paidBy: 'm2',
      date: '2025-06-15', splitMode: 'even',
      participants: [{ memberId: 'm1', weight: 1 }, { memberId: 'm2', weight: 1 }], createdAt: '',
    });
    const put = await call('PUT', { body: { code: CODE, state: seed } });
    check('写入 SQLite 成功', put.statusCode === 200, JSON.stringify(put.body));
    check('storage 报告为 libsql', put.body.storage === 'libsql', put.body.storage);
  } else {
    const get = await call('GET', { query: { code: CODE } });
    check('新进程读取到 SQLite 数据', get.statusCode === 200 && Boolean(get.body.state), JSON.stringify(get.body).slice(0, 100));
    check('storage 报告为 libsql', get.body.storage === 'libsql', get.body.storage);
    check('读取到上个进程写入的名称', get.body.state?.name === '落盘验证小屋', get.body.state?.name);
    check('读取到上个进程写入的账单', get.body.state?.expenses?.some((e) => e.id === 'e_persist'));
  }
}

console.log(failed === 0 ? '\n✅ API 测试通过\n' : `\n❌ ${failed} 项失败\n`);
process.exit(failed === 0 ? 0 : 1);
