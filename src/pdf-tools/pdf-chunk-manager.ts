import { PDFProcessor } from './pdf-processor';
import path from 'path';
import fs from 'fs';

export interface ChunkOutput {
    /** Path where chunks were saved */
    outputPath: string;
    /** Number of chunks created */
    chunkCount: number;
    /** Total characters processed */
    totalCharacters: number;
    /** Total bytes processed */
    totalBytes: number;
    /** List of output files created */
    outputFiles: string[];
}

export interface ProcessingOptions {
    /** Maximum characters per chunk */
    maxChunkSize?: number;
    /** Characters to overlap between chunks */
    overlap?: number;
    /** Whether to preserve paragraph structure */
    preserveParagraphs?: boolean;
    /** Whether to fix hyphenation issues */
    fixHyphenation?: boolean;
    /** Custom output directory (default: 'chunks' in same directory as PDF) */
    outputDir?: string;
    /** Prefix for output files */
    filePrefix?: string;
    /** Chunking strategy: 'characters' (default) or 'words' */
    chunkStrategy?: 'characters' | 'words';
    /** Maximum words per chunk (used when chunkStrategy is 'words') */
    maxWordsPerChunk?: number;
    /** Number of words to overlap between chunks (used when chunkStrategy is 'words') */
    wordOverlap?: number;
}

export class PDFChunkManager {
    private processor: PDFProcessor;
    
    constructor() {
        this.processor = new PDFProcessor();
    }

    /**
     * Process a single PDF file and save chunks to text files
     * @param pdfPath Path to the PDF file
     * @param options Processing options
     * @returns Information about the chunks created
     */
    async processPDFToFiles(pdfPath: string, options: ProcessingOptions = {}): Promise<ChunkOutput> {
        // Determine output directory
        const pdfDir = path.dirname(pdfPath);
        const outputDir = options.outputDir || path.join(pdfDir, 'chunks');
        
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        try {
            // Process the PDF
            const chunks = await this.processor.processPDF(pdfPath, {
                maxChunkSize: options.maxChunkSize,
                overlap: options.overlap,
                preserveParagraphs: options.preserveParagraphs,
                fixHyphenation: options.fixHyphenation
            });

            // Track output statistics
            const output: ChunkOutput = {
                outputPath: outputDir,
                chunkCount: chunks.length,
                totalCharacters: 0,
                totalBytes: 0,
                outputFiles: []
            };

            // Save each chunk to a file
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const sourceFile = path.parse(chunk.metadata.filename).name;
                const prefix = options.filePrefix || 'chunk';
                const outFileName = `${prefix}_${sourceFile}_${String(i + 1).padStart(3, '0')}.txt`;
                const outPath = path.join(outputDir, outFileName);

                // Prepare content with metadata
                const content = this.formatChunkContent(chunk, i + 1);
                
                // Write to file
                fs.writeFileSync(outPath, content, 'utf8');
                
                // Update statistics
                output.totalCharacters += chunk.metadata.charCount;
                output.totalBytes += chunk.metadata.byteSize;
                output.outputFiles.push(outFileName);
            }

            return output;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to process PDF ${pdfPath}: ${errorMessage}`);
        }
    }

    /**
     * Process all PDFs in a directory and save chunks to text files
     * @param dirPath Path to directory containing PDFs
     * @param options Processing options
     * @returns Information about all chunks created
     */
    async processDirectoryToFiles(dirPath: string, options: ProcessingOptions = {}): Promise<ChunkOutput> {
        try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true })
                .filter(dirent => dirent.isFile() && dirent.name.toLowerCase().endsWith('.pdf'))
                .map(dirent => dirent.name);

            if (files.length === 0) {
                throw new Error('No PDF files found in directory');
            }

            // Process each PDF and combine results
            const results = await Promise.all(
                files.map(file => 
                    this.processPDFToFiles(
                        path.join(dirPath, file),
                        options
                    )
                )
            );

            // Combine all results
            const combinedOutput: ChunkOutput = {
                outputPath: results[0].outputPath,
                chunkCount: 0,
                totalCharacters: 0,
                totalBytes: 0,
                outputFiles: []
            };

            results.forEach(result => {
                combinedOutput.chunkCount += result.chunkCount;
                combinedOutput.totalCharacters += result.totalCharacters;
                combinedOutput.totalBytes += result.totalBytes;
                combinedOutput.outputFiles.push(...result.outputFiles);
            });

            return combinedOutput;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to process directory ${dirPath}: ${errorMessage}`);
        }
    }

    /**
     * Get raw chunks without saving to files
     * @param pdfPath Path to PDF file
     * @param options Processing options
     * @returns Array of processed chunks
     */
    async getChunks(pdfPath: string, options: ProcessingOptions = {}) {
        return this.processor.processPDF(pdfPath, {
            maxChunkSize: options.maxChunkSize,
            overlap: options.overlap,
            preserveParagraphs: options.preserveParagraphs,
            fixHyphenation: options.fixHyphenation
        });
    }

    /**
     * Format chunk content with metadata
     * @param chunk The chunk to format
     * @param chunkNumber The chunk number
     * @returns Formatted content string
     */
    private formatChunkContent(chunk: any, chunkNumber: number): string {
        return `Source: ${chunk.metadata.filename}
Page: ${chunk.metadata.pageNumber}
Position: ${chunk.metadata.position}
Chunk: ${chunkNumber}
Size: ${chunk.metadata.charCount} characters (${chunk.metadata.byteSize} bytes)
-------------------
${chunk.text}
`;
    }
} 