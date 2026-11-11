import type { RecipeSpec, Step, StepKind } from '../types';
import { mmss } from './time';

export const STEP_KINDS: { kind: StepKind; label: string }[] = [
  { kind: 'pour', label: 'Pour' },
  { kind: 'swirl', label: 'Swirl' },
  { kind: 'stir', label: 'Stir' },
  { kind: 'wait', label: 'Wait' },
  { kind: 'other', label: 'Other' },
];

/** Older data has no `kind` — every such entry is a pour. */
export const stepKind = (s: Step): StepKind => s.kind ?? 'pour';
export const isPour = (s: Step) => stepKind(s) === 'pour';

/** Display name: "Pour", "Swirl", … or the custom label for 'other'. */
export const stepName = (s: Step) => {
  const k = stepKind(s);
  if (k === 'other') return s.label?.trim() || 'Other';
  return STEP_KINDS.find((x) => x.kind === k)!.label;
};

export const sortedSteps = (steps: Step[]) => [...steps].sort((a, b) => a.timeS - b.timeS);
export const poursOf = (steps: Step[]) => sortedSteps(steps).filter(isPour);

/** Water temperature for a pour: its own when varying temps, otherwise the default. */
export const pourTemp = (spec: Pick<RecipeSpec, 'params'>, s: Step) =>
  spec.params.varyTemp && s.tempC != null && Number.isFinite(s.tempC) ? s.tempC : spec.params.tempC;

/** Bloom = the first pour; its length = time until the next pour. */
export const bloomInfo = (steps: Step[]) => {
  const pours = poursOf(steps);
  if (!pours.length) return null;
  const first = pours[0];
  const next = pours[1];
  return { grams: first.targetWeightG, timeS: next ? next.timeS - first.timeS : null };
};

/** Mutates `spec.params.bloomG/bloomTimeS` to match the steps (kept for exports and older readers). */
export const syncBloom = <T extends RecipeSpec>(spec: T): T => {
  const b = bloomInfo(spec.pourSchedule);
  spec.params.bloomG = b?.grams ?? 0;
  spec.params.bloomTimeS = b?.timeS ?? 0;
  return spec;
};

/** Scale weight after the last pour (cumulative targets). */
export const totalPoured = (steps: Step[]) => poursOf(steps).at(-1)?.targetWeightG ?? 0;

/** Distinct pour temperatures in order of use — e.g. [70, 95] → "switch kettle" moments. */
export const pourTemps = (spec: RecipeSpec) => poursOf(spec.pourSchedule).map((p) => pourTemp(spec, p));

/** Compact one-line signature used for diffs, Compare and CSV. */
export const stepSig = (spec: RecipeSpec) =>
  sortedSteps(spec.pourSchedule)
    .map((s) => {
      if (isPour(s)) {
        const t = spec.params.varyTemp ? ` @${pourTemp(spec, s)}°` : '';
        return `${mmss(s.timeS)}→${s.targetWeightG}g${t}`;
      }
      const d = s.durationS ? ` ${s.durationS}s` : '';
      return `${mmss(s.timeS)} ${stepName(s).toLowerCase()}${d}`;
    })
    .join(' · ');

/** A sensible next step: 30 s after the last one; pours add 50 g on top of the last pour. */
export const newStep = (steps: Step[], kind: StepKind = 'pour', defaultTemp?: number): Step => {
  const sorted = sortedSteps(steps);
  const last = sorted.at(-1);
  const lastPour = poursOf(steps).at(-1);
  const base: Step = { timeS: last ? last.timeS + 30 : 0, kind, targetWeightG: 0, rateGps: null, technique: '' };
  if (kind === 'pour') return { ...base, targetWeightG: (lastPour?.targetWeightG ?? 0) + 50, tempC: lastPour?.tempC ?? defaultTemp ?? null };
  return { ...base, durationS: null, label: kind === 'other' ? '' : undefined };
};
