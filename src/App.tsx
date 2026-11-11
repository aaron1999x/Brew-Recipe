import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { StoreProvider, useStore } from './data/store';
import { navigate, useRoute, type Route } from './lib/router';
import { CompactCountdown, Header, SyncIndicator } from './components/Header';
import { SettingsPanel } from './components/SettingsPanel';
import { ConfirmProvider, ToastProvider, cx } from './components/ui';
import { IconBook, IconCalendar, IconCompare, IconGear, IconHome, IconPlus, IconTimer } from './components/icons';
import { Dashboard } from './pages/Dashboard';
import { RecipeEditPage, RecipesPage } from './pages/Recipes';
import { BrewDetailPage, BrewFormPage } from './pages/Brews';
import { ComparePage } from './pages/Compare';
import { DaysPage } from './pages/Days';
import { TimerPage } from './pages/Timer';
import { RulesPage } from './pages/Rules';

const NAV = [
  { to: '/', label: 'Overview', short: 'Home', Icon: IconHome, match: (p: string[]) => p.length === 0 },
  { to: '/recipes', label: 'Recipes', short: 'Recipes', Icon: IconBook, match: (p: string[]) => p[0] === 'recipes' },
  { to: '/brews/new', label: 'New brew', short: 'Brew', Icon: IconPlus, match: (p: string[]) => p[0] === 'brews' && p[1] === 'new', primary: true },
  { to: '/days', label: 'Practice days', short: 'Days', Icon: IconCalendar, match: (p: string[]) => p[0] === 'days' },
  { to: '/compare', label: 'Compare', short: 'Compare', Icon: IconCompare, match: (p: string[]) => p[0] === 'compare' },
  { to: '/timer', label: 'Rehearsal', short: 'Timer', Icon: IconTimer, match: (p: string[]) => p[0] === 'timer' },
  { to: '/rules', label: 'Rules', short: 'Rules', Icon: IconBook, match: (p: string[]) => p[0] === 'rules' },
];
const MOBILE = ['/', '/recipes', '/brews/new', '/days', '/timer'];

function Page({ route }: { route: Route }) {
  const [a, b, c] = route.parts;
  if (!a) return <Dashboard />;
  if (a === 'recipes') return b ? <RecipeEditPage id={b} /> : <RecipesPage />;
  if (a === 'brews') {
    if (b === 'new') return <BrewFormPage key={`new-${route.query.toString()}`} query={route.query} />;
    if (b && c === 'edit') return <BrewFormPage key={`edit-${b}`} id={b} query={route.query} />;
    if (b) return <BrewDetailPage id={b} />;
    return <DaysPage />;
  }
  if (a === 'compare') return <ComparePage query={route.query} />;
  if (a === 'days') return <DaysPage />;
  if (a === 'rules') return <RulesPage />;
  return <Dashboard />;
}

function Shell() {
  const route = useRoute();
  const { db } = useStore();
  const [settings, setSettings] = useState(false);
  const isTimer = route.parts[0] === 'timer';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        navigate('/brews/new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (isTimer)
    return (
      // keyed by recipe so opening a different recipe's rehearsal link starts fresh
      <TimerPage key={route.query.get('recipe') ?? ''} query={route.query} onExit={() => (history.length > 1 ? history.back() : navigate('/'))} />
    );

  const isHome = route.parts.length === 0;

  return (
    <div className="min-h-screen pb-28 lg:pb-16">
      {/* Global nav — slim, translucent, always visible */}
      <nav className="sticky top-0 z-40 border-b border-black/5 bg-mist-950/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-4 sm:h-16 sm:px-6">
          <a href="#/" className="mr-6 text-lg font-semibold tracking-[0.2em] text-ink sm:text-xl" aria-label="Bloom home">
            BLOOM
          </a>
          <div className="hidden items-center gap-0.5 lg:flex">
            {NAV.filter((n) => !n.primary).map((n) => {
              const active = n.match(route.parts);
              return (
                <a
                  key={n.to}
                  href={`#${n.to}`}
                  className={cx(
                    'rounded-full px-3.5 py-2 text-[15px] transition',
                    active ? 'bg-accent/10 font-medium text-accent-deep' : 'text-ink-muted hover:bg-mist-800 hover:text-ink',
                  )}
                >
                  {n.label}
                </a>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <CompactCountdown eventLocal={db.settings.eventDateTime} />
            <SyncIndicator />
            <button
              onClick={() => setSettings(true)}
              className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-mist-800 hover:text-ink"
              aria-label="Settings"
            >
              <IconGear width={21} height={21} />
            </button>
            <a
              href="#/brews/new"
              className="ml-1 hidden h-10 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-medium text-white hover:bg-accent-soft lg:inline-flex"
            >
              New brew <kbd className="rounded bg-white/20 px-1 text-[10px] font-semibold">N</kbd>
            </a>
          </div>
        </div>
      </nav>

      <Header hero={isHome} />

      <main className={cx('mx-auto max-w-7xl px-4 sm:px-6', isHome ? 'pt-2' : 'pt-8')}>
        <AnimatePresence mode="wait">
          <motion.div
            key={route.path}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <Page route={route} />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* phone bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 h-[68px] border-t border-black/5 bg-mist-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden">
        <div className="mx-auto grid h-full max-w-lg grid-cols-5">
          {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => {
            const active = n.match(route.parts);
            const Icon = n.Icon;
            return n.primary ? (
              <a key={n.to} href={`#${n.to}`} className="flex items-center justify-center" aria-label="New brew">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/25">
                  <Icon width={24} height={24} strokeWidth={2} />
                </span>
              </a>
            ) : (
              <a key={n.to} href={`#${n.to}`} className={cx('flex flex-col items-center justify-center gap-1 text-[10px] font-medium', active ? 'text-accent' : 'text-ink-faint')}>
                <Icon />
                {n.short}
              </a>
            );
          })}
        </div>
      </nav>
      {/* phone: secondary links */}
      <footer className="mx-auto mt-16 flex max-w-7xl justify-center gap-6 border-t border-black/5 px-4 pt-6 text-xs text-ink-muted lg:justify-start lg:px-6">
        <span className="hidden lg:inline">BLOOM · CAFEC Malaysia Brewers Cup 2026</span>
        <a href="#/compare" className="hover:text-accent lg:hidden">
          Compare
        </a>
        <a href="#/rules" className="hover:text-accent lg:hidden">
          Rules
        </a>
      </footer>

      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Shell />
          </ConfirmProvider>
        </ToastProvider>
      </StoreProvider>
    </MotionConfig>
  );
}
