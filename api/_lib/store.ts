/**
 * 存储适配层：同一套接口，两种驱动。
 *
 *  1) libSQL / SQLite（推荐）
 *     - 本地开发：DATABASE_URL=file:./.data/roommate.db  → 真正的单文件 SQLite
 *     - 线上部署：TURSO_DATABASE_URL=libsql://xxx.turso.io → 托管 SQLite（HTTP 协议）
 *     为什么线上不能直接用 .db 文件：Vercel Serverless 的运行目录只读，
 *     仅 /tmp 可写且随实例销毁，文件型数据库无法持久化。
 *
 *  2) 内存降级：未配置数据库时自动启用，配合前端的 localStorage 镜像，
 *     保证「刚部署完、还没配库」的公开链接也能完整演示。
 */

import { createSeedState } from '../../shared/seed';
import type { HouseholdState } from '../../shared/types';

const TABLE = 'households';

type Row = { code: string; payload: string; updated_at: string };

let memoryStore = new Map<string, HouseholdState>();
let clientPromise: Promise<LibsqlLike | null> | null = null;
let schemaReady = false;

interface LibsqlLike {
  execute: (arg: { sql: string; args?: unknown[] }) => Promise<{ rows: unknown[] }>;
}

export type StorageDriver = 'libsql' | 'memory';

function resolveDbUrl(): { url: string; authToken?: string } | null {
  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    process.env.DATABASE_URL ||
    process.env.SQLITE_URL ||
    '';
  if (!url) return null;
  // 只接受 SQLite 系协议的 URL，避免误把 Postgres 连接串喂给 libSQL
  if (!/^(libsql:|https?:|file:|wss?:)/.test(url)) return null;
  return { url, authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN };
}

async function getClient(): Promise<LibsqlLike | null> {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    const target = resolveDbUrl();
    if (!target) return null;
    try {
      const mod = (await import('@libsql/client')) as unknown as {
        createClient: (cfg: { url: string; authToken?: string }) => LibsqlLike;
      };
      const client = mod.createClient({ url: target.url, authToken: target.authToken });
      await ensureSchema(client);
      return client;
    } catch (err) {
      console.error('[store] libSQL 初始化失败，降级为内存存储：', err);
      return null;
    }
  })();
  return clientPromise;
}

async function ensureSchema(client: LibsqlLike): Promise<void> {
  if (schemaReady) return;
  await client.execute({
    sql: `CREATE TABLE IF NOT EXISTS ${TABLE} (
      code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  });
  schemaReady = true;
}

export async function driverName(): Promise<StorageDriver> {
  const client = await getClient();
  return client ? 'libsql' : 'memory';
}

export async function readHousehold(code: string): Promise<{ state: HouseholdState | null; driver: StorageDriver }> {
  const client = await getClient();
  if (!client) {
    return { state: memoryStore.get(code) ?? null, driver: 'memory' };
  }
  const res = await client.execute({
    sql: `SELECT code, payload, updated_at FROM ${TABLE} WHERE code = ? LIMIT 1`,
    args: [code],
  });
  const row = res.rows[0] as Row | undefined;
  if (!row) return { state: null, driver: 'libsql' };
  try {
    return { state: JSON.parse(row.payload) as HouseholdState, driver: 'libsql' };
  } catch {
    return { state: null, driver: 'libsql' };
  }
}

export async function writeHousehold(
  state: HouseholdState,
): Promise<{ driver: StorageDriver; updatedAt: string }> {
  const client = await getClient();
  const updatedAt = new Date().toISOString();
  const next: HouseholdState = { ...state, updatedAt };
  if (!client) {
    memoryStore.set(next.code, next);
    return { driver: 'memory', updatedAt };
  }
  await client.execute({
    sql: `INSERT INTO ${TABLE} (code, payload, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(code) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    args: [next.code, JSON.stringify(next), updatedAt],
  });
  return { driver: 'libsql', updatedAt };
}

/** 首次访问自动铺一份演示数据，保证公开链接打开就有内容 */
export async function ensureHousehold(code: string): Promise<{ state: HouseholdState; driver: StorageDriver }> {
  const existing = await readHousehold(code);
  if (existing.state) return { state: existing.state, driver: existing.driver };
  const seeded = createSeedState();
  seeded.code = code;
  const { driver } = await writeHousehold(seeded);
  return { state: seeded, driver };
}

export async function listHouseholds(): Promise<{ code: string; updatedAt: string }[]> {
  const client = await getClient();
  if (!client) {
    return [...memoryStore.values()].map((s) => ({ code: s.code, updatedAt: s.updatedAt }));
  }
  const res = await client.execute({
    sql: `SELECT code, updated_at FROM ${TABLE} ORDER BY updated_at DESC LIMIT 50`,
  });
  return (res.rows as Row[]).map((r) => ({ code: r.code, updatedAt: r.updated_at }));
}

/** 仅在测试/本地重置时使用 */
export function __resetMemory(): void {
  memoryStore = new Map();
}
