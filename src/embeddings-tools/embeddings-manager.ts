import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { OllamaClient } from '../ollama-client';

export interface EmbeddingResult {
    /** Original text content */
    text: string;
    /** Vector embedding */
    embedding: number[];
    /** Source file path */
    sourceFile: string;
    /** File size in bytes */
    fileSize: number;
    /** Character count */
    charCount: number;
    /** Processing timestamp */
    timestamp: Date;
}

export interface EmbeddingOptions {
    /** Ollama API URL */
    apiUrl?: string;
    /** Embedding model to use */
    model?: string;
    /** Batch size for processing files */
    batchSize?: number;
    /** Whether to include file metadata */
    includeMetadata?: boolean;
    /** Output format: 'json' or 'csv' */
    outputFormat?: 'json' | 'csv';
    /** Custom output directory */
    outputDir?: string;
}

export class EmbeddingsManager {
    private ollamaClient: OllamaClient;
    private options: Required<EmbeddingOptions>;

    constructor(options: EmbeddingOptions = {}) {
        this.ollamaClient = new OllamaClient();
        this.options = {
            apiUrl: options.apiUrl || process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434',
            model: options.model || 'nomic-embed-text:v1.5',
            batchSize: options.batchSize || 10,
            includeMetadata: options.includeMetadata ?? true,
            outputFormat: options.outputFormat || 'json',
            outputDir: options.outputDir || './embeddings'
        };
    }

    /**
     * Create embeddings for a single text file
     * @param filePath Path to the text file
     * @returns Embedding result with vector and metadata
     */
    async createEmbedding(filePath: string): Promise<EmbeddingResult> {
        try {
            // Read the text file
            const text = fs.readFileSync(filePath, 'utf8');
            const stats = fs.statSync(filePath);

            // Create embedding using Ollama API
            const embedding = await this.createEmbeddingVector(text);

            return {
                text: text,
                embedding: embedding,
                sourceFile: filePath,
                fileSize: stats.size,
                charCount: text.length,
                timestamp: new Date()
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to create embedding for ${filePath}: ${errorMessage}`);
        }
    }

    /**
     * Create embeddings for all text files in a directory
     * @param dirPath Path to directory containing text files
     * @returns Array of embedding results
     */
    async createEmbeddingsFromDirectory(dirPath: string): Promise<EmbeddingResult[]> {
        try {
            // Get all .txt files in the directory
            const files = this.getTextFiles(dirPath);
            
            if (files.length === 0) {
                throw new Error(`No .txt files found in directory: ${dirPath}`);
            }

            console.log(`Found ${files.length} text files to process`);

            const results: EmbeddingResult[] = [];
            
            // Process files in batches
            for (let i = 0; i < files.length; i += this.options.batchSize) {
                const batch = files.slice(i, i + this.options.batchSize);
                console.log(`Processing batch ${Math.floor(i / this.options.batchSize) + 1}/${Math.ceil(files.length / this.options.batchSize)} (${batch.length} files)`);
                
                const batchResults = await Promise.all(
                    batch.map(file => this.createEmbedding(file))
                );
                
                results.push(...batchResults);
            }

            return results;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to create embeddings from directory ${dirPath}: ${errorMessage}`);
        }
    }

    /**
     * Save embeddings to file
     * @param embeddings Array of embedding results
     * @param outputPath Optional output path
     */
    async saveEmbeddings(embeddings: EmbeddingResult[], outputPath?: string): Promise<string> {
        try {
            const finalOutputPath = outputPath || this.getDefaultOutputPath();
            
            // Ensure output directory exists
            const outputDir = path.dirname(finalOutputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            let content: string;
            
            if (this.options.outputFormat === 'csv') {
                content = this.formatAsCSV(embeddings);
            } else {
                content = this.formatAsJSON(embeddings);
            }

            fs.writeFileSync(finalOutputPath, content, 'utf8');
            
            console.log(`Embeddings saved to: ${finalOutputPath}`);
            return finalOutputPath;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to save embeddings: ${errorMessage}`);
        }
    }

    /**
     * Process directory and save embeddings in one step
     * @param dirPath Path to directory containing text files
     * @param outputPath Optional output path
     * @returns Path to saved embeddings file
     */
    async processDirectoryAndSave(dirPath: string, outputPath?: string): Promise<string> {
        const embeddings = await this.createEmbeddingsFromDirectory(dirPath);
        return await this.saveEmbeddings(embeddings, outputPath);
    }

    /**
     * Create embedding vector using Ollama API
     * @param text Text to embed
     * @returns Vector embedding
     */
    private async createEmbeddingVector(text: string): Promise<number[]> {
        try {
            const response = await axios.post(`${this.options.apiUrl}/api/embeddings`, {
                model: this.options.model,
                prompt: text
            });

            if (!response.data.embedding || !Array.isArray(response.data.embedding)) {
                throw new Error('Invalid embedding response from Ollama API');
            }

            return response.data.embedding;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    throw new Error(`Model '${this.options.model}' not found. Please ensure it's installed with: ollama pull ${this.options.model}`);
                }
                throw new Error(`Ollama API error: ${error.response?.data?.error || error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get all .txt files in a directory
     * @param dirPath Directory path
     * @returns Array of file paths
     */
    private getTextFiles(dirPath: string): string[] {
        try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true })
                .filter(dirent => dirent.isFile() && dirent.name.toLowerCase().endsWith('.txt'))
                .map(dirent => path.join(dirPath, dirent.name));
            
            return files.sort(); // Sort for consistent ordering
        } catch (error) {
            throw new Error(`Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Format embeddings as JSON
     * @param embeddings Array of embedding results
     * @returns JSON string
     */
    private formatAsJSON(embeddings: EmbeddingResult[]): string {
        const output = {
            metadata: {
                model: this.options.model,
                totalFiles: embeddings.length,
                totalCharacters: embeddings.reduce((sum, e) => sum + e.charCount, 0),
                totalBytes: embeddings.reduce((sum, e) => sum + e.fileSize, 0),
                created: new Date().toISOString(),
                embeddingDimension: embeddings.length > 0 ? embeddings[0].embedding.length : 0
            },
            embeddings: embeddings.map(e => ({
                text: this.options.includeMetadata ? e.text : undefined,
                embedding: e.embedding,
                sourceFile: e.sourceFile,
                fileSize: e.fileSize,
                charCount: e.charCount,
                timestamp: e.timestamp.toISOString()
            }))
        };

        return JSON.stringify(output, null, 2);
    }

    /**
     * Format embeddings as CSV
     * @param embeddings Array of embedding results
     * @returns CSV string
     */
    private formatAsCSV(embeddings: EmbeddingResult[]): string {
        if (embeddings.length === 0) return '';

        const embeddingDimension = embeddings[0].embedding.length;
        const headers = [
            'sourceFile',
            'fileSize',
            'charCount',
            'timestamp',
            ...Array.from({ length: embeddingDimension }, (_, i) => `embedding_${i}`)
        ];

        const rows = embeddings.map(e => [
            e.sourceFile,
            e.fileSize,
            e.charCount,
            e.timestamp.toISOString(),
            ...e.embedding
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    /**
     * Get default output path
     * @returns Default output file path
     */
    private getDefaultOutputPath(): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const extension = this.options.outputFormat === 'csv' ? 'csv' : 'json';
        return path.join(this.options.outputDir, `embeddings_${timestamp}.${extension}`);
    }

    /**
     * Get current configuration
     * @returns Current options
     */
    getConfig(): Required<EmbeddingOptions> {
        return { ...this.options };
    }
} 