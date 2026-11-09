import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../data/store';
import { navigate } from '../lib/router';
import { mmss } from '../lib/time';
import { Button, cx } from '../components/ui';
import { FlipCard } from '../components/FlipClock';
import { allRecipes, findRecipe } from './Recipes';

const COMP_S = 360;
const PREP_S = 180;
const LEAD_S = 5; // "get ready" countdown before the brew clock starts

let audioCtx: AudioContext | null = null;
const beep = (freq = 880, ms = 140, times = 1) => {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audioCtx;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * (ms / 1000 + 0.08);
      o.frequency.value = freq;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + ms / 1000 + 0.02);
    }
  } catch {
    /* audio unavailable */
  }
};
const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* noop */
  }
};

type Phase = 'idle' | 'prep' | 'comp' | 'done';

export function TimerPage({ query, onExit }: { query: URLSearchParams; onExit: () => void }) {
  const { db } = useStore();
  const recipes = allRecipes(db.recipes);
  const [recipeId, setRecipeId] = useState(query.get('recipe') ?? db.settings.defaultRecipeId ?? recipes[0]?.id ?? '');
  const recipe = findRecipe(db.recipes, recipeId) ?? recipes[0];
  const pours = useMemo(() => [...(recipe?.pourSchedule ?? [])].sort((a, b) => a.timeS - b.timeS), [recipe]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [phaseStart, setPhaseStart] = useState(0);
  const [brewStart, setBrewStart] = useState<number | null>(null);
  /** When set, a LEAD_S "get ready" countdown is running before the brew clock starts. */
  const [leadStart, setLeadStart] = useState<number | null>(null);
  const [drawdown, setDrawdown] = useState<number | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [sound, setSound] = useState(true);
  const fired = useRef(new Set<string>());

  // tick
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return;
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // keep the screen awake while rehearsing
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (phase === 'prep' || phase === 'comp') nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [phase]);

  const phaseElapsed = phase === 'idle' ? 0 : (now - phaseStart) / 1000;
  const phaseTotal = phase === 'prep' ? PREP_S : COMP_S;
  const remaining = Math.max(0, phaseTotal - phaseElapsed);
  const brewElapsed = brewStart != null && drawdown == null ? (now - brewStart) / 1000 : drawdown;
  const leadLeft = leadStart != null ? LEAD_S - (now - leadStart) / 1000 : null;

  // The 0:00 pour (bloom) starts the moment the brew clock starts, so "next" is the first pour still ahead.
  const nextIdx = brewElapsed == null ? 0 : pours.findIndex((p) => p.timeS > brewElapsed);
  const current = brewElapsed == null ? null : [...pours].reverse().find((p) => p.timeS <= brewElapsed) ?? null;
  const next = nextIdx >= 0 ? pours[nextIdx] : null;
  const toNext = next && brewElapsed != null ? next.timeS - brewElapsed : null;

  const cue = useCallback(
    (key: string, kind: 'tick' | 'warn' | 'go' | 'end') => {
      if (fired.current.has(key)) return;
      fired.current.add(key);
      if (kind === 'tick') {
        if (sound) beep(880, 90, 1);
        buzz(60);
      } else if (kind === 'warn') {
        if (sound) beep(660, 120, 1);
        buzz(150);
      } else if (kind === 'go') {
        if (sound) beep(990, 160, 2);
        buzz([200, 80, 200]);
      } else {
        if (sound) beep(520, 400, 3);
        buzz([400, 100, 400]);
      }
    },
    [sound],
  );

  // pour cues
  useEffect(() => {
    if (brewElapsed == null || drawdown != null) return;
    pours.forEach((p, i) => {
      if (p.timeS > 0 && brewElapsed >= p.timeS - 5 && brewElapsed < p.timeS) cue(`w${i}`, 'warn');
      if (p.timeS > 0 && brewElapsed >= p.timeS && brewElapsed < p.timeS + 1) cue(`g${i}`, 'go');
    });
  }, [brewElapsed, pours, cue, drawdown]);

  // Brew clock starts exactly LEAD_S after the lead-in began (not "whenever the next frame lands").
  const launchBrew = useCallback(
    (at: number) => {
      setLeadStart(null);
      setBrewStart(at);
      cue(`go-${at}`, 'go');
    },
    [cue],
  );

  // lead-in ticks: 5 (on press) · 4 · 3 · 2 · 1 · go
  useEffect(() => {
    if (leadStart == null || leadLeft == null) return;
    for (let k = LEAD_S - 1; k >= 1; k--) if (leadLeft <= k) cue(`l${leadStart}-${k}`, 'tick');
    if (leadLeft <= 0) launchBrew(leadStart + LEAD_S * 1000);
  }, [leadStart, leadLeft, cue, launchBrew]);

  // phase transitions
  useEffect(() => {
    if (phase === 'prep' && remaining <= 0) {
      cue('prep-end', 'end');
      setPhase('comp');
      setPhaseStart(performance.now());
    } else if (phase === 'comp' && remaining <= 0) {
      cue('comp-end', 'end');
      setLeadStart(null);
      setPhase('done');
    } else if (phase !== 'idle' && remaining <= 30 && remaining > 29) {
      cue(`${phase}-30`, 'warn');
    }
  }, [phase, remaining, cue]);

  const start = (withPrep: boolean) => {
    beep(1, 1); // unlock audio on user gesture
    fired.current.clear();
    setDrawdown(null);
    setBrewStart(null);
    setPhase(withPrep ? 'prep' : 'comp');
    setPhaseStart(performance.now());
  };

  /** Begin the 5-second lead-in; the brew clock starts when it reaches zero. */
  const startBrew = () => {
    fired.current = new Set([...fired.current].filter((k) => !/^[wg]\d/.test(k)));
    setDrawdown(null);
    setBrewStart(null);
    const t = performance.now();
    setLeadStart(t);
    setNow(t);
    cue(`l${t}-${LEAD_S}`, 'tick');
  };

  const reset = () => {
    setPhase('idle');
    setBrewStart(null);
    setLeadStart(null);
    setDrawdown(null);
    fired.current.clear();
  };

  const urgent = phase === 'comp' && remaining <= 60;
  const warnSoon = toNext != null && toNext <= 5 && toNext > 0;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-mist-950">
      {/* top bar */}
      <div className="relative flex flex-wrap items-center gap-2 border-b border-black/5 bg-mist-950/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <span className="text-[15px] font-semibold tracking-[0.18em] text-ink">BLOOM</span>
        <span className="text-[13px] text-ink-muted">Rehearsal</span>
        <select
          value={recipe?.id ?? ''}
          disabled={phase !== 'idle'}
          onChange={(e) => setRecipeId(e.target.value)}
          className="order-last h-11 w-full rounded-xl border border-mist-600 bg-white px-3 text-[15px] text-ink disabled:opacity-60 sm:order-none sm:w-auto sm:min-w-0 sm:max-w-sm sm:flex-1"
        >
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.champion ? '★ ' : ''}
              {r.name}
            </option>
          ))}
        </select>
        <button onClick={() => setSound((s) => !s)} className="ml-auto h-9 rounded-full bg-mist-800 px-4 text-sm text-ink hover:bg-mist-700" aria-pressed={sound}>
          {sound ? 'Sound on' : 'Muted'}
        </button>
        <button onClick={onExit} className="h-9 rounded-full bg-mist-800 px-4 text-sm text-ink hover:bg-mist-700">
          Done
        </button>
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-6 px-4 py-6 sm:gap-8">
        {/* main clock */}
        <div className="text-center">
          <div className="text-[15px] font-medium text-ink-muted">
            {phase === 'idle' ? 'Ready' : phase === 'prep' ? 'Prep time · no grounds touching water' : phase === 'comp' ? 'Competition time' : 'Time'}
          </div>
          {(() => {
            const secs = phase === 'idle' ? COMP_S : phase === 'done' ? 0 : Math.ceil(remaining);
            const tone = urgent ? 'bad' : 'ink';
            return (
              <div className="mt-3 flex items-center justify-center gap-[0.12em] text-[19vw] sm:text-[136px]" aria-label={mmss(secs)}>
                <FlipCard value={String(Math.floor(secs / 60))} tone={tone} />
                <span className={cx('px-[0.04em] font-semibold leading-none', urgent ? 'text-bad' : 'text-ink')}>:</span>
                <FlipCard value={String(secs % 60).padStart(2, '0')} tone={tone} />
              </div>
            );
          })()}
          <div className="mx-auto mt-5 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-mist-800">
            <div className={cx('h-full', phase === 'prep' ? 'bg-flag' : 'bg-accent')} style={{ width: `${phase === 'idle' ? 0 : (phaseElapsed / phaseTotal) * 100}%` }} />
          </div>
        </div>

        {/* pour cue */}
        {phase === 'comp' || (phase === 'done' && drawdown != null) ? (
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-card p-5 text-center sm:p-8">
            {leadLeft != null ? (
              <div aria-live="assertive">
                <div className="text-[15px] font-medium text-ink-muted">Get ready · brew clock starts in</div>
                <div className="mt-3 text-[30vw] leading-none sm:text-[160px]">
                  <FlipCard value={String(Math.max(1, Math.ceil(leadLeft)))} tone="accent" />
                </div>
                <div className="mt-4 font-display text-2xl text-ink sm:text-3xl">
                  {pours[0]?.technique || 'First pour'} → <span className="num text-accent">{pours[0]?.targetWeightG ?? '—'} g</span>
                </div>
              </div>
            ) : brewStart == null ? (
              <>
                <div className="text-sm text-ink-muted">Brew clock not started</div>
                <div className="mt-1 font-display text-3xl">
                  First pour → <span className="num text-accent">{pours[0]?.targetWeightG ?? '—'} g</span>
                </div>
              </>
            ) : drawdown != null ? (
              <>
                <div className="text-sm text-ink-faint">Drawdown logged</div>
                <div className="num mt-1 text-7xl text-accent">{mmss(drawdown)}</div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3 text-sm text-ink-faint">
                  Brew clock <span className="num text-xl text-ink">{mmss(brewElapsed)}</span>
                  {current && <span className="normal-case tracking-normal">· pouring to {current.targetWeightG} g</span>}
                </div>
                <AnimatePresence mode="wait">
                  {next ? (
                    <motion.div key={nextIdx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mt-3">
                      <div className="text-sm text-ink-muted">Next pour at <span className="num text-ink">{mmss(next.timeS)}</span>{next.technique && ` · ${next.technique}`}</div>
                      <div className={cx('num mt-1 font-semibold leading-none transition-colors', warnSoon ? 'text-accent' : 'text-ink', 'text-[18vw] sm:text-[140px]')}>
                        {next.targetWeightG}
                        <span className="text-[0.35em] text-ink-faint"> g</span>
                      </div>
                      <div className={cx('num mt-2 text-3xl', warnSoon ? 'animate-pulse text-accent' : 'text-ink-muted')}>in {Math.max(0, Math.ceil(toNext ?? 0))} s</div>
                    </motion.div>
                  ) : (
                    <motion.div key="dd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                      <div className="font-display text-4xl text-ink sm:text-6xl">All poured</div>
                      <div className="mt-2 text-ink-muted">
                        Target drawdown <span className="num text-accent">{mmss(recipe?.targets.drawdownMinS)}–{mmss(recipe?.targets.drawdownMaxS)}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        ) : phase === 'idle' ? (
          <div className="w-full max-w-3xl">
            <div className="mb-3 text-center text-sm text-ink-muted">Pour schedule</div>
            <div className="flex flex-wrap justify-center gap-2">
              {pours.map((p, i) => (
                <div key={i} className="rounded-2xl bg-white px-5 py-3 text-center shadow-card">
                  <div className="num text-accent">{mmss(p.timeS)}</div>
                  <div className="num text-xl">{p.targetWeightG} g</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* controls */}
        <div className="flex w-full max-w-3xl flex-wrap justify-center gap-3">
          {phase === 'idle' && (
            <>
              <Button variant="primary" size="lg" className="min-w-[200px]" onClick={() => start(false)}>
                Start 6:00
              </Button>
              <Button size="lg" onClick={() => start(true)}>
                3:00 prep → 6:00
              </Button>
            </>
          )}
          {phase === 'prep' && (
            <Button size="lg" variant="primary" onClick={() => (setPhase('comp'), setPhaseStart(performance.now()))}>
              Skip to competition
            </Button>
          )}
          {phase === 'comp' && brewStart == null && leadStart == null && (
            <Button variant="primary" size="lg" className="h-20 min-w-[260px] text-xl" onClick={startBrew}>
              ▶ Start brew (bloom)
            </Button>
          )}
          {leadStart != null && (
            <Button size="lg" className="h-20 min-w-[200px] text-xl" onClick={() => launchBrew(performance.now())}>
              Skip · start now
            </Button>
          )}
          {(phase === 'comp' || phase === 'done') && brewStart != null && drawdown == null && (
            <Button variant="primary" size="lg" className="h-20 min-w-[260px] text-xl" onClick={() => setDrawdown(Math.round(((performance.now() - brewStart) / 1000) * 10) / 10)}>
              ■ Drawdown done
            </Button>
          )}
          {drawdown != null && (
            <>
              <Button variant="primary" size="lg" className="h-16" onClick={() => navigate(`/brews/new?recipe=${recipe?.id ?? ''}&drawdown=${Math.round(drawdown)}`)}>
                Log this brew →
              </Button>
              {phase === 'comp' && (
                <Button size="lg" className="h-16" onClick={startBrew}>
                  Another extraction
                </Button>
              )}
            </>
          )}
          {phase !== 'idle' && (
            <Button size="lg" variant="ghost" onClick={reset}>
              Reset
            </Button>
          )}
        </div>
        <p className="text-center text-xs text-ink-faint">
          {LEAD_S} s count-in before the brew clock. Beeps and vibrates 5 s before each pour. Screen stays awake while running.
        </p>
      </div>
    </div>
  );
}
