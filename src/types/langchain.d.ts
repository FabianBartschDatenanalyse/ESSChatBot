declare module 'langchain/text_splitter' {
  type BaseParams = {
    chunkSize?: number;
    chunkOverlap?: number;
  };

  type SplitDocument = {
    pageContent: string;
    metadata?: Record<string, unknown>;
  };

  export class RecursiveCharacterTextSplitter {
    constructor(params?: BaseParams);
    createDocuments(input: string[]): Promise<SplitDocument[]>;
  }
}
