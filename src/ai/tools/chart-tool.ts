'use server';

import { ai, isAiConfigured, missingAiMessage } from '@/src/ai/genkit';
import { z } from 'zod';
import { searchCodebook } from '@/src/lib/vector-search';
import { executeQuery } from '@/src/lib/data-service';

// NEU: Font-Handling & Canvas-Rendering
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  NEVER_NUMERIC,
  buildBarChartEntries,
  looksNumeric,
  sanitizeLabel,
  type AxisEncoding,
  type BarChartEntry,
  type EncodingConfig,
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

async function tryImport(specifier: string) {
  try {
    return await import(/* @vite-ignore */ specifier);
  } catch (error) {
    if (isModuleNotFoundError(error, specifier)) {
      return null;
    }
    throw error;
  }
}

/** ------------------------------
 *  RENDERER (bestehend)
 *  ------------------------------ */
export async function renderVegaLiteToPngDataUrl(spec: any): Promise<string> {
  const [vegaModule, vegaLiteModule, resvgModule] = await Promise.all([
    tryImport('vega'),
    tryImport('vega-lite'),
    tryImport('@resvg/resvg-js'),
  ]);

  const vega = vegaModule?.default ?? vegaModule;
  const vegaLite = vegaLiteModule?.default ?? vegaLiteModule;
  const ResvgCtor =
    resvgModule?.Resvg ?? resvgModule?.default?.Resvg ?? resvgModule?.default ?? null;

  if (vega && vegaLite && ResvgCtor) {
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
      console.warn('Vega Renderer fehlgeschlagen, verwende Fallback.', error);
    }
  }

  return renderWithFallback(spec);
}

type RGBA = [number, number, number, number];

interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}


const BACKGROUND_COLOR: RGBA = [255, 255, 255, 255];
const AXIS_COLOR: RGBA = [71, 85, 105, 255];
const GRID_COLOR: RGBA = [226, 232, 240, 255];
const BAR_COLOR: RGBA = [59, 130, 246, 255];
const LINE_COLOR: RGBA = [220, 38, 38, 255];
const POINT_COLOR: RGBA = [34, 197, 94, 255];
const TEXT_COLOR: RGBA = [30, 41, 59, 255];
const VALUE_TEXT_COLOR: RGBA = [15, 23, 42, 255];
const FONT_FAMILY = 'DejaVu Sans';
const BASE_FONT_SIZE = 14;
const LINE_HEIGHT_MULTIPLIER = 1.25;

const TITLE_FONT_SCALE = 3;
const SUBTITLE_FONT_SCALE = 2;
const AXIS_TITLE_FONT_SCALE = 2;
const AXIS_TICK_FONT_SCALE = 1.6;
const CATEGORY_LABEL_FONT_SCALE = 1.6;
const VALUE_LABEL_FONT_SCALE = 1.6;

function computeFontSize(scale: number) {
  return Math.max(8, Math.round(BASE_FONT_SIZE * scale));
}

function computeLineHeight(scale: number) {
  return Math.max(10, Math.round(computeFontSize(scale) * LINE_HEIGHT_MULTIPLIER));
}

const AXIS_TICK_PADDING_X = 16;
const AXIS_TICK_PADDING_Y = 16 + computeLineHeight(AXIS_TICK_FONT_SCALE);
const CATEGORY_LABEL_PADDING = 24 + computeLineHeight(CATEGORY_LABEL_FONT_SCALE);
const AXIS_TITLE_PADDING_BOTTOM =
  CATEGORY_LABEL_PADDING + computeLineHeight(CATEGORY_LABEL_FONT_SCALE) + 20;
const AXIS_TITLE_PADDING_TOP = 36;
const VALUE_LABEL_VERTICAL_GAP = 16 + Math.round(computeFontSize(VALUE_LABEL_FONT_SCALE) * 0.7);
const VALUE_LABEL_HORIZONTAL_GAP = 18 + Math.round(computeFontSize(VALUE_LABEL_FONT_SCALE) * 0.8);
const POINT_VALUE_LABEL_GAP = 20 + Math.round(computeFontSize(VALUE_LABEL_FONT_SCALE) * 0.7);
const POINT_RADIUS = 6;

