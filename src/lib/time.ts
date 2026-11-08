import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const TZ = 'Asia/Kuala_Lumpur';

export const nowIso = () => new Date().toISOString();

/** Format an ISO instant in Malaysia time. */
export const fmt = (iso: string | Date, pattern: string) => formatInTimeZone(iso, TZ, pattern);

/** yyyy-MM-dd of an instant in KL. */
export const dateKey = (iso: string | Date) => fmt(iso, 'yyyy-MM-dd');

/** Value for <input type="datetime-local"> in KL time. */
export const toLocalInput = (iso: string) => fmt(iso, "yyyy-MM-dd'T'HH:mm");

/** Parse a KL wall-clock string (yyyy-MM-ddTHH:mm) into an ISO instant. */
export const fromLocalInput = (value: string) => fromZonedTime(value, TZ).toISOString();

/** Format a date-only key (yyyy-MM-dd) for display. */
export const fmtDateKey = (key: string, pattern = 'EEE d MMM yyyy') =>
  formatInTimeZone(fromZonedTime(`${key}T12:00`, TZ), TZ, pattern);

/** m:ss */
export const mmss = (s: number | null | undefined) => {
  if (s == null || !Number.isFinite(s)) return '—';
  const sign = s < 0 ? '-' : '';
  const a = Math.abs(Math.round(s));
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
};

/** Parse "m:ss" or plain seconds. */
export const parseMmss = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    const mi = Number(m);
    const si = Number(s);
    if (!Number.isFinite(mi) || !Number.isFinite(si)) return null;
    return mi * 60 + si;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
