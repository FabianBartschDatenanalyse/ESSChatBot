import Papa from 'papaparse';
import { DatasetColumnType, DatasetMeasurementLevel } from '@/src/features/datasets/types';

export type ColumnMetadataOverride = {
  name: string;
  displayName?: string;
  description?: string;
  dataType?: DatasetColumnType;
  measurementLevel?: DatasetMeasurementLevel;
  valueLabels?: string[];
  missingValues?: string[];
  isWeight?: boolean;
};

export type DatasetMetadataOverrides = {
  defaultMissingValues?: string[];
  weightColumn?: string | null;
  notes?: string;
  columns: ColumnMetadataOverride[];
};

const BOOLEAN_TRUE = new Set(['true', '1', 'yes', 'y', 'ja', 'wahr']);

const parseColumnType = (value: unknown): DatasetColumnType | undefined => {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  switch (normalized) {
    case 'string':
    case 'text':
    case 'categorical':
      return 'string';
    case 'numeric':
    case 'number':
    case 'float':
    case 'double':
    case 'integer':
    case 'int':
      return 'number';
    case 'boolean':
    case 'bool':
    case 'binary':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'time':
      return 'date';
    default:
      return undefined;
  }
};

const parseMeasurementLevel = (value: unknown): DatasetMeasurementLevel | undefined => {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  switch (normalized) {
    case 'nominal':
    case 'categorical':
      return 'nominal';
    case 'ordinal':
    case 'ordered':
      return 'ordinal';
    case 'metric':
    case 'scale':
    case 'interval':
    case 'ratio':
    case 'continuous':
      return 'metric';
    default:
      return undefined;
  }
};

const normalizeList = (value: unknown, separators = /[;,|\n]/): string[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  }
  const text = String(value);
  if (!text.trim().length) {
    return undefined;
  }
  return text
    .split(separators)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

type JsonColumnDefinition =
  | {
      name: unknown;
      displayName?: unknown;
      description?: unknown;
      dataType?: unknown;
      measurementLevel?: unknown;
      valueLabels?: unknown;
      missingValues?: unknown;
      isWeight?: unknown;
    }
  | Record<string, unknown>;

type JsonMetadataShape =
  | {
      defaultMissingValues?: unknown;
      weightColumn?: unknown;
      notes?: unknown;
      columns?: JsonColumnDefinition[];
    }
  | JsonColumnDefinition[];

const valueLabelsFromJson = (value: unknown): string[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const labels: string[] = [];
    for (const entry of value) {
      if (entry == null) {
        continue;
      }
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed.length) {
          labels.push(trimmed);
        }
        continue;
      }
      if (typeof entry === 'object') {
        const maybeValue = (entry as { value?: unknown }).value;
        const maybeLabel = (entry as { label?: unknown }).label;
        const valueText = maybeValue === undefined ? '' : String(maybeValue);
        const labelText = maybeLabel === undefined ? '' : String(maybeLabel);
        if (valueText.length && labelText.length) {
          labels.push(`${valueText}=${labelText}`);
        } else if (valueText.length) {
          labels.push(valueText);
        } else if (labelText.length) {
          labels.push(labelText);
        }
      }
    }
    return labels.length ? labels : undefined;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) {
      return undefined;
    }
    return entries.map(([key, label]) => `${key}=${label ?? ''}`);
  }
  if (typeof value === 'string') {
    return normalizeList(value);
  }
  return undefined;
};

const normalizeColumnName = (input: string | undefined | null): string | null => {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed.length) return null;
  return trimmed.toLowerCase();
};

