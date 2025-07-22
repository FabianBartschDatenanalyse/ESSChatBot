"use client";

import { useState } from 'react';
import { suggestSqlQuery } from '@/ai/flows/suggest-sql-query';
import { executeQuery } from '@/lib/data-service';


import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/data-table';
import { Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchCodebook } from '@/lib/vector-search';

type QueryResult = {
    columns: string[];
    rows: Record<string, any>[];
} | null;

export default function SqlToolPanel() {
    const { toast } = useToast();
    const [sqlQuery, setSqlQuery] = useState("SELECT cntry, AVG(CAST(trstprl AS NUMERIC)) as avg_trust, COUNT(idno) as sample_size\nFROM \"ESS1\"\nGROUP BY cntry\nORDER BY avg_trust DESC");
    const [nlQuestion, setNlQuestion] = useState("");
    const [queryResult, setQueryResult] = useState<QueryResult>(null);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    const handleSuggestQuery = async () => {
        if (!nlQuestion) {
            toast({
                variant: 'destructive',
                title: 'No question provided',
                description: 'Please enter a question to get a query suggestion.',
            });
            return;
        }
        setIsSuggesting(true);
        try {
            const searchResults = await searchCodebook(nlQuestion, 5);
            const codebookContext = searchResults
              .map(result => `- ${result.content}`)
              .join('\n');
            const result = await suggestSqlQuery({ question: nlQuestion, codebook: codebookContext });
            setSqlQuery(result.sqlQuery);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Suggestion Failed',
                description: 'Could not generate SQL query from your question.',
            });
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleRunQuery = async () => {
        setIsRunning(true);
        setQueryResult(null);
        try {
            const result = await executeQuery(sqlQuery);
            if (result.error) {
                 toast({
                    variant: 'destructive',
                    title: 'Query Failed',
                    description: result.error,
                });
                setQueryResult(null);
            } else if (result.data && result.data.length > 0) {
                 const columns = Object.keys(result.data[0]);
                 const rows = result.data;
                 setQueryResult({ columns, rows });

                toast({
                    title: 'Query Executed',
                    description: `Returned ${rows.length} rows.`,
                })
            } else {
                 setQueryResult({columns: [], rows: []});
                 toast({
                    title: 'Query Executed',
                    description: 'The query ran successfully but returned no rows.',
                })
            }
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Execution Failed',
                description: error.message || 'An unexpected error occurred.',
            });
            setQueryResult(null);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="nl-question">Ask a question to generate a query</Label>
                    <div className="flex gap-2">
                        <Input 
                            id="nl-question" 
                            placeholder="e.g., What is the average trust in parliament per country?" 
                            value={nlQuestion}
                            onChange={(e) => setNlQuestion(e.target.value)}
                            disabled={isSuggesting}
                        />
                        <Button onClick={handleSuggestQuery} disabled={isSuggesting}>
                            {isSuggesting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Wand2 className="h-4 w-4" />
                            )}
                            <span className="sr-only">Suggest Query</span>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="sql-query">SQL Query</Label>
                <Textarea 
                    id="sql-query"
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    className="h-32 font-mono text-sm"
                    placeholder="SELECT * FROM \"ESS1\";"
                />
            </div>
            
            <Button onClick={handleRunQuery} disabled={isRunning}>
                {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Run Query
            </Button>

            {isRunning && (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-muted-foreground">Running query...</span>
              </div>
            )}
            
            {queryResult && (
                 <div className="space-y-4">
                    <h3 className="font-headline text-lg font-semibold">Query Results</h3>
                    <DataTable columns={queryResult.columns} data={queryResult.rows} />
                </div>
            )}
        </div>
    );
}
