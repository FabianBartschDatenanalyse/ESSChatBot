"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import { DatasetManager } from "@/src/components/dataset-manager";
import { Button } from "@/src/components/ui/button";
import { fetchDatasets } from "@/src/features/datasets/api";
import type { DatasetMetadata, DatasetSummary } from "@/src/features/datasets/types";

export default function ManageDatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toSummary = useCallback((dataset: DatasetMetadata): DatasetSummary => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { samplePreview, notes, ...summary } = dataset;
    return summary;
  }, []);

  const loadDatasets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await fetchDatasets();
      setDatasets(list);
      if (list.length > 0) {
        setActiveDatasetId((prev) => prev ?? list[0].id);
      } else {
        setActiveDatasetId(null);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load datasets.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  const activeDataset = useMemo(
    () => (activeDatasetId ? datasets.find((item) => item.id === activeDatasetId) ?? null : null),
    [activeDatasetId, datasets],
  );

  const handleDatasetSelected = (datasetId: string | null) => {
    setActiveDatasetId(datasetId);
  };

  const handleDatasetCreated = (dataset: DatasetMetadata) => {
    const summary = toSummary(dataset);
    setDatasets((prev) => [...prev, summary]);
    setActiveDatasetId(dataset.id);
  };

  const handleDatasetUpdated = (dataset: DatasetMetadata) => {
    const summary = toSummary(dataset);
    setDatasets((prev) => prev.map((item) => (item.id === dataset.id ? summary : item)));
    setActiveDatasetId(dataset.id);
  };

  const handleDatasetDeleted = (datasetId: string) => {
    setDatasets((prev) => {
      const next = prev.filter((item) => item.id !== datasetId);
      const fallbackId = next.length > 0 ? next[0].id : null;
      setActiveDatasetId((current) => (current === datasetId ? fallbackId : current));
      return next;
    });
  };

  const handleCloseWindow = () => {
    if (typeof window !== "undefined") {
      window.close();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
        <header className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Manage datasets</h1>
            <p className="text-sm text-muted-foreground">
              Upload new datasets, adjust schemas and sample data in diesem separaten Fenster.
            </p>
            {activeDataset ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Aktives Dataset: <span className="font-medium">{activeDataset.title}</span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Derzeit ist kein Dataset aktiv.</p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={loadDatasets}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              <span>Neu laden</span>
            </Button>
            <Button variant="ghost" onClick={handleCloseWindow} className="flex items-center gap-2">
              <X className="h-4 w-4" />
              <span>Fenster schliessen</span>
            </Button>
          </div>
        </header>
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <div className="flex-1">
          {isLoading && datasets.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Datensaetze werden geladen ...</p>
            </div>
          ) : (
            <DatasetManager
              datasets={datasets}
              activeDatasetId={activeDatasetId}
              onDatasetSelected={handleDatasetSelected}
              onDatasetCreated={handleDatasetCreated}
              onDatasetUpdated={handleDatasetUpdated}
              onDatasetDeleted={handleDatasetDeleted}
            />
          )}
        </div>
      </div>
    </div>
  );
}
