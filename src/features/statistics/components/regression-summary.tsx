import React from 'react';
import {
  RegressionAnalysis,
  LinearRegressionAnalysis,
  RandomForestRegressionAnalysis,
} from '@/src/features/statistics/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/src/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Separator } from '@/src/components/ui/separator';

type RegressionSummaryProps = {
  analysis: RegressionAnalysis;
};

const formatNumber = (
  value: number | null,
  options: Intl.NumberFormatOptions = {},
) => {
  if (value === null || Number.isNaN(value)) {
    return 'â€“';
  }
  const formatter = new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
    ...options,
  });
  return formatter.format(value);
};

const formatPValue = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return 'â€“';
  }
  if (value < 0.0005) {
    return '<0,001';
  }
  return formatNumber(value, { maximumFractionDigits: 3, minimumFractionDigits: 3 });
};

const formatInterval = (
  lower: number | null,
  upper: number | null,
) => {
  if (
    lower === null ||
    upper === null ||
    Number.isNaN(lower) ||
    Number.isNaN(upper)
  ) {
    return 'â€“';
  }
  return `[${formatNumber(lower, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
  })}; ${formatNumber(upper, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
  })}]`;
};

const legendItems = [
  { symbol: '***', description: 'p < 0,001' },
  { symbol: '**', description: 'p < 0,01' },
  { symbol: '*', description: 'p < 0,05' },
  { symbol: 'â€¢', description: 'p < 0,10' },
];

