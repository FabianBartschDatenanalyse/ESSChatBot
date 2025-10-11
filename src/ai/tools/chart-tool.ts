'use server';

import { ai, isAiConfigured, missingAiMessage } from '@/src/ai/genkit';
import { z } from 'zod';
import { searchCodebook } from '@/src/lib/vector-search';
import { executeQuery } from '@/src/lib/data-service';

// NEU: Font-Handling & Canvas-Rendering
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  NEVER_NUMERIC,
  looksNumeric,
  sanitizeLabel,
} from './chart-tool-shared';

const isModuleNotFoundError = (error: unknown, specifier: string) => {
  if (!error) return false;
  const message = typeof error === 'string' ? error : (error as Error)?.message ?? '';
  const code = (error as any)?.code;
  return (
    code === 'ERR_MODULE_NOT_FOUND' ||
    code === 'MODULE_NOT_FOUND' ||
    message.includes(`Cannot find module '${specifier}'`) ||
    message.includes(`Cannot find package '${specifier}'`) ||
    message.includes('Failed to resolve import') ||
    message.includes('Could not dynamically import')
  );
};

type ImportResult = {
  module: any | null;
  error: Error | null;
  isMissing: boolean;
};

async function tryLoadModule(
  specifier: string,
  loader: () => Promise<any>,
): Promise<ImportResult> {
  try {
    const module = await loader();
    return { module, error: null, isMissing: false };
  } catch (unknownError) {
    const error =
      unknownError instanceof Error ? unknownError : new Error(String(unknownError));
    const isMissing = isModuleNotFoundError(error, specifier);
    const reason = isMissing ? 'Missing dependency' : 'Failed to load dependency';
    console.error(`[chart-tool] ${reason} "${specifier}".`, error);
    return { module: null, error, isMissing };
  }
}

const FONT_FAMILY = 'DejaVu Sans';

/** ------------------------------
 *  RENDERER (bestehend)
 *  ------------------------------ */
