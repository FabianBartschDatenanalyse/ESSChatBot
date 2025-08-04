import { config } from 'dotenv';
config();

// Load flows and tools
import '@/src/ai/flows/main-assistant-flow.ts';
import '@/src/ai/flows/suggest-sql-query.ts';
import '@/src/ai/tools/sql-query-tool.ts';
import '@/src/ai/tools/statistics-tool.ts';