const LinearRegressionSummary: React.FC<{ analysis: LinearRegressionAnalysis }> = ({
  analysis,
}) => {
  const {
    coefficientTable,
    modelSummary,
    diagnostics,
    featureEngineering,
    target,
    predictors,
  } = analysis;

  const confidencePercent = Math.round(diagnostics.confidenceLevel * 100);

  const summaryMetrics = [
    {
      label: 'Beobachtungen',
      value: formatNumber(modelSummary.observations),
    },
    {
      label: 'df Residual',
      value: formatNumber(modelSummary.dfResidual),
    },
    {
      label: 'RÂ²',
      value: formatNumber(modelSummary.rSquared, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    },
    {
      label: 'RÂ² adj.',
      value: formatNumber(modelSummary.adjustedRSquared, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    },
    {
      label: 'RMSE',
      value: formatNumber(modelSummary.rmse, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    },
    {
      label: 'AIC',
      value: formatNumber(modelSummary.aic, {
        maximumFractionDigits: 1,
      }),
    },
    {
      label: 'BIC',
      value: formatNumber(modelSummary.bic, {
        maximumFractionDigits: 1,
      }),
    },
    {
      label: 'F-Statistik',
      value: formatNumber(modelSummary.fStatistic, {
        maximumFractionDigits: 3,
      }),
      suffix:
        modelSummary.fPValue !== null
          ? ` (p = ${formatPValue(modelSummary.fPValue)})`
          : undefined,
    },
  ];

  return (
    <Card className="border border-border/60 bg-card/70 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">
          RegressionsÃ¼bersicht ({analysis.model})
        </CardTitle>
        <CardDescription>
          Zielvariable <code className="font-mono text-xs">{target}</code> mit{' '}
          {predictors.length > 0 ? (
            <>
              {predictors.length} PrÃ¤diktor
              {predictors.length !== 1 ? 'en' : ''}:{' '}
              <span className="font-medium">
                {predictors.join(', ')}
              </span>
            </>
          ) : (
            'nur Achsenabschnitt'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3 tracking-wide">
            Modellmetriken
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-md border border-border/50 bg-background/40 px-3 py-2"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {metric.label}
                </p>
                <p className="text-sm font-semibold">
                  {metric.value}
                  {metric.suffix}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Koeffizienten (Konfidenzniveau {confidencePercent}%)
            </h3>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {legendItems.map((item) => (
                <div key={item.symbol} className="flex items-center gap-1">
                  <Badge variant="outline" className="px-1 py-0 text-[11px]">
                    {item.symbol}
                  </Badge>
                  <span>{item.description}</span>
                </div>
              ))}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Term</TableHead>
                <TableHead>Koeffizient</TableHead>
                <TableHead>Std.-Fehler</TableHead>
                <TableHead>t-Wert</TableHead>
                <TableHead>p-Wert</TableHead>
                <TableHead>Sign.</TableHead>
                <TableHead>{confidencePercent}%-KI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coefficientTable.map((coefficient) => (
                <TableRow key={coefficient.term}>
                  <TableCell className="font-medium">
                    {coefficient.term}
                  </TableCell>
                  <TableCell>
                    {formatNumber(coefficient.coefficient, {
                      maximumFractionDigits: 3,
                      minimumFractionDigits: 3,
                    })}
                  </TableCell>
                  <TableCell>
                    {formatNumber(coefficient.standardError, {
                      maximumFractionDigits: 3,
                      minimumFractionDigits: 3,
                    })}
                  </TableCell>
                  <TableCell>
                    {formatNumber(coefficient.tValue, {
                      maximumFractionDigits: 3,
                      minimumFractionDigits: 3,
                    })}
                  </TableCell>
                  <TableCell>{formatPValue(coefficient.pValue)}</TableCell>
                  <TableCell>
                    {coefficient.significance ?? '-'}
                  </TableCell>
                  <TableCell>
                    {formatInterval(
                      coefficient.confidenceInterval.lower,
                      coefficient.confidenceInterval.upper,
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Diagnostik
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Residuen
              </h4>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt>Spannweite</dt>
                <dd>
                  {formatNumber(diagnostics.residuals.min)} bis{' '}
                  {formatNumber(diagnostics.residuals.max)}
                </dd>
                <dt>Mittelwert</dt>
                <dd>{formatNumber(diagnostics.residuals.mean)}</dd>
                <dt>Std.-Abw.</dt>
                <dd>{formatNumber(diagnostics.residuals.stdDev)}</dd>
                <dt>SSE</dt>
                <dd>{formatNumber(diagnostics.residuals.sse)}</dd>
              </dl>
            </div>
            <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Vorhersagen
              </h4>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt>Spannweite</dt>
                <dd>
                  {formatNumber(diagnostics.fitted.min)} bis{' '}
                  {formatNumber(diagnostics.fitted.max)}
                </dd>
                <dt>Mittelwert</dt>
                <dd>{formatNumber(diagnostics.fitted.mean)}</dd>
                <dt>Std.-Abw.</dt>
                <dd>{formatNumber(diagnostics.fitted.stdDev)}</dd>
                <dt>SST</dt>
                <dd>{formatNumber(diagnostics.sst)}</dd>
              </dl>
            </div>
          </div>
        </section>

        {featureEngineering.length > 0 && (
          <>
            <Separator />
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Feature Engineering
              </h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {featureEngineering.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const RandomForestSummary: React.FC<{ analysis: RandomForestRegressionAnalysis }> = ({
  analysis,
}) => (
  <Card className="border border-border/60 bg-card/70 shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold">
        Random-Forest-Modell
      </CardTitle>
      <CardDescription>
        Zielvariable <code className="font-mono text-xs">{analysis.target}</code>{' '}
        mit {analysis.predictors.length} PrÃ¤diktor
        {analysis.predictors.length !== 1 ? 'en' : ''}.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {analysis.message && (
        <p className="text-sm text-muted-foreground">{analysis.message}</p>
      )}
      <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2 text-sm">
        <p>
          Beobachtungen: <strong>{analysis.observations}</strong>
        </p>
      </div>
      {analysis.featureEngineering && analysis.featureEngineering.length > 0 && (
        <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Feature Engineering
          </h4>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {analysis.featureEngineering.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </CardContent>
  </Card>
);

export const RegressionSummary: React.FC<RegressionSummaryProps> = ({ analysis }) => {
  if (analysis.model === 'Linear Regression') {
    return <LinearRegressionSummary analysis={analysis} />;
  }
  return <RandomForestSummary analysis={analysis} />;
};