export async function renderVegaLiteToPngDataUrl(spec: any): Promise<string> {
  const [vegaImport, vegaLiteImport, resvgImport] = await Promise.all([
    tryLoadModule('vega', () => import('vega')),
    tryLoadModule('vega-lite', () => import('vega-lite')),
    tryLoadModule('@resvg/resvg-js', () => import('@resvg/resvg-js')),
  ]);

  const dependencyResults = [
    { name: 'vega', result: vegaImport },
    { name: 'vega-lite', result: vegaLiteImport },
    { name: '@resvg/resvg-js', result: resvgImport },
  ];

  const missingDependencies = dependencyResults.filter(({ result }) => result.isMissing);
  const failedDependencies = dependencyResults.filter(
    ({ result }) => !result.isMissing && result.error,
  );

  if (missingDependencies.length || failedDependencies.length) {
    const details: string[] = [];

    if (missingDependencies.length) {
      for (const { name, result } of missingDependencies) {
        const message = result.error?.message ?? 'unbekannt';
        details.push(`- Modul "${name}" nicht gefunden. Originalfehler: ${message}.`);
      }
    }

    if (failedDependencies.length) {
      for (const { name, result } of failedDependencies) {
        const message = result.error?.message ?? 'unbekannt';
        details.push(
          `- Modul "${name}" konnte nicht geladen werden (kein klassischer Missing-Fall). Originalfehler: ${message}.`,
        );
      }
    }

    details.push(
      'Installationshinweis: npm install vega vega-lite @resvg/resvg-js (bzw. entsprechendes Paketmanagement).',
    );

    const errorMessage =
      'Vega Renderer Initialisierung fehlgeschlagen. Bitte pruefen Sie die folgenden Abhaengigkeiten:\n' +
      details.join('\n');

    console.error('[chart-tool] Vega Renderer Initialisierung fehlgeschlagen.', {
      missingDependencies,
      failedDependencies,
    });

    throw new Error(errorMessage);
  }
  const vegaModule = vegaImport.module;
  const vegaLiteModule = vegaLiteImport.module;
  const resvgModule = resvgImport.module;

  const vega = vegaModule?.default ?? vegaModule;
  const vegaLite = vegaLiteModule?.default ?? vegaLiteModule;
  const ResvgCtor =
    resvgModule?.Resvg ?? resvgModule?.default?.Resvg ?? resvgModule?.default ?? null;

  if (!vega || !vegaLite || !ResvgCtor) {
    const missingConstructors = [
      !vega && 'vega',
      !vegaLite && 'vega-lite',
      !ResvgCtor && '@resvg/resvg-js (Resvg Constructor)',
    ].filter(Boolean);

    const detailMessage = missingConstructors
      .map((name) => `- Konstruktor fuer ${name} nicht gefunden.`)
      .join('\n');

    const errorMessage =
      'Vega Renderer nicht verfuegbar. Import erfolgreich, aber erwartete Exporte fehlen:\n' +
      detailMessage;

    console.error('[chart-tool] Vega Renderer Exporte nicht gefunden.', {
      vegaModule,
      vegaLiteModule,
      resvgModule,
    });

    throw new Error(errorMessage);
  }
  try {
    const compiled = vegaLite.compile(spec).spec;
    const view = new vega.View(vega.parse(compiled), { renderer: 'svg' });
    const svg = await view.toSVG();

    const fontDir = path.join(process.cwd(), 'public', 'fonts');
    const regularPath = path.join(fontDir, 'DejaVuSans.ttf');
    const boldPath = path.join(fontDir, 'DejaVuSans-Bold.ttf');

    await Promise.all(
      [regularPath, boldPath].map(async (p) => {
        try {
          await fs.access(p);
        } catch {
          throw new Error(`Font fehlt: ${p}`);
        }
      }),
    );

    const resvg = new ResvgCtor(svg, {
      font: {
        loadSystemFonts: false,
        fontFiles: [regularPath, boldPath],
        defaultFontFamily: 'DejaVu Sans',
        sansSerifFamily: 'DejaVu Sans',
        serifFamily: 'DejaVu Sans',
        monospaceFamily: 'DejaVu Sans',
      },
    });

    const png = resvg.render().asPng();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (error) {
    console.error('Vega Renderer fehlgeschlagen.', error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Vega Renderer fehlgeschlagen: ${message}`, {
      cause: error instanceof Error ? error : undefined,
    });
  }
}

/** ------------------------------
 *  CHART-PLANNER SCHEMA (bestehend)
 *  ------------------------------ */
const ChartPlanSchema = z.object({
  title: z.string().optional(),
  chartType: z.enum(['bar', 'line', 'scatter', 'histogram', 'boxplot', 'heatmap', 'pie']), // <— PIE ergänzt
  x: z.string().describe('Spaltenname für X-Achse'),
  y: z.string().optional().describe('Spaltenname oder Aggregat für Y'),
  color: z.string().optional(), // muss Spaltenname sein (keine Hex-Werte)
  aggregate: z.enum(['avg', 'sum', 'count', 'median', 'min', 'max', 'none']).default('none'),
  groupBy: z.array(z.string()).default([]),
  filters: z.record(z.string(), z.any()).optional(),
  sqlQuery: z.string().describe('Konformer SQL (nur "ESS1")'),
});

const ChartToolInputSchema = z.object({
  nlQuestion: z.string(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant', 'tool']), content: z.string() }))
    .optional(),
});
type ChartToolInput = z.infer<typeof ChartToolInputSchema>;

const ChartToolOutputSchema = z.object({
  imageDataUrl: z.string().optional(), // data:image/png;base64,...
  vegaLiteSpec: z.any().optional(), // Spec as plain JSON
  sqlQuery: z.string().optional(),
  retrievedContext: z.string().optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
  error: z.string().optional(),
});
type ChartToolOutput = z.infer<typeof ChartToolOutputSchema>;

/** ------------------------------
 *  HILFSFUNKTIONEN (bestehend)
 *  ------------------------------ */
function coerceNumericColumns(rows: any[]): any[] {
  if (!rows.length) return rows;
  const keys = Object.keys(rows[0]);
  const numericLikely = new Set<string>();

  for (const k of keys) {
    if (NEVER_NUMERIC.has(k)) continue;
    let numericLike = 0;
    let seen = 0;
    for (let i = 0; i < Math.min(rows.length, 500); i++) {
      const v = rows[i][k];
      if (v == null || v === '') continue;
      seen++;
      if (looksNumeric(v)) numericLike++;
    }
    if (seen > 0 && numericLike / seen >= 0.9) numericLikely.add(k);
  }

  return rows.map(r => {
    const out: any = { ...r };
    for (const k of numericLikely) {
      if (NEVER_NUMERIC.has(k)) continue;
      const v = out[k];
      if (v == null || v === '') {
        out[k] = null;
        continue;
      }
      if (typeof v === 'number') continue;
      if (typeof v === 'string' && looksNumeric(v)) {
        const num = parseFloat(v);
        out[k] = Number.isFinite(num) ? num : null;
      }
    }
    return out;
  });
}

const prettyAxisTitle = (k?: string) => {
  if (!k) return undefined;
  if (k === 'cntry') return 'Land';
  if (k === 'avg_trust') return 'Durchschnitt Vertrauen (0–10)';
  if (k?.toLowerCase() === 'trstprl') return 'Vertrauen ins Parlament (0–10)';
  if (k?.toLowerCase().startsWith('trst')) return 'Trust (0–10)';
  return k;
};

const ZERO_TO_TEN_DOMAIN: [number, number] = [0, 10];

const fieldImpliesZeroToTen = (field?: string) => {
  if (!field) return false;
  const normalized = field.toLowerCase();
  if (normalized === 'avg_trust') return true;
  if (normalized.startsWith('trst')) return true;
  return false;
};

const titleImpliesZeroToTen = (title?: string) => {
  if (!title) return false;
  return /0\s*[\u2013\-]\s*10/.test(title);
};

const resolveDefaultDomain = (field?: string, axisTitle?: string): [number, number] | null => {
  if (fieldImpliesZeroToTen(field)) return ZERO_TO_TEN_DOMAIN;
  if (titleImpliesZeroToTen(axisTitle)) return ZERO_TO_TEN_DOMAIN;
  return null;
};

function computeNiceStep(range: number, tickCount: number) {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rawStep = range / Math.max(1, tickCount);
  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / Math.pow(10, exponent);
  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * Math.pow(10, exponent);
}

const generateTicksForDomain = (
  domain: [number, number],
  targetTickCount = 6,
): number[] => {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const step = computeNiceStep(max - min, Math.max(1, targetTickCount - 1));
  if (!Number.isFinite(step) || step <= 0) return [];
  const ticks: number[] = [];
  for (let value = min; value <= max + step * 0.25; value += step) {
    const rounded = Number(value.toFixed(6));
    if (ticks.length && Math.abs(rounded - ticks[ticks.length - 1]) < 1e-6) continue;
    ticks.push(Math.min(max, rounded));
  }
  if (!ticks.length || Math.abs(ticks[0] - min) > 1e-6) {
    ticks.unshift(min);
  }
  if (Math.abs(ticks[ticks.length - 1] - max) > 1e-6) {
    ticks.push(max);
  }
  return ticks.map((tick) => Number(tick.toFixed(6)));
};

const applyDefaultAxisDomain = (channel: any, field?: string) => {
  if (!channel || channel.type !== 'quantitative') return;
  const axisTitle = channel.axis?.title ?? prettyAxisTitle(field);
  const domain = resolveDefaultDomain(field, axisTitle);
  if (!domain) return;
  channel.scale = { ...(channel.scale ?? {}), domain, nice: false, zero: domain[0] <= 0 && domain[1] >= 0 };
  const hasExplicitValues = Array.isArray(channel.axis?.values) && channel.axis?.values.length;
  if (!hasExplicitValues) {
    const ticks = generateTicksForDomain(domain);
    if (ticks.length) {
      channel.axis = { ...(channel.axis ?? {}), values: ticks, tickCount: undefined };
    }
  } else if (channel.axis) {
    channel.axis.tickCount = undefined;
  }
};

const sqlHasAggregate = (sql?: string) =>
  !!sql && /\b(AVG|SUM|COUNT|MEDIAN|MIN|MAX)\b/i.test(sql);

/** ------------------------------
 *  PLANNER-PROMPT (bestehend)
 *  ------------------------------ */
const plannerPrompt = (q: string, codebook: string) => `
Du bist ein Visual Analytics Assistent für die ESS-Datenbank.

AUFGABE:
- Erzeuge einen geeigneten Diagramm-Plan (ChartPlan) **als JSON-OBJEKT** und einen SQL-Query, um die Daten abzurufen.
- Benutze NUR Spaltennamen exakt wie im Codebook.
- Tabelle ist IMMER "ESS1" (mit doppelten Anführungszeichen).
- Bei Aggregationen: CAST(...) als NUMERIC und fehlende Codes ('77','88','99','555','666','777','888','999','9999') ausschließen.
- Typische Mappings:
  - Balken: kategoriale Dimension + Aggregat der Metrik. Sowohl (x=Kategorie,y=Aggregat) als auch (y=Kategorie,x=Aggregat) sind erlaubt.
  - Linie: zeitlich/ordinal auf x, Aggregat auf y
  - Scatter: numerische x und y, keine Aggregation (oder Aggregat auf Gruppierung)
  - Histogramm: x gebinnt (bin: true), y = count
  - Pie: Kategorie auf color (z. B. cntry), Metrik aggregiert auf theta (z. B. SUM(...) AS value). Wenn unklar, nutze COUNT(*) AS value.
- Wenn unklar, nutze bar chart mit AVG(...) nach "cntry".
- Wenn du aggregierst, gib dem Aggregat IMMER einen eindeutigen Alias (z. B. "avg_trust" oder "value") und verwende genau diesen Alias im Chart-Feld.

WICHTIG (AUSGABEFORMAT):
- **Gib ausschließlich ein JSON-OBJEKT der Instanz** zurück, KEIN JSON-Schema.
- Enthält KEINE Schlüssel wie "properties", "required", "$schema".
- "color" ist optional und muss eine **Spalte** sein (keine Hex-Farbe).
- Beispiel (nur Format, Werte variieren):
{
  "title": "Durchschnittliches Vertrauen ins Parlament nach Land",
  "chartType": "bar",
  "x": "cntry",
  "y": "avg_trust",
  "aggregate": "none",
  "groupBy": ["cntry"],
  "sqlQuery": "SELECT \"cntry\", AVG(CAST(\"trstprl\" AS NUMERIC)) AS avg_trust FROM \"ESS1\" WHERE \"trstprl\" NOT IN ('77','88','99','555','666','777','888','999','9999') GROUP BY \"cntry\" ORDER BY avg_trust DESC"
}

FRAGE:
"${q}"

CODEBOOK KONTEXT (maßgeblich):
${codebook}
`;

/** ------------------------------
 *  STYLE-TOOL (NEU, integriert)
 *  ------------------------------ */

// Helper: nur Plain Objects durch die RSC-Grenze schicken
const toPlain = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// 1) Whitelist-Schema für Styling-Operationen
const StyleEdit = z.discriminatedUnion('op', [
  z.object({ op: z.literal('setTitle'), text: z.string() }),
  z.object({ op: z.literal('setSubtitle'), text: z.string() }),
  z.object({ op: z.literal('setSize'), width: z.number().int().positive(), height: z.number().int().positive() }),
  z.object({ op: z.literal('rotateXLabels'), angle: z.number().min(-90).max(90) }),
  z.object({ op: z.literal('rotateYLabels'), angle: z.number().min(-90).max(90) }),
  z.object({ op: z.literal('setLegend'), position: z.enum(['right','left','top','bottom','none']) }),
  z.object({ op: z.literal('setNominalPalette'), palette: z.union([z.string(), z.array(z.string().regex(/^#?[0-9a-fA-F]{6}$/))]) }),
  z.object({ op: z.literal('setQuantScale'), type: z.enum(['linear','log']), reverse: z.boolean().optional() }),
  z.object({ op: z.literal('setMarkOpacity'), value: z.number().min(0).max(1) }),
  z.object({ op: z.literal('setBarCornerRadius'), value: z.number().min(0).max(40) }),
  z.object({ op: z.literal('setLineStrokeWidth'), value: z.number().min(0.1).max(10) }),
  z.object({ op: z.literal('setPointSize'), value: z.number().min(1).max(400) }),
  z.object({ op: z.literal('toggleGrid'), axis: z.enum(['x','y']), on: z.boolean() }),
  z.object({ op: z.literal('setAxisTitle'), axis: z.enum(['x','y']), text: z.string() }),
  z.object({ op: z.literal('setAxisFormat'), axis: z.enum(['x','y']), fmt: z.string() }),
  z.object({ op: z.literal('setNumberFormat'), fmt: z.string() }),
  z.object({ op: z.literal('showValueLabels'), on: z.boolean() }),
  z.object({ op: z.literal('sortBy'), field: z.string(), dir: z.enum(['asc','desc']) }),
]);
const StyleEdits = z.array(StyleEdit).min(1);
type StyleEdits = z.infer<typeof StyleEdits>;

// 2) Deterministischer Patch-Applier
async function applyStyleEdits(spec: any, edits: StyleEdits) {
  const ensure = (obj: any, path: string[], seed: any = {}) => {
    let cur = obj;
    for (let i = 0; i < path.length; i++) {
      const k = path[i];
      if (cur[k] == null) cur[k] = i === path.length - 1 ? seed : {};
      cur = cur[k];
    }
    return cur;
  };

  const getMarkTarget = () => {
    if (Array.isArray(spec.layer) && spec.layer.length > 0) {
      spec.layer[0] = spec.layer[0] ?? {};
      (spec.layer[0] as any).mark = (spec.layer[0] as any).mark ?? (spec.mark ?? { type: 'bar' });
      return (spec.layer[0] as any).mark;
    }
    spec.mark = spec.mark ?? { type: 'bar' };
    return spec.mark;
  };

  spec.config = spec.config ?? {};
  spec.config.title = spec.config.title ?? {};
  spec.config.axis = spec.config.axis ?? {};
  spec.config.legend = spec.config.legend ?? {};

  const isQuant = (enc: any) => enc?.type === 'quantitative';
  const guessMetric = (s: any): string => {
    const y = s?.encoding?.y;
    if (y?.type === 'quantitative' && y.field) return y.field;
    const x = s?.encoding?.x;
    if (x?.type === 'quantitative' && x.field) return x.field;
    return (y?.field ?? x?.field ?? 'value');
  };

  for (const e of edits) {
    switch (e.op) {
      case 'setTitle':
        (spec as any).title = e.text;
        break;
      case 'setSubtitle':
        (spec as any).title = { text: (spec as any).title?.text ?? (spec as any).title ?? '', subtitle: e.text };
        break;
      case 'setSize':
        (spec as any).width = e.width; (spec as any).height = e.height;
        break;
      case 'rotateXLabels':
        ensure(spec, ['encoding','x','axis'], {});
        (spec as any).encoding.x.axis.labelAngle = e.angle;
        break;
      case 'rotateYLabels':
        ensure(spec, ['encoding','y','axis'], {});
        (spec as any).encoding.y.axis.labelAngle = e.angle;
        break;
      case 'setLegend':
        if (e.position === 'none') {
          (spec as any).config.legend = { ...((spec as any).config.legend ?? {}), disable: true };
        } else {
          (spec as any).config.legend = { ...((spec as any).config.legend ?? {}), orient: e.position as any, disable: false };
        }
        break;
      case 'setNominalPalette':
        if ((spec as any).encoding?.color) {
          (spec as any).encoding.color.scale = (spec as any).encoding.color.scale ?? {};
          if (Array.isArray(e.palette)) {
            (spec as any).encoding.color.scale.range = e.palette;
          } else {
            (spec as any).encoding.color.scale.scheme = e.palette;
          }
        }
        break;
      case 'setQuantScale':
        if ((spec as any).encoding?.color) {
          (spec as any).encoding.color.scale = { ...((spec as any).encoding.color.scale ?? {}), type: e.type, reverse: e.reverse ?? false };
        }
        break;
      case 'setMarkOpacity':
        getMarkTarget().opacity = e.value;
        break;
      case 'setBarCornerRadius':
        getMarkTarget().cornerRadius = e.value;
        break;
      case 'setLineStrokeWidth':
        getMarkTarget().strokeWidth = e.value;
        break;
      case 'setPointSize':
        getMarkTarget().size = e.value;
        break;
      case 'toggleGrid':
        if (e.axis === 'x') {
          ensure(spec, ['encoding','x','axis'], {});
          (spec as any).encoding.x.axis.grid = e.on;
        } else {
          ensure(spec, ['encoding','y','axis'], {});
          (spec as any).encoding.y.axis.grid = e.on;
        }
        break;
      case 'setAxisTitle':
        if (e.axis === 'x') {
          ensure(spec, ['encoding','x','axis'], {});
          (spec as any).encoding.x.axis.title = e.text;
        } else {
          ensure(spec, ['encoding','y','axis'], {});
          (spec as any).encoding.y.axis.title = e.text;
        }
        break;
      case 'setAxisFormat':
        if (e.axis === 'x') {
          ensure(spec, ['encoding','x','axis'], {});
          (spec as any).encoding.x.axis.format = e.fmt;
        } else {
          ensure(spec, ['encoding','y','axis'], {});
          (spec as any).encoding.y.axis.format = e.fmt;
        }
        break;
      case 'setNumberFormat':
        (spec as any).config.numberFormat = e.fmt;
        break;
      case 'showValueLabels':
        const ensureTextLayer = () => {
          (spec as any).layer = (spec as any).layer ?? [{ mark: (spec as any).mark ?? { type: 'bar' }, encoding: (spec as any).encoding }];
          const hasText = (spec as any).layer.some((l: any) => l?.mark?.type === 'text');
          if (!hasText) {
            (spec as any).layer.push({ mark: { type: 'text', fontSize: 11, dy: -6 }, encoding: { text: { field: guessMetric(spec), type: 'quantitative', format: '.2f' } } });
          }
        };
        const removeTextLayer = () => {
          if (Array.isArray((spec as any).layer)) {
            (spec as any).layer = (spec as any).layer.filter((l: any) => l?.mark?.type !== 'text');
          }
        };
        e.on ? ensureTextLayer() : removeTextLayer();
        break;
      case 'sortBy':
        if ((spec as any).encoding?.x && (spec as any).encoding?.y) {
          const catEnc = isQuant((spec as any).encoding.x) ? 'y' : 'x';
          const metricAxis = catEnc === 'x' ? 'y' : 'x';
          (spec as any).encoding[catEnc].sort = `${e.dir === 'desc' ? '-' : ''}${metricAxis}`;
        }
        break;
    }
  }

  // Fonts konsistent halten
  (spec as any).config.text  = { ...((spec as any).config.text  ?? {}), font: 'DejaVu Sans' };
  (spec as any).config.title = { ...((spec as any).config.title ?? {}), font: 'DejaVu Sans' };
  (spec as any).config.axis  = { ...((spec as any).config.axis  ?? {}), labelFont: 'DejaVu Sans', titleFont: 'DejaVu Sans' };
  (spec as any).config.legend= { ...((spec as any).config.legend?? {}), labelFont: 'DejaVu Sans', titleFont: 'DejaVu Sans' };
  return spec;
}

// 3) NL→Edits Prompt
const stylePlannerPrompt = (prompt: string) => `
Du bist ein Assistent, der **nur Styling**-Anpassungen für eine bestehende Vega-Lite-Spezifikation vornimmt.
Erzeuge eine JSON-Liste von Edits gemäß der zugelassenen Operationen (Whitelist). Keine Änderungen an Daten, Feldern oder Transformationen.

Beispiele in natürlicher Sprache → Edits:
- "Drehe X-Achsenlabels um 45°" → [{"op":"rotateXLabels","angle":45}]
- "Titel auf 'Zufriedenheit nach Land', Legende oben" → [{"op":"setTitle","text":"Zufriedenheit nach Land"},{"op":"setLegend","position":"top"}]
- "Weiche Pastellpalette" → [{"op":"setNominalPalette","palette":"pastel"}]
- "Werte direkt über den Balken anzeigen" → [{"op":"showValueLabels","on":true}]

Nutzerwunsch:
"${prompt}"
`;

// 4) styleTool-Definition (Export)
const styleToolInternal = ai.defineTool(
  {
    name: 'styleTool',
    description: 'Nimmt reine Styling-Änderungen an einer bestehenden Vega-Lite-Spec vor.',
    inputSchema: z.object({ nlPrompt: z.string(), spec: z.any() }),
    outputSchema: z.object({
      edits: StyleEdits.optional(),
      error: z.string().optional(),
      updatedSpec: z.any().optional(),
      imageDataUrl: z.string().optional(),
    }),
  },
  async (input) => {
    if (!isAiConfigured) {
      return { error: missingAiMessage };
    }
    try {
      // 1) NL → Edits (Whitelist)
      const plan = await ai.generate({
        model: 'openai/gpt-4o-mini',
        prompt: stylePlannerPrompt(input.nlPrompt),
        output: { schema: StyleEdits },
      });
      const edits = plan.output as StyleEdits | undefined;
      if (!edits?.length) return { error: 'Keine Styling-Edits erkannt.' };

      // 2) Patch anwenden
      const baseSpec = toPlain(input.spec);
      const updated = await applyStyleEdits(baseSpec, edits);
      const updatedPlain = toPlain(updated);

      // 3) Validieren (Vega-Lite → Vega)
      try {
        const [vegaCheck, vegaLiteCheck] = await Promise.all([
          tryLoadModule('vega', () => import('vega')),
          tryLoadModule('vega-lite', () => import('vega-lite')),
        ]);
        const vegaModule = vegaCheck.module;
        const vegaLiteModule = vegaLiteCheck.module;
        if (vegaModule && vegaLiteModule) {
          const vega = vegaModule.default ?? vegaModule;
          const vegaLite = vegaLiteModule.default ?? vegaLiteModule;
          vega.parse(vegaLite.compile(updated).spec);
        }
      } catch (e: any) {
        return { error: `Ungültige Spec nach Styling: ${e?.message ?? String(e)}` };
      }

      // 4) Rendern (PNG Data URL)
      const imageDataUrl = await renderVegaLiteToPngDataUrl(updatedPlain);
      return { edits, updatedSpec: updatedPlain, imageDataUrl };
    } catch (e: any) {
      return { error: `styleTool Fehler: ${e?.message ?? String(e)}` };
    }
  }
);

type StyleToolInput = Parameters<typeof styleToolInternal>[0];
type StyleToolOutput = Awaited<ReturnType<typeof styleToolInternal>>;

export async function styleTool(input: StyleToolInput): Promise<StyleToolOutput> {
  return styleToolInternal(input);
}

/** ------------------------------
 *  CHART-TOOL (bestehend)
 *  ------------------------------ */
const chartToolInternal = ai.defineTool(
  {
    name: 'chartTool',
    description: 'Erzeugt Diagramme (PNG, Vega-Lite Spec) basierend auf einer NL-Frage zu ESS-Daten.',
    inputSchema: ChartToolInputSchema,
    outputSchema: ChartToolOutputSchema,
  },
  async (input): Promise<ChartToolOutput> => {
    if (!isAiConfigured) {
      return { error: missingAiMessage };
    }
    try {
      // 1) Kontext holen
      const codebookHits = await searchCodebook(input.nlQuestion, 7);
      const retrievedContext = codebookHits.map((r: any) => `- ${r.content}`).join('\n');

      // 2) Plan + SQL via LLM (INSTANCE required)
      const planResp = await ai.generate({
        model: 'openai/gpt-4o',
        prompt: plannerPrompt(input.nlQuestion, retrievedContext),
        output: { schema: ChartPlanSchema },
      });

      const plan = planResp.output as z.infer<typeof ChartPlanSchema> as any;

      // JSON-Schema-Verwechslung abfangen
      if ((plan as any)?.properties || (plan as any)?.$schema) {
        return {
          error:
            'Planner lieferte ein JSON-Schema statt einer Instanz. Präzisiere bitte kurz die Anfrage (z. B. "AVG trstprl nach cntry als Balkendiagramm").',
          retrievedContext,
        };
      }

      const sqlQuery = plan?.sqlQuery;
      if (!sqlQuery) {
        return { error: 'LLM lieferte keinen SQL-Query.', retrievedContext };
      }

      // 3) Daten abfragen
      const res = await executeQuery(sqlQuery);
      if (res.error) {
        return { error: `SQL fehlgeschlagen: ${res.error}`, sqlQuery, retrievedContext };
      }

      let rows = (res.data || []) as any[];
      if (!rows.length) {
        return { error: 'Die Abfrage gab keine Daten zurück.', sqlQuery, retrievedContext };
      }

      // 3b) Strings → Zahlen
      rows = coerceNumericColumns(rows);

      // Sicherheitslimit
      const MAX_POINTS = 5000;
      const dataValues = rows.slice(0, MAX_POINTS);

      // 4) Vega-Lite Spec bauen (robust)
      const sample = dataValues[0] || {};
      const cols = Object.keys(sample);

      const isNumericCol = (k: string) => typeof sample[k] === 'number';
      const xType = typeof sample[plan.x] === 'number' ? 'quantitative' : 'nominal';
      const yType = plan.y && sample[plan.y] ? (typeof sample[plan.y] === 'number' ? 'quantitative' : 'nominal') : undefined;

      // Mark inkl. Pie
      const mark =
        plan.chartType === 'line'
          ? { type: 'line', point: true }
          : plan.chartType === 'scatter'
          ? { type: 'point' }
          : plan.chartType === 'pie'
          ? { type: 'arc' }
          : { type: 'bar', cornerRadiusTopLeft: 4, cornerRadiusTopRight: 4, tooltip: true };

      const isBarMark = (mark as any).type === 'bar';

      // Farbe nur, wenn es wirklich eine Spalte ist
      const safeColor = plan.color && /^#/.test(plan.color) ? undefined : plan.color;

      // metrisch/kategorial bestimmen (für Balken)
      let metricField: string | undefined;
      let categoryField: string | undefined;
      if (isBarMark && yType) {
        if (xType === 'quantitative' && yType === 'nominal') {
          metricField = plan.x;
          categoryField = plan.y;
        } else if (yType === 'quantitative' && xType === 'nominal') {
          metricField = plan.y;
          categoryField = plan.x;
        }
      }

      const needsClientSideAggregation = !sqlHasAggregate(sqlQuery) && !!metricField;

      // Aggregations-Default (Pie bevorzugt sum/count)
      let aggregateMethod: any = 'none';
      let aggTitlePrefix = '';

      if (plan.chartType === 'pie') {
        if (plan.aggregate && plan.aggregate !== 'none') {
          aggregateMethod = plan.aggregate === 'avg' ? 'mean' : plan.aggregate;
        } else {
          aggregateMethod = plan.y ? 'sum' : 'count';
        }
      } else if (plan.aggregate && plan.aggregate !== 'none') {
        aggregateMethod = plan.aggregate === 'avg' ? 'mean' : plan.aggregate;
        aggTitlePrefix = 'Durchschnitt von ';
      } else if (needsClientSideAggregation) {
        aggregateMethod = 'mean';
        aggTitlePrefix = 'Durchschnitt von ';
      }

      // ---------- PIE: eigene Spezifikation & früher Return ----------
      if (plan.chartType === 'pie') {
        const categoryFieldPie = plan.x;
        const metricFieldPie = plan.y; // alias aus SQL (z. B. "value") – kann fehlen

        const tooltipPie: any[] = [
          { field: categoryFieldPie, type: 'nominal', title: prettyAxisTitle(categoryFieldPie) },
        ];
        if (metricFieldPie) {
          tooltipPie.push({ field: metricFieldPie, type: 'quantitative', title: prettyAxisTitle(metricFieldPie), format: '.2f' });
        } else {
          tooltipPie.push({ aggregate: 'count', type: 'quantitative', title: 'Anzahl' });
        }

        const resolvedTitle =
          plan.title ??
          (`${metricFieldPie ?? 'Anzahl'} nach ${prettyAxisTitle(categoryFieldPie)}`);

        const vegaLiteSpec: any = {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
          data: { values: dataValues },
          width: 720,
          height: 420,
          title: resolvedTitle,
          layer: [
            {
              mark: { type: 'arc', innerRadius: 0 },
              encoding: {
                theta: metricFieldPie
                  ? { field: metricFieldPie, type: 'quantitative', aggregate: aggregateMethod }
                  : { aggregate: 'count', type: 'quantitative' },
                color: { field: categoryFieldPie, type: 'nominal', title: prettyAxisTitle(categoryFieldPie) },
                tooltip: tooltipPie
              }
            },
            {
              mark: { type: 'text', radius: 90 },
              encoding: {
                text: metricFieldPie
                  ? { field: metricFieldPie, aggregate: 'sum', type: 'quantitative', format: '.1f' }
                  : { aggregate: 'count', type: 'quantitative' }
              }
            }
          ],
          view: { stroke: null },
          config: {
            numberFormat: '.2f',
            text:  { font: 'DejaVu Sans', color: '#111' },
            title: { font: 'DejaVu Sans', color: '#111', fontSize: 14 },
            axis:  {
              labelFont: 'DejaVu Sans',
              titleFont: 'DejaVu Sans',
              labelColor: '#111',
              titleColor: '#111',
              grid: true,
            },
            legend: {
              labelFont: 'DejaVu Sans',
              titleFont: 'DejaVu Sans',
              labelColor: '#111',
              titleColor: '#111',
            },
            header: {
              labelFont: 'DejaVu Sans',
              titleFont: 'DejaVu Sans',
              labelColor: '#111',
              titleColor: '#111',
            },
          },
        };

        let imageDataUrl: string;
        try {
          imageDataUrl = await renderVegaLiteToPngDataUrl(vegaLiteSpec);
        } catch (renderErr: any) {
          return {
            error: `Render fehlgeschlagen: ${renderErr?.message || String(renderErr)}`,
            sqlQuery,
            retrievedContext,
          };
        }

        const caption =
          plan.title ||
          `Diagramm: pie von ${metricFieldPie ?? 'count'} über ${categoryFieldPie}`;

        return {
          imageDataUrl,
          vegaLiteSpec: JSON.parse(JSON.stringify(vegaLiteSpec)),
          sqlQuery,
          retrievedContext,
          title: plan.title,
          caption,
        };
      }
      // ---------- ENDE PIE-Zweig ----------

      const encX: any = {
        field: plan.x,
        type: xType,
        axis: { title: prettyAxisTitle(plan.x), labelAngle: 0, labelOverlap: 'greedy', labelLimit: 220 }
      };
      const encY: any = plan.y
        ? { field: plan.y, type: yType, axis: { title: prettyAxisTitle(plan.y) } }
        : undefined;

      if (aggregateMethod !== 'none' && metricField) {
        const metricEnc = (metricField === plan.x) ? encX : encY;
        if (metricEnc) {
          metricEnc.aggregate = aggregateMethod;
          if (metricEnc.type === 'quantitative') {
            metricEnc.axis = {
              ...(metricEnc.axis || {}),
              title: `${aggTitlePrefix}${prettyAxisTitle(metricField)}`,
              format: '.2f',
            };
            (metricEnc as any).invalid = null;
          }
        }
      }

      if (plan.chartType === 'histogram') {
        encX.bin = true;
        if (encY) {
          encY.aggregate = 'count';
          encY.type = 'quantitative';
          encY.axis = { title: 'Anzahl' };
        }
      }

      applyDefaultAxisDomain(encX, plan.x);
      if (encY) {
        applyDefaultAxisDomain(encY, plan.y);
      }

      if (isBarMark && categoryField && metricField) {
        const categoryEnc = (categoryField === plan.x) ? encX : encY;
        const metricAxis = (metricField === plan.x) ? 'x' : 'y';
        if (categoryEnc) categoryEnc.sort = `-${metricAxis}`;
      }

      const encColor = safeColor && cols.includes(safeColor)
        ? { field: safeColor, type: 'nominal', title: prettyAxisTitle(safeColor) }
        : undefined;

      const tooltipEnc: any[] = cols.map(c => ({
        field: c,
        type: isNumericCol(c) ? 'quantitative' : 'nominal',
        title: prettyAxisTitle(c),
        ...(isNumericCol(c) && { format: '.2f' })
      }));

      let textLayer: any;
      const metricSampleVal =
        metricField != null ? dataValues.find(d => Number.isFinite(+d[metricField]))?.[metricField] : undefined;
      const metricIsNumeric =
        metricField != null &&
        (typeof metricSampleVal === 'number' || (typeof metricSampleVal === 'string' && /^-?\d+(\.\d+)?$/.test(metricSampleVal)));

      if (isBarMark && metricField && metricIsNumeric) {
        const metricEnc = (metricField === plan.x) ? encX : encY;
        const textChannelDef: any = {
          field: metricField,
          type: 'quantitative',
          format: '.2f',
        };
        if (metricEnc?.aggregate) textChannelDef.aggregate = metricEnc.aggregate;

        const textMarkAlign =
          metricField === plan.x
            ? { align: 'left', baseline: 'middle', dx: 6 }
            : { align: 'center', baseline: 'bottom', dy: -8 };

        textLayer = {
          mark: { type: 'text', fontSize: 11, font: FONT_FAMILY, color: '#0f172a', ...textMarkAlign },
          encoding: { text: textChannelDef }
        };
      }

      const fallbackTitle =
        (`${prettyAxisTitle(plan.y) ?? ''}${plan.y ? ' nach ' : ''}${prettyAxisTitle(plan.x) ?? ''}`).trim() || 'Diagramm';
      const resolvedTitle = plan.title ?? fallbackTitle;
      const titleSpec =
        typeof resolvedTitle === 'string'
          ? { text: resolvedTitle }
          : resolvedTitle;

      const vegaLiteSpec: any = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: dataValues },
        width: 720,
        height: 420,
        padding: { top: 36, right: 36, bottom: 96, left: 96 },
        view: { stroke: null },
        title: titleSpec,
        encoding: {
          x: encX,
          ...(plan.y ? { y: encY } : {}),
          ...(encColor ? { color: encColor } : {}),
          tooltip: tooltipEnc,
        },
        layer: [
          { mark },
          ...(textLayer ? [textLayer] : []),
        ],
        config: {
          numberFormat: '.2f',
          text:  { font: FONT_FAMILY, color: '#111' },
          title: { font: FONT_FAMILY, color: '#111', fontSize: 16, subtitleFont: FONT_FAMILY, subtitleColor: '#1f2937' },
          axis:  {
            labelFont: FONT_FAMILY,
            titleFont: FONT_FAMILY,
            labelColor: '#111',
            titleColor: '#111',
            labelFontSize: 11,
            titleFontSize: 13,
            labelPadding: 8,
            grid: true,
            gridColor: '#e2e8f0',
            gridDash: [2, 2],
            domainColor: '#94a3b8',
            tickColor: '#94a3b8',
          },
          axisX: {
            labelAngle: 0,
            labelPadding: 12,
          },
          axisY: {
            labelPadding: 8,
          },
          legend: {
            labelFont: FONT_FAMILY,
            titleFont: FONT_FAMILY,
            labelColor: '#111',
            titleColor: '#111',
          },
          header: {
            labelFont: FONT_FAMILY,
            titleFont: FONT_FAMILY,
            labelColor: '#111',
            titleColor: '#111',
          },
          locale: { /* wie bei dir */ },
        },
      };

      let imageDataUrl: string;
      try {
        imageDataUrl = await renderVegaLiteToPngDataUrl(vegaLiteSpec);
      } catch (renderErr: any) {
        return {
          error: `Render fehlgeschlagen: ${renderErr?.message || String(renderErr)}`,
          sqlQuery,
          retrievedContext,
        };
      }

      const caption =
        plan.title ||
        `Diagramm: ${plan.chartType} von ${plan.y ?? '(n/a)'} über ${plan.x}${
          safeColor && cols.includes(safeColor) ? `, farblich nach ${safeColor}` : ''
        }`;

      return {
        imageDataUrl,
        vegaLiteSpec: JSON.parse(JSON.stringify(vegaLiteSpec)),
        sqlQuery,
        retrievedContext,
        title: plan.title,
        caption,
      };
    } catch (e: any) {
      return { error: `chartTool Fehler: ${e?.message ?? String(e)}` };
    }
  }
);

export async function chartTool(input: ChartToolInput): Promise<ChartToolOutput> {
  return chartToolInternal(input);
}
