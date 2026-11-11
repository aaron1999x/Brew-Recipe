import type { Recipe, RecipeSpec, Settings, Sensory, Step } from '../types';

export const DRIPPERS = ['CAFEC Tritan Flower Dripper Cup 1', 'CAFEC Flower Dripper Deep 27'];
export const PAPERS = ['CAFEC Abaca', 'CAFEC Abaca+', 'CAFEC TH-1', 'CAFEC TH-2', 'CAFEC TH-3', 'CAFEC Abaca+ Deep 27'];
export const ROAST_LEVELS = ['Light', 'Medium-light', 'Medium'] as const;

export const FLAVOUR_PRESETS = [
  'orange',
  'mandarin',
  'red apple',
  'peach',
  'apricot',
  'brown sugar',
  'caramel',
  'milk chocolate',
  'cocoa',
  'black tea',
  'floral',
];

export const SENSORY_KEYS: (keyof Sensory)[] = [
  'sweetness',
  'acidity',
  'brightness',
  'body',
  'clarity',
  'balance',
  'aftertaste',
  'overall',
];

export const DEFAULT_SENSORY: Sensory = {
  sweetness: 5,
  acidity: 5,
  brightness: 5,
  body: 5,
  clarity: 5,
  balance: 5,
  aftertaste: 5,
  overall: 5,
};

export const AQUACODE_STOCK_PPM = 590;

export const STARTER_RECIPE_ID = 'rcp-lamari-v1';

export const STARTER_SPEC: RecipeSpec = {
  coffee: {
    name: 'Lamari Washed',
    origin: 'Lamari River Valley Coffee Gardens, Obura-Wonenara, Eastern Highlands, PNG',
    process: 'Washed',
    varietals: 'Arusha, Blue Mountain, Bourbon, Typica',
    altitude: '1,700–2,000 masl',
    roaster: 'Stronghold S8X',
    roastLevel: 'Light',
    roastDate: '',
    agtron: null,
  },
  equipment: {
    dripper: DRIPPERS[0],
    paper: 'CAFEC TH-3',
    grinder: '1Zpresso K-Ultra',
    kettle: 'Own kettle',
    scale: 'Own scale',
  },
  params: {
    doseG: 15,
    brewWaterG: 200,
    bypassG: 20,
    tempC: 92,
    grindSetting: '7.3',
    waterPpm: 80,
    bloomG: 40,
    bloomTimeS: 40,
  },
  pourSchedule: [
    { timeS: 0, targetWeightG: 40, rateGps: null, technique: 'Bloom' },
    { timeS: 40, targetWeightG: 100, rateGps: null, technique: 'Centre spiral' },
    { timeS: 70, targetWeightG: 150, rateGps: null, technique: 'Centre spiral' },
    { timeS: 100, targetWeightG: 200, rateGps: null, technique: 'Centre, gentle' },
  ],
  targets: {
    drawdownMinS: 160,
    drawdownMaxS: 180,
    tdsMin: 1.38,
    tdsMax: 1.45,
    eyMin: 19.5,
    eyMax: 21,
  },
};

const EPOCH = '2026-01-01T00:00:00.000Z';

export const makeStarterRecipe = (now: string): Recipe => ({
  id: STARTER_RECIPE_ID,
  lineageId: 'lin-lamari',
  version: 1,
  name: 'Lamari Washed — Comp v1',
  notes: 'Competition baseline. Cup 1 Tritan, TH-3, K-Ultra 7.3.',
  createdAt: now,
  updatedAt: EPOCH, // so any remote copy always wins over the seed
  ...structuredClone(STARTER_SPEC),
});

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  updatedAt: EPOCH,
  title: 'CAFEC Malaysia Brewers Cup 2026',
  venue: 'Parc Subang Jaya',
  eventDateTime: '2026-11-27T10:00',
  competitor: 'Aaron',
  competitorUrl: 'https://atys.dev',
  beanBudgetG: 200,
  defaultRecipeId: STARTER_RECIPE_ID,
};

// ---------- Champion templates (read-only, built in) ----------

