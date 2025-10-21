'use client';

import { Button } from '@/src/components/ui/button';

interface ChartDownloadButtonProps {
  imageDataUrl?: string;
  title?: string;
  chartId?: string;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildFilename = (title?: string, chartId?: string) => {
  const slug = title ? slugify(title) : '';
  if (slug) {
    return `${slug}.png`;
  }
  if (chartId) {
    return `chart-${chartId}.png`;
  }
  return 'chart.png';
};

export function ChartDownloadButton({ imageDataUrl, title, chartId }: ChartDownloadButtonProps) {
  if (!imageDataUrl) {
    return null;
  }

  const downloadName = buildFilename(title, chartId);

  return (
    <Button asChild size="sm" variant="outline">
      <a href={imageDataUrl} download={downloadName}>
        Als PNG herunterladen
      </a>
    </Button>
  );
}