const ensureOverride = (definition: ColumnMetadataOverride | null): ColumnMetadataOverride | null => {
  if (!definition) return null;
  const { name } = definition;
  const normalized = normalizeColumnName(name);
  if (!normalized) {
    return null;
  }
  return {
    ...definition,
    name: normalized,
    displayName: definition.displayName?.trim().length ? definition.displayName.trim() : undefined,
    description: definition.description?.trim().length ? definition.description.trim() : undefined,
    dataType: definition.dataType,
    measurementLevel: definition.measurementLevel,
    valueLabels: definition.valueLabels && definition.valueLabels.length ? definition.valueLabels : undefined,
    missingValues: definition.missingValues && definition.missingValues.length ? definition.missingValues : undefined,
    isWeight: Boolean(definition.isWeight),
  };
};

const buildStructuredOverridesFromJson = (raw: JsonMetadataShape): DatasetMetadataOverrides => {
  const overrides: DatasetMetadataOverrides = {
    columns: [],
  };

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const columnName = normalizeColumnName((entry as any).name);
      if (!columnName) {
        continue;
      }
      const override: ColumnMetadataOverride = {
        name: columnName,
        displayName: typeof (entry as any).displayName === 'string' ? (entry as any).displayName : undefined,
        description: typeof (entry as any).description === 'string' ? (entry as any).description : undefined,
        dataType: parseColumnType((entry as any).dataType),
        measurementLevel: parseMeasurementLevel((entry as any).measurementLevel),
        valueLabels: valueLabelsFromJson((entry as any).valueLabels),
        missingValues: normalizeList((entry as any).missingValues),
        isWeight: BOOLEAN_TRUE.has(String((entry as any).isWeight ?? '').trim().toLowerCase()),
      };
      const normalized = ensureOverride(override);
      if (normalized) {
        overrides.columns.push(normalized);
        if (normalized.isWeight && !overrides.weightColumn) {
          overrides.weightColumn = entry?.name ? String(entry.name).trim() : undefined;
        }
      }
    }
    return overrides;
  }

  const root = raw as { [key: string]: unknown };
  const defaultMissing = normalizeList(root.defaultMissingValues);
  if (defaultMissing?.length) {
    overrides.defaultMissingValues = defaultMissing;
  }
  if (typeof root.notes === 'string' && root.notes.trim().length) {
    overrides.notes = root.notes.trim();
  }

  if (root.weightColumn && typeof root.weightColumn === 'string') {
    overrides.weightColumn = root.weightColumn.trim();
  }

  const columnEntries = Array.isArray(root.columns) ? root.columns : [];
  for (const entry of columnEntries) {
    const columnName = normalizeColumnName((entry as any).name);
    if (!columnName) {
      continue;
    }
    const override: ColumnMetadataOverride = {
      name: columnName,
      displayName: typeof (entry as any).displayName === 'string' ? (entry as any).displayName : undefined,
      description: typeof (entry as any).description === 'string' ? (entry as any).description : undefined,
      dataType: parseColumnType((entry as any).dataType),
      measurementLevel: parseMeasurementLevel((entry as any).measurementLevel),
      valueLabels: valueLabelsFromJson((entry as any).valueLabels),
      missingValues: normalizeList((entry as any).missingValues),
      isWeight: BOOLEAN_TRUE.has(String((entry as any).isWeight ?? '').trim().toLowerCase()),
    };
    const normalized = ensureOverride(override);
    if (normalized) {
      overrides.columns.push(normalized);
      if (normalized.isWeight && !overrides.weightColumn && typeof (entry as any).name === 'string') {
        overrides.weightColumn = entry.name.trim();
      }
    }
  }

  return overrides;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pickFirstString = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === 'string' && candidate.trim().length) {
      return candidate.trim();
    }
  }
  return undefined;
};

const mergeOverrides = (
  base: DatasetMetadataOverrides,
  extra: DatasetMetadataOverrides,
): DatasetMetadataOverrides => {
  const mergedColumns = extra.columns?.length ? extra.columns : base.columns;
  const mergedNotes =
    base.notes && extra.notes && base.notes !== extra.notes
      ? `${base.notes}\n\n${extra.notes}`
      : base.notes ?? extra.notes;
  return {
    columns: mergedColumns,
    defaultMissingValues: extra.defaultMissingValues ?? base.defaultMissingValues,
    weightColumn: extra.weightColumn ?? base.weightColumn,
    notes: mergedNotes,
  };
};

