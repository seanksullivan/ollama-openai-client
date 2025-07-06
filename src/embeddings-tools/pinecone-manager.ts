import { Pinecone } from '@pinecone-database/pinecone';
import * as fs from 'fs';
import * as path from 'path';
import { EmbeddingsManager } from './embeddings-manager';

export interface PineconeConfig {
  apiKey: string;
  environment: string;
  indexName: string;
}

export interface DocumentMetadata {
  filename?: string;
  content?: string;
  chunkIndex?: number;
  totalChunks?: number;
  timestamp?: string;
  [key: string]: any;
}

export interface UpsertOptions {
  batchSize?: number;
  namespace?: string;
  metadata?: DocumentMetadata;
  embeddingModel?: string;
}

export class PineconeManager {
  private pinecone: Pinecone;
  private indexName: string;
  private embeddingsManager: EmbeddingsManager;

  constructor(config: PineconeConfig) {
    this.pinecone = new Pinecone({
      apiKey: config.apiKey,
    });
    this.indexName = config.indexName;
    this.embeddingsManager = new EmbeddingsManager();
  }

  /**
   * Initialize the Pinecone index
   */
  async initializeIndex(dimension: number = 768): Promise<void> {
    try {
      const indexes = await this.pinecone.listIndexes();
      const indexNames = Object.values(indexes).map((index: any) => index.name);
      const indexExists = indexNames.includes(this.indexName);

      if (!indexExists) {
        console.log(`Creating index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        // Wait for index to be ready
        console.log('Waiting for index to be ready...');
        await this.waitForIndexReady();
      } else {
        console.log(`Index ${this.indexName} already exists`);
      }
    } catch (error) {
      console.error('Error initializing index:', error);
      throw error;
    }
  }

  /**
   * Wait for index to be ready
   */
  private async waitForIndexReady(): Promise<void> {
    const maxAttempts = 30;
    const delayMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const index = this.pinecone.index(this.indexName);
        const stats = await index.describeIndexStats();
        console.log('Index is ready!');
        return;
      } catch (error) {
        if (attempt < maxAttempts - 1) {
          console.log(`Waiting for index to be ready... (attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          throw new Error('Index failed to become ready within expected time');
        }
      }
    }
  }

  /**
   * Upsert a single text document to Pinecone
   */
  async upsertDocument(
    text: string,
    id: string,
    options: UpsertOptions = {}
  ): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);
      
      // Generate embedding using the private method
      const embedding = await this.createEmbeddingVector(text, options.embeddingModel);

      // Prepare metadata
      const metadata: DocumentMetadata = {
        content: text,
        timestamp: new Date().toISOString(),
        ...options.metadata
      };

      // Upsert to Pinecone
      await index.upsert([{
        id,
        values: embedding,
        metadata
      }]);

      console.log(`Successfully upserted document: ${id}`);
    } catch (error) {
      console.error(`Error upserting document ${id}:`, error);
      throw error;
    }
  }

  /**
   * Upsert multiple text documents to Pinecone in batches
   */
  async upsertDocuments(
    documents: Array<{ text: string; id: string; metadata?: DocumentMetadata }>,
    options: UpsertOptions = {}
  ): Promise<void> {
    const batchSize = options.batchSize || 100;
    const index = this.pinecone.index(this.indexName);

    console.log(`Upserting ${documents.length} documents in batches of ${batchSize}`);

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);

      try {
        // Generate embeddings for the batch
        const embeddings = await Promise.all(
          batch.map(async (doc) => {
            const embedding = await this.createEmbeddingVector(doc.text, options.embeddingModel);
            return {
              id: doc.id,
              values: embedding,
              metadata: {
                content: doc.text,
                timestamp: new Date().toISOString(),
                ...doc.metadata,
                ...options.metadata
              }
            };
          })
        );

        // Upsert batch to Pinecone
        await index.upsert(embeddings);
        console.log(`Successfully upserted batch of ${batch.length} documents`);
      } catch (error) {
        console.error(`Error upserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }
    }
  }

  /**
   * Upsert text documents from a directory
   */
  async upsertFromDirectory(
    directoryPath: string,
    options: UpsertOptions = {}
  ): Promise<void> {
    try {
      const files = fs.readdirSync(directoryPath)
        .filter(file => file.endsWith('.txt'))
        .map(file => path.join(directoryPath, file));

      console.log(`Found ${files.length} text files in directory`);

      const documents = files.map(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const filename = path.basename(filePath, '.txt');
        return {
          text: content,
          id: filename,
          metadata: {
            filename: path.basename(filePath),
            filepath: filePath,
            ...options.metadata
          }
        };
      });

      await this.upsertDocuments(documents, options);
    } catch (error) {
      console.error('Error upserting from directory:', error);
      throw error;
    }
  }

  /**
   * Query the Pinecone index
   */
  async query(
    queryText: string,
    topK: number = 10,
    namespace?: string,
    filter?: any
  ): Promise<any> {
    try {
      const index = this.pinecone.index(this.indexName);
      
      // Generate embedding for query
      const queryEmbedding = await this.createEmbeddingVector(queryText);

      // Query Pinecone
      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        filter,
        includeMetadata: true
      });

      return queryResponse;
    } catch (error) {
      console.error('Error querying index:', error);
      throw error;
    }
  }

  /**
   * Delete vectors from the index
   */
  async deleteVectors(ids: string[], namespace?: string): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);
      await index.deleteMany(ids);
      console.log(`Successfully deleted ${ids.length} vectors`);
    } catch (error) {
      console.error('Error deleting vectors:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error('Error getting index stats:', error);
      throw error;
    }
  }

  /**
   * Create embedding vector using Ollama API
   * @param text Text to embed
   * @param model Optional model name
   * @returns Vector embedding
   */
  private async createEmbeddingVector(text: string, model?: string): Promise<number[]> {
    try {
      const apiUrl = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434';
      const embeddingModel = model || 'nomic-embed-text:v1.5';
      
      const response = await fetch(`${apiUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: embeddingModel,
          prompt: text
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama API');
      }

      return data.embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw error;
    }
  }

  /**
   * List all indexes
   */
  async listIndexes(): Promise<any[]> {
    try {
      const indexes = await this.pinecone.listIndexes();
      return Object.values(indexes);
    } catch (error) {
      console.error('Error listing indexes:', error);
      throw error;
    }
  }
} 