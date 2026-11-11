import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Brew, Recipe, Sensory } from '../types';
import { useStore } from '../data/store';
import { DEFAULT_SENSORY, FLAVOUR_PRESETS, SENSORY_KEYS, STARTER_SPEC, makeStarterRecipe } from '../lib/defaults';
import {
  autoTitle,
  brewRatio,
  brewTitle,
  diffSpecs,
  extractionYield,
  overallRatio,
  ratioLabel,
  specFromRecipe,
  submissionState,
  uid,
} from '../lib/calc';
import { navigate } from '../lib/router';
import { fmt, fromLocalInput, mmss, nowIso, parseMmss, toLocalInput } from '../lib/time';
import { Badge, Button, Card, Empty, Field, NumberInput, PageTitle, TextArea, TextInput, cx, useConfirm, useToast } from '../components/ui';
import { SpecEditor } from '../components/SpecEditor';
import { SpecView } from '../components/SpecView';
import { PourCurve, SensoryRadar } from '../components/charts';
import { allRecipes, duplicateRecipe, findRecipe, nextVersion } from './Recipes';

export const newBrewFromRecipe = (r: Recipe | undefined, brews: Brew[], dateTime = nowIso()): Brew => {
  const spec = r ? specFromRecipe(r) : structuredClone(STARTER_SPEC);
  const draft: Brew = {
    id: uid('brw'),
    recipeId: r?.id ?? '',
    dateTime,
    title: '',
    customTitle: false,
    spec,
    baseline: structuredClone(spec),
    results: { drawdownS: null, beverageG: null, finalG: null, tdsPct: null },
    sensory: { ...DEFAULT_SENSORY },
    flavours: [],
    whatITweaked: '',
    feedback: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  draft.title = autoTitle(draft, brews);
  return draft;
};

function DurationInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      inputMode="numeric"
      placeholder="m:ss"
      value={text ?? (value == null ? '' : mmss(value))}
      onFocus={() => setText(value == null ? '' : mmss(value))}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        onChange(parseMmss(text ?? ''));
        setText(null);
      }}
      className="h-11 w-full rounded-xl border border-mist-600 bg-white px-3 font-mono text-ink focus:border-accent/60 focus:outline-none"
    />
  );
}

export function SubmissionBadge({ finalG }: { finalG: number | null }) {
  const s = submissionState(finalG);
  if (s === 'unknown') return <Badge>≥150 mL submission · —</Badge>;
  if (s === 'fail') return <Badge tone="bad">✕ Under 150 mL</Badge>;
  if (s === 'warn') return <Badge tone="warn">! ≥150 mL · tight margin</Badge>;
  return <Badge tone="ok">✓ ≥150 mL submission</Badge>;
}

function inRange(v: number | null, lo: number, hi: number) {
  if (v == null) return null;
  return v >= lo && v <= hi;
}

export function ComputedPanel({ brew }: { brew: Brew }) {
  const ey = extractionYield(brew);
  const t = brew.spec.targets;
  const tdsOk = inRange(brew.results.tdsPct, t.tdsMin, t.tdsMax);
  const eyOk = inRange(ey, t.eyMin, t.eyMax);
  const ddOk = inRange(brew.results.drawdownS, t.drawdownMinS, t.drawdownMaxS);
  const cell = (label: string, value: string, ok: boolean | null, sub?: string) => (
    <div className="rounded-2xl bg-mist-950 p-3">
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className={cx('num mt-1 text-xl', ok === true && 'text-ok', ok === false && 'text-warn', ok == null && 'text-ink')}>{value}</div>
      {sub && <div className="num text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cell('Brew ratio', ratioLabel(brewRatio(brew.spec)), null)}
      {cell('Overall ratio', ratioLabel(overallRatio(brew.spec)), null, 'incl. bypass')}
      {cell('EY', ey == null ? '—' : `${ey.toFixed(2)}%`, eyOk, `target ${t.eyMin}–${t.eyMax}`)}
      {cell('TDS', brew.results.tdsPct == null ? '—' : `${brew.results.tdsPct}%`, tdsOk, `target ${t.tdsMin}–${t.tdsMax}`)}
      {cell('Drawdown', mmss(brew.results.drawdownS), ddOk, `target ${mmss(t.drawdownMinS)}–${mmss(t.drawdownMaxS)}`)}
      <div className="flex items-center rounded-2xl bg-mist-950 p-3">
        <SubmissionBadge finalG={brew.results.finalG} />
      </div>
    </div>
  );
}

function SensorySliders({ value, onChange }: { value: Sensory; onChange: (s: Sensory) => void }) {
  return (
    <div className="space-y-3">
      {SENSORY_KEYS.map((k) => (
        <label key={k} className="block">
          <div className="flex items-baseline justify-between">
            <span className={cx('text-sm capitalize', k === 'overall' ? 'font-semibold text-accent' : 'text-ink-muted')}>{k}</span>
            <span className="num text-lg text-ink">{value[k].toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={value[k]}
            onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })}
            className="slider"
            style={{ ['--pct' as string]: `${value[k] * 10}%` }}
            aria-label={k}
          />
        </label>
      ))}
    </div>
  );
}

