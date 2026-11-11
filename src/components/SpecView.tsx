import type { RecipeSpec } from '../types';
import { SPEC_FIELDS, brewRatio, changedPaths, fmtField, getPath, overallRatio, ratioLabel } from '../lib/calc';
import { mmss } from '../lib/time';
import { isPour, pourTemp, sortedSteps, stepName } from '../lib/steps';
import { cx } from './ui';

export function SpecView({ spec, baseline }: { spec: RecipeSpec; baseline?: RecipeSpec }) {
  const ch = changedPaths(baseline, spec);
  const groups = ['Coffee', 'Equipment', 'Params', 'Targets'] as const;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
        <span>
          Origin <span className="text-ink">{spec.coffee.origin || '—'}</span>
        </span>
        <span>
          Varietals <span className="text-ink">{spec.coffee.varietals || '—'}</span>
        </span>
        <span>
          Ratio <span className="num text-ink">{ratioLabel(brewRatio(spec))}</span> brew ·{' '}
          <span className="num text-ink">{ratioLabel(overallRatio(spec))}</span> overall
        </span>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g}>
            <h4 className="mb-2 text-xs font-medium text-ink-faint">{g}</h4>
            <dl className="divide-y divide-mist-700 rounded-2xl bg-mist-950">
              {SPEC_FIELDS.filter((f) => f.group === g).map((f) => {
                const changed = !!baseline && ch.has(f.path);
                return (
                  <div key={f.path} className={cx('flex items-center justify-between gap-3 px-3 py-2 text-sm', changed && 'bg-flag/10')}>
                    <dt className="text-ink-muted">{f.label}</dt>
                    <dd className={cx('num text-right', changed ? 'text-flag-soft' : 'text-ink')}>
                      {changed && <span className="mr-2 text-ink-faint line-through">{fmtField(f, getPath(baseline, f.path))}</span>}
                      {fmtField(f, getPath(spec, f.path))}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
      <div>
        <h4 className="mb-2 text-xs font-medium text-ink-faint">
          Steps {baseline && ch.has('pourSchedule') && <span className="ml-2 normal-case text-flag-soft">changed</span>}
          {spec.params.varyTemp && <span className="ml-2 font-normal text-ink-faint">· temperature varies by pour</span>}
        </h4>
        <ol className="grid gap-2 sm:grid-cols-2">
          {sortedSteps(spec.pourSchedule).map((p, i) =>
            isPour(p) ? (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-mist-950 px-4 py-2.5 text-sm">
                <span className="num w-12 text-accent">{mmss(p.timeS)}</span>
                <span className="num w-16 text-ink">→ {p.targetWeightG} g</span>
                {spec.params.varyTemp && <span className="num text-xs font-medium text-ink">{pourTemp(spec, p)}°C</span>}
                {p.rateGps ? <span className="num text-xs text-ink-faint">{p.rateGps} g/s</span> : null}
                <span className="truncate text-ink-muted">{p.technique}</span>
              </li>
            ) : (
              <li key={i} className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm ring-1 ring-inset ring-mist-700">
                <span className="num w-12 text-ink-muted">{mmss(p.timeS)}</span>
                <span className="font-medium text-ink">{stepName(p)}</span>
                {p.durationS ? <span className="num text-xs text-ink-faint">{p.durationS} s</span> : null}
                <span className="truncate text-ink-muted">{p.technique}</span>
              </li>
            ),
          )}
        </ol>
      </div>
    </div>
  );
}
