import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Pour, Sensory, Targets } from '../types';
import { SENSORY_KEYS } from '../lib/defaults';
import { mmss } from '../lib/time';

/** Validated on white (all-pairs CVD + normal-vision); identity also carried by A/B/C labels, legend and table. */
export const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
export const SERIES = ['#0094A3', '#E8590C', '#7048E8'];
export const SERIES_LABEL = ['A', 'B', 'C'];
export const ACCENT = '#0094A3'; // dripper teal, chart-weight (UI text uses accent #007A87)
export const AXIS = '#86868B';
export const GRID = '#EFEFF2';

export const tooltipStyle = {
  contentStyle: {
    background: '#FFFFFF',
    border: '1px solid #E5E5EA',
    borderRadius: 12,
    fontFamily: SF,
    fontSize: 12,
    color: '#1D1D1F',
  },
  labelStyle: { color: '#6E6E73' },
  itemStyle: { color: '#1D1D1F' },
  cursor: { stroke: '#C7C7CC', strokeWidth: 1 },
};

export const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11, fontFamily: SF },
  tickLine: false,
  axisLine: { stroke: GRID },
};

export const useChartAnim = () => {
  const reduce = useReducedMotion();
  return { isAnimationActive: !reduce, animationDuration: 1200, animationEasing: 'ease-out' as const };
};

