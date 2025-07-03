import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

interface ChunkOptions {
    /** Maximum number of characters per chunk (not bytes) */
    maxChunkSize: number;
    /** Number of characters to overlap between consecutive chunks */
    overlap: number;
    /** Minimum number of characters required for a chunk */
    minChunkSize: number;
    /** Whether to try to keep paragraphs together when possible */
    preserveParagraphs: boolean;
    /** Whether to attempt to fix hyphenated words at line breaks */
    fixHyphenation: boolean;
    /** Chunking strategy: 'characters' (default) or 'words' */
    chunkStrategy?: 'characters' | 'words';
    /** Maximum words per chunk (used when chunkStrategy is 'words') */
    maxWordsPerChunk?: number;
    /** Number of words to overlap between chunks (used when chunkStrategy is 'words') */
    wordOverlap?: number;
}

interface ProcessedChunk {
    text: string;
    metadata: {
        pageNumber: number;
        position: number;
        filename: string;
        /** Size of the chunk text in characters */
        charCount: number;
        /** Size of the chunk text in bytes */
        byteSize: number;
    };
}

export class PDFProcessor {
    private defaultChunkOptions: ChunkOptions = {
        maxChunkSize: 1000,    // 1000 characters max per chunk
        overlap: 200,          // 200 characters of overlap
        minChunkSize: 100,     // At least 100 characters per chunk
        preserveParagraphs: true,
        fixHyphenation: true,  // Enable hyphenation fixing by default
        chunkStrategy: 'characters', // Default to character-based chunking
        maxWordsPerChunk: 150, // 150 words max per chunk (when using word strategy)
        wordOverlap: 20        // 20 words of overlap (when using word strategy)
    };

    /**
     * Clean up text by handling hyphenation and other PDF-specific issues
     * @param text Raw text from PDF
     * @returns Cleaned text
     */
    private cleanText(text: string, fixHyphenation: boolean): string {
        if (!fixHyphenation) return text;

        // Step 1: Handle hyphenated words at line breaks
        // Pattern: word- \n word becomes wordword
        text = text.replace(/(\w+)-\s*\n\s*(\w+)/g, (match, part1, part2) => {
            // Dictionary of common prefixes and suffixes could be added here
            const commonPrefixes = ['re', 'pre', 'un', 'non', 'anti'];
            const commonSuffixes = ['ing', 'ed', 'able', 'ible', 'tion', 'sion'];
            
            // If it matches common patterns for hyphenation at line breaks
            if (
                // Check if the parts make a valid word when combined
                part1.length > 2 && part2.length > 2 &&
                // Check if it's not a common intentional hyphenation
                !commonPrefixes.some(prefix => part2.startsWith(prefix)) &&
                !commonSuffixes.some(suffix => part2.endsWith(suffix))
            ) {
                return part1 + part2;
            }
            // Keep original hyphenation if it seems intentional
            return `${part1}-${part2}`;
        });

        // Step 2: Fix extra spaces
        text = text
            // Remove multiple spaces
            .replace(/\s+/g, ' ')
            // Fix spaces around punctuation
            .replace(/\s+([.,;:!?)])/g, '$1')
            .replace(/([({])\s+/g, '$1');

        // Step 3: Handle common PDF artifacts
        text = text
            // Remove form feed characters
            .replace(/\f/g, '')
            // Normalize line endings
            .replace(/\r\n/g, '\n')
            // Remove repeated line breaks
            .replace(/\n{3,}/g, '\n\n');

        return text;
    }

    /**
     * Extract text from a PDF file
     * @param filePath Path to the PDF file
     * @returns Object containing text and metadata
     */
    async extractText(filePath: string): Promise<{ text: string; pageCount: number }> {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            
            return {
                text: this.cleanText(data.text, this.defaultChunkOptions.fixHyphenation),
                pageCount: data.numpages
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error extracting text from PDF:', error);
            throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
        }
    }

    /**
     * Process a PDF file and return chunks of text
     * @param filePath Path to the PDF file
     * @param options Chunking options
     * @returns Array of processed chunks with metadata
     */
    async processPDF(filePath: string, options: Partial<ChunkOptions> = {}): Promise<ProcessedChunk[]> {
        const mergedOptions: ChunkOptions = { ...this.defaultChunkOptions, ...options };
        const filename = path.basename(filePath);

        try {
            let { text, pageCount } = await this.extractText(filePath);
            // Clean text with user's hyphenation preference
            text = this.cleanText(text, mergedOptions.fixHyphenation);
            return this.createChunks(text, filename, pageCount, mergedOptions);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error processing PDF:', error);
            throw new Error(`Failed to process PDF: ${errorMessage}`);
        }
    }

    /**
     * Create chunks from extracted text
     * @param text The extracted text
     * @param filename Original filename
     * @param pageCount Total number of pages
     * @param options Chunking options
     * @returns Array of processed chunks
     */
    private createChunks(
        text: string,
        filename: string,
        pageCount: number,
        options: ChunkOptions
    ): ProcessedChunk[] {
        if (options.chunkStrategy === 'words') {
            return this.createWordBasedChunks(text, filename, pageCount, options);
        } else {
            return this.createCharacterBasedChunks(text, filename, pageCount, options);
        }
    }

    /**
     * Create chunks based on character count (original method)
     */
    private createCharacterBasedChunks(
        text: string,
        filename: string,
        pageCount: number,
        options: ChunkOptions
    ): ProcessedChunk[] {
        const chunks: ProcessedChunk[] = [];
        let position = 0;

        // Split text into paragraphs if preserveParagraphs is true
        const textBlocks = options.preserveParagraphs 
            ? text.split(/\n\s*\n/).filter(block => block.trim().length > 0)
            : [text];

        for (const block of textBlocks) {
            let currentChunk = '';
            const words = block.split(/\s+/);

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + word;

                if (potentialChunk.length >= options.maxChunkSize && currentChunk.length >= options.minChunkSize) {
                    // Add the current chunk to the results
                    chunks.push({
                        text: currentChunk,
                        metadata: {
                            pageNumber: Math.ceil((position / text.length) * pageCount),
                            position,
                            filename,
                            charCount: currentChunk.length,
                            byteSize: Buffer.byteLength(currentChunk, 'utf8')
                        }
                    });

                    // Start new chunk with overlap
                    const lastWords = currentChunk.split(/\s+/).slice(-Math.ceil(options.overlap / 5)); // Approximate words for overlap
                    currentChunk = lastWords.join(' ') + ' ' + word;
                    position += currentChunk.length;
                } else {
                    currentChunk = potentialChunk;
                }
            }

            // Add the last chunk if it's not empty
            if (currentChunk.trim().length > 0) {
                chunks.push({
                    text: currentChunk.trim(),
                    metadata: {
                        pageNumber: Math.ceil((position / text.length) * pageCount),
                        position,
                        filename,
                        charCount: currentChunk.trim().length,
                        byteSize: Buffer.byteLength(currentChunk.trim(), 'utf8')
                    }
                });
            }
        }

        return chunks;
    }

