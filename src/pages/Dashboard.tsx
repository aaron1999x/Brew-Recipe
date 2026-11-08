import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { useStore } from '../data/store';
import { bestBrew, brewTitle, extractionYield, parseGrind, practiceDates, sortBrews } from '../lib/calc';
import { buildDemo } from '../lib/demo';
import { STARTER_SPEC } from '../lib/defaults';
import { navigate } from '../lib/router';
import { fmt, mmss } from '../lib/time';
import { ACCENT, axisProps, tooltipStyle, useChartAnim, GRID } from '../components/charts';
import { Badge, Button, Card, CountUp, Empty, Stat, useToast } from '../components/ui';

export const KEY_RULES = [
  ['3 min', 'prep — no grounds touching water'],
  ['6 min', 'competition time'],
  ['≥150 mL', 'whole brew submitted'],
  ['Bypass', 'allowed'],
  ['Multiple', 'extractions allowed'],
  ['Final', 'FM YODA grinder + 80 g mystery beans'],
];

export function KeyRulesCard({ delay = 0 }: { delay?: number }) {
  return (
    <Card title="Key rules" delay={delay} action={<a href="#/rules" className="text-sm text-accent hover:underline">Full rules ›</a>}>
      <ul className="divide-y divide-mist-700">
        {KEY_RULES.map(([k, v]) => (
          <li key={k} className="flex items-baseline gap-4 py-2.5 first:pt-0 last:pb-0">
            <span className="num w-20 shrink-0 text-[15px] font-semibold text-ink">{k}</span>
            <span className="text-[15px] text-ink-muted">{v}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Dashboard() {
  const { db, importData } = useStore();
  const toast = useToast();
  const anim = useChartAnim();
  const brews = useMemo(() => sortBrews(db.brews), [db.brews]);
  const days = practiceDates(brews);
  const used = brews.reduce((s, b) => s + (b.spec.params.doseG || 0), 0);
  const remaining = db.settings.beanBudgetG - used;
  const best = bestBrew(brews);
  const targets = (db.recipes.find((r) => r.id === db.settings.defaultRecipeId) ?? db.recipes[0])?.targets ?? STARTER_SPEC.targets;

  const grindPts = brews
    .map((b) => ({ x: parseGrind(b.spec.params.grindSetting), y: b.results.drawdownS, name: brewTitle(b, db.brews) }))
    .filter((p) => p.x != null && p.y != null);
  const overallPts = brews.map((b, i) => ({ i: i + 1, overall: b.sensory.overall, name: brewTitle(b, db.brews), date: fmt(b.dateTime, 'd MMM') }));
  const tdsPts = brews
    .map((b) => ({ x: extractionYield(b), y: b.results.tdsPct, name: brewTitle(b, db.brews) }))
    .filter((p) => p.x != null && p.y != null)
    .map((p) => ({ ...p, x: Number(p.x!.toFixed(2)) }));

  const loadDemo = () => {
    importData(buildDemo());
    toast('Demo data loaded — 2 days, 4 brews');
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Practice">
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-4">
            <Stat label="Practice days">
              <CountUp value={days.length} />
            </Stat>
            <Stat label="Brews logged">
              <CountUp value={brews.length} />
            </Stat>
            <Stat label="Beans left" sub={`of ${db.settings.beanBudgetG} g`}>
              <span className={remaining < 30 ? 'text-warn' : ''}>
                <CountUp value={remaining} decimals={0} />
              </span>
              <span className="text-base text-ink-faint"> g</span>
            </Stat>
            <Stat label="Best overall" sub={best ? <a className="hover:text-accent" href={`#/brews/${best.id}`}>{brewTitle(best, db.brews)}</a> : 'no brews yet'}>
              {best ? <CountUp value={best.sensory.overall} decimals={1} /> : '—'}
            </Stat>
          </div>
          <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-mist-800" aria-label="Practice beans used">
            <div
              className="h-full rounded-full bg-accent transition-all duration-1000"
              style={{ width: `${Math.min(100, (used / Math.max(1, db.settings.beanBudgetG)) * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-ink-faint">
            <span className="num">{used} g used</span>
            <span>practice beans</span>
          </div>
        </Card>
        <KeyRulesCard delay={0.08} />
      </div>

      {brews.length === 0 ? (
        <Empty
          title="No brews yet"
          hint="Log your first practice brew, or load demo data to see the trend charts. Press N anywhere to start a new brew."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => navigate('/brews/new')}>
                + New brew
              </Button>
              <Button onClick={loadDemo}>Load demo data</Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Grind vs drawdown" delay={0.12} action={<Badge>target {mmss(targets.drawdownMinS)}–{mmss(targets.drawdownMaxS)}</Badge>}>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 10, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis type="number" dataKey="x" name="Grind" domain={['dataMin - 0.3', 'dataMax + 0.3']} tickFormatter={(v) => Number(v).toFixed(1)} {...axisProps} />
                <YAxis type="number" dataKey="y" name="Drawdown" tickFormatter={(v) => mmss(v)} domain={['dataMin - 20', 'dataMax + 20']} width={48} {...axisProps} />
                <ZAxis range={[90, 90]} />
                <ReferenceArea y1={targets.drawdownMinS} y2={targets.drawdownMaxS} fill={ACCENT} fillOpacity={0.08} stroke={ACCENT} strokeOpacity={0.25} strokeDasharray="4 4" />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v, n) => (n === 'Drawdown' ? [mmss(Number(v)), n] : [v, n])}
                  labelFormatter={() => ''}
                />
                <Scatter data={grindPts} fill={ACCENT} stroke="#FFFFFF" strokeWidth={2} {...anim} />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="mt-1 text-xs text-ink-faint">Shaded band = target drawdown. Coarser grind (higher number) → faster drawdown.</p>
          </Card>

          <Card title="Overall score over time" delay={0.16}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={overallPts} margin={{ top: 10, right: 12, bottom: 4, left: -20 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="i" {...axisProps} tickFormatter={(v) => `#${v}`} />
                <YAxis domain={[0, 10]} {...axisProps} width={40} />
                <Tooltip {...tooltipStyle} labelFormatter={(_, p) => (p?.[0]?.payload?.name as string) ?? ''} formatter={(v) => [v, 'overall']} />
                <Line type="monotone" dataKey="overall" stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT, stroke: '#FFFFFF', strokeWidth: 2 }} activeDot={{ r: 6 }} {...anim} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Brew control chart" delay={0.2} className="lg:col-span-2" action={<Badge tone="accent">TDS {targets.tdsMin}–{targets.tdsMax}% · EY {targets.eyMin}–{targets.eyMax}%</Badge>}>
            {tdsPts.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">Log TDS readings on your brews to plot them here.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: -4 }}>
                  <CartesianGrid stroke={GRID} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="EY"
                    unit="%"
                    domain={[Math.min(16, ...tdsPts.map((p) => p.x)), Math.max(24, ...tdsPts.map((p) => p.x))]}
                    label={{ value: 'Extraction yield %', fill: '#86868B', fontSize: 11, position: 'insideBottom', offset: -10 }}
                    {...axisProps}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="TDS"
                    unit="%"
                    domain={[Math.min(1.15, ...tdsPts.map((p) => p.y!)), Math.max(1.65, ...tdsPts.map((p) => p.y!))]}
                    tickFormatter={(v) => Number(v).toFixed(2)}
                    width={56}
                    {...axisProps}
                  />
                  <ZAxis range={[100, 100]} />
                  <ReferenceArea x1={targets.eyMin} x2={targets.eyMax} y1={targets.tdsMin} y2={targets.tdsMax} fill={ACCENT} fillOpacity={0.12} stroke={ACCENT} strokeOpacity={0.6} label={{ value: 'target', fill: ACCENT, fontSize: 11, position: 'insideTopLeft' }} />
                  <Tooltip {...tooltipStyle} labelFormatter={() => ''} />
                  <Scatter data={tdsPts} fill={ACCENT} stroke="#FFFFFF" strokeWidth={2} {...anim} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
