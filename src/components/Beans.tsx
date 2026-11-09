import { useEffect, useState } from 'react';
import type { BeanEntry } from '../types';
import { useStore } from '../data/store';
import { DISCARD_REASONS, beanUsage, g1, uid } from '../lib/calc';
import { fmt, fromLocalInput, nowIso, toLocalInput } from '../lib/time';
import { Button, Field, Modal, NumberInput, TextArea, TextInput, cx, useConfirm, useToast } from './ui';

/** Add / edit a discard entry. */
export function BeanLogModal({ open, onClose, entry }: { open: boolean; onClose: () => void; entry?: BeanEntry | null }) {
  const { db, saveSettings } = useStore();
  const toast = useToast();
  const blank = (): BeanEntry => ({ id: uid('bean'), dateTime: nowIso(), grams: 0, reason: DISCARD_REASONS[0], note: '' });
  const [draft, setDraft] = useState<BeanEntry>(entry ?? blank());

  useEffect(() => {
    if (open) setDraft(entry ?? blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  const set = (patch: Partial<BeanEntry>) => setDraft((d) => ({ ...d, ...patch }));
  const { remaining } = beanUsage(db);
  const valid = draft.grams > 0;

  const save = () => {
    const log = db.settings.beanLog ?? [];
    const exists = log.some((e) => e.id === draft.id);
    const next = exists ? log.map((e) => (e.id === draft.id ? draft : e)) : [...log, draft];
    saveSettings({ beanLog: next });
    toast(exists ? 'Entry updated' : `Logged ${g1(draft.grams)} g discarded`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Edit discarded beans' : 'Log discarded beans'}>
      <div className="space-y-4">
        <Field label="Amount" hint={`${g1(remaining)} g left before this entry`}>
          <NumberInput value={draft.grams || null} step={0.1} min={0} onChange={(v) => set({ grams: v ?? 0 })} suffix="g" placeholder="0.0" />
        </Field>
        <Field label="Reason">
          <div className="flex flex-wrap gap-2">
            {DISCARD_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set({ reason: r })}
                className={cx(
                  'h-10 rounded-full px-4 text-sm transition',
                  draft.reason === r ? 'bg-accent text-white' : 'bg-mist-800 text-ink hover:bg-mist-700',
                )}
                aria-pressed={draft.reason === r}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Date & time (MYT)">
          <TextInput type="datetime-local" value={toLocalInput(draft.dateTime)} onChange={(e) => e.target.value && set({ dateTime: fromLocalInput(e.target.value) })} />
        </Field>
        <Field label="Note (optional)">
          <TextArea value={draft.note} onChange={(v) => set({ note: v })} rows={2} placeholder="e.g. quakers and broken beans from the 50 g batch" />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!valid} onClick={save}>
          {entry ? 'Save' : 'Log discard'}
        </Button>
      </div>
    </Modal>
  );
}

/** Two-segment bar: brewed (accent) + discarded (flag), with a 2px surface gap between segments. */
export function BeanBar({ budget, brewed, discarded }: { budget: number; brewed: number; discarded: number }) {
  const pct = (n: number) => `${Math.min(100, (n / Math.max(1, budget)) * 100)}%`;
  return (
    <div>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-mist-800" role="img" aria-label={`${g1(brewed)} g brewed, ${g1(discarded)} g discarded of ${budget} g`}>
        {brewed > 0 && <div className="h-full rounded-full bg-accent transition-all duration-1000" style={{ width: pct(brewed) }} />}
        {discarded > 0 && <div className="h-full rounded-full bg-flag transition-all duration-1000" style={{ width: pct(discarded) }} />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Brewed <span className="num text-ink">{g1(brewed)} g</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-flag" />
          Discarded <span className="num text-ink">{g1(discarded)} g</span>
        </span>
        <span className="ml-auto">of {budget} g practice beans</span>
      </div>
    </div>
  );
}

/** List of discard entries with edit/delete. `date` filters to one KL day (yyyy-MM-dd). */
export function BeanLogList({ limit, onEdit, compact }: { limit?: number; onEdit: (e: BeanEntry) => void; compact?: boolean }) {
  const { db, saveSettings } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const log = [...(db.settings.beanLog ?? [])].sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  const shown = limit ? log.slice(0, limit) : log;
  if (!log.length) return <p className="text-sm text-ink-faint">No discards logged yet.</p>;
  return (
    <ul className={cx('divide-y divide-mist-700', compact && 'text-sm')}>
      {shown.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="num w-16 shrink-0 font-semibold text-ink">−{g1(e.grams)} g</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ink">{e.reason}</span>
            <span className="block truncate text-xs text-ink-faint">
              {fmt(e.dateTime, 'EEE d MMM · HH:mm')}
              {e.note && ` · ${e.note}`}
            </span>
          </span>
          <button onClick={() => onEdit(e)} className="rounded-full px-3 py-1.5 text-sm text-accent hover:bg-accent/5">
            Edit
          </button>
          <button
            onClick={async () => {
              if (await confirm({ title: 'Delete entry?', message: `Remove the ${g1(e.grams)} g “${e.reason}” entry? Beans left will go back up.` })) {
                saveSettings({ beanLog: (db.settings.beanLog ?? []).filter((x) => x.id !== e.id) });
                toast('Entry deleted');
              }
            }}
            className="rounded-full px-3 py-1.5 text-sm text-bad hover:bg-bad/5"
          >
            Delete
          </button>
        </li>
      ))}
      {limit && log.length > limit && <li className="pt-2.5 text-xs text-ink-faint">+ {log.length - limit} earlier entries</li>}
    </ul>
  );
}
