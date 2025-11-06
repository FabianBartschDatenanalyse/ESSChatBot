/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, PlusCircle, Save, Trash2, UploadCloud } from 'lucide-react';
import type { DatasetMetadata, DatasetSummary } from '@/src/features/datasets/types';
import { uploadDataset, fetchDatasetMetadata, updateDataset, deleteDataset } from '@/src/features/datasets/api';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/src/components/ui/select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/src/components/ui/table';

type DatasetManagerProps = {
  datasets: DatasetSummary[];
  activeDatasetId: string | null;
  onDatasetSelected: (datasetId: string | null) => void;
  onDatasetCreated: (dataset: DatasetMetadata) => void;
  onDatasetUpdated: (dataset: DatasetMetadata) => void;
  onDatasetDeleted: (datasetId: string) => void;
};

type ValueLabelDraft = {
  id: string;
  value: string;
  label: string;
};

type ColumnEditState = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  dataType: DatasetMetadata['columns'][number]['dataType'];
  measurementLevel: DatasetMetadata['columns'][number]['measurementLevel'];
  valueLabels: ValueLabelDraft[];
  missingValuesInput: string;
};

const SAMPLE_PREVIEW_VISIBLE_COLUMNS = 5;
const SAMPLE_PREVIEW_COLUMN_MIN_WIDTH = 140;

const createValueLabelDraft = (value = '', label = ''): ValueLabelDraft => ({
  id: uuidv4(),
  value,
  label,
});

const parseValueLabelString = (entry: string): ValueLabelDraft | null => {
  const trimmed = entry.trim();
  if (!trimmed.length) {
    return null;
  }
  const separators = ['=', ':'];
  for (const separator of separators) {
    const separatorIndex = trimmed.indexOf(separator);
    if (separatorIndex !== -1) {
      const rawValue = trimmed.slice(0, separatorIndex).trim();
      const rawLabel = trimmed.slice(separatorIndex + 1).trim();
      return createValueLabelDraft(rawValue, rawLabel);
    }
  }
  return createValueLabelDraft(trimmed, '');
};

const toValueLabelDrafts = (values: string[]): ValueLabelDraft[] =>
  values
    .map((entry) => parseValueLabelString(entry))
    .filter((entry): entry is ValueLabelDraft => Boolean(entry));

const stringifyValueLabelDrafts = (drafts: ValueLabelDraft[]): string[] =>
  drafts
    .map(({ value, label }) => ({
      value: value.trim(),
      label: label.trim(),
    }))
    .filter(({ value, label }) => value.length > 0 || label.length > 0)
    .map(({ value, label }) => {
      if (value.length > 0 && label.length > 0) {
        return `${value}=${label}`;
      }
      return value.length > 0 ? value : label;
    });

