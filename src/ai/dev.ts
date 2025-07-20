import { config } from 'dotenv';
config();

import '@/ai/flows/main-assistant-flow.ts';
import '@/ai/flows/suggest-sql-query.ts';
import '@/ai/tools/sql-query-tool.ts';
