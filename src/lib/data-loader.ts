import initSqlJs from 'sql.js';
import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

let db: any;

async function initDb() {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`
  });
  db = new SQL.Database();

  // Load the CSV data
  const filePath = path.join(process.cwd(), 'src', 'data', 'ess_data.csv');
  const csvFile = await fs.readFile(filePath, 'utf8');

  // Parse CSV
  const { data: jsonData, meta } = Papa.parse(csvFile, { header: true, skipEmptyLines: true });
  
  if (!meta.fields) {
    throw new Error('Could not parse CSV headers.');
  }
  const headers = meta.fields;
  
  // Create table
  const createTableQuery = `CREATE TABLE ess_data (${headers.map(h => `"${h}" TEXT`).join(', ')});`;
  db.run(createTableQuery);

  // Insert data
  const stmt = db.prepare(`INSERT INTO ess_data VALUES (${headers.map(() => '?').join(', ')})`);
  jsonData.forEach((row: any) => {
    const values = headers.map(h => row[h]);
    stmt.run(values);
  });
  stmt.free();
}

export { initDb, db };
