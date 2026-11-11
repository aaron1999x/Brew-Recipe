import { useState, type ReactNode } from 'react';
import type { RecipeSpec, RoastLevel, Step, StepKind } from '../types';
import { DRIPPERS, PAPERS, ROAST_LEVELS, TEMP_HINT } from '../lib/defaults';
import { aquacode, brewRatio, changedPaths, overallRatio, ratioLabel } from '../lib/calc';
import { STEP_KINDS, bloomInfo, newStep, poursOf, pourTemps, sortedSteps, stepKind, syncBloom, totalPoured } from '../lib/steps';
import { mmss, parseMmss } from '../lib/time';
import { Button, Card, Field, NumberInput, Select, Switch, TextInput, cx } from './ui';
import { PourCurve, TempGauge } from './charts';

type Updater = (fn: (s: RecipeSpec) => void) => void;

export function useSpecUpdater(spec: RecipeSpec, onChange: (s: RecipeSpec) => void): Updater {
  return (fn) => {
    const next = structuredClone(spec);
    fn(next);
    syncBloom(next); // bloom grams/time always follow the steps
    onChange(next);
  };
}

function TimeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      inputMode="numeric"
      value={text ?? mmss(value)}
      onFocus={() => setText(mmss(value))}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = parseMmss(text ?? '');
        if (v != null) onChange(v);
        setText(null);
      }}
      className="h-11 w-full rounded-xl border border-mist-600 bg-white px-3 font-mono text-ink focus:border-accent/60 focus:outline-none"
      aria-label="Time (m:ss)"
    />
  );
}

