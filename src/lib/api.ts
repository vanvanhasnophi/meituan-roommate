import type { HouseholdState } from '../../shared/types';

export const DEFAULT_CODE = 'ROOM-5283';

export type StorageDriver = 'libsql' | 'memory' | 'local';

export interface FetchResult {
  state: HouseholdState | null;
  driver: StorageDriver;
  hint?: string;
  /** API 不可用（例如纯静态托管），前端应完全降级到本地模式 */
  offline: boolean;
}

const TIMEOUT = 8000;

async function request(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await fetch(path, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 读取小屋状态。
 * 任何异常（404 / 超时 / 非 JSON / 纯静态托管）都视为 offline，
 * 保证「公开链接」在极端情况下依然是一个可用的本地应用。
 */
export async function fetchHousehold(code = DEFAULT_CODE): Promise<FetchResult> {
  try {
    const res = await request(`/api/household?code=${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { state: null, driver: 'local', offline: true };
    const data = (await res.json()) as {
      ok?: boolean;
      state?: HouseholdState | null;
      storage?: StorageDriver;
      hint?: string;
    };
    if (!data?.ok) return { state: null, driver: 'local', offline: true };
    return {
      state: data.state ?? null,
      driver: (data.storage as StorageDriver) ?? 'memory',
      hint: data.hint,
      offline: false,
    };
  } catch {
    return { state: null, driver: 'local', offline: true };
  }
}

export async function pushHousehold(state: HouseholdState): Promise<{ ok: boolean; driver: StorageDriver }> {
  try {
    const res = await request('/api/household', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: state.code, state }),
    });
    if (!res.ok) return { ok: false, driver: 'local' };
    const data = (await res.json()) as { ok?: boolean; storage?: StorageDriver };
    return { ok: Boolean(data?.ok), driver: (data?.storage as StorageDriver) ?? 'memory' };
  } catch {
    return { ok: false, driver: 'local' };
  }
}

export async function resetHousehold(code = DEFAULT_CODE): Promise<HouseholdState | null> {
  try {
    const res = await request('/api/household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', code }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; state?: HouseholdState };
    return data?.state ?? null;
  } catch {
    return null;
  }
}
