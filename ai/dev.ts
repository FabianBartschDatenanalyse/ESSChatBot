import { config } from 'dotenv';
config();

// Load flows and tools
import '@/ai/flows/main-assistant-flow.ts';
import '@/ai/flows/suggest-sql-query.ts';
import '@/ai/tools/sql-query-tool.ts';
import '@/ai/tools/statistics-tool.ts';