const evenPours = (count: number, grams: number, everyS: number, technique: string, first = 'Bloom'): Step[] =>
  Array.from({ length: count }, (_, i) => ({
    timeS: i * everyS,
    targetWeightG: grams * (i + 1),
    rateGps: null,
    technique: i === 0 ? first : technique,
  }));

const champ = (
  id: string,
  name: string,
  notes: string,
  params: Partial<RecipeSpec['params']>,
  pourSchedule: Step[],
  drawdown: [number, number],
  equipment: Partial<RecipeSpec['equipment']> = {},
): Recipe => ({
  id,
  lineageId: `lin-${id}`,
  version: 1,
  name,
  notes,
  champion: true,
  tags: ['Champion'],
  createdAt: EPOCH,
  updatedAt: EPOCH,
  coffee: { ...STARTER_SPEC.coffee },
  equipment: { ...STARTER_SPEC.equipment, ...equipment },
  params: { ...STARTER_SPEC.params, bypassG: 0, ...params },
  pourSchedule,
  targets: {
    ...STARTER_SPEC.targets,
    drawdownMinS: drawdown[0],
    drawdownMaxS: drawdown[1],
  },
});

export const CHAMPION_RECIPES: Recipe[] = [
  champ(
    'champ-kasuya-46',
    'Tetsu Kasuya 4:6 (WBrC 2016)',
    'Original: V60. First 40% of water (2 pours) tunes sweetness/acidity; last 60% (3 pours) tunes strength. Scaled for Cup 1.',
    { doseG: 14, brewWaterG: 210, tempC: 92, grindSetting: '9.0', bloomG: 42, bloomTimeS: 45 },
    evenPours(5, 42, 45, 'Even circular pour'),
    [210, 225],
  ),
  champ(
    'champ-chad-wang',
    'Chad Wang (WBrC 2017)',
    'Original: ceramic V60. 30 s bloom, then one continuous slow centre pour to full weight. Finish 2:00–2:10.',
    { doseG: 14, brewWaterG: 230, tempC: 92, grindSetting: '7.0', bloomG: 30, bloomTimeS: 30 },
    [
      { timeS: 0, targetWeightG: 30, rateGps: null, technique: 'Bloom' },
      { timeS: 30, targetWeightG: 230, rateGps: 3, technique: 'Continuous centre pour' },
    ],
    [120, 130],
  ),
  champ(
    'champ-matt-winton',
    'Matt Winton five-pour (WBrC 2021)',
    'Original: V60. Five equal pours every 30 s, no stirring or swirling — let the pours do the agitation.',
    { doseG: 14, brewWaterG: 210, tempC: 93, grindSetting: '7.5', bloomG: 42, bloomTimeS: 30 },
    evenPours(5, 42, 30, 'Centre pour, no stir'),
    [180, 200],
  ),
  champ(
    'champ-carlos-medina',
    'Carlos Medina (WBrC 2023)',
    'Original: Origami. Five pours of 45 g every 30 s at 91°C.',
    { doseG: 14, brewWaterG: 225, tempC: 91, grindSetting: '7.2', bloomG: 45, bloomTimeS: 30 },
    evenPours(5, 45, 30, 'Circular pour'),
    [165, 185],
  ),
  champ(
    'champ-sherry-hsu',
    'Sherry Hsu (WBrC 2022) — technique',
    'Original: Orea. Technique only: first pour at 70°C, then 95°C. Four pours of 50 g every 30 s. Blended grind: 75% coarse + 25% ground 10 clicks finer. Finish with 15–20 g bypass.',
    { doseG: 14, brewWaterG: 200, bypassG: 18, tempC: 95, varyTemp: true, grindSetting: '8.0 / 7.0 (75/25 blend)', bloomG: 50, bloomTimeS: 30 },
    [
      { timeS: 0, kind: 'pour', targetWeightG: 50, rateGps: null, tempC: 70, technique: 'Low-temp first pour' },
      { timeS: 30, kind: 'pour', targetWeightG: 100, rateGps: null, tempC: 95, technique: 'Switch to hot kettle' },
      { timeS: 60, kind: 'pour', targetWeightG: 150, rateGps: null, tempC: 95, technique: '' },
      { timeS: 90, kind: 'pour', targetWeightG: 200, rateGps: null, tempC: 95, technique: '' },
    ],
    [150, 170],
  ),
];