// ---------- Radar ----------
export function SensoryRadar({
  series,
  height = 280,
}: {
  series: { name: string; data: Sensory; color?: string }[];
  height?: number;
}) {
  const anim = useChartAnim();
  const data = SENSORY_KEYS.map((k) => {
    const row: Record<string, string | number> = { attr: k[0].toUpperCase() + k.slice(1) };
    series.forEach((s, i) => (row[`s${i}`] = s.data[k]));
    return row;
  });
  const single = series.length === 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="attr" tick={{ fill: '#6E6E73', fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={false} axisLine={false} />
        {series.map((s, i) => {
          const color = s.color ?? (single ? ACCENT : SERIES[i]);
          return (
            <Radar
              key={i}
              name={s.name}
              dataKey={`s${i}`}
              stroke={color}
              strokeWidth={2}
              fill={color}
              fillOpacity={single ? 0.22 : 0.12}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              {...anim}
              animationDuration={800}
            />
          );
        })}
        <Tooltip {...tooltipStyle} cursor={false} />
        {!single && (
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            formatter={(value) => <span style={{ color: '#6E6E73' }}>{value}</span>}
          />
        )}
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ---------- Pour curve ----------
export function pourCurvePoints(pours: Pour[], drawdownS?: number | null) {
  const sorted = [...pours].sort((a, b) => a.timeS - b.timeS);
  const pts: { t: number; w: number }[] = [{ t: 0, w: 0 }];
  let w = 0;
  sorted.forEach((p, i) => {
    const next = sorted[i + 1];
    // Pour duration: from rate if set, else assume ~10 s or until next pour.
    const amount = Math.max(0, p.targetWeightG - w);
    let dur = p.rateGps && p.rateGps > 0 ? amount / p.rateGps : Math.min(10, amount / 5);
    if (next) dur = Math.min(dur, Math.max(1, next.timeS - p.timeS - 1));
    if (p.timeS > 0 || i > 0) pts.push({ t: p.timeS, w });
    w = p.targetWeightG;
    pts.push({ t: Math.round(p.timeS + dur), w });
  });
  const lastPourEnd = pts[pts.length - 1].t;
  const end = Math.max(drawdownS ?? 0, (sorted.at(-1)?.timeS ?? 0) + 30, lastPourEnd + 20);
  pts.push({ t: end, w });
  return pts;
}

export function PourCurve({
  pours,
  targets,
  drawdownS,
  height = 220,
  compact,
}: {
  pours: Pour[];
  targets?: Targets;
  drawdownS?: number | null;
  height?: number;
  compact?: boolean;
}) {
  const anim = useChartAnim();
  const pts = useMemo(() => pourCurvePoints(pours, drawdownS), [pours, drawdownS]);
  const key = pts.map((p) => `${p.t}:${p.w}`).join('|');
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart key={key} data={pts} margin={{ top: 22, right: 12, bottom: 0, left: compact ? 8 : -8 }}>
        <defs>
          <linearGradient id="pourFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} tickFormatter={(v) => mmss(v)} {...axisProps} />
        <YAxis {...axisProps} unit="g" width={48} hide={compact} />
        {targets && (
          <>
            <ReferenceLine x={targets.drawdownMinS} stroke="#C7C7CC" strokeDasharray="4 4" />
            <ReferenceLine
              x={targets.drawdownMaxS}
              stroke="#C7C7CC"
              strokeDasharray="4 4"
              label={compact ? undefined : { value: 'target drawdown', fill: AXIS, fontSize: 10, position: 'insideTopRight' }}
            />
          </>
        )}
        {drawdownS != null && <ReferenceLine x={drawdownS} stroke="#F08C00" strokeWidth={2} label={{ value: mmss(drawdownS), fill: '#B25E00', fontSize: 11, position: 'top' }} />}
        <Tooltip {...tooltipStyle} labelFormatter={(v) => mmss(Number(v))} formatter={(v) => [`${v} g`, 'water']} />
        <Area type="linear" dataKey="w" stroke={ACCENT} strokeWidth={2} fill="url(#pourFill)" dot={false} activeDot={{ r: 5, fill: ACCENT }} {...anim} animationDuration={1600} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------- Temperature gauge ----------
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const tempColor = (c: number) => {
  // 80°C system blue → 88 system orange → 96 system red
  const t = Math.min(1, Math.max(0, (c - 80) / 16));
  const stops = [
    [10, 132, 255],
    [255, 159, 10],
    [255, 59, 48],
  ];
  const [a, b, k] = t < 0.5 ? [stops[0], stops[1], t / 0.5] : [stops[1], stops[2], (t - 0.5) / 0.5];
  return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
};

export function TempGauge({ tempC, hint }: { tempC: number; hint?: [number, number] | null }) {
  const reduce = useReducedMotion();
  const min = 80;
  const max = 100;
  const pct = Math.min(1, Math.max(0, (tempC - min) / (max - min)));
  const tubeTop = 14;
  const tubeH = 150;
  const fillH = tubeH * pct;
  const color = tempColor(tempC);
  const band = hint
    ? { y: tubeTop + tubeH * (1 - (hint[1] - min) / (max - min)), h: (tubeH * (hint[1] - hint[0])) / (max - min) }
    : null;
  const t = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 60, damping: 14 };
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 70 210" className="h-48 w-16 shrink-0" role="img" aria-label={`Water temperature ${tempC} °C`}>
        {band && <rect x={6} y={band.y} width={58} height={band.h} rx={3} fill={ACCENT} opacity={0.12} />}
        <rect x={26} y={tubeTop - 4} width={18} height={tubeH + 20} rx={9} fill="#F5F5F7" stroke="#E5E5EA" strokeWidth={1} />
        <motion.rect
          x={30}
          width={10}
          rx={5}
          initial={{ y: tubeTop + tubeH + 10, height: 0, fill: tempColor(min) }}
          animate={{ y: tubeTop + tubeH - fillH, height: fillH + 12, fill: color }}
          transition={t}
        />
        <motion.circle cx={35} cy={188} r={12} initial={{ fill: tempColor(min) }} animate={{ fill: color }} transition={t} stroke="#FFFFFF" strokeWidth={2} />
        {[80, 85, 90, 95, 100].map((v) => {
          const y = tubeTop + tubeH * (1 - (v - min) / (max - min));
          return (
            <g key={v}>
              <line x1={46} x2={52} y1={y} y2={y} stroke="#C7C7CC" />
              <text x={54} y={y + 3} fontSize={8} fill="#86868B" fontFamily={SF}>
                {v}
              </text>
            </g>
          );
        })}
      </svg>
      <div>
        <motion.div key={tempC} initial={reduce ? false : { opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="font-display text-5xl text-ink">
          {tempC}
          <span className="text-xl text-ink-faint">°C</span>
        </motion.div>
        {hint && (
          <div className="mt-1 text-xs text-ink-muted">
            Roast hint <span className="num text-accent">{hint[0]}–{hint[1]}°C</span>
            {(tempC < hint[0] || tempC > hint[1]) && <span className="ml-1 text-warn">· outside</span>}
          </div>
        )}
      </div>
    </div>
  );
}
