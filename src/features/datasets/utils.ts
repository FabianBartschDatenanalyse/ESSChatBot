export function datasetTableName(datasetId: string): string {
  return `dataset_${datasetId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
}

