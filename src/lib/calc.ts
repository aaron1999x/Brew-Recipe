import type { Brew, PracticeDay, Recipe, RecipeSpec } from '../types';
import { AQUACODE_STOCK_PPM } from './defaults';
import { dateKey, fmt, mmss } from './time';

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const overallRatio = (s: RecipeSpec) =>
  s.params.doseG > 0 ? (s.params.brewWaterG + (s.params.bypassG || 0)) / s.params.doseG : null;

export const brewRatio = (s: RecipeSpec) => (s.params.doseG > 0 ? s.params.brewWaterG / s.params.doseG : null);

export const extractionYield = (b: Pick<Brew, 'results' | 'spec'>) => {
  const tds = num(b.results.tdsPct);
  const fin = num(b.results.finalG);
  const dose = b.spec.params.doseG;
  if (tds == null || fin == null || !dose) return null;
  return (tds * fin) / dose;
};

export type SubmissionState = 'pass' | 'warn' | 'fail' | 'unknown';
export const submissionState = (finalG: number | null | undefined): SubmissionState => {
  if (finalG == null || !Number.isFinite(finalG)) return 'unknown';
  if (finalG < 150) return 'fail';
  if (finalG < 175) return 'warn';
  return 'pass';
};

export const ratioLabel = (r: number | null) => (r == null ? '—' : `1:${r.toFixed(1)}`);

export const aquacode = (targetPpm: number) => {
  const conc = (targetPpm / AQUACODE_STOCK_PPM) * 1000;
  return { concentrateG: conc, distilledG: Math.max(0, 1000 - conc) };
};

export const parseGrind = (g: string) => {
  const m = String(g).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** Sorted unique practice dates (KL). */
export const practiceDates = (brews: Brew[]) =>
  Array.from(new Set(brews.map((b) => dateKey(b.dateTime)))).sort();

export const dayNumber = (brew: Pick<Brew, 'dateTime'>, brews: Brew[]) => {
  const dates = practiceDates(brews);
  const key = dateKey(brew.dateTime);
  const idx = dates.indexOf(key);
  if (idx >= 0) return idx + 1;
  // brew not yet in list: count dates before it + 1
  return dates.filter((d) => d < key).length + 1;
};

export const autoTitle = (brew: Pick<Brew, 'dateTime'>, brews: Brew[]) =>
  `Day ${dayNumber(brew, brews)} · ${fmt(brew.dateTime, 'EEE d MMM · HH:mm')}`;

export const brewTitle = (brew: Brew, brews: Brew[]) =>
  brew.customTitle && brew.title ? brew.title : autoTitle(brew, brews);

export const sortBrews = (brews: Brew[]) =>
  [...brews].sort((a, b) => a.dateTime.localeCompare(b.dateTime));

export const bestBrew = (brews: Brew[]) =>
  brews.reduce<Brew | null>((best, b) => (!best || b.sensory.overall > best.sensory.overall ? b : best), null);

export const specFromRecipe = (r: Recipe): RecipeSpec =>
  structuredClone({
    coffee: r.coffee,
    equipment: r.equipment,
    params: r.params,
    pourSchedule: r.pourSchedule,
    targets: r.targets,
  });

// ---------- Diffing ----------

export interface FieldDef {
  path: string;
  label: string;
  group: 'Coffee' | 'Equipment' | 'Params' | 'Targets';
  format?: (v: unknown) => string;
}

const g = (v: unknown) => (v == null || v === '' ? '—' : String(v));
const sec = (v: unknown) => mmss(typeof v === 'number' ? v : null);

export const SPEC_FIELDS: FieldDef[] = [
  { path: 'coffee.name', label: 'Coffee', group: 'Coffee' },
  { path: 'coffee.process', label: 'Process', group: 'Coffee' },
  { path: 'coffee.roastLevel', label: 'Roast level', group: 'Coffee' },
  { path: 'coffee.roastDate', label: 'Roast date', group: 'Coffee' },
  { path: 'coffee.agtron', label: 'Agtron', group: 'Coffee' },
  { path: 'equipment.dripper', label: 'Dripper', group: 'Equipment' },
  { path: 'equipment.paper', label: 'Paper', group: 'Equipment' },
  { path: 'equipment.grinder', label: 'Grinder', group: 'Equipment' },
  { path: 'params.doseG', label: 'Dose (g)', group: 'Params' },
  { path: 'params.brewWaterG', label: 'Brew water (g)', group: 'Params' },
  { path: 'params.bypassG', label: 'Bypass (g)', group: 'Params' },
  { path: 'params.tempC', label: 'Temp (°C)', group: 'Params' },
  { path: 'params.grindSetting', label: 'Grind', group: 'Params' },
  { path: 'params.waterPpm', label: 'Water (ppm)', group: 'Params' },
  { path: 'params.bloomG', label: 'Bloom (g)', group: 'Params' },
  { path: 'params.bloomTimeS', label: 'Bloom time', group: 'Params', format: sec },
  { path: 'targets.drawdownMinS', label: 'Target drawdown min', group: 'Targets', format: sec },
  { path: 'targets.drawdownMaxS', label: 'Target drawdown max', group: 'Targets', format: sec },
];

export const getPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

export const fmtField = (f: FieldDef, v: unknown) => (f.format ? f.format(v) : g(v));

export const pourSig = (s: RecipeSpec) =>
  s.pourSchedule.map((p) => `${mmss(p.timeS)}→${p.targetWeightG}g`).join(' · ');

export interface Diff {
  path: string;
  label: string;
  from: string;
  to: string;
}

export const diffSpecs = (base: RecipeSpec | undefined, cur: RecipeSpec): Diff[] => {
  if (!base) return [];
  const out: Diff[] = [];
  for (const f of SPEC_FIELDS) {
    const a = getPath(base, f.path);
    const b = getPath(cur, f.path);
    if (String(a ?? '') !== String(b ?? '')) out.push({ path: f.path, label: f.label, from: fmtField(f, a), to: fmtField(f, b) });
  }
  if (pourSig(base) !== pourSig(cur)) out.push({ path: 'pourSchedule', label: 'Pour schedule', from: pourSig(base), to: pourSig(cur) });
  return out;
};

export const changedPaths = (base: RecipeSpec | undefined, cur: RecipeSpec) =>
  new Set(diffSpecs(base, cur).map((d) => d.path));

export const findDay = (days: PracticeDay[], date: string) => days.find((d) => d.date === date && !d.deleted);
