import { useEffect, useRef, useState } from 'react';
import { useStore } from '../data/store';
import { backendConfigured } from '../data/api';
import { buildDemo } from '../lib/demo';
import { exportCsv, exportJson, readJsonFile } from '../lib/export';
import type { Settings } from '../types';
import { Button, Field, Modal, NumberInput, TextInput, useToast } from './ui';

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, saveSettings, importData, status, lastError, pendingCount } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<Settings>(db.settings);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setDraft(db.settings);
  }, [open, db.settings]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const recipeOpts = db.recipes.map((r) => r.id);
  const recipeName = (id: string) => db.recipes.find((r) => r.id === id)?.name ?? id;

  return (
    <Modal open={open} onClose={onClose} title="Settings" wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event title" className="sm:col-span-2">
          <TextInput value={draft.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Venue">
          <TextInput value={draft.venue} onChange={(e) => set('venue', e.target.value)} />
        </Field>
        <Field label="Competitor">
          <TextInput value={draft.competitor} onChange={(e) => set('competitor', e.target.value)} />
        </Field>
        <Field label="Competitor link" hint="Your name in the header links here. Leave blank for no link.">
          <TextInput type="url" placeholder="https://atys.dev" value={draft.competitorUrl ?? ''} onChange={(e) => set('competitorUrl', e.target.value)} />
        </Field>
        <Field label="Event date & time" hint="Asia/Kuala_Lumpur">
          <TextInput type="datetime-local" value={draft.eventDateTime} onChange={(e) => set('eventDateTime', e.target.value)} />
        </Field>
        <Field label="Practice bean budget">
          <NumberInput value={draft.beanBudgetG} onChange={(v) => set('beanBudgetG', v ?? 0)} suffix="g" />
        </Field>
        {recipeOpts.length > 0 && (
          <Field label="Default recipe for new brews" className="sm:col-span-2">
            <select
              value={draft.defaultRecipeId ?? ''}
              onChange={(e) => set('defaultRecipeId', e.target.value || null)}
              className="h-11 w-full rounded-xl border border-mist-600 bg-white px-3 text-ink"
            >
              {recipeOpts.map((id) => (
                <option key={id} value={id} className="bg-mist-900">
                  {recipeName(id)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            saveSettings(draft);
            toast('Settings saved');
            onClose();
          }}
        >
          Save settings
        </Button>
      </div>

      <hr className="my-6 border-mist-700" />

      <h3 className="mb-3 font-display text-lg">Data</h3>
      <div className="mb-4 rounded-2xl bg-mist-950 p-3 text-sm text-ink-muted">
        Backend:{' '}
        {backendConfigured ? (
          <>
            Google Sheet · <span className="text-ink">{status}</span>
            {pendingCount > 0 && <> · {pendingCount} queued</>}
            {lastError && <div className="mt-1 text-bad">{lastError}</div>}
          </>
        ) : (
          <>not configured — set VITE_GAS_URL and VITE_GAS_TOKEN in .env. Data is kept in this browser.</>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => exportJson(db)}>Export JSON</Button>
        <Button onClick={() => exportCsv(db)}>Export CSV (brews)</Button>
        <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
        <Button
          variant="ghost"
          onClick={() => {
            importData(buildDemo());
            toast('Demo data loaded — 2 days, 4 brews');
            onClose();
          }}
        >
          Load demo data
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const data = await readJsonFile(f);
              importData(data);
              toast(`Imported ${data.brews?.length ?? 0} brews, ${data.recipes?.length ?? 0} recipes`);
            } catch (err) {
              toast(`Import failed: ${err instanceof Error ? err.message : 'invalid file'}`);
            }
          }}
        />
      </div>
      <p className="mt-3 text-xs text-ink-faint">Import merges by id; imported records win over local ones.</p>
    </Modal>
  );
}
