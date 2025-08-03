"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { executeQuery } from '@/lib/data-service';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Play } from 'lucide-react';
import { DataTable } from './data-table';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: 'SELECT cntry, COUNT(*) as count FROM "ESS1" GROUP BY cntry',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);

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
        } else {
             toast({
                title: "Query Successful",
                description: "The query ran successfully but returned no results.",
            });
            setResult({ columns: [], data: [] });
        }
      }
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "An Unexpected Error Occurred",
            description: error.message || "Please check the console for more details.",
        });
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

        </CardContent>
    </Card>
  );
}
