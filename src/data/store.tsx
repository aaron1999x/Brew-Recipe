import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BaseEntity, Brew, DB, EntityName, PracticeDay, Recipe, Settings, SyncStatus } from '../types';
import { backendConfigured, fetchAll, sendOp, type Op, type RemoteSnapshot } from './api';
import { DEFAULT_SETTINGS, makeStarterRecipe } from '../lib/defaults';
import { nowIso } from '../lib/time';
import { uid } from '../lib/calc';

const CACHE_KEY = 'brewlab:db:v1';
const QUEUE_KEY = 'brewlab:queue:v1';

/** Internal shape keeps tombstones so deletes propagate. */
interface RawDB {
  recipes: Recipe[];
  brews: Brew[];
  days: PracticeDay[];
  settings: Settings;
}

const safeRead = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const safeWrite = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked */
  }
};

const initialRaw = (): RawDB => {
  const cached = safeRead<RawDB | null>(CACHE_KEY, null);
  if (cached && cached.settings) {
    return { ...cached, settings: { ...DEFAULT_SETTINGS, ...cached.settings } };
  }
  return { recipes: [makeStarterRecipe(nowIso())], brews: [], days: [], settings: DEFAULT_SETTINGS };
};

/** Last-write-wins merge by updatedAt. */
const mergeList = <T extends BaseEntity>(local: T[], remote: BaseEntity[]): T[] => {
  const map = new Map<string, T>();
  for (const l of local) map.set(l.id, l);
  for (const r of remote as T[]) {
    const l = map.get(r.id);
    if (!l || (r.updatedAt || '') >= (l.updatedAt || '')) map.set(r.id, r);
  }
  return Array.from(map.values());
};

const mergeRemote = (raw: RawDB, remote: RemoteSnapshot, pending: Op[]): RawDB => {
  const pendingIds = new Set(pending.map((p) => p.data.id));
  // never let remote clobber something we still have queued
  const filt = (list: BaseEntity[]) => list.filter((r) => !pendingIds.has(r.id));
  const remoteSettings = filt(remote.settings || []).find((s) => s.id === 'settings') as Settings | undefined;
  return {
    recipes: mergeList(raw.recipes, filt(remote.recipes || [])),
    brews: mergeList(raw.brews, filt(remote.brews || [])),
    days: mergeList(raw.days, filt(remote.days || [])),
    settings:
      remoteSettings && remoteSettings.updatedAt >= raw.settings.updatedAt
        ? { ...DEFAULT_SETTINGS, ...remoteSettings }
        : raw.settings,
  };
};

interface StoreApi {
  db: DB;
  status: SyncStatus;
  lastError: string | null;
  pendingCount: number;
  upsert: <K extends Exclude<EntityName, 'settings'>>(entity: K, item: DB[K][number]) => void;
  remove: (entity: Exclude<EntityName, 'settings'>, id: string) => void;
  saveSettings: (patch: Partial<Settings>) => void;
  saveDay: (date: string, patch: Partial<Pick<PracticeDay, 'endOfDayConclusion' | 'nextSessionPlan'>>) => void;
  importData: (data: Partial<DB>) => void;
  syncNow: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<RawDB>(initialRaw);
  const [queue, setQueue] = useState<Op[]>(() => safeRead<Op[]>(QUEUE_KEY, []));
  const [status, setStatus] = useState<SyncStatus>(backendConfigured ? 'syncing' : 'local');
  const [lastError, setLastError] = useState<string | null>(null);
  const flushing = useRef(false);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const rawRef = useRef(raw);
  rawRef.current = raw;

  useEffect(() => safeWrite(CACHE_KEY, raw), [raw]);
  useEffect(() => safeWrite(QUEUE_KEY, queue), [queue]);

  const flush = useCallback(async () => {
    if (!backendConfigured || flushing.current) return;
    flushing.current = true;
    try {
      while (queueRef.current.length) {
        setStatus('syncing');
        const op = queueRef.current[0];
        await sendOp(op);
        const rest = queueRef.current.filter((o) => o.opId !== op.opId);
        queueRef.current = rest;
        setQueue(rest);
      }
      setStatus('saved');
      setLastError(null);
    } catch (e) {
      setStatus('offline');
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      flushing.current = false;
    }
  }, []);

  const pull = useCallback(async () => {
    if (!backendConfigured) return;
    setStatus('syncing');
    try {
      const remote = await fetchAll();
      setRaw((r) => mergeRemote(r, remote, queueRef.current));
      setLastError(null);
      if (queueRef.current.length) await flush();
      else setStatus('saved');
    } catch (e) {
      setStatus('offline');
      setLastError(e instanceof Error ? e.message : String(e));
    }
  }, [flush]);

