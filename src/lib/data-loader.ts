import initSqlJs from 'sql.js';
import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

let dbInstance: any;

async function initDb() {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`
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
