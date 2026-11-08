import { useState } from 'react';
import type { Pour, RecipeSpec, RoastLevel } from '../types';
import { DRIPPERS, PAPERS, ROAST_LEVELS, TEMP_HINT } from '../lib/defaults';
import { aquacode, brewRatio, changedPaths, overallRatio, ratioLabel } from '../lib/calc';
import { mmss, parseMmss } from '../lib/time';
import { Button, Card, Field, NumberInput, Select, TextInput, cx } from './ui';
import { PourCurve, TempGauge } from './charts';

type Updater = (fn: (s: RecipeSpec) => void) => void;

export function useSpecUpdater(spec: RecipeSpec, onChange: (s: RecipeSpec) => void): Updater {
  return (fn) => {
    const next = structuredClone(spec);
    fn(next);
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

export function PourScheduleEditor({ pours, onChange, changed }: { pours: Pour[]; onChange: (p: Pour[]) => void; changed?: boolean }) {
  const set = (i: number, patch: Partial<Pour>) => onChange(pours.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className={cx('space-y-2', changed && 'rounded-xl ring-1 ring-flag/50 p-2')}>
      <div className="hidden grid-cols-[90px_100px_90px_1fr_40px] gap-2 px-1 text-[11px] text-ink-faint sm:grid">
        <span>Time</span>
        <span>Target</span>
        <span>Rate</span>
        <span>Technique</span>
        <span />
      </div>
      {pours.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 rounded-2xl bg-mist-950 p-2 sm:bg-transparent sm:grid-cols-[90px_100px_90px_1fr_40px] sm:border-0 sm:p-0">
          <TimeInput value={p.timeS} onChange={(v) => set(i, { timeS: v })} />
          <NumberInput value={p.targetWeightG} onChange={(v) => set(i, { targetWeightG: v ?? 0 })} suffix="g" />
          <NumberInput value={p.rateGps ?? null} onChange={(v) => set(i, { rateGps: v })} suffix="g/s" step={0.5} placeholder="—" />
          <button
            onClick={() => onChange(pours.filter((_, j) => j !== i))}
            className="grid h-11 w-10 place-items-center rounded-xl text-ink-faint hover:bg-bad/10 hover:text-bad sm:order-last"
            aria-label="Remove pour"
          >
            ✕
          </button>
          <TextInput className="col-span-3 sm:col-span-1" value={p.technique} placeholder="Technique" onChange={(e) => set(i, { technique: e.target.value })} />
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          const last = pours.at(-1);
          onChange([...pours, { timeS: (last?.timeS ?? -30) + 30, targetWeightG: (last?.targetWeightG ?? 0) + 50, rateGps: null, technique: '' }]);
        }}
      >
        + Add pour
      </Button>
    </div>
  );
}

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
            <Field label="Temp" changed={c('params.tempC')} hint={hint ? `${spec.coffee.roastLevel}: ${hint[0]}–${hint[1]}°C` : undefined}>
              <NumberInput value={p.tempC} step={0.5} onChange={(v) => up((s) => void (s.params.tempC = v ?? 0))} suffix="°C" />
            </Field>
            <Field label="Grind" changed={c('params.grindSetting')}>
              <TextInput className="num" value={p.grindSetting} onChange={(e) => up((s) => void (s.params.grindSetting = e.target.value))} />
            </Field>
            <Field label="Water" changed={c('params.waterPpm')}>
              <NumberInput value={p.waterPpm} onChange={(v) => up((s) => void (s.params.waterPpm = v ?? 0))} suffix="ppm" />
            </Field>
            <Field label="Bloom" changed={c('params.bloomG')}>
              <NumberInput value={p.bloomG} onChange={(v) => up((s) => void (s.params.bloomG = v ?? 0))} suffix="g" />
            </Field>
            <Field label="Bloom time" changed={c('params.bloomTimeS')}>
              <NumberInput value={p.bloomTimeS} onChange={(v) => up((s) => void (s.params.bloomTimeS = v ?? 0))} suffix="s" />
            </Field>
          </div>
          <div className="flex justify-center rounded-2xl bg-mist-950 px-6 py-3">
            <TempGauge tempC={p.tempC} hint={hint} />
          </div>
        </div>
        <div className="mt-5">
          <WaterCalc ppm={p.waterPpm} />
        </div>
      </Card>

      <Card title="Pour schedule">
        <div className="grid gap-5 lg:grid-cols-2">
          <PourScheduleEditor pours={spec.pourSchedule} changed={c('pourSchedule')} onChange={(ps) => up((s) => void (s.pourSchedule = ps))} />
          <div>
            <PourCurve pours={spec.pourSchedule} targets={spec.targets} />
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
