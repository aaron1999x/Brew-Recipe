import { Fragment, useMemo } from 'react';
import type { Brew } from '../types';
import { useStore } from '../data/store';
import { SENSORY_KEYS } from '../lib/defaults';
import { SPEC_FIELDS, brewRatio, brewTitle, extractionYield, fmtField, getPath, overallRatio, pourSig, ratioLabel, sortBrews } from '../lib/calc';
import { navigate } from '../lib/router';
import { fmt, mmss } from '../lib/time';
import { SERIES, SERIES_LABEL, SensoryRadar } from '../components/charts';
import { Button, Card, Empty, PageTitle, cx } from '../components/ui';

interface Row {
  label: string;
  get: (b: Brew) => string;
  group: string;
}

const rows: Row[] = [
  ...SPEC_FIELDS.map((f) => ({ label: f.label, group: f.group, get: (b: Brew) => fmtField(f, getPath(b.spec, f.path)) })),
  { label: 'Steps', group: 'Steps', get: (b) => pourSig(b.spec) },
  { label: 'Brew ratio', group: 'Results', get: (b) => ratioLabel(brewRatio(b.spec)) },
  { label: 'Overall ratio', group: 'Results', get: (b) => ratioLabel(overallRatio(b.spec)) },
  { label: 'Drawdown', group: 'Results', get: (b) => mmss(b.results.drawdownS) },
  { label: 'Beverage (g)', group: 'Results', get: (b) => (b.results.beverageG == null ? '—' : String(b.results.beverageG)) },
  { label: 'Final (g)', group: 'Results', get: (b) => (b.results.finalG == null ? '—' : String(b.results.finalG)) },
  { label: 'TDS %', group: 'Results', get: (b) => (b.results.tdsPct == null ? '—' : String(b.results.tdsPct)) },
  { label: 'EY %', group: 'Results', get: (b) => extractionYield(b)?.toFixed(2) ?? '—' },
  ...SENSORY_KEYS.map((k) => ({ label: k[0].toUpperCase() + k.slice(1), group: 'Sensory', get: (b: Brew) => b.sensory[k].toFixed(1) })),
  { label: 'Flavours', group: 'Sensory', get: (b) => b.flavours.join(', ') || '—' },
];

export function ComparePage({ query }: { query: URLSearchParams }) {
  const { db } = useStore();
  const ids = (query.get('ids') ?? '').split(',').filter(Boolean);
  const all = useMemo(() => sortBrews(db.brews).reverse(), [db.brews]);
  const picked = ids.map((id) => db.brews.find((b) => b.id === id)).filter(Boolean) as Brew[];

  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-3);
    navigate(`/compare?ids=${next.join(',')}`);
  };

  if (db.brews.length < 2)
    return (
      <div>
        <PageTitle title="Compare" />
        <Empty title="Need at least two brews" hint="Log a couple of brews (or load demo data in Settings) to compare them side by side." action={<Button onClick={() => navigate('/brews/new')}>+ New brew</Button>} />
      </div>
    );

  return (
    <div>
      <PageTitle title="Compare" subtitle="Pick 2–3 brews. Rows that differ are highlighted." />
      <div className="scroll-thin -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {all.map((b) => {
          const idx = ids.indexOf(b.id);
          const on = idx >= 0;
          return (
            <button
              key={b.id}
              onClick={() => toggle(b.id)}
              className={cx(
                'flex h-12 shrink-0 items-center gap-2 rounded-xl border px-3 text-left text-sm transition',
                on ? 'border-ink/40 bg-mist-800 text-ink' : 'border-mist-600 text-ink-muted hover:border-mist-500',
              )}
            >
              {on && (
                <span className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white" style={{ background: SERIES[idx] }}>
                  {SERIES_LABEL[idx]}
                </span>
              )}
              <span>
                <span className="block leading-tight">{brewTitle(b, db.brews)}</span>
                <span className="num text-[11px] text-ink-faint">overall {b.sensory.overall.toFixed(1)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {picked.length < 2 ? (
        <Empty title="Pick another brew" hint="Select at least two brews above to overlay their sensory profiles." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
          <Card title="Sensory overlay" className="xl:sticky xl:top-24 xl:self-start">
            <SensoryRadar series={picked.map((b, i) => ({ name: `${SERIES_LABEL[i]} · ${fmt(b.dateTime, 'd MMM HH:mm')}`, data: b.sensory }))} height={340} />
          </Card>
          <Card title="Side by side" delay={0.05}>
            <div className="scroll-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="pb-2 font-medium text-ink-faint" />
                    {picked.map((b, i) => (
                      <th key={b.id} className="pb-2 pl-3 font-medium">
                        <a href={`#/brews/${b.id}`} className="flex items-center gap-2 hover:text-accent">
                          <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: SERIES[i] }}>
                            {SERIES_LABEL[i]}
                          </span>
                          <span className="leading-tight">{brewTitle(b, db.brews)}</span>
                        </a>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => {
                    const vals = picked.map((b) => r.get(b));
                    const differs = new Set(vals).size > 1;
                    const newGroup = ri === 0 || rows[ri - 1].group !== r.group;
                    return (
                      <Fragment key={r.label}>
                        {newGroup && (
                          <tr>
                            <td colSpan={picked.length + 1} className="pb-1 pt-4 text-[11px] font-medium text-ink-faint">
                              {r.group}
                            </td>
                          </tr>
                        )}
                        <tr className={cx('border-t border-mist-800', differs && 'bg-flag/10')}>
                          <td className="py-1.5 pr-2 text-ink-muted">
                            {differs && <span className="mr-1 text-flag-soft">●</span>}
                            {r.label}
                          </td>
                          {vals.map((v, i) => (
                            <td key={i} className={cx('num py-1.5 pl-3', differs ? 'text-ink' : 'text-ink-muted')}>
                              {v}
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
