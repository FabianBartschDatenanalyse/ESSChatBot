import type { Database, InitSqlJsStatic, SqlJsStatic } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let sqlJsInstance: Promise<SqlJsStatic> | null = null;
let initSqlJs: InitSqlJsStatic | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (!initSqlJs) {
    const requiredModule = require('sql.js/dist/sql-wasm.js') as InitSqlJsStatic & { default?: InitSqlJsStatic };
    initSqlJs = requiredModule.default ?? requiredModule;
  }

  const initializer = initSqlJs;
  if (!initializer) {
    throw new Error('Failed to initialize sql.js module.');
  }

  return initializer({
    locateFile: (file) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
  });
}

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsInstance) {
    sqlJsInstance = loadSqlJs();
  }
  return sqlJsInstance;
}

export async function createDatabase(): Promise<Database> {
  const SQL = await getSqlJs();
  return new SQL.Database();
}

export async function openDatabaseFromFile(sqlitePath: string): Promise<Database> {
  const SQL = await getSqlJs();
  const buffer = await fs.readFile(sqlitePath);
  return new SQL.Database(buffer);
}

export async function serializeDatabase(db: Database): Promise<Uint8Array> {
  return db.export();
}
