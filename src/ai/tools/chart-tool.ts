'use server';

import { ai, isAiConfigured, missingAiMessage } from '@/src/ai/genkit';
import { z } from 'zod';
import { searchCodebook } from '@/src/lib/vector-search';
import { executeQuery } from '@/src/lib/data-service';
import { fetchTableColumns } from '@/src/lib/schema-cache';

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
  interpretation: z.string().optional(),
  error: z.string().optional(),
});
type ChartToolOutput = z.infer<typeof ChartToolOutputSchema>;

const VALID_IDENTIFIER = /^[A-Za-z0-9_]+$/;
const normalizeIdent = (value: string | undefined | null) =>
  (value ?? '').replace(/"/g, '').trim().toLowerCase();

const isKnownIdentifier = (value: string | undefined | null, known: Set<string>) => {
  if (!value) return true;
  return known.has(normalizeIdent(value));
};

const extractSqlAliases = (sql: string): Set<string> => {
  const aliasRegex = /\bAS\s+"?([A-Za-z0-9_]+)"?/gi;
  const aliases = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = aliasRegex.exec(sql)) !== null) {
    aliases.add(match[1].toLowerCase());
  }
  return aliases;
};

const extractQuotedIdentifiers = (sql: string): Set<string> => {
  const quotedRegex = /"([A-Za-z0-9_]+)"/g;
  const identifiers = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = quotedRegex.exec(sql)) !== null) {
    identifiers.add(match[1].toLowerCase());
  }
  return identifiers;
};

const validatePlanAgainstSchema = (
  plan: z.infer<typeof ChartPlanSchema>,
  {
    allowedColumns,
    aliasSet,
    tableName,
    sqlQuery,
  }: {
    allowedColumns: string[];
    aliasSet: Set<string>;
    tableName: string;
    sqlQuery: string;
  }
): string | null => {
  const allowedLower = allowedColumns.map(name => name.toLowerCase());
  const known = new Set<string>([...allowedLower, ...aliasSet]);

  const fieldsToValidate: string[] = [
    plan.x,
    plan.y,
    plan.color,
    ...(Array.isArray(plan.groupBy) ? plan.groupBy : []),
    ...(plan.filters ? Object.keys(plan.filters) : []),
  ].filter(Boolean) as string[];

  const unknownFields = Array.from(
    new Set(fieldsToValidate.filter(field => !isKnownIdentifier(field, known)))
  );
  if (unknownFields.length) {
    return `Unbekannte Felder im Plan: ${unknownFields.join(', ')}`;
  }

  const quotedIdentifiers = extractQuotedIdentifiers(sqlQuery);
  const tableLower = tableName.toLowerCase();
  const invalidQuoted = Array.from(quotedIdentifiers).filter(identifier => {
    if (identifier === tableLower || identifier === 'public') return false;
    return !known.has(identifier);
  });

  if (invalidQuoted.length) {
    return `SQL referenziert nicht erlaubte Spalten: ${invalidQuoted.join(', ')}`;
  }

  if (!quotedIdentifiers.has(tableLower) && !new RegExp(`\\b${tableName}\\b`, 'i').test(sqlQuery)) {
    return `SQL referenziert nicht die erwartete Tabelle "${tableName}".`;
  }

  return null;
};

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

const describeFieldLabel = (field?: string) => prettyAxisTitle(field) ?? field ?? '';

const collapseWhitespace = (value?: string) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

const stringsEqualIgnoreCase = (a?: string, b?: string) => {
  const normA = collapseWhitespace(a).toLowerCase();
  const normB = collapseWhitespace(b).toLowerCase();
  return normA.length > 0 && normA === normB;
};

const resolveAggregateLabel = (agg?: string | null) => {
  if (!agg) return null;
  switch (agg.toLowerCase()) {
    case 'avg':
    case 'mean':
      return 'Durchschnitt';
    case 'sum':
      return 'Summe';
    case 'count':
      return 'Anzahl';
    case 'median':
      return 'Median';
    case 'min':
      return 'Minimum';
    case 'max':
      return 'Maximum';
    case 'none':
      return null;
    default:
      return null;
  }
};

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  if (abs === 0) return '0';
  return value.toPrecision(3);
};

const MAX_INTERPRETATION_ROWS = 40;