    /**
     * Create chunks based on word count
     */
    private createWordBasedChunks(
        text: string,
        filename: string,
        pageCount: number,
        options: ChunkOptions
    ): ProcessedChunk[] {
        const chunks: ProcessedChunk[] = [];
        let position = 0;

        // Split text into paragraphs if preserveParagraphs is true
        const textBlocks = options.preserveParagraphs 
            ? text.split(/\n\s*\n/).filter(block => block.trim().length > 0)
            : [text];

        for (const block of textBlocks) {
            const words = block.split(/\s+/).filter(word => word.trim().length > 0);
            const maxWords = options.maxWordsPerChunk || 150;
            const wordOverlap = options.wordOverlap || 20;

            for (let i = 0; i < words.length; i += maxWords - wordOverlap) {
                const chunkWords = words.slice(i, i + maxWords);
                const chunkText = chunkWords.join(' ');

                if (chunkText.trim().length > 0) {
                    chunks.push({
                        text: chunkText.trim(),
                        metadata: {
                            pageNumber: Math.ceil((position / text.length) * pageCount),
                            position,
                            filename,
                            charCount: chunkText.trim().length,
                            byteSize: Buffer.byteLength(chunkText.trim(), 'utf8')
                        }
                    });
                    position += chunkText.length;
                }

                // Stop if we've reached the end
                if (i + maxWords >= words.length) {
                    break;
                }
            }
        }

        return chunks;
    }

    /**
     * Process multiple PDF files
     * @param directoryPath Path to directory containing PDFs
     * @param options Chunking options
     * @returns Array of processed chunks from all PDFs
     */
    async processDirectory(directoryPath: string, options: Partial<ChunkOptions> = {}): Promise<ProcessedChunk[]> {
        try {
            const files = fs.readdirSync(directoryPath)
                .filter(file => file.toLowerCase().endsWith('.pdf'));

            const allChunks: ProcessedChunk[] = [];
            
            for (const file of files) {
                const filePath = path.join(directoryPath, file);
                const chunks = await this.processPDF(filePath, options);
                allChunks.push(...chunks);
            }

            return allChunks;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error processing directory:', error);
            throw new Error(`Failed to process directory: ${errorMessage}`);
        }
    }
} 