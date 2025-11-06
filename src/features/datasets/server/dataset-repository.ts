import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DatasetIndexFile,
  DatasetMetadata,
  DatasetSummary,
  DatasetSummarySchema,
  DatasetMetadataSchema,
} from '@/src/features/datasets/types';

const DATASETS_DIR = path.join(process.cwd(), '.idx', 'datasets');
const META_FILE_PATH = path.join(DATASETS_DIR, 'meta.json');

async function ensureDatasetsDir(): Promise<void> {
  await fs.mkdir(DATASETS_DIR, { recursive: true });
}

async function readMetaFile(): Promise<DatasetIndexFile> {
  await ensureDatasetsDir();
  try {
    const raw = await fs.readFile(META_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as DatasetIndexFile;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.datasets)) {
      throw new Error('Invalid dataset index file format.');
    }
    return parsed;
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return { version: 1, datasets: [] };
    }
    throw error;
  }
}

async function writeMetaFile(data: DatasetIndexFile): Promise<void> {
  await ensureDatasetsDir();
  const serialized = JSON.stringify(data, null, 2);
  await fs.writeFile(META_FILE_PATH, serialized, 'utf-8');
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  const meta = await readMetaFile();
  return meta.datasets.map((dataset) => DatasetSummarySchema.parse(dataset));
}

export async function getDataset(datasetId: string): Promise<DatasetMetadata | null> {
  const meta = await readMetaFile();
  const match = meta.datasets.find((dataset) => dataset.id === datasetId);
  return match ? DatasetMetadataSchema.parse(match) : null;
}

export async function upsertDataset(dataset: DatasetMetadata): Promise<void> {
  const meta = await readMetaFile();
  const validated = DatasetMetadataSchema.parse(dataset);
  const existingIndex = meta.datasets.findIndex((item) => item.id === dataset.id);
  if (existingIndex >= 0) {
    meta.datasets[existingIndex] = validated;
  } else {
    meta.datasets.push(validated);
  }
  await writeMetaFile(meta);
}

export async function deleteDataset(datasetId: string): Promise<void> {
  const meta = await readMetaFile();
  const updated = meta.datasets.filter((dataset) => dataset.id !== datasetId);
  if (updated.length === meta.datasets.length) {
    return;
  }
  await writeMetaFile({ ...meta, datasets: updated });
  const files = await fs.readdir(DATASETS_DIR);
  await Promise.all(
    files
      .filter((filename) => filename.startsWith(datasetId))
      .map((filename) => fs.unlink(path.join(DATASETS_DIR, filename)).catch(() => undefined)),
  );
}

export function getDatasetStorageDir(): string {
  return DATASETS_DIR;
}

export function getDatasetCsvPath(datasetId: string): string {
  return path.join(DATASETS_DIR, `${datasetId}.csv`);
}

export function getDatasetSqlitePath(datasetId: string): string {
  return path.join(DATASETS_DIR, `${datasetId}.sqlite`);
}
