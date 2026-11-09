import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../data/store';
import { brewTitle, extractionYield, findDay, g1, practiceDates, sortBrews, submissionState } from '../lib/calc';
import { buildDemo } from '../lib/demo';
import { navigate } from '../lib/router';
import { dateKey, fmt, fmtDateKey, mmss } from '../lib/time';
import { Badge, Button, Empty, Field, PageTitle, TextArea, cx, useToast } from '../components/ui';

/** Textarea that saves itself after you stop typing (and on blur). */
function AutoSaveText({ value, onSave, placeholder, rows }: { value: string; onSave: (v: string) => void; placeholder: string; rows?: number }) {
  const [text, setText] = useState(value);
  const [state, setState] = useState<'idle' | 'typing' | 'saved'>('idle');
  const t = useRef<ReturnType<typeof setTimeout>>();
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  const commit = (v: string) => {
    clearTimeout(t.current);
    if (v !== value) {
      onSave(v);
      setState('saved');
    }
  };
  return (
    <div onFocus={() => (focused.current = true)} onBlur={() => ((focused.current = false), commit(text))}>
      <TextArea
        value={text}
        rows={rows}
        placeholder={placeholder}
        onChange={(v) => {
          setText(v);
          setState('typing');
          clearTimeout(t.current);
          t.current = setTimeout(() => commit(v), 900);
        }}
      />
      <div className="mt-1 h-4 text-right text-[11px] text-ink-faint">{state === 'typing' ? 'Typing…' : state === 'saved' ? 'Saved' : ''}</div>
    </div>
  );
}

export function DaysPage() {
  const { db, saveDay, importData } = useStore();
  const toast = useToast();
  const brews = useMemo(() => sortBrews(db.brews), [db.brews]);
  const dates = useMemo(() => {
    const set = new Set(practiceDates(brews));
    db.days.forEach((d) => set.add(d.date));
    (db.settings.beanLog ?? []).forEach((e) => set.add(dateKey(e.dateTime)));
    return Array.from(set).sort().reverse();
  }, [brews, db.days, db.settings.beanLog]);
  const brewDates = practiceDates(brews);

  if (dates.length === 0)
    return (
      <div>
        <PageTitle title="Practice days" />
        <Empty
          title="No practice days yet"
          hint="Each day you log a brew becomes a practice day. Wrap up each session with a conclusion and a plan for next time."
          action={
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => navigate('/brews/new')}>
                + New brew
              </Button>
              <Button
                onClick={() => {
                  importData(buildDemo());
                  toast('Demo data loaded');
                }}
              >
                Load demo data
              </Button>
            </div>
          }
        />
      </div>
    );

  return (
    <div>
      <PageTitle title="Practice days" subtitle={`${brewDates.length} days · ${brews.length} brews`} action={<Button variant="primary" onClick={() => navigate('/brews/new')}>+ New brew</Button>} />
      <ol className="relative space-y-8 border-l border-mist-700 pl-5 sm:pl-8">
        {dates.map((date, i) => {
          const dayBrews = brews.filter((b) => dateKey(b.dateTime) === date);
          const day = findDay(db.days, date);
          const n = brewDates.indexOf(date) + 1;
          const best = dayBrews.reduce((m, b) => Math.max(m, b.sensory.overall), 0);
          const discards = (db.settings.beanLog ?? []).filter((e) => dateKey(e.dateTime) === date).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
          const discardedG = g1(discards.reduce((s, e) => s + e.grams, 0));
          return (
            <motion.li key={date} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative">
              <span className="absolute -left-[27px] top-2 h-3 w-3 rounded-full bg-accent shadow-glow sm:-left-[39px]" />
              <div className="mb-3 flex flex-wrap items-baseline gap-3">
                <h2 className="font-display text-2xl">{n > 0 ? `Day ${n}` : discards.length ? 'Bean prep' : 'Notes'}</h2>
                <span className="num text-sm text-ink-muted">{fmtDateKey(date)}</span>
                {dayBrews.length > 0 && <Badge>{dayBrews.length} brews</Badge>}
                {best > 0 && <Badge tone="accent">best {best.toFixed(1)}</Badge>}
                {discardedG > 0 && <Badge tone="flag">−{discardedG} g discarded</Badge>}
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <div className="space-y-2">
                  {dayBrews.length === 0 && discards.length === 0 && <p className="text-sm text-ink-faint">No brews logged on this day.</p>}
                  {discards.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-card">
                      <div className="num grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-flag/15 text-sm font-semibold text-flag-soft">−{g1(e.grams)}g</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">Discarded · {e.reason}</div>
                        <div className="truncate text-xs text-ink-muted">
                          <span className="num">{fmt(e.dateTime, 'HH:mm')}</span>
                          {e.note && ` · ${e.note}`}
                        </div>
                      </div>
                    </div>
                  ))}
                  {dayBrews.map((b) => {
                    const ey = extractionYield(b);
                    const sub = submissionState(b.results.finalG);
                    return (
                      <a
                        key={b.id}
                        href={`#/brews/${b.id}`}
                        className="flex items-center gap-3 rounded-xl bg-white shadow-card p-3 transition hover:border-accent/40"
                      >
                        <div className="num grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-mist-950 text-lg text-accent">{b.sensory.overall.toFixed(1)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{brewTitle(b, db.brews)}</div>
                          <div className="num flex flex-wrap gap-x-3 text-xs text-ink-muted">
                            <span>{fmt(b.dateTime, 'HH:mm')}</span>
                            <span>grind {b.spec.params.grindSetting}</span>
                            <span>{b.spec.params.tempC}°C</span>
                            <span>dd {mmss(b.results.drawdownS)}</span>
                            {ey != null && <span>EY {ey.toFixed(1)}%</span>}
                            <span className={cx(sub === 'fail' && 'text-bad', sub === 'warn' && 'text-warn')}>{b.results.finalG ?? '—'} g</span>
                          </div>
                          {b.whatITweaked && <div className="mt-0.5 truncate text-xs text-flag-soft">{b.whatITweaked}</div>}
                        </div>
                      </a>
                    );
                  })}
                </div>
                <div className="rounded-2xl bg-white shadow-card p-4">
                  <Field label="End-of-day conclusion">
                    <AutoSaveText
                      value={day?.endOfDayConclusion ?? ''}
                      onSave={(v) => saveDay(date, { endOfDayConclusion: v })}
                      placeholder="What did today teach you?"
                      rows={3}
                    />
                  </Field>
                  <Field label="Next session plan">
                    <AutoSaveText value={day?.nextSessionPlan ?? ''} onSave={(v) => saveDay(date, { nextSessionPlan: v })} placeholder="What will you try next?" rows={2} />
                  </Field>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
