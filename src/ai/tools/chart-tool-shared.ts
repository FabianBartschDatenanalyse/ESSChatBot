export interface AxisEncoding {
  field?: string;
  type?: string;
  title?: string;
  sort?: string | string[] | { field?: string; order?: 'ascending' | 'descending' };
}

export interface EncodingConfig {
  x?: AxisEncoding;
  y?: AxisEncoding;
  color?: { field?: string };
}

export type BarChartEntry = {
  category: string;
  label: string;
  value: number;
};

export const NEVER_NUMERIC = new Set(['cntry']);

export const looksNumeric = (v: unknown) =>
  typeof v === 'number'
    ? true
    : typeof v === 'string'
    ? /^-?\d+(\.\d+)?$/.test((v as string).trim())
    : false;

const normalizeSortKey = (value: unknown) => {
  if (value == null) return '';
  const raw = typeof value === 'string' ? value : String(value);
  const sanitized = sanitizeLabel(raw);
  return sanitized || raw.trim().toUpperCase();
};

type BarSortInstruction =
  | { kind: 'value' | 'category'; order: 'ascending' | 'descending' }
  | { kind: 'custom'; orderMap: Map<string, number> };

const resolveBarSortInstruction = (
  sort: AxisEncoding['sort'] | string[] | undefined,
  orientation: 'vertical' | 'horizontal',
  categoryField: string,
  valueField: string,
): BarSortInstruction | null => {
  if (!sort) return null;

  if (Array.isArray(sort)) {
    const orderMap = new Map<string, number>();
    sort.forEach((value, index) => {
      const key = normalizeSortKey(value);
      if (key && !orderMap.has(key)) {
        orderMap.set(key, index);
      }
    });
    return orderMap.size ? { kind: 'custom', orderMap } : null;
  }

  if (typeof sort === 'string') {
    const trimmed = sort.trim();
    if (!trimmed) return null;
    if (trimmed === 'ascending' || trimmed === 'descending') {
      return { kind: 'category', order: trimmed };
    }

    const descending = trimmed.startsWith('-');
    const order: 'ascending' | 'descending' = descending ? 'descending' : 'ascending';
    const target = descending ? trimmed.slice(1) : trimmed;

    if (target === 'x') {
      return {
        kind: orientation === 'vertical' ? 'category' : 'value',
        order,
      };
    }
    if (target === 'y') {
      return {
        kind: orientation === 'vertical' ? 'value' : 'category',
        order,
      };
    }
    if (target === 'value' || target === valueField) {
      return { kind: 'value', order };
    }
    if (target === 'category' || target === categoryField) {
      return { kind: 'category', order };
    }

    return { kind: 'value', order };
  }

  if (typeof sort === 'object') {
    const order: 'ascending' | 'descending' =
      (sort as any).order === 'descending' ? 'descending' : 'ascending';
    const field = (sort as any).field;

    if (field === categoryField || field === 'category') {
      return { kind: 'category', order };
    }
    if (field === valueField || field === 'value') {
      return { kind: 'value', order };
    }
    if (field === 'x') {
      return {
        kind: orientation === 'vertical' ? 'category' : 'value',
        order,
      };
    }
    if (field === 'y') {
      return {
        kind: orientation === 'vertical' ? 'value' : 'category',
        order,
      };
    }

    return { kind: 'value', order };
  }

  return null;
};

export function buildBarChartEntries(
  dataValues: any[],
  encoding: EncodingConfig,
  orientation: 'vertical' | 'horizontal',
): BarChartEntry[] {
  const xEnc = encoding.x ?? {};
  const yEnc = encoding.y ?? {};

  const valueField =
    orientation === 'vertical' ? (yEnc.field ?? 'value') : (xEnc.field ?? 'value');
  const categoryField =
    orientation === 'vertical' ? (xEnc.field ?? 'category') : (yEnc.field ?? 'category');

  const entriesWithIndex = dataValues
    .map((row: any, originalIndex: number) => {
      const rawCategory = categoryField != null ? row?.[categoryField] : undefined;
      const rawValue =
        valueField != null ? row?.[valueField] : row?.value ?? row?.count ?? row?.total;

      const numericValue =
        typeof rawValue === 'number'
          ? rawValue
          : typeof rawValue === 'string' && looksNumeric(rawValue)
          ? parseFloat(rawValue)
          : NaN;

      const category =
        rawCategory == null
          ? ''
          : typeof rawCategory === 'string'
          ? rawCategory
          : String(rawCategory);

      const label = sanitizeLabel(category) || 'N/A';

      return {
        category,
        label,
        value: numericValue,
        originalIndex,
      };
    })
    .filter((entry) => Number.isFinite(entry.value));

  const entries = entriesWithIndex.slice();
  const catEnc = orientation === 'vertical' ? xEnc : yEnc;
  const sortInstruction = resolveBarSortInstruction(
    catEnc.sort as AxisEncoding['sort'],
    orientation,
    categoryField,
    valueField,
  );

  if (sortInstruction) {
    if (sortInstruction.kind === 'custom') {
      entries.sort((a, b) => {
        const aKey = normalizeSortKey(a.category) || normalizeSortKey(a.label);
        const bKey = normalizeSortKey(b.category) || normalizeSortKey(b.label);
        const aIdx = sortInstruction.orderMap.get(aKey);
        const bIdx = sortInstruction.orderMap.get(bKey);
        if (aIdx != null && bIdx != null) return aIdx - bIdx;
        if (aIdx != null) return -1;
        if (bIdx != null) return 1;
        return a.originalIndex - b.originalIndex;
      });
    } else {
      const multiplier = sortInstruction.order === 'descending' ? -1 : 1;
      if (sortInstruction.kind === 'value') {
        entries.sort((a, b) => {
          const diff = a.value - b.value;
          if (diff !== 0) return diff * multiplier;
          return (a.originalIndex - b.originalIndex) * multiplier;
        });
      } else {
        entries.sort((a, b) => {
          const compare = a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
          if (compare !== 0) return compare * multiplier;
          return (a.originalIndex - b.originalIndex) * multiplier;
        });
      }
    }
  }

  return entries.map(({ originalIndex: _originalIndex, ...rest }) => rest);
}

export function sanitizeLabel(input: unknown): string {
  if (typeof input !== 'string') {
    if (input == null) return '';
    return String(input);
  }
  let text = input.normalize('NFD').replace(/ß/g, 'SS').replace(/[̀-ͯ]/g, '');
  text = text.toUpperCase();
  text = text.replace(/[^A-Z0-9 .,:%()!?'#&+\/-]/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}
