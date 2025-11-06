import fs from 'node:fs/promises';
import { randomUUID } from 'crypto';
import {
  DatasetMetadata,
  DatasetMetadataSchema,
  DatasetSummary,
  DatasetSummarySchema,
  UpdateDatasetPayload,
  UpdateDatasetPayloadSchema,
  DatasetPreviewRow,
} from '@/src/features/datasets/types';
import {
  getDataset,
  listDatasets,
  upsertDataset,
  getDatasetStorageDir,
  getDatasetCsvPath,
  deleteDataset,
} from '@/src/features/datasets/server/dataset-repository';
import { ingestCsvBuffer } from '@/src/features/datasets/server/csv-ingest';
import { parseMetadataFile, DatasetMetadataOverrides } from '@/src/features/datasets/server/metadata-import';
import { enrichDatasetMetadataWithAi } from '@/src/features/datasets/server/metadata-ai';

type CreateDatasetParams = {
  file: File;
  title?: string;
  metadataFile?: File | null;
  autoGenerateMetadata?: boolean;
};

type UpdateDatasetOptions = {
  datasetId: string;
  payload: UpdateDatasetPayload;
};

export async function listDatasetSummaries(): Promise<DatasetSummary[]> {
  const summaries = await listDatasets();
  return summaries.map((summary) => DatasetSummarySchema.parse(summary));
}

export async function getDatasetMetadata(datasetId: string): Promise<DatasetMetadata | null> {
  const dataset = await getDataset(datasetId);
  return dataset ? DatasetMetadataSchema.parse(dataset) : null;
}

export async function getDatasetPreview(datasetId: string): Promise<DatasetPreviewRow[] | null> {
  const dataset = await getDatasetMetadata(datasetId);
  return dataset?.samplePreview ?? null;
}

export async function createDatasetFromUpload({
  file,
  title,
  metadataFile,
  autoGenerateMetadata,
}: CreateDatasetParams): Promise<DatasetMetadata> {
  if (!file) {
    throw new Error('Missing file in dataset upload.');
  }

  const datasetId = randomUUID();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const originalFilename = file.name ?? `${datasetId}.csv`;

  const datasetDir = getDatasetStorageDir();
  await fs.mkdir(datasetDir, { recursive: true });

  const csvPath = getDatasetCsvPath(datasetId);
  await fs.writeFile(csvPath, buffer);

  let metadataOverrides: DatasetMetadataOverrides | undefined;
  if (metadataFile instanceof File) {
    try {
      metadataOverrides = await parseMetadataFile(metadataFile);
    } catch (error) {
      throw new Error(
        `Failed to parse metadata file "${metadataFile.name ?? 'metadata'}": ${
          (error as Error)?.message ?? error
        }`,
      );
    }
  }

  const ingestResult = await ingestCsvBuffer({
    datasetId,
    originalFilename,
    buffer,
    title,
    overrides: metadataOverrides,
  });

  let metadata = ingestResult.metadata;

  if (autoGenerateMetadata && !metadataFile) {
    metadata = await enrichDatasetMetadataWithAi(metadata);
  }

  await upsertDataset(metadata);

  return metadata;
}

function sanitizeColumnName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.length) {
    throw new Error('Column name must not be empty.');
  }
  let normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
  if (!normalized.length) {
    normalized = `c_${randomUUID().slice(0, 8)}`;
  }
  if (/^\d/.test(normalized)) {
    normalized = `c_${normalized}`;
  }
  return normalized;
}

function normalizeValueLabels(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

export async function updateDatasetMetadata({ datasetId, payload }: UpdateDatasetOptions): Promise<DatasetMetadata> {
  const parsedPayload = UpdateDatasetPayloadSchema.parse(payload);
  const existing = await getDatasetMetadata(datasetId);
  if (!existing) {
    throw new Error(`Dataset "${datasetId}" not found.`);
  }

  const updatedColumns = [...existing.columns];
  const renameMap = new Map<string, string>();

  if (parsedPayload.columns) {
    for (const columnPatch of parsedPayload.columns) {
      const index = updatedColumns.findIndex((column) => column.id === columnPatch.id);
      if (index === -1) {
        continue;
      }
      const current = updatedColumns[index];
      let nextName = current.name;
      if (columnPatch.name && columnPatch.name !== current.name) {
        nextName = sanitizeColumnName(columnPatch.name);
        renameMap.set(current.name, nextName);
      }
      const nextValueLabels = columnPatch.valueLabels
        ? normalizeValueLabels(columnPatch.valueLabels)
        : current.valueLabels;
      updatedColumns[index] = {
        ...current,
        ...columnPatch,
        name: nextName,
        displayName: columnPatch.displayName ?? current.displayName,
        description: columnPatch.description ?? current.description,
        valueLabels: nextValueLabels,
        missingValues: columnPatch.missingValues ?? current.missingValues,
      };
    }
  }

  if (renameMap.size > 0) {
    // Ensure uniqueness after rename.
    const seen = new Set<string>();
    for (const column of updatedColumns) {
      if (seen.has(column.name)) {
        throw new Error(`Duplicate column name "${column.name}" after rename.`);
      }
      seen.add(column.name);
    }
  }

  let weightColumn = existing.weightColumn;
  if (parsedPayload.weightColumn !== undefined) {
    if (parsedPayload.weightColumn === null) {
      weightColumn = null;
    } else {
      const target = updatedColumns.find((column) => column.name === parsedPayload.weightColumn);
      if (!target) {
        throw new Error(`Weight column "${parsedPayload.weightColumn}" not found in dataset "${datasetId}".`);
      }
      weightColumn = target.name;
    }
  }
  if (weightColumn && renameMap.has(weightColumn)) {
    weightColumn = renameMap.get(weightColumn) ?? weightColumn;
  }

  const updatedSamplePreview = existing.samplePreview.map((row) => {
    const updatedRow: DatasetPreviewRow = {};
    for (const [key, value] of Object.entries(row)) {
      const renamedKey = renameMap.get(key) ?? key;
      updatedRow[renamedKey] = value;
    }
    return updatedRow;
  });

  const updated: DatasetMetadata = {
    ...existing,
    title: parsedPayload.title ?? existing.title,
    weightColumn,
    defaultMissingValues: parsedPayload.defaultMissingValues ?? existing.defaultMissingValues,
    columns: updatedColumns,
    samplePreview: updatedSamplePreview,
    notes: parsedPayload.notes ?? existing.notes,
    updatedAt: new Date().toISOString(),
  };

  await upsertDataset(updated);
  return updated;
}

export async function removeDataset(datasetId: string): Promise<void> {
  await deleteDataset(datasetId);
}