function Mini({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block min-w-0', className)}>
      <span className="mb-1 block text-[11px] font-medium text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

/** Editable list of brew steps. Pours carry weight/rate/temp; other steps carry a duration (and a name for "Other"). */
export function StepsEditor({
  steps,
  onChange,
  changed,
  varyTemp,
  defaultTemp,
}: {
  steps: Step[];
  onChange: (s: Step[]) => void;
  changed?: boolean;
  varyTemp?: boolean;
  defaultTemp: number;
}) {
  const set = (i: number, patch: Partial<Step>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  // keep steps in time order once a time has been committed
  const setTime = (i: number, t: number) => onChange(sortedSteps(steps.map((s, j) => (j === i ? { ...s, timeS: t } : s))));
  const setKind = (i: number, kind: StepKind) => {
    const s = steps[i];
    const patch: Partial<Step> = { kind };
    if (kind === 'pour' && !s.targetWeightG) patch.targetWeightG = (poursOf(steps.filter((_, j) => j !== i)).at(-1)?.targetWeightG ?? 0) + 50;
    if (kind === 'pour' && s.tempC == null) patch.tempC = defaultTemp;
    set(i, patch);
  };

  return (
    <div className={cx('space-y-2', changed && 'rounded-2xl p-2 ring-1 ring-flag/50')}>
      {steps.map((s, i) => {
        const kind = stepKind(s);
        const pour = kind === 'pour';
        return (
          <div key={i} className={cx('rounded-2xl p-3', pour ? 'bg-mist-950' : 'bg-mist-950/60 ring-1 ring-inset ring-mist-700')}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted">Step {i + 1}</span>
              <button
                onClick={() => onChange(steps.filter((_, j) => j !== i))}
                className="-mr-1 grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:bg-bad/10 hover:text-bad"
                aria-label={`Remove step ${i + 1}`}
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[112px_84px_repeat(3,minmax(0,1fr))] sm:items-end">
              <Mini label="Type">
                <select
                  value={kind}
                  onChange={(e) => setKind(i, e.target.value as StepKind)}
                  className="h-11 w-full rounded-xl border border-mist-600 bg-white px-3 text-[15px] text-ink focus:border-accent focus:outline-none"
                  aria-label="Step type"
                >
                  {STEP_KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </Mini>
              <Mini label="At">
                <TimeInput value={s.timeS} onChange={(v) => setTime(i, v)} />
              </Mini>
              {pour ? (
                <>
                  <Mini label="Scale target">
                    <NumberInput value={s.targetWeightG} onChange={(v) => set(i, { targetWeightG: v ?? 0 })} suffix="g" />
                  </Mini>
                  <Mini label="Rate (optional)">
                    <NumberInput value={s.rateGps ?? null} onChange={(v) => set(i, { rateGps: v })} suffix="g/s" step={0.5} placeholder="—" />
                  </Mini>
                  {varyTemp ? (
                    <Mini label="Water temp">
                      <NumberInput value={s.tempC ?? defaultTemp} step={0.5} onChange={(v) => set(i, { tempC: v })} suffix="°C" />
                    </Mini>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                </>
              ) : (
                <>
                  <Mini label="Duration (optional)">
                    <NumberInput value={s.durationS ?? null} onChange={(v) => set(i, { durationS: v })} suffix="s" placeholder="—" />
                  </Mini>
                  {kind === 'other' ? (
                    <Mini label="Action" className="col-span-2 sm:col-span-1">
                      <TextInput value={s.label ?? ''} placeholder="e.g. Tap dripper" onChange={(e) => set(i, { label: e.target.value })} />
                    </Mini>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                  <div className="hidden sm:block" />
                </>
              )}
            </div>
            <TextInput
              className="mt-2"
              value={s.technique}
              placeholder={pour ? 'Technique, e.g. centre spiral' : 'Note, e.g. gentle, 3 rotations'}
              onChange={(e) => set(i, { technique: e.target.value })}
            />
          </div>
        );
      })}
      <Button size="sm" variant="ghost" onClick={() => onChange([...steps, newStep(steps, 'pour', defaultTemp)])}>
        + Add step
      </Button>
    </div>
  );
}

/** @deprecated kept for older imports */
export const PourScheduleEditor = StepsEditor;

export function WaterCalc({ ppm, onPpm }: { ppm: number; onPpm?: (v: number) => void }) {
  const { concentrateG, distilledG } = aquacode(ppm || 0);
  return (
    <div className="rounded-2xl bg-mist-950 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-faint">Aquacode water · per 1 L</span>
        {onPpm && (
          <div className="w-28">
            <NumberInput value={ppm} onChange={(v) => onPpm(v ?? 0)} suffix="ppm" />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="num text-2xl text-accent">{concentrateG.toFixed(1)} g</div>
          <div className="text-xs text-ink-muted">concentrate (590 ppm stock)</div>
        </div>
        <div>
          <div className="num text-2xl text-ink">{distilledG.toFixed(1)} g</div>
          <div className="text-xs text-ink-muted">distilled water</div>
        </div>
      </div>
      <div className="mt-2 font-mono text-[11px] text-ink-faint">
        {ppm} ÷ 590 × 1000 = {concentrateG.toFixed(1)} g
      </div>
    </div>
  );
}

export function SpecEditor({ spec, onChange, baseline }: { spec: RecipeSpec; onChange: (s: RecipeSpec) => void; baseline?: RecipeSpec }) {
  const up = useSpecUpdater(spec, onChange);
  const ch = changedPaths(baseline, spec);
  const c = (p: string) => !!baseline && ch.has(p);
  const hint = TEMP_HINT[spec.coffee.roastLevel] ?? null;
  const p = spec.params;
  const bloom = bloomInfo(spec.pourSchedule);
  const poured = totalPoured(spec.pourSchedule);
  const temps = p.varyTemp ? pourTemps(spec).filter((t, i, a) => i === 0 || t !== a[i - 1]) : [];

  return (
    <div className="space-y-5">
      <Card title="Coffee">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" changed={c('coffee.name')}>
            <TextInput value={spec.coffee.name} onChange={(e) => up((s) => void (s.coffee.name = e.target.value))} />
          </Field>
          <Field label="Process" changed={c('coffee.process')}>
            <TextInput value={spec.coffee.process} onChange={(e) => up((s) => void (s.coffee.process = e.target.value))} />
          </Field>
          <Field label="Roast level" changed={c('coffee.roastLevel')}>
            <Select value={spec.coffee.roastLevel} options={ROAST_LEVELS} onChange={(v) => up((s) => void (s.coffee.roastLevel = v as RoastLevel))} />
          </Field>
          <Field label="Origin" className="sm:col-span-2">
            <TextInput value={spec.coffee.origin} onChange={(e) => up((s) => void (s.coffee.origin = e.target.value))} />
          </Field>
          <Field label="Altitude">
            <TextInput value={spec.coffee.altitude} onChange={(e) => up((s) => void (s.coffee.altitude = e.target.value))} />
          </Field>
          <Field label="Varietals" className="sm:col-span-2">
            <TextInput value={spec.coffee.varietals} onChange={(e) => up((s) => void (s.coffee.varietals = e.target.value))} />
          </Field>
          <Field label="Roaster / machine">
            <TextInput value={spec.coffee.roaster} onChange={(e) => up((s) => void (s.coffee.roaster = e.target.value))} />
          </Field>
          <Field label="Roast date" changed={c('coffee.roastDate')}>
            <TextInput type="date" value={spec.coffee.roastDate} onChange={(e) => up((s) => void (s.coffee.roastDate = e.target.value))} />
          </Field>
          <Field label="Agtron (optional)" changed={c('coffee.agtron')}>
            <NumberInput value={spec.coffee.agtron ?? null} onChange={(v) => up((s) => void (s.coffee.agtron = v))} />
          </Field>
        </div>
      </Card>

      <Card title="Equipment">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Dripper" changed={c('equipment.dripper')}>
            <Select value={spec.equipment.dripper} options={DRIPPERS} allowCustom onChange={(v) => up((s) => void (s.equipment.dripper = v))} />
          </Field>
          <Field label="Paper" changed={c('equipment.paper')}>
            <Select value={spec.equipment.paper} options={PAPERS} allowCustom onChange={(v) => up((s) => void (s.equipment.paper = v))} />
          </Field>
          <Field label="Grinder" changed={c('equipment.grinder')}>
            <TextInput value={spec.equipment.grinder} onChange={(e) => up((s) => void (s.equipment.grinder = e.target.value))} />
          </Field>
          <Field label="Kettle">
            <TextInput value={spec.equipment.kettle} onChange={(e) => up((s) => void (s.equipment.kettle = e.target.value))} />
          </Field>
          <Field label="Scale">
            <TextInput value={spec.equipment.scale} onChange={(e) => up((s) => void (s.equipment.scale = e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Parameters" action={<span className="num text-sm text-ink-muted">brew {ratioLabel(brewRatio(spec))} · overall {ratioLabel(overallRatio(spec))}</span>}>
        <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Dose" changed={c('params.doseG')}>
              <NumberInput value={p.doseG} step={0.1} onChange={(v) => up((s) => void (s.params.doseG = v ?? 0))} suffix="g" />
            </Field>
            <Field label="Brew water" changed={c('params.brewWaterG')}>
              <NumberInput value={p.brewWaterG} onChange={(v) => up((s) => void (s.params.brewWaterG = v ?? 0))} suffix="g" />
            </Field>
            <Field label="Bypass" changed={c('params.bypassG')}>
              <NumberInput value={p.bypassG} onChange={(v) => up((s) => void (s.params.bypassG = v ?? 0))} suffix="g" />
            </Field>
            <Field label={p.varyTemp ? 'Default temp' : 'Temp'} changed={c('params.tempC')} hint={hint ? `${spec.coffee.roastLevel}: ${hint[0]}–${hint[1]}°C` : undefined}>
              <NumberInput value={p.tempC} step={0.5} onChange={(v) => up((s) => void (s.params.tempC = v ?? 0))} suffix="°C" />
            </Field>
            <Field label="Grind" changed={c('params.grindSetting')}>
              <TextInput className="num" value={p.grindSetting} onChange={(e) => up((s) => void (s.params.grindSetting = e.target.value))} />
            </Field>
            <Field label="Water" changed={c('params.waterPpm')}>
              <NumberInput value={p.waterPpm} onChange={(v) => up((s) => void (s.params.waterPpm = v ?? 0))} suffix="ppm" />
            </Field>
            <Field label="Bloom" hint="From your first pour" className="col-span-2">
              <div className="flex h-11 items-center rounded-xl bg-mist-950 px-3.5 text-[15px] text-ink-muted">
                {bloom ? (
                  <span className="num">
                    <span className="text-ink">{bloom.grams} g</span>
                    {bloom.timeS != null && <> · next pour at +{mmss(bloom.timeS)}</>}
                  </span>
                ) : (
                  'Add a pour step'
                )}
              </div>
            </Field>
            <div className="col-span-2 sm:col-span-4">
              <Switch
                checked={!!p.varyTemp}
                label="Vary temperature by pour"
                hint={
                  p.varyTemp
                    ? `Each pour sets its own temperature in Steps${temps.length ? ` · ${temps.join(' → ')}°C` : ''}`
                    : `Every pour uses ${p.tempC}°C`
                }
                onChange={(on) =>
                  up((s) => {
                    s.params.varyTemp = on;
                    // first time on: start every pour at the default temp (turning off keeps them, just unused)
                    if (on) s.pourSchedule.forEach((st) => stepKind(st) === 'pour' && st.tempC == null && (st.tempC = s.params.tempC));
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-center rounded-2xl bg-mist-950 px-6 py-3">
            <TempGauge tempC={p.tempC} hint={hint} />
          </div>
        </div>
        <div className="mt-5">
          <WaterCalc ppm={p.waterPpm} />
        </div>
      </Card>

      <Card title="Steps" action={<span className="text-sm text-ink-muted">{poursOf(spec.pourSchedule).length} pours · {spec.pourSchedule.length} steps</span>}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <StepsEditor
              steps={spec.pourSchedule}
              varyTemp={!!p.varyTemp}
              defaultTemp={p.tempC}
              changed={c('pourSchedule')}
              onChange={(ps) => up((s) => void (s.pourSchedule = ps))}
            />
            {poured > 0 && poured !== p.brewWaterG && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-flag/10 px-4 py-3 text-sm text-warn" role="status">
                <span>
                  Steps pour to <span className="num font-semibold">{poured} g</span> but brew water is <span className="num font-semibold">{p.brewWaterG} g</span>.
                </span>
                <button className="font-medium underline underline-offset-2" onClick={() => up((s) => void (s.params.brewWaterG = poured))}>
                  Set brew water to {poured} g
                </button>
              </div>
            )}
          </div>
          <div>
            <PourCurve pours={spec.pourSchedule} targets={spec.targets} spec={spec} />
          </div>
        </div>
      </Card>

      <Card title="Targets">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Drawdown min" changed={c('targets.drawdownMinS')} hint={mmss(spec.targets.drawdownMinS)}>
            <NumberInput value={spec.targets.drawdownMinS} onChange={(v) => up((s) => void (s.targets.drawdownMinS = v ?? 0))} suffix="s" />
          </Field>
          <Field label="Drawdown max" changed={c('targets.drawdownMaxS')} hint={mmss(spec.targets.drawdownMaxS)}>
            <NumberInput value={spec.targets.drawdownMaxS} onChange={(v) => up((s) => void (s.targets.drawdownMaxS = v ?? 0))} suffix="s" />
          </Field>
          <Field label="TDS min">
            <NumberInput value={spec.targets.tdsMin} step={0.01} onChange={(v) => up((s) => void (s.targets.tdsMin = v ?? 0))} suffix="%" />
          </Field>
          <Field label="TDS max">
            <NumberInput value={spec.targets.tdsMax} step={0.01} onChange={(v) => up((s) => void (s.targets.tdsMax = v ?? 0))} suffix="%" />
          </Field>
          <Field label="EY min">
            <NumberInput value={spec.targets.eyMin} step={0.1} onChange={(v) => up((s) => void (s.targets.eyMin = v ?? 0))} suffix="%" />
          </Field>
          <Field label="EY max">
            <NumberInput value={spec.targets.eyMax} step={0.1} onChange={(v) => up((s) => void (s.targets.eyMax = v ?? 0))} suffix="%" />
          </Field>
        </div>
      </Card>
    </div>
  );
}
