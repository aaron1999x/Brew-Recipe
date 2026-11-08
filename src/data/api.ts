import type { BaseEntity, EntityName } from '../types';

const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined)?.trim() || '';
const GAS_TOKEN = (import.meta.env.VITE_GAS_TOKEN as string | undefined)?.trim() || '';

export const backendConfigured = Boolean(GAS_URL);

export interface RemoteSnapshot {
  recipes: BaseEntity[];
  brews: BaseEntity[];
  days: BaseEntity[];
  settings: BaseEntity[];
}

export interface Op {
  opId: string;
  action: 'upsert' | 'delete';
  entity: EntityName;
  data: BaseEntity;
}

const withTimeout = async (input: string, init: RequestInit = {}, ms = 20000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
};

const unwrap = async (res: Response) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json || json.ok !== true) throw new Error(json?.error || 'Backend error');
  return json;
};

export async function fetchAll(): Promise<RemoteSnapshot> {
  const url = `${GAS_URL}?action=list&token=${encodeURIComponent(GAS_TOKEN)}`;
  const json = await unwrap(await withTimeout(url));
  return json.data as RemoteSnapshot;
}

export async function sendOp(op: Op): Promise<void> {
  // text/plain keeps this a "simple request" -> no CORS preflight (Apps Script can't answer OPTIONS).
  const res = await withTimeout(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: op.action, entity: op.entity, data: op.data, token: GAS_TOKEN }),
  });
  await unwrap(res);
}