function FlavourTags({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('');
  const add = (t: string) => {
    const v = t.trim().toLowerCase();
    if (v && !value.includes(v)) onChange([...value, v]);
    setText('');
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <AnimatePresence>
          {value.map((t) => (
            <motion.button
              key={t}
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 text-sm text-accent"
            >
              {t} <span className="text-accent/60">✕</span>
            </motion.button>
          ))}
        </AnimatePresence>
        {value.length === 0 && <span className="text-sm text-ink-faint">Tap a preset or type your own.</span>}
      </div>
      <div className="flex gap-2">
        <TextInput
          value={text}
          placeholder="Add a note, press Enter"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            }
          }}
        />
        <Button onClick={() => add(text)}>Add</Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FLAVOUR_PRESETS.filter((p) => !value.includes(p)).map((p) => (
          <button key={p} onClick={() => add(p)} className="h-9 rounded-full border border-mist-600 px-3 text-sm text-ink-muted hover:border-accent/40 hover:text-ink">
            + {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function DiffSummary({ brew }: { brew: Brew }) {
  const diffs = diffSpecs(brew.baseline, brew.spec);
  if (!diffs.length) return <p className="text-sm text-ink-faint">Same as the recipe — no tweaks.</p>;
  return (
    <ul className="space-y-1.5">
      {diffs.map((d) => (
        <li key={d.path} className="flex flex-wrap items-baseline gap-2 text-sm">
          <span className="text-ink-muted">{d.label}</span>
          <span className="num text-ink-faint line-through">{d.from}</span>
          <span className="text-flag-soft">→</span>
          <span className="num text-flag-soft">{d.to}</span>
        </li>
      ))}
    </ul>
  );
}

export function BrewFormPage({ id, query }: { id?: string; query: URLSearchParams }) {
  const { db, upsert, remove } = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const existing = id ? db.brews.find((b) => b.id === id) : undefined;
  const recipes = allRecipes(db.recipes);

  const initial = useMemo(() => {
    if (existing) return structuredClone(existing);
    const r = findRecipe(db.recipes, query.get('recipe')) ?? findRecipe(db.recipes, db.settings.defaultRecipeId) ?? db.recipes[0];
    const b = newBrewFromRecipe(r, db.brews);
    const dd = query.get('drawdown');
    if (dd && Number.isFinite(Number(dd))) b.results.drawdownS = Number(dd);
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [brew, setBrew] = useState<Brew>(initial);
  const [showSpec, setShowSpec] = useState(false);
  useEffect(() => setBrew(initial), [initial]);

  if (id && !existing) return <Empty title="Brew not found" hint="It may have been deleted." action={<Button onClick={() => navigate('/days')}>Practice days</Button>} />;

  const set = (patch: Partial<Brew>) => setBrew((b) => ({ ...b, ...patch }));
  const setRes = (patch: Partial<Brew['results']>) => setBrew((b) => ({ ...b, results: { ...b.results, ...patch } }));
  const othersForTitle = db.brews.filter((b) => b.id !== brew.id).concat(brew);
  const title = brew.customTitle ? brew.title : autoTitle(brew, othersForTitle);
  const diffCount = diffSpecs(brew.baseline, brew.spec).length;
  const recipe = findRecipe(db.recipes, brew.recipeId);

  const save = (andView = true) => {
    const toSave = { ...brew, title };
    upsert('brews', toSave);
    toast(existing ? 'Brew updated' : 'Brew logged');
    if (andView) navigate(`/brews/${brew.id}`);
    return toSave;
  };

  const promote = () => {
    save(false);
    const base = recipe;
    let v: Recipe;
    if (!base || base.champion) {
      v = duplicateRecipe({ ...(base ?? makeStarterRecipe(nowIso())), ...structuredClone(brew.spec) }, `${brew.spec.coffee.name} — from ${title}`);
      v.notes = `Promoted from brew “${title}”${base ? ` (based on ${base.name})` : ''}.`;
    } else {
      const head = db.recipes.filter((r) => r.lineageId === base.lineageId).sort((a, b) => b.version - a.version)[0] ?? base;
      v = nextVersion(head, db.recipes, brew.spec);
      v.notes = `Promoted from brew “${title}”. ${brew.whatITweaked}`.trim();
    }
    upsert('recipes', v);
    toast(`Promoted to ${v.name}`);
    navigate(`/recipes/${v.id}`);
  };

  return (
    <div className="pb-28">
      <PageTitle title={existing ? 'Edit brew' : 'New brew'} subtitle={title} />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card title="Setup">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipe" className="sm:col-span-2">
              <select
                value={brew.recipeId}
                onChange={(e) => {
                  const r = recipes.find((x) => x.id === e.target.value);
                  if (!r) return;
                  const spec = specFromRecipe(r);
                  set({ recipeId: r.id, spec, baseline: structuredClone(spec) });
                }}
                className="h-11 w-full rounded-xl border border-mist-600 bg-white px-3 text-ink"
              >
                {!brew.recipeId && <option value="">— none —</option>}
                <optgroup label="My recipes" className="bg-mist-900">
                  {db.recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (v{r.version})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Champion templates" className="bg-mist-900">
                  {recipes
                    .filter((r) => r.champion)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        ★ {r.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            </Field>
            <Field label="Date & time (MYT)">
              <TextInput type="datetime-local" value={toLocalInput(brew.dateTime)} onChange={(e) => e.target.value && set({ dateTime: fromLocalInput(e.target.value) })} />
            </Field>
            <Field
              label="Title"
              hint={
                brew.customTitle ? (
                  <button className="text-accent hover:underline" onClick={() => set({ customTitle: false })}>
                    Reset to auto title
                  </button>
                ) : (
                  'Auto — edit to override'
                )
              }
            >
              <TextInput value={title} onChange={(e) => set({ title: e.target.value, customTitle: true })} />
            </Field>
          </div>
          <div className="mt-4 rounded-2xl bg-mist-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-ink-faint">Tweaks vs recipe</span>
              {diffCount > 0 && <Badge tone="flag">{diffCount} changed</Badge>}
            </div>
            <DiffSummary brew={brew} />
          </div>
        </Card>

        <Card title="Results">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Drawdown">
              <DurationInput value={brew.results.drawdownS} onChange={(v) => setRes({ drawdownS: v })} />
            </Field>
            <Field label="TDS (optional)">
              <NumberInput value={brew.results.tdsPct} step={0.01} onChange={(v) => setRes({ tdsPct: v })} suffix="%" />
            </Field>
            <Field label="Beverage (pre-bypass)">
              <NumberInput value={brew.results.beverageG} onChange={(v) => setRes({ beverageG: v })} suffix="g" />
            </Field>
            <Field label="Final (after bypass)">
              <NumberInput value={brew.results.finalG} onChange={(v) => setRes({ finalG: v })} suffix="g" />
            </Field>
          </div>
          {brew.results.beverageG != null && brew.results.finalG == null && (
            <button className="mt-2 text-xs text-accent hover:underline" onClick={() => setRes({ finalG: (brew.results.beverageG ?? 0) + (brew.spec.params.bypassG || 0) })}>
              Fill final = beverage + {brew.spec.params.bypassG} g bypass
            </button>
          )}
          <div className="mt-4">
            <ComputedPanel brew={brew} />
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Sensory">
          <div className="grid gap-4 md:grid-cols-[1fr_1.1fr] lg:grid-cols-1 xl:grid-cols-[1fr_1.1fr]">
            <SensorySliders value={brew.sensory} onChange={(s) => set({ sensory: s })} />
            <SensoryRadar series={[{ name: 'This brew', data: brew.sensory }]} />
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Flavour notes">
            <FlavourTags value={brew.flavours} onChange={(f) => set({ flavours: f })} />
          </Card>
          <Card title="Notes">
            <div className="space-y-4">
              <Field label="What I tweaked">
                <TextArea value={brew.whatITweaked} onChange={(v) => set({ whatITweaked: v })} placeholder="e.g. grind 7.3 → 7.6, slower final pour" />
              </Field>
              <Field label="Feedback / how it tasted">
                <TextArea value={brew.feedback} onChange={(v) => set({ feedback: v })} rows={4} placeholder="Cup notes, what to try next" />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5">
        <button
          onClick={() => setShowSpec((v) => !v)}
          className="mb-4 flex w-full items-center justify-between rounded-2xl bg-white shadow-card px-5 py-4 text-left hover:border-accent/40"
        >
          <span>
            <span className="font-display text-lg">Recipe snapshot</span>
            <span className="ml-3 text-sm text-ink-faint">coffee, equipment, params, steps, targets — edits stay on this brew</span>
          </span>
          <span className="text-accent">{showSpec ? '▾' : '▸'}</span>
        </button>
        {showSpec ? (
          <SpecEditor spec={brew.spec} baseline={brew.baseline} onChange={(s) => set({ spec: s })} />
        ) : (
          <Card>
            <PourCurve pours={brew.spec.pourSchedule} targets={brew.spec.targets} drawdownS={brew.results.drawdownS} spec={brew.spec} />
          </Card>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t border-black/5 bg-white/80 backdrop-blur-xl backdrop-saturate-150 lg:bottom-0">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6">
          {existing && (
            <Button
              variant="quiet-danger"
              
              onClick={async () => {
                if (await confirm({ title: 'Delete brew?', message: `Delete “${title}”? This can't be undone.` })) {
                  remove('brews', existing.id);
                  toast('Brew deleted');
                  navigate('/days');
                }
              }}
            >
              Delete
            </Button>
          )}
          <Button className="ml-auto" onClick={promote} title="Save this brew's snapshot as the next version of its recipe">
            <span className="sm:hidden">Promote ↑</span>
            <span className="hidden sm:inline">Promote to new recipe version</span>
          </Button>
          <Button variant="primary" size="lg" onClick={() => save()}>
            {existing ? 'Save' : 'Log brew'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function BrewDetailPage({ id }: { id: string }) {
  const { db } = useStore();
  const brew = db.brews.find((b) => b.id === id);
  if (!brew) return <Empty title="Brew not found" hint="It may have been deleted." action={<Button onClick={() => navigate('/days')}>Practice days</Button>} />;
  const recipe = findRecipe(db.recipes, brew.recipeId);
  return (
    <div>
      <PageTitle
        title={brewTitle(brew, db.brews)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{fmt(brew.dateTime, 'EEEE d MMMM yyyy · HH:mm')}</span>
            {recipe && (
              <a href={`#/recipes/${recipe.id}`} className="text-accent hover:underline">
                {recipe.name}
              </a>
            )}
          </span>
        }
        action={
          <>
            <Button onClick={() => navigate(`/compare?ids=${brew.id}`)}>Compare</Button>
            <Button variant="primary" onClick={() => navigate(`/brews/${brew.id}/edit`)}>
              Edit
            </Button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card title="Sensory" action={<span className="num text-3xl text-accent">{brew.sensory.overall.toFixed(1)}</span>}>
          <SensoryRadar series={[{ name: 'Sensory', data: brew.sensory }]} height={300} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {brew.flavours.map((f) => (
              <Badge key={f} tone="accent">
                {f}
              </Badge>
            ))}
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Results" delay={0.05}>
            <ComputedPanel brew={brew} />
          </Card>
          <Card title="Pour curve" delay={0.1}>
            <PourCurve pours={brew.spec.pourSchedule} targets={brew.spec.targets} drawdownS={brew.results.drawdownS} spec={brew.spec} />
          </Card>
        </div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="What I tweaked" delay={0.12}>
          <p className="whitespace-pre-wrap text-ink-muted">{brew.whatITweaked || '—'}</p>
          <div className="mt-4 rounded-2xl bg-mist-950 p-4">
            <DiffSummary brew={brew} />
          </div>
        </Card>
        <Card title="Feedback" delay={0.14}>
          <p className="whitespace-pre-wrap text-ink-muted">{brew.feedback || '—'}</p>
        </Card>
      </div>
      <Card title="Full spec" className="mt-5" delay={0.16}>
        <SpecView spec={brew.spec} baseline={brew.baseline} />
      </Card>
    </div>
  );
}