type AxisFieldInfo = {
  field: string;
  label?: string;
};

type ChartInterpretationArgs = {
  question: string;
  chartType: z.infer<typeof ChartPlanSchema>['chartType'];
  axis: {
    x?: AxisFieldInfo;
    y?: AxisFieldInfo;
    color?: AxisFieldInfo;
  };
  aggregateLabel?: string | null;
  dataValues: any[];
};

type NumericSummary = {
  field: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
};

type CategoricalSummary = {
  field: string;
  total: number;
  topValues: Array<{ value: string; count: number; share: number }>;
};

const summarizeNumericField = (rows: any[], field: string): NumericSummary | null => {
  const values = rows
    .map(row => row?.[field])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const median =
    sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return {
    field,
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: total / sorted.length,
    median,
  };
};

const summarizeCategoricalField = (rows: any[], field: string): CategoricalSummary | null => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = row?.[field];
    if (raw == null || raw === '') continue;
    const key = String(raw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  if (!total) return null;
  const topValues = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([value, count]) => ({
      value,
      count,
      share: (count / total) * 100,
    }));
  return { field, total, topValues };
};

const buildInterpretationPrompt = ({
  question,
  chartType,
  axis,
  aggregateLabel,
  dataValues,
}: ChartInterpretationArgs): string | null => {
  if (!dataValues.length) return null;

  const fieldSet = new Set<string>();
  if (axis.x?.field) fieldSet.add(axis.x.field);
  if (axis.y?.field) fieldSet.add(axis.y.field);
  if (axis.color?.field) fieldSet.add(axis.color.field);

  const fields = Array.from(fieldSet);
  if (!fields.length) return null;

  const sampledRows = dataValues.slice(0, MAX_INTERPRETATION_ROWS).map(row => {
    const record: Record<string, unknown> = {};
    for (const name of fields) {
      if (Object.prototype.hasOwnProperty.call(row, name)) {
        record[name] = row[name];
      }
    }
    return record;
  });

  const numericSummaries = fields
    .map(field => summarizeNumericField(dataValues, field))
    .filter((summary): summary is NumericSummary => summary != null);
  const categoricalSummaries = fields
    .map(field => summarizeCategoricalField(dataValues, field))
    .filter((summary): summary is CategoricalSummary => summary != null);

  const axisLines: string[] = [];
  if (axis.x) axisLines.push(`- X: ${axis.x.label ?? axis.x.field} (Feld: ${axis.x.field})`);
  if (axis.y) axisLines.push(`- Y: ${axis.y.label ?? axis.y.field} (Feld: ${axis.y.field})`);
  if (axis.color)
    axisLines.push(`- Farbe: ${axis.color.label ?? axis.color.field} (Feld: ${axis.color.field})`);

  const numericLines = numericSummaries.length
    ? numericSummaries
        .map(
          summary =>
            `- ${summary.field}: n=${summary.count}, Mittelwert ${formatNumber(summary.mean)}, Median ${formatNumber(summary.median)}, Min ${formatNumber(summary.min)}, Max ${formatNumber(summary.max)}`
        )
        .join('\n')
    : '- keine numerischen Felder erkannt';

  const categoricalLines = categoricalSummaries.length
    ? categoricalSummaries
        .map(summary => {
          const top = summary.topValues
            .map(
              entry =>
                `${entry.value} (${entry.count}, ${formatNumber(entry.share)}%)`
            )
            .join(', ');
          return `- ${summary.field}: ${top}`;
        })
        .join('\n')
    : '- keine kategorialen Felder erkannt';

  const sampleJson = JSON.stringify(sampledRows, null, 2);

  return `
Du bist ein datenanalytischer Assistent. Analysiere die bereitgestellten Ergebnisse und formuliere eine fundierte Interpretation für die Nutzerfrage.

Frage: "${question}"
Diagrammtyp: ${chartType}
Aggregation: ${aggregateLabel ?? 'keine'}
Anzahl Datensätze: ${dataValues.length}
Achsen:
${axisLines.join('\n') || '- keine Angaben'}

Numerische Felder:
${numericLines}

Kategoriale Felder:
${categoricalLines}

Beispielhafte Datenzeilen (${sampledRows.length} von ${dataValues.length}):
${sampleJson}

Erstelle eine inhaltliche Interpretation auf Basis dieser Informationen. Antworte in derselben Sprache wie die Frage. Gehe auf auffällige Muster, Vergleiche oder Unterschiede ein und erwähne bei Bedarf Unsicherheiten (z. B. geringe Fallzahlen oder fehlende Daten). Die Interpretation darf höchstens 7 Sätze umfassen. Wiederhole den Diagrammtitel nicht wörtlich.
`.trim();
};

