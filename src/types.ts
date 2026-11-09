export type RoastLevel = 'Light' | 'Medium-light' | 'Medium';

export interface Coffee {
  name: string;
  origin: string;
  process: string;
  varietals: string;
  altitude: string;
  roaster: string;
  roastLevel: RoastLevel;
  roastDate: string; // yyyy-MM-dd
  agtron?: number | null;
}

export interface Equipment {
  dripper: string;
  paper: string;
  grinder: string;
  kettle: string;
  scale: string;
}

export interface BrewParams {
  doseG: number;
  brewWaterG: number;
  bypassG: number;
  tempC: number;
  grindSetting: string;
  waterPpm: number;
  bloomG: number;
  bloomTimeS: number;
}

export interface Pour {
  timeS: number;
  targetWeightG: number;
  rateGps?: number | null;
  technique: string;
}

export interface Targets {
  drawdownMinS: number;
  drawdownMaxS: number;
  tdsMin: number;
  tdsMax: number;
  eyMin: number;
  eyMax: number;
}

/** Everything a brew copies from its recipe. */
export interface RecipeSpec {
  coffee: Coffee;
  equipment: Equipment;
  params: BrewParams;
  pourSchedule: Pour[];
  targets: Targets;
}

export interface BaseEntity {
  id: string;
  updatedAt: string; // ISO
  deleted?: boolean;
}

export interface Recipe extends BaseEntity, RecipeSpec {
  name: string;
  lineageId: string; // shared across versions
  version: number;
  notes: string;
  createdAt: string;
  champion?: boolean; // built-in read-only template
  tags?: string[];
}

export interface Sensory {
  sweetness: number;
  acidity: number;
  brightness: number;
  body: number;
  clarity: number;
  balance: number;
  aftertaste: number;
  overall: number;
}

export interface BrewResults {
  drawdownS: number | null;
  beverageG: number | null;
  finalG: number | null;
  tdsPct: number | null;
}

export interface Brew extends BaseEntity {
  recipeId: string;
  dateTime: string; // ISO (UTC instant)
  title: string;
  customTitle: boolean;
  spec: RecipeSpec; // snapshot (editable)
  baseline: RecipeSpec; // recipe as it was when the brew was created
  results: BrewResults;
  sensory: Sensory;
  flavours: string[];
  whatITweaked: string;
  feedback: string;
  createdAt: string;
}

export interface PracticeDay extends BaseEntity {
  date: string; // yyyy-MM-dd (KL)
  endOfDayConclusion: string;
  nextSessionPlan: string;
}

/** Beans removed from the practice budget without brewing (sorting defects, grinder purge, spills…). */
export interface BeanEntry {
  id: string;
  dateTime: string; // ISO instant
  grams: number;
  reason: string;
  note: string;
}

export interface Settings extends BaseEntity {
  title: string;
  venue: string;
  eventDateTime: string; // yyyy-MM-ddTHH:mm in Asia/Kuala_Lumpur
  competitor: string;
  competitorUrl?: string;
  beanBudgetG: number;
  /** Stored on the settings record so no backend/schema change is needed. Missing on older data = []. */
  beanLog?: BeanEntry[];
  defaultRecipeId: string | null;
}

export type EntityName = 'recipes' | 'brews' | 'days' | 'settings';

export interface DB {
  recipes: Recipe[];
  brews: Brew[];
  days: PracticeDay[];
  settings: Settings;
}

export type SyncStatus = 'saved' | 'syncing' | 'offline' | 'local';
