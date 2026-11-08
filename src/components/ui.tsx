import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Card ----------
export function Card({
  children,
  className,
  title,
  action,
  delay = 0,
  glow,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  delay?: number;
  glow?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cx(
        'min-w-0 rounded-3xl bg-white p-5 shadow-card sm:p-7',
        glow && 'ring-1 ring-accent/10',
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-5 flex items-center justify-between gap-3">
          {title && <h3 className="font-display text-xl text-ink">{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </motion.section>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl text-ink sm:text-5xl">{title}</h1>
        {subtitle && <div className="mt-2 text-base text-ink-muted">{subtitle}</div>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

// ---------- Button ----------
type Variant = 'primary' | 'ghost' | 'outline' | 'danger' | 'quiet-danger';
export function Button({
  variant = 'outline',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25',
        size === 'sm' && 'h-9 px-4 text-sm',
        size === 'md' && 'h-11 px-5 text-[15px]',
        size === 'lg' && 'h-14 px-7 text-[17px]',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-soft',
        variant === 'outline' && 'bg-mist-800 text-ink hover:bg-mist-700',
        variant === 'ghost' && 'text-accent hover:bg-accent/5',
        variant === 'danger' && 'bg-bad text-white hover:bg-bad/90',
        variant === 'quiet-danger' && 'text-bad hover:bg-bad/5',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------- Inputs ----------
const inputBase =
  'w-full rounded-xl border border-mist-600 bg-white px-3.5 h-11 text-[15px] text-ink placeholder:text-ink-faint transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15';

export function Field({
  label,
  hint,
  changed,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  changed?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-ink-muted">
        {label}
        {changed && (
          <span className="rounded-full bg-flag/15 px-2 py-px text-[11px] font-semibold text-flag-soft">
            changed
          </span>
        )}
      </span>
      <div className={cx(changed && '[&_input]:border-flag/70 [&_select]:border-flag/70 [&_textarea]:border-flag/70')}>
        {children}
      </div>
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputBase, className)} />;
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  className,
  placeholder,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? '' : String(value));
  }, [value]);
  return (
    <div className={cx('relative', className)}>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(value == null ? '' : String(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const t = e.target.value.trim();
          if (t === '') return onChange(null);
          const n = Number(t);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={cx(inputBase, 'num', suffix && 'pr-10')}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-ink-faint">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  allowCustom,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  allowCustom?: boolean;
  className?: string;
}) {
  const list = allowCustom && value && !options.includes(value) ? [...options, value] : options;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputBase, 'appearance-none pr-8', className)}>
      {list.map((o) => (
        <option key={o} value={o} className="bg-mist-900">
          {o}
        </option>
      ))}
    </select>
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx(inputBase, 'h-auto py-2.5 leading-relaxed', className)}
    />
  );
}

// ---------- Badges / tags ----------
export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'flag'; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        tone === 'neutral' && 'bg-mist-800 text-ink-muted',
        tone === 'accent' && 'bg-accent/10 text-accent-deep',
        tone === 'ok' && 'bg-ok/10 text-ok',
        tone === 'warn' && 'bg-flag/15 text-warn',
        tone === 'bad' && 'bg-bad/10 text-bad',
        tone === 'flag' && 'bg-flag/15 text-flag-soft',
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------- Stat + count-up ----------
export function CountUp({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const prev = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = value.toFixed(decimals);
      prev.current = value;
      return;
    }
    const ctrl = animate(prev.current, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = v.toFixed(decimals)),
    });
    prev.current = value;
    return () => ctrl.stop();
  }, [value, decimals, reduce]);
  return (
    <span ref={ref} className={cx('num', className)}>
      {(0).toFixed(decimals)}
    </span>
  );
}

export function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-medium text-ink-muted">{label}</div>
      <div className="mt-1 font-display text-3xl text-ink sm:text-4xl">{children}</div>
      {sub && <div className="mt-1 text-xs text-ink-faint">{sub}</div>}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-white px-6 py-16 text-center shadow-card">
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-[15px] text-ink-muted">{hint}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 backdrop-blur-md sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={cx(
              'max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8 scroll-thin',
              wide ? 'sm:max-w-3xl' : 'sm:max-w-md',
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl">{title}</h2>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-mist-800 text-sm text-ink-muted hover:bg-mist-700" aria-label="Close">
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Confirm ----------
interface ConfirmOpts {
  title: string;
  message: string;
  confirmLabel?: string;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? ''}>
        <p className="text-ink-muted">{state?.message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => close(true)}>
            {state?.confirmLabel ?? 'Delete'}
          </Button>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

// ---------- Toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msgs, setMsgs] = useState<{ id: number; msg: string }[]>([]);
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setMsgs((m) => [...m, { id, msg }]);
    setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        <AnimatePresence>
          {msgs.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-white shadow-2xl backdrop-blur"
            >
              {m.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
