import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cx } from './ui';

export type FlipTone = 'ink' | 'accent' | 'bad';

const FALL = 0.28; // seconds for each half of the flip

/**
 * Split-flap card. When `value` changes, the old top half folds down (revealing the new top),
 * then the new bottom half swings down over the old bottom — like a Solari board / flip clock.
 * Size is driven by font-size (everything is in em).
 */
export function FlipCard({ value, tone = 'ink', className }: { value: string; tone?: FlipTone; className?: string }) {
  const reduce = useReducedMotion();
  // Track the previous value during render (not in an effect) so there's no one-frame flash of the new bottom.
  const [s, setS] = useState({ value, from: value, id: 0 });
  if (s.value !== value) setS({ value, from: s.value, id: s.id + 1 });
  const flipping = !reduce && s.from !== s.value;
  const done = () => setS((x) => (x.id === s.id ? { ...x, from: x.value } : x));

  return (
    <span className={cx('flip', `flip-${tone}`, className)} aria-label={value} role="img">
      {/* sizer: gives the card its width */}
      <span className="flip-sizer" aria-hidden>
        {value}
      </span>
      {/* static halves: new top behind, old bottom until covered */}
      <span className="flip-half flip-top" aria-hidden>
        <span>{s.value}</span>
      </span>
      <span className="flip-half flip-bottom" aria-hidden>
        <span>{flipping ? s.from : s.value}</span>
      </span>
      {flipping && (
        <>
          <motion.span
            key={`t${s.id}`}
            className="flip-half flip-top flip-flap"
            initial={{ rotateX: 0, filter: 'brightness(1)' }}
            animate={{ rotateX: -90, filter: 'brightness(0.55)' }}
            transition={{ duration: FALL, ease: 'easeIn' }}
            aria-hidden
          >
            <span>{s.from}</span>
          </motion.span>
          <motion.span
            key={`b${s.id}`}
            className="flip-half flip-bottom flip-flap"
            initial={{ rotateX: 90, filter: 'brightness(1.6)' }}
            animate={{ rotateX: 0, filter: 'brightness(1)' }}
            transition={{ duration: FALL, delay: FALL, ease: [0.3, 1.4, 0.6, 1] }}
            onAnimationComplete={done}
            aria-hidden
          >
            <span>{s.value}</span>
          </motion.span>
        </>
      )}
    </span>
  );
}

/** A labelled flip card, e.g. "17" over "Hours". */
export function FlipUnit({ value, label, tone }: { value: string; label?: string; tone?: FlipTone }) {
  return (
    <span className="inline-flex flex-col items-center">
      <FlipCard value={value} tone={tone} />
      {label && <span className="mt-2 font-sans text-xs font-medium text-ink-faint" style={{ fontSize: 12 }}>{label}</span>}
    </span>
  );
}
