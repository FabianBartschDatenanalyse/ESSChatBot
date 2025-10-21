"use client";

import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { executeQuery } from '@/src/lib/data-service';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/src/components/ui/form';
import { Textarea } from '@/src/components/ui/textarea';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Loader2, Play } from 'lucide-react';
import { useToast } from '@/src/hooks/use-toast';
import { DataTable } from './data-table';
import { ChartShell } from '@/src/features/charting/components/chart-shell';
import { ChartDownloadButton } from '@/src/features/charting/components/chart-download-button';
import { VegaChart } from '@/src/features/charting/components/vega-chart';
import { useChartStore } from '@/src/features/charting/state/chart-store';
import { useChartQuery } from '@/src/features/charting/state/use-chart-query';
import { VisualizationRequest } from '@/src/features/charting/types';

const formSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty.'),
});

interface QueryResult {
    columns: string[];
    data: any[];
}

export default function SqlToolPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [chartDescriptor, setChartDescriptor] = useState<
    { id: string; request: VisualizationRequest } | null
  >(null);
  const { toast } = useToast();
  const resetChartStore = useChartStore((state) => state.reset);
  const chartEntry = useChartStore((state) =>
    chartDescriptor ? state.items[chartDescriptor.id] : undefined,
  );

  const chartId = chartDescriptor?.id ?? 'sql-tool-placeholder';
  const chartRequest = chartDescriptor?.request ?? { nlQuestion: 'placeholder' };

  useChartQuery({
    chartId,
    request: chartRequest,
    enabled: Boolean(chartDescriptor),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: 'SELECT cntry, COUNT(*) as count FROM "ESS1" GROUP BY cntry',
    },
  });

  const resetVisualization = useCallback(() => {
    if (chartDescriptor) {
      resetChartStore(chartDescriptor.id);
    }
    setChartDescriptor(null);
  }, [chartDescriptor, resetChartStore]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);
    resetVisualization();

    try {
      const queryResult = await executeQuery(values.query);
      if (queryResult.error) {
         toast({
            variant: "destructive",
            title: "Query Error",
            description: queryResult.error,
        });
      } else if (queryResult.data) {
        if (queryResult.data.length > 0) {
            const columns = Object.keys(queryResult.data[0]);
            setResult({ columns, data: queryResult.data });

            const newChartId = crypto.randomUUID();
            const visualizationRequest: VisualizationRequest = {
              nlQuestion:
                'Erzeuge eine aussagekräftige Visualisierung aus den ESS-Daten für die folgende SQL-Abfrage. Nutze die Abfrage unverändert und wähle einen geeigneten Chart-Typ.',
              history: [
                {
                  role: 'user',
                  content: values.query,
                },
              ],
              clientChartId: newChartId,
            };

            setChartDescriptor({ id: newChartId, request: visualizationRequest });
        } else {
             toast({
                title: "Query Successful",
                description: "The query ran successfully but returned no results.",
            });
            setResult({ columns: [], data: [] });
            resetVisualization();
        }
      }
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "An Unexpected Error Occurred",
            description: error.message || "Please check the console for more details.",
        });
        resetVisualization();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle className="font-headline">SQL Tool</CardTitle>
            <CardDescription>Execute read-only SQL queries directly against the database.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                    control={form.control}
                    name="query"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>SQL Query</FormLabel>
                            <FormControl>
                                <Textarea 
                                    placeholder='SELECT * FROM "ESS1" LIMIT 10' 
                                    {...field} 
                                    className="font-mono h-40"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="mr-2 h-4 w-4" />
                        )}
                        Execute Query
                    </Button>
                </form>
            </Form>

            <div className="mt-6">
                <h3 className="text-lg font-medium mb-2 font-headline">Results</h3>
                {result ? (
                    <DataTable columns={result.columns} data={result.data} />
                ) : (
                    <p className="text-sm text-muted-foreground">Run a query to see the results here.</p>
                )}
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2 font-headline">Visualization</h3>
              {chartDescriptor ? (
                <ChartShell
                  title={chartEntry?.chart?.title ?? 'Automatisch generierte Visualisierung'}
                  caption={chartEntry?.chart?.caption}
                  actions={
                    <ChartDownloadButton
                      imageDataUrl={chartEntry?.chart?.imageDataUrl}
                      title={chartEntry?.chart?.title}
                      chartId={chartDescriptor.id}
                    />
                  }
                >
                  <VegaChart chartId={chartDescriptor.id} request={chartDescriptor.request} />
                </ChartShell>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run a query to trigger an AI-generated visualization.
                </p>
              )}
            </div>

        </CardContent>
    </Card>
  );
}