type CanvasModule = typeof import('canvas');
type NodeCanvas = ReturnType<CanvasModule['createCanvas']>;

let createCanvasImpl: CanvasModule['createCanvas'] | null = null;
let registerFontImpl: CanvasModule['registerFont'] | null = null;
let fontsRegistered = false;
let measurementCanvas: NodeCanvas | null = null;
let canvasLoadAttempted = false;

async function ensureCanvasModule(): Promise<boolean> {
  if (createCanvasImpl && registerFontImpl) {
    return true;
  }

  if (canvasLoadAttempted && (!createCanvasImpl || !registerFontImpl)) {
    return false;
  }
  canvasLoadAttempted = true;

  const canvasModule = await tryImport('canvas');
  if (!canvasModule) {
    return false;
  }

  const resolved: Partial<CanvasModule> & { default?: Partial<CanvasModule> } =
    (canvasModule as any)?.default ? (canvasModule as any).default : (canvasModule as any);
  const create = resolved.createCanvas;
  const register = resolved.registerFont;

  if (typeof create === 'function' && typeof register === 'function') {
    createCanvasImpl = create as CanvasModule['createCanvas'];
    registerFontImpl = register as CanvasModule['registerFont'];
    return true;
  }

  return false;
}

async function prepareCanvas(): Promise<boolean> {
  const hasCanvas = await ensureCanvasModule();
  if (!hasCanvas) {
    return false;
  }

  ensureCanvasFonts();
  return true;
}

function ensureCanvasFonts() {
  if (fontsRegistered) return;
  if (!registerFontImpl) {
    console.warn('Konnte Schriftarten nicht registrieren: Canvas-Modul nicht verfügbar.');
    return;
  }
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  const fontDefinitions: { file: string; options?: Parameters<CanvasModule['registerFont']>[1] }[] = [
    { file: 'DejaVuSans.ttf', options: { family: FONT_FAMILY } },
    { file: 'DejaVuSans-Bold.ttf', options: { family: FONT_FAMILY, weight: 'bold' } },
  ];

  fontDefinitions.forEach(({ file, options }) => {
    const filePath = path.join(fontDir, file);
    try {
      registerFontImpl(filePath, options as any);
    } catch (error) {
      console.warn(`Konnte Schriftart nicht registrieren: ${filePath}`, error);
    }
  });

  fontsRegistered = true;
}

function getMeasurementContext(fontSize: number) {
  ensureCanvasFonts();
  if (!createCanvasImpl) {
    throw new Error('Canvas-Modul nicht verfügbar.');
  }
  if (!measurementCanvas) {
    measurementCanvas = createCanvasImpl(1, 1);
  }
  const ctx = measurementCanvas.getContext('2d');
  ctx.font = `${fontSize}px "${FONT_FAMILY}"`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  return ctx;
}

