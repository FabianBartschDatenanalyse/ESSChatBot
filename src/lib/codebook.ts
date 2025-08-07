import * as fs from 'fs';
import * as path from 'path';

// This function reads the codebook from the file system.
// We use a simple caching mechanism to avoid reading the file on every request.
let codebook: string | null = null;

export function getCodebookAsString(): string {
  if (codebook) {
    return codebook;
  }
  
  try {
    const filePath = path.join(process.cwd(), 'codebook-import.txt');
    codebook = fs.readFileSync(filePath, 'utf-8');
    return codebook;
  } catch (error) {
    console.error('Failed to read codebook file:', error);
    // Return a fallback or error message if the file can't be read.
    return 'Error: Could not load the database codebook.';
  }
}