type HtmlAstNode = {
  type?: string;
  tag?: string;
  attrs?: Record<string, unknown>;
  children?: HtmlAstNode[];
  content?: unknown;
};

const collectHtmlText = (node: HtmlAstNode | undefined | null): string => {
  if (!node) return '';
  if (node.type === 'text') {
    return typeof node.content === 'string' ? node.content : '';
  }
  if (!Array.isArray(node.children)) {
    return '';
  }
  return node.children.map((child) => collectHtmlText(child)).join('');
};

const normalizeHtmlDescription = (text: string): string =>
  text.replace(/^[\s\-\u2013\u2014:]+/, '').trim();

const attemptHtmlAstMetadata = (raw: unknown): DatasetMetadataOverrides | null => {
  if (!isRecord(raw) || raw.type !== 'document' || !Array.isArray(raw.children)) {
    return null;
  }

  const columnsMap = new Map<string, ColumnMetadataOverride>();

  const upsertColumn = (name: string, patch: Partial<ColumnMetadataOverride>) => {
    const normalizedName = normalizeColumnName(name);
    if (!normalizedName) return;

    const existing = columnsMap.get(normalizedName);
    const mergedValueLabels = Array.from(
      new Set([...(existing?.valueLabels ?? []), ...(patch.valueLabels ?? [])].filter(Boolean)),
    );
    const missing = new Set<string>();
    for (const value of existing?.missingValues ?? []) {
      if (value) {
        missing.add(value);
      }
    }
    for (const value of patch.missingValues ?? []) {
      if (value) {
        missing.add(value);
      }
    }

    const merged: ColumnMetadataOverride = {
      ...existing,
      ...patch,
      name: normalizedName,
      displayName: patch.displayName ?? existing?.displayName,
      description: patch.description ?? existing?.description,
      dataType: patch.dataType ?? existing?.dataType,
      measurementLevel: patch.measurementLevel ?? existing?.measurementLevel,
      valueLabels: mergedValueLabels.length ? mergedValueLabels : existing?.valueLabels,
      missingValues: missing.size ? Array.from(missing) : existing?.missingValues,
      isWeight: patch.isWeight ?? existing?.isWeight,
    };

    const ensured = ensureOverride(merged);
    if (ensured) {
      columnsMap.set(ensured.name, ensured);
    }
  };

  const extractTableRows = (table: HtmlAstNode | undefined): string[][] => {
    if (!table || table.tag !== 'table' || !Array.isArray(table.children)) {
      return [];
    }
    const rowSections = (table.children ?? []).filter(
      (child): child is HtmlAstNode => Boolean(child && child.type === 'element'),
    );
    const bodies = rowSections.filter((child) => child.tag === 'tbody');
    const sources = bodies.length ? bodies : rowSections;

    const rows: string[][] = [];

    const collectRows = (container: HtmlAstNode) => {
      for (const maybeRow of container.children ?? []) {
        if (maybeRow?.type === 'element' && maybeRow.tag === 'tr') {
          const cells: string[] = [];
          for (const cell of maybeRow.children ?? []) {
            if (cell?.type === 'element' && typeof cell.tag === 'string' && ['td', 'th'].includes(cell.tag)) {
              const textValue = collectHtmlText(cell).trim();
              cells.push(textValue);
            }
          }
          if (cells.length) {
            rows.push(cells);
          }
        }
      }
    };

    if (!sources.length) {
      collectRows(table);
    } else {
      for (const source of sources) {
        collectRows(source);
      }
    }

    return rows;
  };

  const missingLabelIndicators = [
    'not applicable',
    'no answer',
    "don't know",
    'dont know',
    'refusal',
    'refused',
    'missing',
  ];

  const parseValueTable = (wrapper: HtmlAstNode): { valueLabels: string[]; missing: string[] } => {
    const table = (wrapper.children ?? []).find(
      (child) => child?.type === 'element' && child.tag === 'table',
    ) as HtmlAstNode | undefined;
    if (!table) {
      return { valueLabels: [], missing: [] };
    }

    const rows = extractTableRows(table);
    if (!rows.length) {
      return { valueLabels: [], missing: [] };
    }

    const valueLabels: string[] = [];
    const missingValues: string[] = [];

    for (const row of rows) {
      if (!row.length) continue;
      const rawValue = row[0]?.trim();
      if (!rawValue?.length || /^(value|code)$/i.test(rawValue)) {
        continue;
      }
      const labelCandidate = row.slice(1).find((cell) => cell && cell.trim().length) ?? '';
      let label = labelCandidate.trim();
      let isMissing = false;
      if (/[*\u2020\u2021]+$/.test(label)) {
        label = label.replace(/[*\u2020\u2021]+$/, '').trim();
        isMissing = true;
      }
      const normalizedLabel = label.length ? label : labelCandidate.trim();
      const lowered = normalizedLabel.toLowerCase();
      if (!isMissing && missingLabelIndicators.some((indicator) => lowered.includes(indicator))) {
        isMissing = true;
      }
      if (normalizedLabel.length) {
        valueLabels.push(`${rawValue}=${normalizedLabel}`);
      } else {
        valueLabels.push(rawValue);
      }
      if (isMissing) {
        missingValues.push(rawValue);
      }
    }

    return { valueLabels, missing: missingValues };
  };

  const visit = (node: HtmlAstNode, context: { inVariableList: boolean }) => {
    if (!node) return;
    const nextContext = { ...context };

    if (node.type === 'element' && typeof node.tag === 'string') {
      if (node.tag === 'ul') {
        const classAttr = typeof node.attrs?.class === 'string' ? node.attrs.class : '';
        if (classAttr.split(/\s+/).includes('toc-list')) {
          nextContext.inVariableList = true;
        }
      } else if (node.tag === 'a' && nextContext.inVariableList) {
        const href = typeof node.attrs?.href === 'string' ? node.attrs.href : '';
        if (href.startsWith('#') && Array.isArray(node.children) && node.children.length > 0) {
          const nameCandidate = collectHtmlText(node.children[0]).trim();
          if (nameCandidate.length) {
            const descriptionText = normalizeHtmlDescription(
              node.children.slice(1).map((child) => collectHtmlText(child)).join(' '),
            );
            const description = descriptionText.length ? descriptionText : undefined;
            const isWeight =
              description?.toLowerCase().includes('weight') ||
              nameCandidate.toLowerCase().includes('weight') ||
              false;
            upsertColumn(nameCandidate, {
              name: nameCandidate,
              displayName: nameCandidate,
              description,
              isWeight: isWeight || undefined,
            });
          }
        }
      } else if (node.tag === 'div' && Array.isArray(node.children)) {
        const heading = node.children.find(
          (child) => child?.type === 'element' && child.tag === 'h3' && typeof child.attrs?.id === 'string',
        ) as HtmlAstNode | undefined;
        if (heading?.attrs?.id) {
          const variableName = String(heading.attrs.id);
          const detailBlocks = node.children.filter(
            (child) =>
              child &&
              child !== heading &&
              child.type === 'element' &&
              child.tag !== 'style' &&
              child.tag !== 'script',
          ) as HtmlAstNode[];

          const descriptionParts: string[] = [];
          const valueLabelAggregates: string[] = [];
          const missingAggregate = new Set<string>();

          for (const block of detailBlocks) {
            const className = typeof block.attrs?.class === 'string' ? block.attrs.class : '';
            if (className.split(/\s+/).includes('data-table')) {
              const { valueLabels, missing } = parseValueTable(block);
              for (const label of valueLabels) {
                valueLabelAggregates.push(label);
              }
              for (const missingValue of missing) {
                missingAggregate.add(missingValue);
              }
            } else {
              const textValue = collectHtmlText(block).trim();
              if (textValue.length) {
                descriptionParts.push(textValue);
              }
            }
          }

          const description =
            descriptionParts.length > 0 ? descriptionParts.join('\n\n').trim() : undefined;

          upsertColumn(variableName, {
            name: variableName,
            displayName: collectHtmlText(heading).trim() || variableName,
            description,
            valueLabels: valueLabelAggregates.length ? valueLabelAggregates : undefined,
            missingValues: missingAggregate.size ? Array.from(missingAggregate) : undefined,
          });
        }
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children ?? []) {
        visit(child, nextContext);
      }
    }
  };

  for (const child of raw.children as HtmlAstNode[]) {
    visit(child, { inVariableList: false });
  }

  if (!columnsMap.size) {
    return null;
  }

  return {
    columns: Array.from(columnsMap.values()),
  };
};
const BOOLEAN_FALSE = new Set(['false', '0', 'no', 'n', 'nein', 'f']);

