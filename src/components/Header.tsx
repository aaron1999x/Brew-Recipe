import { useEffect, useMemo, useState } from 'react';
import { fromZonedTime } from 'date-fns-tz';
import { FlipUnit } from './FlipClock';
import { useStore } from '../data/store';
import { TZ, fmt } from '../lib/time';
import { cx } from './ui';

export function useCountdown(eventLocal: string) {
  const target = useMemo(() => {
    try {
      return fromZonedTime(eventLocal, TZ).getTime();
    } catch {
      return NaN;
    }
  }, [eventLocal]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, (target || 0) - now);
  const s = Math.floor(diff / 1000);
  return {
    target,
    done: diff <= 0,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

const p2 = (n: number) => String(n).padStart(2, '0');

export function Countdown({ eventLocal, size = 'lg' }: { eventLocal: string; size?: 'md' | 'lg' }) {
  const c = useCountdown(eventLocal);
  if (c.done) return <div className="font-display text-3xl text-accent">It's competition day.</div>;
  return (
    <div
      className={cx('flex items-start', size === 'lg' ? 'gap-3 text-5xl sm:gap-4 sm:text-7xl' : 'gap-2.5 text-[34px] sm:gap-3 sm:text-[48px]')}
      aria-label={`${c.days} days ${c.hours} hours ${c.minutes} minutes to go`}
    >
      <FlipUnit value={p2(c.days)} label="Days" tone="accent" />
      <FlipUnit value={p2(c.hours)} label="Hours" />
      <FlipUnit value={p2(c.minutes)} label="Minutes" />
      <FlipUnit value={p2(c.seconds)} label="Seconds" />
    </div>
  );
}

export function CompactCountdown({ eventLocal }: { eventLocal: string }) {
  const c = useCountdown(eventLocal);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="shrink-0 text-[13px] tabular-nums text-ink-muted sm:text-[15px]" aria-label="Time to competition">
      {c.done ? (
        'Today'
      ) : (
        <>
          <span className="font-semibold text-ink">{c.days}d</span> {p(c.hours)}:{p(c.minutes)}:{p(c.seconds)}
        </>
      )}
    </span>
  );
}

export function SyncIndicator() {
  const { status, pendingCount, lastError, syncNow } = useStore();
  const map = {
    saved: { label: 'Saved', dot: 'bg-ok' },
    syncing: { label: 'Syncing', dot: 'bg-accent animate-pulse' },
    offline: { label: pendingCount ? `Offline · ${pendingCount}` : 'Offline', dot: 'bg-bad' },
    local: { label: 'Local', dot: 'bg-mist-500' },
  }[status];
  return (
    <button
      onClick={syncNow}
      title={status === 'local' ? 'No VITE_GAS_URL set — data is saved in this browser only' : lastError ?? 'Click to sync now'}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-ink-muted hover:bg-mist-800"
    >
      <span className={cx('h-2 w-2 rounded-full', map.dot)} />
      {map.label}
    </button>
  );
}

/** Competitor name, linked to their site when a URL is set. Opens in a new tab so the brew log stays open. */
function CompetitorName({ name, url }: { name: string; url?: string }) {
  const href = url?.trim();
  if (!href) return <>{name}</>;
  return (
    <a
      href={/^https?:\/\//i.test(href) ? href : `https://${href}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-current/30 underline-offset-4 transition hover:decoration-current"
    >
      {name}
    </a>
  );
}

/** Event header. `hero` = big dashboard version; otherwise a compact strip. */
export function Header({ hero }: { hero?: boolean }) {
  const { db } = useStore();
  const s = db.settings;
  let when = '';
  try {
    when = fmt(fromZonedTime(s.eventDateTime, TZ), 'd MMMM yyyy, h:mm a');
  } catch {
    when = s.eventDateTime;
  }

  if (!hero) {
    return (
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pt-6 text-[15px] text-ink-muted sm:px-6">
        <span>
          <span className="font-medium text-ink">{s.title}</span>
          <span className="mx-2 text-mist-500">·</span>
          {s.venue}
          <span className="mx-2 text-mist-500">·</span>
          {when}
          <span className="mx-2 text-mist-500">·</span>
          <CompetitorName name={s.competitor} url={s.competitorUrl} />
        </span>
      </div>
    );
  }

  return (
    <header className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-8 pt-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:pt-12">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-accent">
          Competitor · <CompetitorName name={s.competitor} url={s.competitorUrl} />
        </p>
        <h1 className="mt-1 font-display text-[32px] leading-tight text-ink sm:text-5xl">{s.title}</h1>
        <p className="mt-2 text-base text-ink-muted sm:text-lg">
          {s.venue} · {when}
        </p>
      </div>
      <div className="shrink-0">
        <Countdown eventLocal={s.eventDateTime} size="md" />
      </div>
    </header>
  );
}