function rgbaToCss(color: RGBA) {
  const alpha = (color[3] ?? 255) / 255;
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function drawText(
  buffer: PixelBuffer,
  x: number,
  y: number,
  rawText: string,
  color: RGBA,
  scale = 1,
  align: 'left' | 'center' | 'right' = 'left',
  baseline: 'top' | 'middle' | 'bottom' = 'top',
  fontWeight: 'normal' | 'bold' = 'normal',
) {
  const text = sanitizeLabel(rawText);
  if (!text) return;

  const fontSize = computeFontSize(scale);
  const measurementContext = getMeasurementContext(fontSize);
  measurementContext.font = `${fontWeight} ${fontSize}px "${FONT_FAMILY}"`;
  const metrics = measurementContext.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.25;
  const measuredWidth = Math.ceil(
    Math.max(metrics.width, metrics.actualBoundingBoxRight + metrics.actualBoundingBoxLeft),
  );
  const width = Math.max(1, measuredWidth);
  const height = Math.max(1, Math.ceil(ascent + descent));

  if (!createCanvasImpl) {
    console.warn('Canvas-Modul nicht verfügbar, Text kann nicht gezeichnet werden.');
    return;
  }
  const textCanvas = createCanvasImpl(width, height);
  const textContext = textCanvas.getContext('2d');
  textContext.antialias = 'subpixel';
  textContext.font = `${fontWeight} ${fontSize}px "${FONT_FAMILY}"`;
  textContext.fillStyle = rgbaToCss(color);
  textContext.textBaseline = 'top';
  textContext.textAlign = 'left';
  textContext.fillText(text, 0, Math.max(0, ascent - metrics.actualBoundingBoxAscent));

  const imageData = textContext.getImageData(0, 0, width, height);

  let startX = x;
  if (align === 'center') startX = x - width / 2;
  else if (align === 'right') startX = x - width;

  let startY = y;
  if (baseline === 'middle') startY = y - height / 2;
  else if (baseline === 'bottom') startY = y - height;

  blitImageData(buffer, imageData, startX, startY);
}

function blitImageData(buffer: PixelBuffer, imageData: ImageData, destX: number, destY: number) {
  const { data, width, height } = imageData;
  const startX = Math.round(destX);
  const startY = Math.round(destY);

  for (let row = 0; row < height; row++) {
    const targetY = startY + row;
    if (targetY < 0 || targetY >= buffer.height) continue;
    for (let col = 0; col < width; col++) {
      const targetX = startX + col;
      if (targetX < 0 || targetX >= buffer.width) continue;
      const srcIdx = (row * width + col) * 4;
      const alpha = data[srcIdx + 3] / 255;
      if (alpha <= 0) continue;
      const dstIdx = (targetY * buffer.width + targetX) * 4;
      const invAlpha = 1 - alpha;
      buffer.data[dstIdx] = Math.round(data[srcIdx] * alpha + buffer.data[dstIdx] * invAlpha);
      buffer.data[dstIdx + 1] = Math.round(data[srcIdx + 1] * alpha + buffer.data[dstIdx + 1] * invAlpha);
      buffer.data[dstIdx + 2] = Math.round(data[srcIdx + 2] * alpha + buffer.data[dstIdx + 2] * invAlpha);
      buffer.data[dstIdx + 3] = 255;
    }
  }
}

function shortenLabel(label: string, maxLength = 16) {
  if (!label) return '';
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(0, maxLength - 3))}...`;
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

const FALLBACK_PLACEHOLDER_BACKGROUND = '#f8fafc';
const FALLBACK_PLACEHOLDER_PRIMARY = '#0f172a';
const FALLBACK_PLACEHOLDER_SECONDARY = '#64748b';

function escapeSvgText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMissingCanvasPlaceholder(spec: any, width: number, height: number) {
  const title = typeof spec?.title === 'string' ? spec.title.trim() : '';
  const subtitle = 'Chart rendering temporarily unavailable';
  const detail = 'Server is missing optional "canvas" dependency.';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${FALLBACK_PLACEHOLDER_BACKGROUND}" rx="24" />
  <g fill="${FALLBACK_PLACEHOLDER_PRIMARY}" text-anchor="middle" font-family="'DejaVu Sans','Segoe UI',sans-serif">
    <text x="50%" y="40%" font-size="22" font-weight="600">${escapeSvgText(title || 'Visualization unavailable')}</text>
    <text x="50%" y="52%" font-size="16" fill="${FALLBACK_PLACEHOLDER_SECONDARY}">${escapeSvgText(subtitle)}</text>
    <text x="50%" y="62%" font-size="14" fill="${FALLBACK_PLACEHOLDER_SECONDARY}">${escapeSvgText(detail)}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function renderWithFallback(spec: any): Promise<string> {
  const width = clampNumber(Number(spec?.width) || 720, 320, 1600);
  const height = clampNumber(Number(spec?.height) || 420, 240, 1200);

  const prepared = await prepareCanvas();
  if (!prepared || !createCanvasImpl) {
    return renderMissingCanvasPlaceholder(spec, width, height);
  }
  const dataValues = Array.isArray(spec?.data?.values) ? spec.data.values : [];
  if (!dataValues.length) {
    throw new Error('Fallback renderer benötigt Datenwerte.');
  }

  const buffer: PixelBuffer = {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  };
  fillBackground(buffer, BACKGROUND_COLOR);

  const baseEncoding: EncodingConfig = spec?.encoding ?? {};
  const firstLayer = (Array.isArray(spec?.layer) && spec.layer.length ? spec.layer[0] : undefined) as any;
  const layerEncoding: EncodingConfig = firstLayer?.encoding ?? {};

  const encoding: EncodingConfig = {
    x: { ...(baseEncoding.x ?? {}), ...(layerEncoding.x ?? {}) },
    y: { ...(baseEncoding.y ?? {}), ...(layerEncoding.y ?? {}) },
    color: { ...(baseEncoding.color ?? {}), ...(layerEncoding.color ?? {}) },
  };

  const rawMark =
    firstLayer?.mark?.type ?? firstLayer?.mark ?? spec?.mark?.type ?? spec?.mark ?? 'bar';
  const markType =
    typeof rawMark === 'string'
      ? rawMark.toLowerCase()
      : Array.isArray(rawMark)
      ? 'bar'
      : 'bar';

  switch (markType) {
    case 'bar':
    case 'rect':
    case 'rule':
    case 'area':
      renderBarChartFallback(buffer, dataValues, encoding);
      break;
    case 'line':
      renderLineChartFallback(buffer, dataValues, encoding, false);
      break;
    case 'point':
    case 'circle':
    case 'scatter':
      renderLineChartFallback(buffer, dataValues, encoding, true);
      break;
    default:
      throw new Error(`Fallback-Renderer unterstützt Mark-Typ "${markType}" nicht.`);
  }

  drawTitle(buffer, spec?.title);
  const png = encodePng(buffer);
  return `data:image/png;base64,${png.toString('base64')}`;
}

export type { BarChartEntry } from './chart-tool-shared';

function renderBarChartFallback(
  buffer: PixelBuffer,
  dataValues: any[],
  encoding: EncodingConfig,
) {
  const width = buffer.width;
  const height = buffer.height;

  const xEnc = encoding.x ?? {};
  const yEnc = encoding.y ?? {};

  let orientation: 'vertical' | 'horizontal' = 'vertical';
  if (
    (xEnc.type === 'quantitative' && yEnc.type !== 'quantitative') ||
    (!yEnc.field && !!xEnc.field)
  ) {
    orientation = 'horizontal';
  }

  const margin =
    orientation === 'vertical'
      ? { top: 110, right: 60, bottom: 160, left: 140 }
      : { top: 110, right: 200, bottom: 140, left: 220 };

  const entries = buildBarChartEntries(dataValues, encoding, orientation);
  if (!entries.length) {
    throw new Error('Keine numerischen Daten für das Rendering gefunden.');
  }

  const innerWidth = Math.max(20, width - margin.left - margin.right);
  const innerHeight = Math.max(20, height - margin.top - margin.bottom);
  const originX = margin.left;
  const originY = height - margin.bottom;

  const maxValue = Math.max(...entries.map((entry) => entry.value), 0);
  const safeMax = maxValue <= 0 ? 1 : maxValue;

  const tickStep = computeNiceStep(safeMax, 5);
  const ticks: number[] = [];
  for (let tick = 0; tick <= safeMax + tickStep * 0.5; tick += tickStep) {
    ticks.push(Number(tick.toFixed(6)));
  }
  if (ticks.length === 0 || ticks[ticks.length - 1] < safeMax) {
    ticks.push(Number(safeMax.toFixed(6)));
  }

  ticks.forEach((tick) => {
    const ratio = safeMax === 0 ? 0 : Math.min(1, tick / safeMax);
    if (orientation === 'vertical') {
      const y = originY - ratio * innerHeight;
      drawLine(buffer, originX, y, originX + innerWidth, y, GRID_COLOR, tick === 0 ? 2 : 1);
      drawText(
        buffer,
        originX - AXIS_TICK_PADDING_X,
        y,
        formatTick(tick),
        TEXT_COLOR,
        AXIS_TICK_FONT_SCALE,
        'right',
        'middle',
      );
    } else {
      const x = originX + ratio * innerWidth;
      drawLine(buffer, x, margin.top, x, originY, GRID_COLOR, tick === 0 ? 2 : 1);
      drawText(
        buffer,
        x,
        originY + AXIS_TICK_PADDING_Y,
        formatTick(tick),
        TEXT_COLOR,
        AXIS_TICK_FONT_SCALE,
        'center',
        'top',
      );
    }
  });

  drawLine(buffer, originX, margin.top, originX, originY, AXIS_COLOR, 2);
  drawLine(buffer, originX, originY, originX + innerWidth, originY, AXIS_COLOR, 2);

  const bandCount = entries.length;
  const bandSpan = (orientation === 'vertical' ? innerWidth : innerHeight) / Math.max(bandCount, 1);
  const barSize = Math.max(4, Math.min(bandSpan * 0.72, orientation === 'vertical' ? 90 : 48));
  const gap = Math.max(2, bandSpan - barSize);

  entries.forEach((entry, index) => {
    const ratio = safeMax === 0 ? 0 : Math.max(0, Math.min(1, entry.value / safeMax));
    if (orientation === 'vertical') {
      const barHeight = ratio * innerHeight;
      const x0 = originX + index * bandSpan + gap / 2;
      const y0 = originY - barHeight;
      fillRect(buffer, x0, y0, barSize, barHeight, BAR_COLOR);
      const valueLabelY = Math.max(margin.top + 8, y0 - VALUE_LABEL_VERTICAL_GAP);
      drawText(
        buffer,
        x0 + barSize / 2,
        valueLabelY,
        formatTick(entry.value),
        VALUE_TEXT_COLOR,
        VALUE_LABEL_FONT_SCALE,
        'center',
        'bottom',
        'bold',
      );
      drawText(
        buffer,
        x0 + barSize / 2,
        originY + CATEGORY_LABEL_PADDING,
        shortenLabel(entry.label, 22),
        TEXT_COLOR,
        CATEGORY_LABEL_FONT_SCALE,
        'center',
        'top',
      );
    } else {
      const barLength = ratio * innerWidth;
      const y0 = margin.top + index * bandSpan + gap / 2;
      fillRect(buffer, originX, y0, barLength, barSize, BAR_COLOR);
      drawText(
        buffer,
        Math.min(originX + barLength + VALUE_LABEL_HORIZONTAL_GAP, width - 8),
        y0 + barSize / 2,
        formatTick(entry.value),
        VALUE_TEXT_COLOR,
        VALUE_LABEL_FONT_SCALE,
        'left',
        'middle',
        'bold',
      );
      drawText(
        buffer,
        originX - AXIS_TICK_PADDING_X,
        y0 + barSize / 2,
        shortenLabel(entry.label, 22),
        TEXT_COLOR,
        CATEGORY_LABEL_FONT_SCALE,
        'right',
        'middle',
      );
    }
  });

  const valueTitle =
    orientation === 'vertical'
      ? sanitizeLabel(yEnc.title ?? prettyAxisTitle(yEnc.field) ?? 'WERT')
      : sanitizeLabel(xEnc.title ?? prettyAxisTitle(xEnc.field) ?? 'WERT');
  if (valueTitle) {
    if (orientation === 'vertical') {
      drawText(
        buffer,
        margin.left - (AXIS_TICK_PADDING_X + 24),
        margin.top - AXIS_TITLE_PADDING_TOP,
        valueTitle,
        TEXT_COLOR,
        AXIS_TITLE_FONT_SCALE,
        'center',
        'bottom',
      );
    } else {
      drawText(
        buffer,
        originX + innerWidth / 2,
        margin.top - AXIS_TITLE_PADDING_TOP,
        valueTitle,
        TEXT_COLOR,
        AXIS_TITLE_FONT_SCALE,
        'center',
        'bottom',
      );
    }
  }

  const categoryTitle =
    orientation === 'vertical'
      ? sanitizeLabel(xEnc.title ?? prettyAxisTitle(xEnc.field) ?? '')
      : sanitizeLabel(yEnc.title ?? prettyAxisTitle(yEnc.field) ?? '');
  if (categoryTitle) {
    if (orientation === 'vertical') {
      drawText(
        buffer,
        originX + innerWidth / 2,
        originY + AXIS_TITLE_PADDING_BOTTOM,
        categoryTitle,
        TEXT_COLOR,
        AXIS_TITLE_FONT_SCALE,
        'center',
        'top',
      );
    } else {
      drawText(
        buffer,
        margin.left - (AXIS_TICK_PADDING_X + 40),
        margin.top + innerHeight / 2,
        categoryTitle,
        TEXT_COLOR,
        AXIS_TITLE_FONT_SCALE,
        'center',
        'middle',
      );
    }
  }
}

function renderLineChartFallback(
  buffer: PixelBuffer,
  dataValues: any[],
  encoding: EncodingConfig,
  scatterOnly: boolean,
) {
  const width = buffer.width;
  const height = buffer.height;
  const margin = {
    top: 110,
    right: 80,
    bottom: 160,
    left: 140,
  };

  const xEnc = encoding.x ?? {};
  const yEnc = encoding.y ?? {};

  const xField = xEnc.field ?? 'x';
  const yField = yEnc.field ?? 'y';

  const entries = dataValues
    .map((row: any, index: number) => {
      const rawX = row?.[xField];
      const rawY = row?.[yField];
      const numericY =
        typeof rawY === 'number'
          ? rawY
          : typeof rawY === 'string' && looksNumeric(rawY)
          ? parseFloat(rawY)
          : NaN;
      let numericX: number | null = null;
      if (typeof rawX === 'number') {
        numericX = rawX;
      } else if (typeof rawX === 'string' && looksNumeric(rawX)) {
        numericX = parseFloat(rawX);
      }
      return {
        rawX,
        numericX,
        numericY,
        index,
      };
    })
    .filter((entry) => Number.isFinite(entry.numericY));

  if (!entries.length) {
    throw new Error('Keine numerischen Daten für das Rendering gefunden.');
  }

  const hasNumericX = entries.every((entry) => entry.numericX != null);
  const xPositions = hasNumericX
    ? entries.map((entry) => entry.numericX ?? 0)
    : entries.map((_, index) => index);
  const labels = entries.map((entry) =>
    sanitizeLabel(
      hasNumericX
        ? entry.rawX != null
          ? String(entry.rawX)
          : String(entry.numericX ?? entry.index)
        : entry.rawX != null
        ? String(entry.rawX)
        : String(entry.index),
    ),
  );

  let xMin = Math.min(...xPositions);
  let xMax = Math.max(...xPositions);
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }

  let yMin = Math.min(...entries.map((entry) => entry.numericY), 0);
  let yMax = Math.max(...entries.map((entry) => entry.numericY), 0);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  if (yMax <= yMin) {
    yMax = yMin + 1;
  }

  const innerWidth = Math.max(20, width - margin.left - margin.right);
  const innerHeight = Math.max(20, height - margin.top - margin.bottom);
  const originX = margin.left;
  const originY = height - margin.bottom;

  const xScale = (value: number) => originX + ((value - xMin) / (xMax - xMin)) * innerWidth;
  const yScale = (value: number) => originY - ((value - yMin) / (yMax - yMin)) * innerHeight;

  const yTickStep = computeNiceStep(Math.max(Math.abs(yMax - yMin), 1), 5);
  const yTicks: number[] = [];
  for (
    let tick = Math.ceil(yMin / yTickStep) * yTickStep;
    tick <= yMax + 1e-6;
    tick += yTickStep
  ) {
    yTicks.push(Number(tick.toFixed(6)));
  }
  if (!yTicks.some((tick) => Math.abs(tick) < 1e-6)) {
    yTicks.push(0);
  }
  yTicks.sort((a, b) => a - b);

  yTicks.forEach((tick) => {
    const y = yScale(tick);
    drawLine(
      buffer,
      originX,
      y,
      originX + innerWidth,
      y,
      GRID_COLOR,
      Math.abs(tick) < 1e-6 ? 2 : 1,
    );
    drawText(
      buffer,
      originX - AXIS_TICK_PADDING_X,
      y,
      formatTick(tick),
      TEXT_COLOR,
      AXIS_TICK_FONT_SCALE,
      'right',
      'middle',
    );
  });

  if (hasNumericX) {
    const xTickStep = computeNiceStep(Math.max(Math.abs(xMax - xMin), 1), Math.min(5, entries.length));
    for (
      let tick = Math.ceil(xMin / xTickStep) * xTickStep;
      tick <= xMax + 1e-6;
      tick += xTickStep
    ) {
      const x = xScale(tick);
      drawLine(buffer, x, margin.top, x, originY, GRID_COLOR, 1);
      drawText(
        buffer,
        x,
        originY + AXIS_TICK_PADDING_Y,
        formatTick(tick),
        TEXT_COLOR,
        AXIS_TICK_FONT_SCALE,
        'center',
        'top',
      );
    }
  } else if (entries.length <= 12) {
    entries.forEach((_, idx) => {
      const x = xScale(xPositions[idx]);
      drawLine(buffer, x, margin.top, x, originY, GRID_COLOR, 1);
      drawText(
        buffer,
        x,
        originY + AXIS_TICK_PADDING_Y,
        shortenLabel(labels[idx], 22),
        TEXT_COLOR,
        CATEGORY_LABEL_FONT_SCALE,
        'center',
        'top',
      );
    });
  } else {
    const sample = new Set<number>([0, entries.length - 1, Math.floor((entries.length - 1) / 2)]);
    sample.forEach((idx) => {
      const x = xScale(xPositions[idx]);
      drawLine(buffer, x, margin.top, x, originY, GRID_COLOR, 1);
      drawText(
        buffer,
        x,
        originY + AXIS_TICK_PADDING_Y,
        shortenLabel(labels[idx], 22),
        TEXT_COLOR,
        CATEGORY_LABEL_FONT_SCALE,
        'center',
        'top',
      );
    });
  }

  drawLine(buffer, originX, margin.top, originX, originY, AXIS_COLOR, 2);
  drawLine(buffer, originX, originY, originX + innerWidth, originY, AXIS_COLOR, 2);

  const sorted = entries
    .map((entry, idx) => ({ entry, xValue: xPositions[idx], label: labels[idx] }))
    .sort((a, b) => a.xValue - b.xValue);

  if (!scatterOnly && sorted.length > 1) {
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const current = sorted[i];
      drawLine(
        buffer,
        xScale(prev.xValue),
        yScale(prev.entry.numericY),
        xScale(current.xValue),
        yScale(current.entry.numericY),
        LINE_COLOR,
        2,
      );
    }
  }

  sorted.forEach((item) => {
    const cx = xScale(item.xValue);
    const cy = yScale(item.entry.numericY);
    const labelY = Math.max(margin.top + 8, cy - POINT_VALUE_LABEL_GAP);
    drawCircle(buffer, cx, cy, POINT_RADIUS, scatterOnly ? POINT_COLOR : LINE_COLOR);
    drawText(
      buffer,
      cx,
      labelY,
      formatTick(item.entry.numericY),
      VALUE_TEXT_COLOR,
      VALUE_LABEL_FONT_SCALE,
      'center',
      'bottom',
      'bold',
    );
  });

  const xTitle = sanitizeLabel(xEnc.title ?? prettyAxisTitle(xEnc.field) ?? '');
  if (xTitle) {
    drawText(
      buffer,
      originX + innerWidth / 2,
      originY + AXIS_TITLE_PADDING_BOTTOM,
      xTitle,
      TEXT_COLOR,
      AXIS_TITLE_FONT_SCALE,
      'center',
      'top',
    );
  }
  const yTitle = sanitizeLabel(yEnc.title ?? prettyAxisTitle(yEnc.field) ?? '');
  if (yTitle) {
    drawText(
      buffer,
      margin.left - (AXIS_TICK_PADDING_X + 24),
      margin.top - AXIS_TITLE_PADDING_TOP,
      yTitle,
      TEXT_COLOR,
      AXIS_TITLE_FONT_SCALE,
      'center',
      'bottom',
    );
  }
}

function drawTitle(buffer: PixelBuffer, rawTitle: any) {
  const width = buffer.width;
  if (!rawTitle) return;

  let mainTitle: string | undefined;
  let subtitle: string | undefined;
  if (typeof rawTitle === 'string') {
    mainTitle = rawTitle;
  } else if (typeof rawTitle === 'object') {
    mainTitle = typeof rawTitle.text === 'string' ? rawTitle.text : undefined;
    subtitle = typeof rawTitle.subtitle === 'string' ? rawTitle.subtitle : undefined;
  }

  const normalizedTitle = sanitizeLabel(mainTitle ?? '');
  const normalizedSubtitle = sanitizeLabel(subtitle ?? '');

  if (normalizedTitle) {
    const titleY = 40;
    drawText(buffer, width / 2, titleY, normalizedTitle, TEXT_COLOR, TITLE_FONT_SCALE, 'center', 'middle', 'bold');
  }
  if (normalizedSubtitle) {
    const titleFontSize = computeFontSize(TITLE_FONT_SCALE);
    const subtitleY = 40 + Math.round(titleFontSize * 0.9) + 12;
    drawText(buffer, width / 2, subtitleY, normalizedSubtitle, TEXT_COLOR, SUBTITLE_FONT_SCALE, 'center', 'middle');
  }
}

function fillBackground(buffer: PixelBuffer, color: RGBA) {
  for (let i = 0; i < buffer.data.length; i += 4) {
    buffer.data[i] = color[0];
    buffer.data[i + 1] = color[1];
    buffer.data[i + 2] = color[2];
    buffer.data[i + 3] = color[3];
  }
}

function setPixel(buffer: PixelBuffer, x: number, y: number, color: RGBA) {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || px >= buffer.width || py < 0 || py >= buffer.height) return;
  const idx = (py * buffer.width + px) * 4;
  buffer.data[idx] = color[0];
  buffer.data[idx + 1] = color[1];
  buffer.data[idx + 2] = color[2];
  buffer.data[idx + 3] = color[3];
}

function fillRect(buffer: PixelBuffer, x: number, y: number, width: number, height: number, color: RGBA) {
  if (width <= 0 || height <= 0) return;
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(buffer.width - 1, Math.ceil(x + width) - 1);
  const endY = Math.min(buffer.height - 1, Math.ceil(y + height) - 1);
  for (let py = startY; py <= endY; py++) {
    for (let px = startX; px <= endX; px++) {
      setPixel(buffer, px, py, color);
    }
  }
}

function drawLine(
  buffer: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: RGBA,
  thickness = 1,
) {
  let cx = Math.round(x0);
  let cy = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - cx);
  const dy = Math.abs(ty - cy);
  const sx = cx < tx ? 1 : -1;
  const sy = cy < ty ? 1 : -1;
  let err = dx - dy;

  while (true) {
    fillRect(buffer, cx - thickness / 2, cy - thickness / 2, thickness, thickness, color);
    if (cx === tx && cy === ty) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

function drawCircle(buffer: PixelBuffer, cx: number, cy: number, radius: number, color: RGBA) {
  const r = Math.max(1, radius);
  const startX = Math.floor(cx - r);
  const endX = Math.ceil(cx + r);
  const startY = Math.floor(cy - r);
  const endY = Math.ceil(cy + r);
  const rSquared = r * r;
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rSquared) {
        setPixel(buffer, x, y, color);
      }
    }
  }
}

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

function formatTick(value: number) {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 100) return Math.round(value).toString();
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function encodePng(buffer: PixelBuffer): Buffer {
  const { width, height, data } = buffer;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter byte
    Buffer.from(data.subarray(y * stride, y * stride + stride)).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    createChunk('IHDR', header),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createChunk(type: string, data: Buffer) {
  const chunkType = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([chunkType, data])), 0);
  return Buffer.concat([length, chunkType, data, crc]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

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
        const [vegaModule, vegaLiteModule] = await Promise.all([
          tryImport('vega'),
          tryImport('vega-lite'),
        ]);
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