export function DatasetManager({
  datasets,
  activeDatasetId,
  onDatasetSelected,
  onDatasetCreated,
  onDatasetUpdated,
  onDatasetDeleted,
}: DatasetManagerProps) {
  const [selectedDataset, setSelectedDataset] = useState<DatasetMetadata | null>(null);
  const [columnDrafts, setColumnDrafts] = useState<ColumnEditState[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [defaultMissingValues, setDefaultMissingValues] = useState('');
  const [weightColumn, setWeightColumn] = useState<string | null>(null);
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [shouldAutoGenerateMetadata, setShouldAutoGenerateMetadata] = useState(false);
  const [hasMetadataFile, setHasMetadataFile] = useState(false);

  const samplePreviewContainerMaxWidth =
    columnDrafts.length > SAMPLE_PREVIEW_VISIBLE_COLUMNS
      ? SAMPLE_PREVIEW_VISIBLE_COLUMNS * SAMPLE_PREVIEW_COLUMN_MIN_WIDTH
      : undefined;
  const samplePreviewTableMinWidth =
    Math.max(columnDrafts.length, 1) * SAMPLE_PREVIEW_COLUMN_MIN_WIDTH;

  useEffect(() => {
    async function load() {
      if (!activeDatasetId) {
        setSelectedDataset(null);
        setColumnDrafts([]);
        setTitle('');
        setNotes('');
        setDefaultMissingValues('');
        setWeightColumn(null);
        setSaveError(null);
        setDeleteError(null);
        return;
      }
      setIsLoadingDataset(true);
      setSaveError(null);
       setDeleteError(null);
      setSuccessMessage(null);
      try {
        const metadata = await fetchDatasetMetadata(activeDatasetId);
        setSelectedDataset(metadata);
        setTitle(metadata.title);
        setNotes(metadata.notes ?? '');
        setDefaultMissingValues(metadata.defaultMissingValues.join(', '));
        setWeightColumn(metadata.weightColumn);
        setColumnDrafts(
          metadata.columns.map((column) => ({
            id: column.id,
            name: column.name,
            displayName: column.displayName,
            description: column.description,
            dataType: column.dataType,
            measurementLevel: column.measurementLevel,
            valueLabels: toValueLabelDrafts(column.valueLabels),
            missingValuesInput: column.missingValues.join(', '),
          })),
        );
      } catch (error: any) {
        console.error('[DatasetManager] Failed to load dataset metadata:', error);
        setSaveError(error?.message ?? 'Failed to load dataset metadata.');
      } finally {
        setIsLoadingDataset(false);
      }
    }
    void load();
  }, [activeDatasetId]);

  const normalizeMissingArray = (values: string[]) =>
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .sort()
      .join('|');

  const normalizeMissingInput = (input: string) =>
    input
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .sort()
      .join('|');

  const normalizeValueLabelsArray = (values: string[]) =>
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join('|');

  const normalizeValueLabelDrafts = (drafts: ValueLabelDraft[]) =>
    stringifyValueLabelDrafts(drafts)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join('|');

  const hasDraftChanges = useMemo(() => {
    if (!selectedDataset) return false;
    if (selectedDataset.title !== title.trim()) return true;
    if ((selectedDataset.notes ?? '') !== notes.trim()) return true;
    if ((selectedDataset.weightColumn ?? null) !== (weightColumn ?? null)) return true;
    if (
      normalizeMissingArray(selectedDataset.defaultMissingValues) !== normalizeMissingInput(defaultMissingValues)
    ) {
      return true;
    }
    for (const column of columnDrafts) {
      const source = selectedDataset.columns.find((c) => c.id === column.id);
      if (!source) continue;
      if (source.name !== column.name.trim()) return true;
      if (source.displayName !== column.displayName.trim()) return true;
      if ((source.description ?? '') !== column.description.trim()) return true;
      if (source.dataType !== column.dataType) return true;
      if (source.measurementLevel !== column.measurementLevel) return true;
      if (
        normalizeValueLabelsArray(source.valueLabels) !== normalizeValueLabelDrafts(column.valueLabels)
      ) {
        return true;
      }
      if (
        normalizeMissingArray(source.missingValues) !== normalizeMissingInput(column.missingValuesInput)
      ) {
        return true;
      }
    }
    return false;
  }, [selectedDataset, columnDrafts, title, notes, defaultMissingValues, weightColumn]);

  const handleDatasetUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadError(null);
    setUploadSuccessMessage(null);
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem('dataset-file') as HTMLInputElement | null;
    const titleInput = form.elements.namedItem('dataset-title') as HTMLInputElement | null;
    const metadataInput = form.elements.namedItem('metadata') as HTMLInputElement | null;
    if (!fileInput?.files?.length) {
      setUploadError('Please select a CSV file.');
      return;
    }
    const file = fileInput.files[0];
    const datasetTitle = titleInput?.value?.trim();
    const metadataFile = metadataInput?.files?.[0];
    const autoMetadataRequested = !metadataFile && shouldAutoGenerateMetadata;
    setIsUploading(true);
    try {
      const dataset = await uploadDataset({
        file,
        title: datasetTitle?.length ? datasetTitle : undefined,
        metadataFile: metadataFile ?? undefined,
        autoGenerateMetadata: autoMetadataRequested,
      });
      onDatasetCreated(dataset);
      setUploadSuccessMessage(`Dataset "${dataset.title}" uploaded successfully.`);
      form.reset();
      setShouldAutoGenerateMetadata(false);
      setHasMetadataFile(false);
    } catch (error: any) {
      setUploadError(error?.message ?? 'Dataset upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

type ColumnDraftEditableField =
  | 'displayName'
  | 'description'
  | 'dataType'
  | 'measurementLevel'
  | 'missingValuesInput';

  const handleColumnDraftChange = <Field extends ColumnDraftEditableField>(
    columnId: string,
    field: Field,
    value: ColumnEditState[Field],
  ) => {
    setColumnDrafts((prev) =>
      prev.map((column) =>
        column.id === columnId
          ? { ...column, [field]: value }
          : column,
      ),
    );
  };

  const handleSaveChanges = async () => {
    if (!selectedDataset) return;
    setIsSaving(true);
    setSaveError(null);
    setDeleteError(null);
    setSuccessMessage(null);
    try {
      const payload = {
        title: title.trim(),
        notes: notes.trim().length ? notes.trim() : undefined,
        weightColumn: weightColumn ?? null,
        defaultMissingValues: defaultMissingValues
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      columns: columnDrafts.map((column) => ({
        id: column.id,
        name: column.name.trim(),
        displayName: column.displayName.trim(),
        description: column.description.trim(),
        dataType: column.dataType,
        measurementLevel: column.measurementLevel,
        valueLabels: stringifyValueLabelDrafts(column.valueLabels),
        missingValues: column.missingValuesInput
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
        })),
      };

      const updated = await updateDataset(selectedDataset.id, payload);
      setSelectedDataset(updated);
      setTitle(updated.title);
      setNotes(updated.notes ?? '');
      setDefaultMissingValues(updated.defaultMissingValues.join(', '));
      setWeightColumn(updated.weightColumn);
        setColumnDrafts(
          updated.columns.map((column) => ({
            id: column.id,
            name: column.name,
            displayName: column.displayName,
            description: column.description,
            dataType: column.dataType,
            measurementLevel: column.measurementLevel,
            valueLabels: toValueLabelDrafts(column.valueLabels),
            missingValuesInput: column.missingValues.join(', '),
          })),
        );
      onDatasetUpdated(updated);
      setSuccessMessage('Dataset settings saved.');
    } catch (error: any) {
      console.error('[DatasetManager] Failed to save dataset changes:', error);
      setSaveError(error?.message ?? 'Failed to save dataset changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddValueLabel = (columnId: string) => {
    setColumnDrafts((prev) =>
      prev.map((column) =>
        column.id === columnId
          ? { ...column, valueLabels: [...column.valueLabels, createValueLabelDraft()] }
          : column,
      ),
    );
  };

  const handleValueLabelChange = (
    columnId: string,
    valueLabelId: string,
    field: 'value' | 'label',
    value: string,
  ) => {
    setColumnDrafts((prev) =>
      prev.map((column) => {
        if (column.id !== columnId) {
          return column;
        }
        return {
          ...column,
          valueLabels: column.valueLabels.map((valueLabel) =>
            valueLabel.id === valueLabelId ? { ...valueLabel, [field]: value } : valueLabel,
          ),
        };
      }),
    );
  };

  const handleRemoveValueLabel = (columnId: string, valueLabelId: string) => {
    setColumnDrafts((prev) =>
      prev.map((column) => {
        if (column.id !== columnId) {
          return column;
        }
        return {
          ...column,
          valueLabels: column.valueLabels.filter((valueLabel) => valueLabel.id !== valueLabelId),
        };
      }),
    );
  };

  const handleDeleteDataset = async () => {
    if (!selectedDataset) return;
    const { id, title: datasetTitle } = selectedDataset;
    const confirmed = window.confirm(
      `Delete dataset "${datasetTitle}"? This will remove the uploaded files and make it unavailable in conversations.`,
    );
    if (!confirmed) {
      return;
    }
    setIsDeleting(true);
    setSaveError(null);
    setDeleteError(null);
    setSuccessMessage(null);
    try {
      await deleteDataset(id);
      onDatasetDeleted(id);
      onDatasetSelected(null);
      setSelectedDataset(null);
      setColumnDrafts([]);
      setTitle('');
      setNotes('');
      setDefaultMissingValues('');
      setWeightColumn(null);
      setSuccessMessage(`Dataset "${datasetTitle}" deleted.`);
    } catch (error: any) {
      console.error('[DatasetManager] Failed to delete dataset:', error);
      setDeleteError(error?.message ?? 'Failed to delete dataset.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
          Upload new dataset
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a CSV file to create a new dataset. The system will automatically detect columns, infer data types, and
          provide a preview. You can tweak details after upload.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1fr),auto] sm:items-end"
          onSubmit={handleDatasetUpload}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataset-title">Dataset title</Label>
            <Input id="dataset-title" name="dataset-title" placeholder="e.g. Customer Survey 2024" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataset-file">CSV file</Label>
            <Input id="dataset-file" name="dataset-file" type="file" accept=".csv,text/csv" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="metadata-file">Variable metadata (optional)</Label>
            <Input
              id="metadata-file"
              name="metadata"
              type="file"
              accept=".json,.csv,.txt"
              onChange={(event) => {
                const hasFile = Boolean(event.target.files?.length);
                setHasMetadataFile(hasFile);
                if (hasFile) {
                  setShouldAutoGenerateMetadata(false);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Provide a JSON or CSV codebook to prefill types, labels, and descriptions.
            </p>
          </div>
          <Button type="submit" disabled={isUploading} className="sm:self-end">
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Upload
          </Button>
          <div className="flex items-start gap-2 sm:col-span-4">
            <Checkbox
              id="auto-metadata"
              checked={shouldAutoGenerateMetadata}
              disabled={hasMetadataFile}
              onCheckedChange={(next) => {
                if (typeof next === 'boolean') {
                  setShouldAutoGenerateMetadata(next);
                }
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="auto-metadata" className="text-sm font-medium leading-none">
                No codebook? Let the AI help.
              </Label>
              <p className="text-xs text-muted-foreground max-w-lg">
                When no codebook is provided, the AI can draft variable descriptions, measurement levels, and value labels based on your data.
              </p>
              {hasMetadataFile && (
                <p className="text-xs text-muted-foreground">
                  Remove the codebook file first to enable this option.
                </p>
              )}
            </div>
          </div>
        </form>
        {uploadError && <p className="text-sm text-destructive mt-3">{uploadError}</p>}
        {uploadSuccessMessage && <p className="text-sm text-emerald-600 mt-3">{uploadSuccessMessage}</p>}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Manage datasets</h3>
            <p className="text-sm text-muted-foreground">
              Select a dataset to review the inferred schema, adjust column settings, and configure missing values or
              weighting.
            </p>
          </div>
          <Select
            value={activeDatasetId ?? 'none'}
            onValueChange={(value) => {
              const next = value === 'none' ? null : value;
              onDatasetSelected(next);
            }}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select dataset" />
            </SelectTrigger>
            <SelectContent>
              {datasets.length === 0 ? (
                <SelectItem value="none" disabled>
                  No datasets available
                </SelectItem>
              ) : (
                <>
                  <SelectItem value="none" disabled>
                    Select dataset
                  </SelectItem>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.title}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {(saveError || deleteError) && (
          <p className="text-sm text-destructive mt-4">{saveError ?? deleteError}</p>
        )}
        {successMessage && !saveError && !deleteError && (
          <p className="text-sm text-emerald-600 mt-4">{successMessage}</p>
        )}

        {isLoadingDataset && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading dataset details...
          </div>
        )}

        {!isLoadingDataset && !selectedDataset && (
          <p className="text-sm text-muted-foreground mt-6">Select a dataset to view and edit its configuration.</p>
        )}

        {!isLoadingDataset && selectedDataset && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dataset-title-edit">Title</Label>
                <Input
                  id="dataset-title-edit"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataset-weight-column">Weight column</Label>
                <Select
                  value={weightColumn ?? 'none'}
                  onValueChange={(value) => setWeightColumn(value === 'none' ? null : value)}
                >
                  <SelectTrigger id="dataset-weight-column">
                    <SelectValue placeholder="No weighting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No weighting (weight = 1)</SelectItem>
                    {columnDrafts.map((column) => (
                      <SelectItem key={column.id} value={column.name}>
                        {column.displayName} ({column.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="dataset-notes">Notes</Label>
                <Textarea
                  id="dataset-notes"
                  placeholder="Optional notes about this dataset..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="dataset-default-missing">Default missing values</Label>
                <Input
                  id="dataset-default-missing"
                  placeholder="Comma separated missing value sentinels, e.g. 77, 88, 99"
                  value={defaultMissingValues}
                  onChange={(event) => setDefaultMissingValues(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  These values are treated as missing for all variables. You can also set column-specific missing values
                  below.
                </p>
              </div>
            </div>

            <div className="space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold">Columns</h4>
                  <p className="text-sm text-muted-foreground">
                    Adjust the technical name, display label, description, type, value labels, and missing values for
                    each variable.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteDataset}
                    disabled={isDeleting || isSaving}
                  >
                    {isDeleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete dataset
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSaveChanges}
                    disabled={!hasDraftChanges || isSaving || isDeleting}
                  >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save changes
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border w-full min-w-0 max-w-full">
                <div className="max-h-[420px] w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto">
                  <Table className="w-full table-auto">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[110px] md:min-w-[140px]">Technical name</TableHead>
                        <TableHead className="min-w-[130px] md:min-w-[160px]">Display label</TableHead>
                        <TableHead className="min-w-[180px] md:min-w-[220px]">Description</TableHead>
                        <TableHead className="min-w-[96px] md:min-w-[120px]">Type</TableHead>
                        <TableHead className="min-w-[130px] md:min-w-[160px]">Measurement</TableHead>
                        <TableHead className="min-w-[150px] md:min-w-[200px]">Values</TableHead>
                        <TableHead className="min-w-[130px] md:min-w-[160px]">Missings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {columnDrafts.map((column) => {
                        const original = selectedDataset.columns.find((c) => c.id === column.id);
                        return (
                          <TableRow key={column.id}>
                            <TableCell>
                              <Input
                                value={column.name}
                                readOnly
                                disabled
                              />
                              {original && original.name !== column.name && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Was: <span className="font-mono">{original.name}</span>
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={column.displayName}
                                onChange={(event) =>
                                  handleColumnDraftChange(column.id, 'displayName', event.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Textarea
                                value={column.description}
                                onChange={(event) =>
                                  handleColumnDraftChange(column.id, 'description', event.target.value)
                                }
                                rows={2}
                              />
                            </TableCell>
                              <TableCell>
                                <Select
                                  value={column.dataType}
                                  onValueChange={(value) =>
                                    handleColumnDraftChange(
                                      column.id,
                                      'dataType',
                                      value as ColumnEditState['dataType'],
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="boolean">Boolean</SelectItem>
                                    <SelectItem value="date">Date</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={column.measurementLevel}
                                  onValueChange={(value) =>
                                    handleColumnDraftChange(
                                      column.id,
                                      'measurementLevel',
                                      value as ColumnEditState['measurementLevel'],
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="nominal">Nominal</SelectItem>
                                    <SelectItem value="ordinal">Ordinal</SelectItem>
                                    <SelectItem value="metric">Metric</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                {column.valueLabels.length === 0 && (
                                  <p className="text-xs text-muted-foreground">No value labels defined.</p>
                                )}
                                <div className="flex flex-col gap-2">
                                  {column.valueLabels.map((valueLabel) => (
                                    <div key={valueLabel.id} className="flex items-center gap-2">
                                      <Input
                                        value={valueLabel.value}
                                        onChange={(event) =>
                                          handleValueLabelChange(column.id, valueLabel.id, 'value', event.target.value)
                                        }
                                        placeholder="Code"
                                        className="w-20"
                                      />
                                      <Input
                                        value={valueLabel.label}
                                        onChange={(event) =>
                                          handleValueLabelChange(column.id, valueLabel.id, 'label', event.target.value)
                                        }
                                        placeholder="Label"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveValueLabel(column.id, valueLabel.id)}
                                        aria-label="Remove value label"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                                <Button
                                  type="button"
                                  variant={column.valueLabels.length === 0 ? 'outline' : 'ghost'}
                                  size="sm"
                                  className={column.valueLabels.length === 0 ? 'justify-start' : 'self-start'}
                                  onClick={() => handleAddValueLabel(column.id)}
                                >
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Add value label
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={column.missingValuesInput}
                                onChange={(event) =>
                                  handleColumnDraftChange(column.id, 'missingValuesInput', event.target.value)
                                }
                                placeholder="e.g. 77, 88, 99"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <h4 className="text-base font-semibold mb-2">Sample rows</h4>
              <div
                className="rounded-lg border w-full min-w-0"
                style={samplePreviewContainerMaxWidth ? { maxWidth: samplePreviewContainerMaxWidth } : undefined}
              >
                <div className="max-h-[300px] w-full min-w-0 overflow-x-auto overflow-y-auto">
                  <Table
                    className="w-full table-auto"
                    style={{ minWidth: samplePreviewTableMinWidth }}
                  >
                    <TableHeader>
                      <TableRow>
                        {columnDrafts.map((column) => (
                          <TableHead
                            key={`preview-head-${column.id}`}
                            style={{ minWidth: SAMPLE_PREVIEW_COLUMN_MIN_WIDTH }}
                            className="whitespace-nowrap"
                          >
                            {column.displayName}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDataset.samplePreview.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={columnDrafts.length}
                            className="text-center text-sm text-muted-foreground"
                          >
                            Dataset has no rows to preview.
                          </TableCell>
                        </TableRow>
                      )}
                      {selectedDataset.samplePreview.map((row, rowIndex) => (
                        <TableRow key={`preview-row-${rowIndex}`}>
                          {columnDrafts.map((column) => (
                            <TableCell
                              key={`preview-cell-${column.id}-${rowIndex}`}
                              style={{ minWidth: SAMPLE_PREVIEW_COLUMN_MIN_WIDTH }}
                              className="whitespace-nowrap"
                            >
                              {(() => {
                                const value = row[column.name];
                                if (value === null || value === undefined || value === '') {
                                  return <span className="text-muted-foreground text-xs">missing</span>;
                                }
                                if (typeof value === 'number') {
                                  return value.toLocaleString();
                                }
                                return String(value);
                              })()}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
