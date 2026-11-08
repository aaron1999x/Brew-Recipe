import type { Brew, PracticeDay, Recipe } from '../types';
import { STARTER_SPEC } from './defaults';
import { fromLocalInput, fmt, nowIso } from './time';
import { subDays } from 'date-fns';

const clone = <T,>(x: T): T => structuredClone(x);

/** Two practice days, four brews, linked to a demo copy of the starter recipe. */
export function buildDemo(): { recipes: Recipe[]; brews: Brew[]; days: PracticeDay[] } {
  const now = nowIso();
  const d1 = fmt(subDays(new Date(), 3), 'yyyy-MM-dd');
  const d2 = fmt(subDays(new Date(), 1), 'yyyy-MM-dd');

  const recipe: Recipe = {
    id: 'demo-rcp-lamari',
    lineageId: 'demo-lin-lamari',
    version: 1,
    name: 'Lamari Washed — Demo',
    notes: 'Demo copy of the comp baseline.',
    createdAt: now,
    updatedAt: now,
    ...clone(STARTER_SPEC),
  };
  recipe.coffee.roastDate = fmt(subDays(new Date(), 14), 'yyyy-MM-dd');

  const mk = (
    n: number,
    date: string,
    time: string,
    tweak: (s: Brew['spec']) => void,
    results: Brew['results'],
    sensory: Brew['sensory'],
    flavours: string[],
    whatITweaked: string,
    feedback: string,
  ): Brew => {
    const spec = clone(recipe) as Brew['spec'];
    const s: Brew['spec'] = {
      coffee: spec.coffee,
      equipment: spec.equipment,
      params: spec.params,
      pourSchedule: spec.pourSchedule,
      targets: spec.targets,
    };
    tweak(s);
    return {
      id: `demo-brew-${n}`,
      recipeId: recipe.id,
      dateTime: fromLocalInput(`${date}T${time}`),
      title: '',
      customTitle: false,
      spec: s,
      baseline: clone({
        coffee: recipe.coffee,
        equipment: recipe.equipment,
        params: recipe.params,
        pourSchedule: recipe.pourSchedule,
        targets: recipe.targets,
      }),
      results,
      sensory,
      flavours,
      whatITweaked,
      feedback,
      createdAt: now,
      updatedAt: now,
    };
  };

  const brews: Brew[] = [
    mk(
      1,
      d1,
      '14:30',
      () => {},
      { drawdownS: 196, beverageG: 168, finalG: 188, tdsPct: 1.49 },
      { sweetness: 6, acidity: 5, brightness: 5, body: 7, clarity: 4, balance: 5, aftertaste: 5, overall: 5.5 },
      ['brown sugar', 'cocoa', 'black tea'],
      'Baseline run.',
      'Drawdown long (3:16). Heavy, a little muddy. Go coarser.',
    ),
    mk(
      2,
      d1,
      '15:10',
      (s) => {
        s.params.grindSetting = '7.7';
      },
      { drawdownS: 172, beverageG: 171, finalG: 191, tdsPct: 1.42 },
      { sweetness: 7, acidity: 6, brightness: 6.5, body: 6, clarity: 6.5, balance: 6.5, aftertaste: 6, overall: 7 },
      ['mandarin', 'brown sugar', 'black tea'],
      'Grind 7.3 → 7.7.',
      'Much cleaner, mandarin shows up as it cools. Right in the drawdown window.',
    ),
    mk(
      3,
      d2,
      '10:15',
      (s) => {
        s.params.grindSetting = '7.7';
        s.params.tempC = 94;
      },
      { drawdownS: 168, beverageG: 170, finalG: 190, tdsPct: 1.44 },
      { sweetness: 8, acidity: 7, brightness: 7.5, body: 6, clarity: 7, balance: 7.5, aftertaste: 7, overall: 8 },
      ['peach', 'mandarin', 'caramel', 'floral'],
      'Temp 92 → 94°C on 7.7.',
      'Best so far. Stone fruit + florals, sweet long finish.',
    ),
    mk(
      4,
      d2,
      '11:00',
      (s) => {
        s.params.grindSetting = '7.7';
        s.params.tempC = 94;
        s.params.bypassG = 30;
        s.equipment.paper = 'CAFEC Abaca+';
      },
      { drawdownS: 154, beverageG: 172, finalG: 202, tdsPct: 1.33 },
      { sweetness: 6.5, acidity: 6, brightness: 6, body: 5, clarity: 7.5, balance: 6, aftertaste: 5.5, overall: 6.5 },
      ['peach', 'black tea'],
      'Abaca+ paper, bypass 20 → 30 g.',
      'Too thin, TDS under target. Drawdown faster on Abaca+. Back to TH-3, bypass 20.',
    ),
  ];

  const days: PracticeDay[] = [
    {
      id: `day-${d1}`,
      date: d1,
      endOfDayConclusion: 'Grind 7.3 is too fine for this bean on TH-3. 7.7 lands the drawdown in the 2:40–3:00 window.',
      nextSessionPlan: 'Keep 7.7, test temp 94°C.',
      updatedAt: now,
    },
    {
      id: `day-${d2}`,
      date: d2,
      endOfDayConclusion: '94°C opened up the florals. Abaca+ and more bypass thinned it out too much.',
      nextSessionPlan: 'Lock 7.7 / 94°C / TH-3. Try a slower final pour (3 g/s).',
      updatedAt: now,
    },
  ];

  return { recipes: [recipe], brews, days };
}