const toBooleanFlag = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (value === 0) return false;
    if (value === 1) return true;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized.length) {
      return undefined;
    }
    if (BOOLEAN_TRUE.has(normalized)) return true;
    if (BOOLEAN_FALSE.has(normalized)) return false;
  }
  return undefined;
};

const COLUMN_NAME_KEYS = ['name', 'column', 'variable', 'column_name', 'variable_name', 'id'];
const DISPLAY_NAME_KEYS = ['displayName', 'label', 'title', 'question', 'text', 'description'];
const DESCRIPTION_KEYS = ['description', 'notes', 'comment', 'details', 'text', 'question'];
const DATA_TYPE_KEYS = ['dataType', 'type', 'columnType', 'valueType', 'kind'];
const MEASUREMENT_LEVEL_KEYS = ['measurementLevel', 'level', 'scale'];
const VALUE_LABEL_KEYS = ['valueLabels', 'labels', 'values', 'value_labels'];
const MISSING_VALUE_KEYS = ['missingValues', 'missing', 'missingValue', 'missing_values'];
const WEIGHT_KEYS = ['isWeight', 'is_weight', 'weight', 'weightIndicator'];

const tryBuildColumnOverrideFromObject = (value: Record<string, unknown>): ColumnMetadataOverride | null => {
  const nameCandidate = pickFirstString(value, COLUMN_NAME_KEYS);
  if (!nameCandidate) {
    return null;
  }

  const displayNameCandidate = pickFirstString(value, DISPLAY_NAME_KEYS);
  const descriptionCandidate = pickFirstString(value, DESCRIPTION_KEYS);
  const dataTypeCandidate = pickFirstString(value, DATA_TYPE_KEYS);
  const measurementCandidate = pickFirstString(value, MEASUREMENT_LEVEL_KEYS);

  const valueLabelsCandidate = VALUE_LABEL_KEYS.map((key) => value[key]).find(
    (candidate) => candidate !== undefined,
  );
  const missingValuesCandidate = MISSING_VALUE_KEYS.map((key) => value[key]).find(
    (candidate) => candidate !== undefined,
  );
  const weightCandidate = WEIGHT_KEYS.map((key) => value[key]).find(
    (candidate) => candidate !== undefined,
  );

  const override: ColumnMetadataOverride = {
    name: nameCandidate,
    displayName: displayNameCandidate,
    description: descriptionCandidate,
    dataType: parseColumnType(dataTypeCandidate),
    measurementLevel: parseMeasurementLevel(measurementCandidate),
    valueLabels: valueLabelsFromJson(valueLabelsCandidate),
    missingValues: normalizeList(missingValuesCandidate),
    isWeight: toBooleanFlag(weightCandidate) ?? undefined,
  };

  return ensureOverride(override);
};

