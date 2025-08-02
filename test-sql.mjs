// test-sql.mjs
import { register } from 'ts-node';
register({ transpileOnly: true });

const { executeQueryTool } = await import('./src/ai/tools/sql-query-tool.ts');

const result = await executeQueryTool({
  nlQuestion: 'Wie viele Menschen vertrauen dem Parlament in Deutschland?',
  history: [],
});

console.log('--- SQL Query ---');
console.log(result.sqlQuery);
