import initSqlJs from 'sql.js';
import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

let dbInstance: any;

async function initDb() {
  if (dbInstance) return dbInstance;

  // sql.js needs to locate its .wasm file. In a server environment, we must provide the path.
  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmBinary = await fs.readFile(wasmPath);
  
  const SQL = await initSqlJs({
    wasmBinary
  });
  dbInstance = new SQL.Database();

  const filePath = path.join(process.cwd(), 'src', 'data', 'ess_data.csv');
  const csvFile = await fs.readFile(filePath, 'utf8');

  const { data: jsonData, meta } = Papa.parse(csvFile, { header: true, skipEmptyLines: true });
  
  if (!meta.fields) {
    throw new Error('Could not parse CSV headers.');
  }
  const headers = meta.fields;
  
  const createTableQuery = `CREATE TABLE ess_data (${headers.map(h => `"${h}" TEXT`).join(', ')});`;
  dbInstance.run(createTableQuery);

  const stmt = dbInstance.prepare(`INSERT INTO ess_data VALUES (${headers.map(() => '?').join(', ')})`);
  jsonData.forEach((row: any) => {
    const values = headers.map(h => row[h] === undefined || row[h] === null ? null : String(row[h]));
    stmt.run(values);
  });
  stmt.free();
  
  return dbInstance;
}

export { initDb };
export type { Database } from 'sql.js';