const collectColumnOverridesFromAnyJson = (raw: unknown): ColumnMetadataOverride[] => {
  const visited = new WeakSet<object>();
  const columns = new Map<string, ColumnMetadataOverride>();

  const visit = (value: unknown) => {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }
      return;
    }
    if (!isRecord(value)) {
      return;
    }
    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    const override = tryBuildColumnOverrideFromObject(value);
    if (override && !columns.has(override.name)) {
      columns.set(override.name, override);
    }

    for (const entry of Object.values(value)) {
      visit(entry);
    }
  };

  visit(raw);
  return Array.from(columns.values());
};

const parseJsonMetadata = (text: string): DatasetMetadataOverrides => {
  const raw = JSON.parse(text) as JsonMetadataShape;
  const structured = buildStructuredOverridesFromJson(raw);

  if (structured.columns.length) {
    return structured;
  }

  const htmlOverrides = attemptHtmlAstMetadata(raw);
  if (htmlOverrides) {
    return mergeOverrides(structured, htmlOverrides);
  }

  const fallbackColumns = collectColumnOverridesFromAnyJson(raw);
  if (fallbackColumns.length) {
    return mergeOverrides(structured, { columns: fallbackColumns });
  }

  return structured;
};

const parseCsvMetadata = (text: string): DatasetMetadataOverrides => {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => (header ? header.trim().toLowerCase() : ''),
  });

  if (parsed.errors?.length) {
    const first = parsed.errors[0];
    throw new Error(
      `Metadata parse error at row ${first.row ?? 'unknown'}: ${first.message ?? 'Unknown error'}`,
    );
  }

  const overrides: DatasetMetadataOverrides = {
    columns: [],
  };

  for (const row of parsed.data ?? []) {
    const nameCandidate =
      row?.name ?? row?.variable ?? row?.column ?? row?.column_name ?? row?.spalte ?? row?.feld;
    const normalizedName = normalizeColumnName(nameCandidate);
    if (!normalizedName) {
      continue;
    }

    const override: ColumnMetadataOverride = {
      name: normalizedName,
      displayName: row?.displayname ?? row?.label ?? row?.title,
      description: row?.description ?? row?.notes ?? row?.comment,
      dataType: parseColumnType(row?.datatype ?? row?.type),
      measurementLevel: parseMeasurementLevel(row?.measurementlevel ?? row?.level ?? row?.scale),
      valueLabels: normalizeList(row?.valuelabels ?? row?.labels),
      missingValues: normalizeList(row?.missingvalues ?? row?.missing),
      isWeight: BOOLEAN_TRUE.has(String(row?.weight ?? row?.is_weight ?? row?.gewicht ?? '').trim().toLowerCase()),
    };

    const normalized = ensureOverride(override);
    if (normalized) {
      overrides.columns.push(normalized);
      if (normalized.isWeight && !overrides.weightColumn && typeof nameCandidate === 'string') {
        overrides.weightColumn = nameCandidate.trim();
      }
    }
  }

  return overrides;
};

export async function parseMetadataFile(file: File): Promise<DatasetMetadataOverrides> {
  const text = await file.text();
  if (!text.trim().length) {
    throw new Error('Metadata file is empty.');
  }

  const name = file.name?.toLowerCase() ?? '';
  if (name.endsWith('.json')) {
    return parseJsonMetadata(text);
  }
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    return parseCsvMetadata(text);
  }

  // Try JSON first by checking the first non-whitespace character.
  const firstChar = text.trimStart()[0];
  if (firstChar === '{' || firstChar === '[') {
    try {
      return parseJsonMetadata(text);
    } catch (error) {
      throw new Error(`Failed to parse metadata file as JSON: ${(error as Error)?.message ?? error}`);
    }
  }

  try {
    return parseCsvMetadata(text);
  } catch (error) {
    throw new Error(`Unsupported metadata file format. ${(error as Error)?.message ?? error}`);
  }
}