  // Sync on load, on reconnect, on focus, and retry periodically while offline.
  useEffect(() => {
    if (!backendConfigured) return;
    void pull();
    const onOnline = () => void pull();
    const onVis = () => document.visibilityState === 'visible' && void pull();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => {
      if (queueRef.current.length) void flush();
    }, 15000);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, [pull, flush]);

  const enqueue = useCallback(
    (ops: Omit<Op, 'opId'>[]) => {
      if (!backendConfigured) return;
      // collapse: newer op for same entity/id replaces older queued one
      let next = [...queueRef.current];
      for (const o of ops) {
        next = next.filter((q) => !(q.entity === o.entity && q.data.id === o.data.id));
        next.push({ ...o, opId: uid('op') });
      }
      queueRef.current = next;
      setQueue(next);
      void flush();
    },
    [flush],
  );

  const upsert = useCallback<StoreApi['upsert']>(
    (entity, item) => {
      const stamped = { ...item, updatedAt: nowIso() } as BaseEntity;
      setRaw((r) => {
        const list = r[entity] as BaseEntity[];
        const exists = list.some((x) => x.id === stamped.id);
        return { ...r, [entity]: exists ? list.map((x) => (x.id === stamped.id ? stamped : x)) : [...list, stamped] };
      });
      enqueue([{ action: 'upsert', entity, data: stamped }]);
    },
    [enqueue],
  );

  const remove = useCallback<StoreApi['remove']>(
    (entity, id) => {
      const list = rawRef.current[entity] as BaseEntity[];
      const found = list.find((x) => x.id === id);
      if (!found) return;
      const tomb = { ...found, deleted: true, updatedAt: nowIso() };
      setRaw((r) => ({ ...r, [entity]: (r[entity] as BaseEntity[]).map((x) => (x.id === id ? tomb : x)) }));
      enqueue([{ action: 'delete', entity, data: tomb }]);
    },
    [enqueue],
  );

  const saveSettings = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...rawRef.current.settings, ...patch, id: 'settings', updatedAt: nowIso() };
      setRaw((r) => ({ ...r, settings: next }));
      enqueue([{ action: 'upsert', entity: 'settings', data: next }]);
    },
    [enqueue],
  );

  const saveDay = useCallback<StoreApi['saveDay']>(
    (date, patch) => {
      const existing = rawRef.current.days.find((d) => d.date === date);
      const day: PracticeDay = {
        id: existing?.id ?? `day-${date}`,
        date,
        endOfDayConclusion: existing?.endOfDayConclusion ?? '',
        nextSessionPlan: existing?.nextSessionPlan ?? '',
        ...patch,
        deleted: false,
        updatedAt: nowIso(),
      };
      setRaw((r) => ({ ...r, days: existing ? r.days.map((d) => (d.id === day.id ? day : d)) : [...r.days, day] }));
      enqueue([{ action: 'upsert', entity: 'days', data: day }]);
    },
    [enqueue],
  );

  const importData = useCallback(
    (data: Partial<DB>) => {
      const now = nowIso();
      const stamp = <T extends BaseEntity>(xs: T[] | undefined) => (xs || []).map((x) => ({ ...x, updatedAt: now }));
      const recipes = stamp(data.recipes).filter((r) => !r.champion);
      const brews = stamp(data.brews);
      const days = stamp(data.days);
      setRaw((r) => ({
        recipes: mergeList(r.recipes, recipes),
        brews: mergeList(r.brews, brews),
        days: mergeList(r.days, days),
        settings: data.settings ? { ...r.settings, ...data.settings, id: 'settings', updatedAt: now } : r.settings,
      }));
      const ops: Omit<Op, 'opId'>[] = [
        ...recipes.map((d) => ({ action: 'upsert' as const, entity: 'recipes' as const, data: d })),
        ...brews.map((d) => ({ action: 'upsert' as const, entity: 'brews' as const, data: d })),
        ...days.map((d) => ({ action: 'upsert' as const, entity: 'days' as const, data: d })),
      ];
      if (data.settings) ops.push({ action: 'upsert', entity: 'settings', data: { ...data.settings, id: 'settings', updatedAt: now } });
      enqueue(ops);
    },
    [enqueue],
  );

  const db = useMemo<DB>(
    () => ({
      recipes: raw.recipes.filter((x) => !x.deleted),
      brews: raw.brews.filter((x) => !x.deleted),
      days: raw.days.filter((x) => !x.deleted),
      settings: raw.settings,
    }),
    [raw],
  );

  const api = useMemo<StoreApi>(
    () => ({
      db,
      status,
      lastError,
      pendingCount: queue.length,
      upsert,
      remove,
      saveSettings,
      saveDay,
      importData,
      syncNow: () => void pull(),
    }),
    [db, status, lastError, queue.length, upsert, remove, saveSettings, saveDay, importData, pull],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
};
