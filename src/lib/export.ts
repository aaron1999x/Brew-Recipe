import type { Brew, DB } from '../types';
import { brewRatio, brewTitle, extractionYield, overallRatio } from './calc';
import { fmt } from './time';

const download = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const stamp = () => fmt(new Date(), 'yyyyMMdd-HHmm');

export const exportJson = (db: DB) =>
  download(`bloom-${stamp()}.json`, JSON.stringify({ app: 'bloom', version: 1, ...db }, null, 2), 'application/json');

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportCsv = (db: DB) => {
  const recipeName = (id: string) => db.recipes.find((r) => r.id === id)?.name ?? '';
  const cols: [string, (b: Brew) => unknown][] = [
    ['id', (b) => b.id],
    ['title', (b) => brewTitle(b, db.brews)],
    ['dateTime (KL)', (b) => fmt(b.dateTime, 'yyyy-MM-dd HH:mm')],
    ['recipe', (b) => recipeName(b.recipeId)],
    ['coffee', (b) => b.spec.coffee.name],
    ['roastLevel', (b) => b.spec.coffee.roastLevel],
    ['dripper', (b) => b.spec.equipment.dripper],
    ['paper', (b) => b.spec.equipment.paper],
    ['grinder', (b) => b.spec.equipment.grinder],
    ['doseG', (b) => b.spec.params.doseG],
    ['brewWaterG', (b) => b.spec.params.brewWaterG],
    ['bypassG', (b) => b.spec.params.bypassG],
    ['tempC', (b) => b.spec.params.tempC],
    ['grind', (b) => b.spec.params.grindSetting],
    ['waterPpm', (b) => b.spec.params.waterPpm],
    ['bloomG', (b) => b.spec.params.bloomG],
    ['bloomTimeS', (b) => b.spec.params.bloomTimeS],
    ['pours', (b) => b.spec.pourSchedule.map((p) => `${p.timeS}s:${p.targetWeightG}g`).join(' | ')],
    ['drawdownS', (b) => b.results.drawdownS],
    ['beverageG', (b) => b.results.beverageG],
    ['finalG', (b) => b.results.finalG],
    ['tdsPct', (b) => b.results.tdsPct],
    ['eyPct', (b) => extractionYield(b)?.toFixed(2)],
    ['brewRatio', (b) => brewRatio(b.spec)?.toFixed(2)],
    ['overallRatio', (b) => overallRatio(b.spec)?.toFixed(2)],
    ...(['sweetness', 'acidity', 'brightness', 'body', 'clarity', 'balance', 'aftertaste', 'overall'] as const).map(
      (k) => [k, (b: Brew) => b.sensory[k]] as [string, (b: Brew) => unknown],
    ),
    ['flavours', (b) => b.flavours.join('; ')],
    ['whatITweaked', (b) => b.whatITweaked],
    ['feedback', (b) => b.feedback],
  ];
  const rows = [cols.map((c) => c[0]), ...db.brews.map((b) => cols.map((c) => c[1](b)))];
  download(`bloom-brews-${stamp()}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
};

export const readJsonFile = (file: File) =>
  new Promise<Partial<DB>>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || typeof data !== 'object') throw new Error('Not a Bloom export');
        resolve(data as Partial<DB>);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
