// This file provides a function to read the entire codebook as a string.
// This is used to provide full context to the AI model for generating SQL queries.

import * as fs from 'fs';
import * as path from 'path';

let codebookCache: string | null = null;

/**
 * Reads the codebook-import.txt file and returns its content as a single string.
 * The content is cached in memory after the first read to improve performance.
 * @returns The content of the codebook file as a string.
 */
export function getCodebookAsString(): string {
  if (codebookCache) {
    return codebookCache;
  }

  try {
    // Navigate to the project's root directory to find the file.
    const filePath = path.join(process.cwd(), 'codebook-import.txt');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    codebookCache = fileContent;
    return fileContent;
  } catch (error) {
    console.error('Error reading codebook-import.txt:', error);
    // Return a fallback error message if the file cannot be read.
    return 'Error: Could not load the codebook. Please ensure that codebook-import.txt exists in the root directory.';
  }
}
