import type { DatasetMetadata, DatasetSummary, UpdateDatasetPayload } from '@/src/features/datasets/types';

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

export async function fetchDatasets(): Promise<DatasetSummary[]> {
  const response = await fetch('/api/datasets', { method: 'GET' });
  if (!response.ok) {
    throw new Error('Failed to load datasets.');
  }
  const payload = await parseJson<{ datasets: DatasetSummary[] }>(response);
  return Array.isArray(payload.datasets) ? payload.datasets : [];
}

type UploadDatasetParams = {
  file: File;
  title?: string;
  metadataFile?: File | null;
  autoGenerateMetadata?: boolean;
};

export async function uploadDataset({
  file,
  title,
  metadataFile,
  autoGenerateMetadata,
}: UploadDatasetParams): Promise<DatasetMetadata> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) {
    formData.append('title', title);
  }
  if (metadataFile instanceof File) {
    formData.append('metadata', metadataFile);
  }
  if (autoGenerateMetadata) {
    formData.append('autoMetadata', 'true');
  }
  const response = await fetch('/api/datasets', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const payload = await parseJson<{ error?: string; details?: string }>(response);
    throw new Error(payload.details ?? payload.error ?? 'Dataset upload failed.');
  }
  return parseJson<DatasetMetadata>(response);
}

export async function fetchDatasetMetadata(datasetId: string): Promise<DatasetMetadata> {
  const response = await fetch(`/api/datasets/${datasetId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch dataset metadata.');
  }
  return parseJson<DatasetMetadata>(response);
}

export async function updateDataset(datasetId: string, payload: UpdateDatasetPayload): Promise<DatasetMetadata> {
  const response = await fetch(`/api/datasets/${datasetId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const details = await parseJson<{ error?: string; details?: string }>(response);
    throw new Error(details.details ?? details.error ?? 'Failed to update dataset.');
  }
  return parseJson<DatasetMetadata>(response);
}

export async function deleteDataset(datasetId: string): Promise<void> {
  const response = await fetch(`/api/datasets/${datasetId}`, { method: 'DELETE' });
  if (!response.ok) {
    const details = await parseJson<{ error?: string }>(response);
    throw new Error(details.error ?? 'Failed to delete dataset.');
  }
}