const limitSentenceCount = (value: string, maxSentences: number) => {
  if (!value) return value;
  if (maxSentences <= 0) return '';

  const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
  const segments: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(value)) !== null && segments.length < maxSentences) {
    segments.push(match[0]);
    if (segments.length === maxSentences) break;
  }

  if (!segments.length) return value.trim();

  const remainder =
    sentenceRegex.lastIndex < value.length ? value.slice(sentenceRegex.lastIndex).trim() : '';
  const truncated = segments.length === maxSentences && remainder.length > 0;
  if (!truncated) return value.trim();

  return segments.join('').trim();
};

async function generateChartInterpretation(args: ChartInterpretationArgs): Promise<string | undefined> {
  try {
    const prompt = buildInterpretationPrompt(args);
    if (!prompt) return undefined;
    const response = await ai.generate({
      model: 'openai/gpt-4o-mini',
      prompt,
    });
    const text = response.text?.trim();
    const limited = text ? limitSentenceCount(text, 7) : undefined;
    return limited && limited.length ? limited : undefined;
  } catch (error) {
    console.error('[chart-tool] Interpretation konnte nicht erzeugt werden.', error);
    return undefined;
  }
}

const buildCaptionText = (segments: Array<string | undefined>, titleText?: string) => {
  const filtered = segments.map(collapseWhitespace).filter(Boolean);
  if (!filtered.length) return undefined;
  const caption = filtered.join(' | ');
  if (stringsEqualIgnoreCase(caption, titleText)) {
    return filtered[0];
  }
  return caption;
};

