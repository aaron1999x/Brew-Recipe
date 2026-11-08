import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Recipe } from '../types';
import { useStore } from '../data/store';
import { CHAMPION_RECIPES, STARTER_SPEC } from '../lib/defaults';
import { brewRatio, ratioLabel, specFromRecipe, uid } from '../lib/calc';
import { navigate } from '../lib/router';
import { fmt, mmss, nowIso } from '../lib/time';
import { Badge, Button, Card, Empty, Field, PageTitle, TextArea, TextInput, useConfirm, useToast } from '../components/ui';
import { SpecEditor } from '../components/SpecEditor';
import { SpecView } from '../components/SpecView';
import { PourCurve } from '../components/charts';

export const allRecipes = (mine: Recipe[]) => [...mine, ...CHAMPION_RECIPES];
export const findRecipe = (mine: Recipe[], id: string | null | undefined) => (id ? allRecipes(mine).find((r) => r.id === id) : undefined);

export const duplicateRecipe = (r: Recipe, name?: string): Recipe => {
  const now = nowIso();
  return {
    ...structuredClone(r),
    id: uid('rcp'),
    lineageId: uid('lin'),
    version: 1,
    name: name ?? (r.champion ? `${r.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()} — my version` : `${r.name} (copy)`),
    champion: false,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
};

export const nextVersion = (r: Recipe, recipes: Recipe[], spec = specFromRecipe(r)): Recipe => {
  const now = nowIso();
  const max = Math.max(...recipes.filter((x) => x.lineageId === r.lineageId).map((x) => x.version), r.version);
  const base = r.name.replace(/\s*v\d+$/i, '').trim();
  return {
    ...structuredClone(r),
    ...structuredClone(spec),
    id: uid('rcp'),
    version: max + 1,
    name: `${base} v${max + 1}`,
    champion: false,
    createdAt: now,
    updatedAt: now,
  };
};

function RecipeCard({ r, versions, i }: { r: Recipe; versions?: Recipe[]; i: number }) {
  const { db, upsert, remove } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const [showHist, setShowHist] = useState(false);
  const brewCount = db.brews.filter((b) => b.recipeId === r.id).length;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.4 }}
      className="flex flex-col rounded-2xl bg-white shadow-card p-4 shadow-card"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {r.champion ? <Badge tone="accent">★ Champion</Badge> : <Badge>v{r.version}</Badge>}
        {versions && versions.length > 1 && <Badge tone="flag">{versions.length} versions</Badge>}
        {brewCount > 0 && <Badge>{brewCount} brews</Badge>}
      </div>
      <button className="text-left" onClick={() => navigate(`/recipes/${r.id}`)}>
        <h3 className="font-display text-xl leading-snug hover:text-accent">{r.name}</h3>
      </button>
      <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{r.notes || r.coffee.name}</p>
      <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-xs text-ink-muted">
        <div>
          <div className="text-ink">{r.params.doseG}g</div>dose
        </div>
        <div>
          <div className="text-ink">{ratioLabel(brewRatio(r))}</div>ratio
        </div>
        <div>
          <div className="text-ink">{r.params.tempC}°</div>temp
        </div>
        <div>
          <div className="text-ink truncate">{r.params.grindSetting}</div>grind
        </div>
      </div>
      <div className="-mx-2 mt-2">
        <PourCurve pours={r.pourSchedule} height={90} compact />
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {!r.champion && (
          <Button size="sm" variant="primary" onClick={() => navigate(`/brews/new?recipe=${r.id}`)}>
            Brew
          </Button>
        )}
        <Button size="sm" onClick={() => navigate(`/recipes/${r.id}`)}>
          {r.champion ? 'View' : 'Edit'}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const d = duplicateRecipe(r);
            upsert('recipes', d);
            toast('Duplicated');
            navigate(`/recipes/${d.id}`);
          }}
        >
          Duplicate
        </Button>
        {!r.champion && (
          <Button
            size="sm"
            variant="quiet-danger"
            className="ml-auto"
            onClick={async () => {
              if (await confirm({ title: 'Delete recipe?', message: `“${r.name}” will be removed. Brews that used it keep their own snapshot.` })) {
                remove('recipes', r.id);
                toast('Recipe deleted');
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
      {versions && versions.length > 1 && (
        <div className="mt-3 border-t border-mist-800 pt-2">
          <button className="text-xs text-ink-faint hover:text-accent" onClick={() => setShowHist((v) => !v)}>
            {showHist ? '▾' : '▸'} Version history
          </button>
          {showHist && (
            <ul className="mt-2 space-y-1">
              {versions.map((v) => (
                <li key={v.id}>
                  <a href={`#/recipes/${v.id}`} className="flex justify-between rounded-lg px-2 py-1 text-sm hover:bg-mist-800">
                    <span>
                      <span className="num text-accent">v{v.version}</span> {v.name}
                    </span>
                    <span className="num text-xs text-ink-faint">{fmt(v.createdAt, 'd MMM')}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function RecipesPage() {
  const { db, upsert } = useStore();
  const lineages = useMemo(() => {
    const map = new Map<string, Recipe[]>();
    for (const r of db.recipes) map.set(r.lineageId, [...(map.get(r.lineageId) ?? []), r]);
    return Array.from(map.values())
      .map((vs) => vs.sort((a, b) => b.version - a.version))
      .sort((a, b) => b[0].updatedAt.localeCompare(a[0].updatedAt));
  }, [db.recipes]);

  const create = () => {
    const now = nowIso();
    const r: Recipe = {
      id: uid('rcp'),
      lineageId: uid('lin'),
      version: 1,
      name: 'New recipe',
      notes: '',
      createdAt: now,
      updatedAt: now,
      ...structuredClone(STARTER_SPEC),
    };
    upsert('recipes', r);
    navigate(`/recipes/${r.id}`);
  };

  return (
    <div>
      <PageTitle title="Recipes" subtitle="Reusable templates. Brews snapshot a recipe, so tweaks never overwrite it." action={<Button variant="primary" onClick={create}>+ New recipe</Button>} />
      {lineages.length === 0 ? (
        <Empty title="No recipes" hint="Create one, or duplicate a champion template below." action={<Button onClick={create}>+ New recipe</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lineages.map((vs, i) => (
            <RecipeCard key={vs[0].lineageId} r={vs[0]} versions={vs} i={i} />
          ))}
        </div>
      )}
      <h2 className="mb-1 mt-10 font-display text-2xl">Champion templates</h2>
      <p className="mb-4 text-sm text-ink-muted">World Brewers Cup recipes scaled for Cup 1. Read-only — duplicate one to make it yours.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CHAMPION_RECIPES.map((r, i) => (
          <RecipeCard key={r.id} r={r} i={i} />
        ))}
      </div>
    </div>
  );
}

export function RecipeEditPage({ id }: { id: string }) {
  const { db, upsert, remove } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const source = findRecipe(db.recipes, id);
  const [draft, setDraft] = useState<Recipe | undefined>(source);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(source);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!source || !draft) return <Empty title="Recipe not found" hint="It may have been deleted." action={<Button onClick={() => navigate('/recipes')}>Back to recipes</Button>} />;

  const versions = db.recipes.filter((r) => r.lineageId === source.lineageId).sort((a, b) => b.version - a.version);
  const set = (patch: Partial<Recipe>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };

  if (source.champion) {
    return (
      <div>
        <PageTitle
          title={source.name}
          subtitle={<Badge tone="accent">★ Champion · read-only</Badge>}
          action={
            <Button
              variant="primary"
              onClick={() => {
                const d = duplicateRecipe(source);
                upsert('recipes', d);
                toast('Duplicated — now editable');
                navigate(`/recipes/${d.id}`);
              }}
            >
              Duplicate to edit
            </Button>
          }
        />
        <Card className="mb-5">
          <p className="leading-relaxed text-ink-muted">{source.notes}</p>
          <div className="mt-4">
            <PourCurve pours={source.pourSchedule} targets={source.targets} />
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Target finish {mmss(source.targets.drawdownMinS)}–{mmss(source.targets.drawdownMaxS)}. Coffee and equipment are placeholders from your comp setup.
          </p>
        </Card>
        <Card>
          <SpecView spec={source} />
        </Card>
      </div>
    );
  }

  const save = () => {
    upsert('recipes', draft);
    setDirty(false);
    toast('Recipe saved');
  };
  const saveVersion = () => {
    const v = nextVersion(draft, db.recipes, specFromRecipe(draft));
    upsert('recipes', v);
    setDirty(false);
    toast(`Saved as v${v.version}`);
    navigate(`/recipes/${v.id}`);
  };

  return (
    <div className="pb-24">
      <PageTitle
        title={draft.name || 'Untitled recipe'}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>v{draft.version}</Badge>
            <span>updated {fmt(source.updatedAt, 'd MMM, HH:mm')}</span>
          </span>
        }
        action={
          <>
            <Button onClick={() => navigate(`/timer?recipe=${source.id}`)}>Rehearse</Button>
            <Button onClick={() => navigate(`/brews/new?recipe=${source.id}`)}>Brew this</Button>
          </>
        }
      />
      <div className="mb-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="grid gap-4">
            <Field label="Name">
              <TextInput value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Notes">
              <TextArea value={draft.notes} onChange={(v) => set({ notes: v })} />
            </Field>
          </div>
        </Card>
        <Card title="Version history">
          <ul className="space-y-1">
            {versions.map((v) => (
              <li key={v.id}>
                <a href={`#/recipes/${v.id}`} className={`flex justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-mist-800 ${v.id === id ? 'bg-mist-800 text-accent' : ''}`}>
                  <span>
                    <span className="num">v{v.version}</span> · {v.name}
                  </span>
                  <span className="num text-xs text-ink-faint">{fmt(v.createdAt, 'd MMM')}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <SpecEditor
        spec={draft}
        onChange={(s) => {
          setDraft((d) => (d ? { ...d, ...s } : d));
          setDirty(true);
        }}
      />
      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t border-black/5 bg-white/80 backdrop-blur-xl backdrop-saturate-150 lg:bottom-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <span className="text-sm text-ink-faint">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <Button
            variant="quiet-danger"
            className="ml-auto"
            onClick={async () => {
              if (await confirm({ title: 'Delete recipe?', message: `Delete “${source.name}” (v${source.version})?` })) {
                remove('recipes', source.id);
                navigate('/recipes');
              }
            }}
          >
            Delete
          </Button>
          <Button onClick={saveVersion}>Save as v{Math.max(...versions.map((v) => v.version)) + 1}</Button>
          <Button variant="primary" disabled={!dirty} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
