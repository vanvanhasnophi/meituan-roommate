import type { VercelRequest, VercelResponse } from '@vercel/node';

import { createSeedState } from '../shared/seed';
import type { HouseholdState } from '../shared/types';
import { driverName, ensureHousehold, listHouseholds, writeHousehold } from './_lib/store';

export const DEFAULT_CODE = 'ROOM-5283';

const MAX_PAYLOAD = 1_500_000; // 约 1.5MB，足够 MVP 使用

const REQUIRED_ARRAYS = [
  'members',
  'expenses',
  'settlements',
  'choreTasks',
  'supplies',
  'supplyLogs',
  'pacts',
  'activity',
] as const;

function normalizeCode(value: unknown): string {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_CODE;
  return raw.slice(0, 40).toUpperCase();
}

function validateState(input: unknown): { ok: true; state: HouseholdState } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'state 必须是对象' };
  const s = input as Partial<HouseholdState>;
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(s[key])) return { ok: false, error: `state.${key} 必须是数组` };
  }
  if (!s.code || typeof s.code !== 'string') return { ok: false, error: 'state.code 缺失' };
  if (!s.members || s.members.length === 0) return { ok: false, error: '至少需要一位室友' };
  return { ok: true, state: s as HouseholdState };
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const code = normalizeCode(req.query.code);
      if (!req.query.code && req.query.list === '1') {
        res.status(200).json({ ok: true, households: await listHouseholds() });
        return;
      }
      const { state, driver } = await ensureHousehold(code);
      res.status(200).json({
        ok: true,
        state,
        storage: driver,
        source: driver === 'libsql' ? 'db' : 'memory',
        /** 未配置数据库时给前端的提示 */
        hint:
          driver === 'memory'
            ? '当前未配置数据库（TURSO_DATABASE_URL），数据保存在前端本地并随实例销毁；配置后即为持久化 SQLite。'
            : undefined,
      });
      return;
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = parseBody(req);

      if (req.method === 'POST' && (body.action === 'reset' || body.action === 'seed')) {
        const code = normalizeCode(body.code ?? req.query.code);
        const fresh = createSeedState();
        fresh.code = code;
        const { driver } = await writeHousehold(fresh);
        res
          .status(200)
          .json({ ok: true, state: fresh, storage: driver, source: driver === 'libsql' ? 'db' : 'memory' });
        return;
      }

      const serialized = JSON.stringify(body.state ?? null);
      if (serialized.length > MAX_PAYLOAD) {
        res.status(413).json({ ok: false, error: '数据过大' });
        return;
      }
      const checked = validateState(body.state);
      if (!checked.ok) {
        res.status(400).json({ ok: false, error: checked.error });
        return;
      }
      const state = checked.state;
      state.code = normalizeCode(body.code ?? state.code);
      const { driver, updatedAt } = await writeHousehold(state);
      res.status(200).json({ ok: true, updatedAt, storage: driver, source: driver === 'libsql' ? 'db' : 'memory' });
      return;
    }

    if (req.method === 'DELETE') {
      res.status(405).json({ ok: false, error: 'MVP 暂不开放删除小屋' });
      return;
    }

    res.status(405).json({ ok: false, error: `不支持的方法 ${req.method}` });
  } catch (err) {
    console.error('[api/household]', err);
    const driver = await driverName().catch(() => 'memory' as const);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : '服务端错误',
      storage: driver,
    });
  }
}