const ensureSingleLine = (value?: string, maxLength = 160) => {
  const normalized = collapseWhitespace(value);
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  if (maxLength < 2) return normalized.slice(0, maxLength);
  return `${normalized.slice(0, maxLength - 1)}…`;
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
type PlannerPromptArgs = {
  question: string;
  codebook: string;
  allowedColumns: string[];
  tableName: string;
  previousError?: string;
};

const formatAllowedColumns = (columns: string[]) =>
  columns.map(name => `  - ${name}`).join('\n');

const plannerPrompt = ({
  question,
  codebook,
  allowedColumns,
  tableName,
  previousError,
}: PlannerPromptArgs) => `
Du bist ein Visual Analytics Assistent für die ESS-Datenbank.

AUFGABE:
- Erzeuge einen geeigneten Diagramm-Plan (ChartPlan) **als JSON-OBJEKT** und einen SQL-Query, um die Daten abzurufen.
- Benutze NUR Spaltennamen exakt wie im Codebook.
- Tabelle: "${tableName}" (mit doppelten Anführungszeichen).
- Erlaubte Spalten (vollständige Liste, **verwende ausschließlich diese Namen**):
${formatAllowedColumns(allowedColumns)}
- Bei Aggregationen: CAST(...) als NUMERIC und fehlende Codes ('77','88','99','555','666','777','888','999','9999') ausschließen.
- Typische Mappings:
  - Balken: kategoriale Dimension + Aggregat der Metrik. Sowohl (x=Kategorie,y=Aggregat) als auch (y=Kategorie,x=Aggregat) sind erlaubt.
  - Linie: zeitlich/ordinal auf x, Aggregat auf y
  - Scatter: numerische x und y, keine Aggregation (oder Aggregat auf Gruppierung)
  - Histogramm: x gebinnt (bin: true), y = count
  - Pie: Kategorie auf color (z. B. cntry), Metrik aggregiert auf theta (z. B. SUM(...) AS value). Wenn unklar, nutze COUNT(*) AS value.
- Wenn unklar, nutze bar chart mit AVG(...) nach "cntry".
- Wenn du aggregierst, gib dem Aggregat IMMER einen eindeutigen Alias (z. B. "avg_trust" oder "value") und verwende genau diesen Alias im Chart-Feld.

${previousError ? `HINWEIS: Der vorherige Vorschlag war ungültig (${previousError}). Bitte liefere einen neuen Plan, der diese Vorgabe respektiert.\n` : ''}

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
"${question}"

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

      const tableName = 'ESS1';
      let allowedColumns: string[];
      try {
        allowedColumns = await fetchTableColumns(tableName);
      } catch (schemaError: any) {
        const message = schemaError?.message ?? String(schemaError);
        return { error: `Schema konnte nicht geladen werden: ${message}`, retrievedContext };
      }

      const MAX_PLANNER_ATTEMPTS = 2;
      let plan: z.infer<typeof ChartPlanSchema> | null = null;
      let sqlQuery: string | undefined;
      let previousError: string | undefined;

      for (let attempt = 0; attempt < MAX_PLANNER_ATTEMPTS; attempt++) {
        const planResp = await ai.generate({
          model: 'openai/gpt-4o',
          prompt: plannerPrompt({
            question: input.nlQuestion,
            codebook: retrievedContext,
            allowedColumns,
            tableName,
            previousError,
          }),
          output: { schema: ChartPlanSchema },
        });

        const candidatePlan = planResp.output as z.infer<typeof ChartPlanSchema> as any;

        if ((candidatePlan as any)?.properties || (candidatePlan as any)?.$schema) {
          return {
            error:
              'Planner lieferte ein JSON-Schema statt einer Instanz. Präzisiere bitte kurz die Anfrage (z. B. "AVG trstprl nach cntry als Balkendiagramm").',
            retrievedContext,
          };
        }

        const candidateSql = candidatePlan?.sqlQuery;
        if (!candidateSql) {
          previousError = 'Plan enthielt keinen SQL-Query.';
          continue;
        }

        const aliasSet = extractSqlAliases(candidateSql);
        const validationError = validatePlanAgainstSchema(candidatePlan, {
          allowedColumns,
          aliasSet,
          tableName,
          sqlQuery: candidateSql,
        });

        if (!validationError) {
          plan = candidatePlan;
          sqlQuery = candidateSql;
          previousError = undefined;
          break;
        }

        previousError = validationError;
      }

      if (!plan || !sqlQuery) {
        const errorMessage =
          previousError ??
          'LLM lieferte keinen gültigen Plan. Bitte präzisiere die Anfrage oder versuche es erneut.';
        return { error: errorMessage, retrievedContext };
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

      // ---------- PIE: eigene Spezifikation & frueher Return ----------
      if (plan.chartType === 'pie') {
        const categoryFieldPie = plan.x;
        const metricFieldPie = plan.y; // alias aus SQL (z. B. "value") - kann fehlen

        const tooltipPie: any[] = [
          { field: categoryFieldPie, type: 'nominal', title: prettyAxisTitle(categoryFieldPie) },
        ];
        if (metricFieldPie) {
          tooltipPie.push({ field: metricFieldPie, type: 'quantitative', title: prettyAxisTitle(metricFieldPie), format: '.2f' });
        } else {
          tooltipPie.push({ aggregate: 'count', type: 'quantitative', title: 'Anzahl' });
        }

        const fallbackPieTitle =
          `${metricFieldPie ?? 'Anzahl'} nach ${prettyAxisTitle(categoryFieldPie)}`;
        const resolvedTitle = plan.title ?? fallbackPieTitle;
        const titleText: string | undefined =
          typeof resolvedTitle === 'string'
            ? resolvedTitle
            : typeof (resolvedTitle as any)?.text === 'string'
            ? (resolvedTitle as any).text
            : undefined;
        const aggregateLabel = resolveAggregateLabel(aggregateMethod);
        const axisParts: string[] = [`Kategorie: ${describeFieldLabel(categoryFieldPie)}`];
        if (metricFieldPie) axisParts.push(`Wert: ${describeFieldLabel(metricFieldPie)}`);
        const axisSegment =
          axisParts.length ? `Segmente (${axisParts.join(' - ')})` : undefined;
        const aggregationSegment =
          aggregateLabel ? `Aggregation: ${aggregateLabel}` : undefined;
        const narrative = await generateChartInterpretation({
          question: input.nlQuestion,
          chartType: plan.chartType,
          aggregateLabel,
          dataValues,
          axis: {
            x: { field: categoryFieldPie, label: describeFieldLabel(categoryFieldPie) },
            y: metricFieldPie
              ? { field: metricFieldPie, label: describeFieldLabel(metricFieldPie) }
              : undefined,
          },
        });
        const interpretation = narrative?.trim();
        const subtitleSource = buildCaptionText(
          [
            `Basis: ${dataValues.length} Faelle aus ESS1`,
            aggregationSegment,
            axisSegment,
          ],
          titleText,
        );
        const providedSubtitle =
          typeof resolvedTitle === 'object' && resolvedTitle
            ? (resolvedTitle as any).subtitle
            : undefined;
        const subtitle = ensureSingleLine(providedSubtitle ?? subtitleSource);
        const titleSpec =
          typeof resolvedTitle === 'string'
            ? { text: resolvedTitle }
            : { ...(resolvedTitle as Record<string, any>) };
        if (subtitle) {
          titleSpec.subtitle = subtitle;
        } else if (titleSpec.subtitle) {
          titleSpec.subtitle = ensureSingleLine(titleSpec.subtitle);
        }

        const vegaLiteSpec: any = {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
          data: { values: dataValues },
          width: 720,
          height: 420,
          title: titleSpec,
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

        return {
          imageDataUrl,
          vegaLiteSpec: JSON.parse(JSON.stringify(vegaLiteSpec)),
          sqlQuery,
          retrievedContext,
          title: titleText && titleText.trim() ? titleText : fallbackPieTitle,
          caption: subtitle,
          interpretation,
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
      const titleText: string | undefined =
        typeof resolvedTitle === 'string'
          ? resolvedTitle
          : typeof (resolvedTitle as any)?.text === 'string'
          ? (resolvedTitle as any).text
          : undefined;
      const titleSpec =
        typeof resolvedTitle === 'string'
          ? { text: resolvedTitle }
          : { ...(resolvedTitle as Record<string, any>) };

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

      const aggregateLabel = resolveAggregateLabel(aggregateMethod);
      const axisParts: string[] = [`X: ${describeFieldLabel(plan.x)}`];
      if (plan.y) axisParts.push(`Y: ${describeFieldLabel(plan.y)}`);
      if (safeColor) axisParts.push(`Farbe: ${describeFieldLabel(safeColor)}`);
      const axisSegment =
        axisParts.length ? `Achsen (${axisParts.join(' - ')})` : undefined;
      const aggregationSegment =
        aggregateLabel && metricField
          ? `Aggregation: ${aggregateLabel} fuer ${describeFieldLabel(metricField)}`
          : undefined;
      const narrative = await generateChartInterpretation({
        question: input.nlQuestion,
        chartType: plan.chartType,
        aggregateLabel,
        dataValues,
        axis: {
          x: { field: plan.x, label: describeFieldLabel(plan.x) },
          y: plan.y ? { field: plan.y, label: describeFieldLabel(plan.y) } : undefined,
          color: safeColor ? { field: safeColor, label: describeFieldLabel(safeColor) } : undefined,
        },
      });
      const interpretation = narrative?.trim();
      const subtitleSource = buildCaptionText(
        [
          `Basis: ${dataValues.length} Faelle aus ESS1`,
          aggregationSegment,
          axisSegment,
        ],
        titleText,
      );
      const providedSubtitle =
        typeof resolvedTitle === 'object' && resolvedTitle
          ? (resolvedTitle as any).subtitle
          : undefined;
      const subtitle = ensureSingleLine(providedSubtitle ?? subtitleSource);
      if (subtitle) {
        titleSpec.subtitle = subtitle;
      } else if (titleSpec.subtitle) {
        titleSpec.subtitle = ensureSingleLine(titleSpec.subtitle);
      }

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

      return {
        imageDataUrl,
        vegaLiteSpec: JSON.parse(JSON.stringify(vegaLiteSpec)),
        sqlQuery,
        retrievedContext,
        title: titleText && titleText.trim() ? titleText : fallbackTitle,
        caption: subtitle,
        interpretation,
      };
    } catch (e: any) {
      return { error: `chartTool Fehler: ${e?.message ?? String(e)}` };
    }
  }
);

export async function chartTool(input: ChartToolInput): Promise<ChartToolOutput> {
  return chartToolInternal(input);
}
