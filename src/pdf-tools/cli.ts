#!/usr/bin/env node
import { PDFChunkManager, ProcessingOptions } from './pdf-chunk-manager';
import path from 'path';

function printUsage() {
    console.log(`
PDF Chunk Manager CLI

Usage:
    process-pdf <command> [options]

Commands:
    process-file <pdfPath>          Process a single PDF file
    process-dir <dirPath>           Process all PDFs in a directory
    get-chunks <pdfPath>            Get chunks without saving to files

Options:
    --max-chunk-size <number>       Maximum characters per chunk (default: 1000)
    --overlap <number>              Characters to overlap between chunks (default: 200)
    --chunk-strategy <strategy>     Chunking strategy: 'characters' or 'words' (default: characters)
    --max-words-per-chunk <number>  Maximum words per chunk (when using word strategy, default: 150)
    --word-overlap <number>         Words to overlap between chunks (when using word strategy, default: 20)
    --no-preserve-paragraphs        Disable paragraph preservation
    --no-fix-hyphenation           Disable hyphenation fixing
    --output-dir <path>            Custom output directory
    --prefix <string>              Custom prefix for output files (default: "chunk")

Examples:
    process-pdf process-file ./document.pdf --max-chunk-size 2500 --overlap 100
    process-pdf process-file ./document.pdf --chunk-strategy words --max-words-per-chunk 200
    process-pdf process-dir ./pdfs --output-dir ./output --prefix doc
    process-pdf get-chunks ./document.pdf --max-chunk-size 2000
`);
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        printUsage();
        process.exit(0);
    }

    try {
        const manager = new PDFChunkManager();
        const command = args[0];

        // Parse options
        const options: ProcessingOptions = {
            maxChunkSize: 10000,
            overlap: 200,
            preserveParagraphs: true,
            fixHyphenation: true,
            filePrefix: 'chunk'
        };

        for (let i = 2; i < args.length; i += 2) {
            switch (args[i]) {
                case '--max-chunk-size':
                    options.maxChunkSize = parseInt(args[i + 1], 10);
                    break;
                case '--overlap':
                    options.overlap = parseInt(args[i + 1], 10);
                    break;
                case '--chunk-strategy':
                    options.chunkStrategy = args[i + 1] as 'characters' | 'words';
                    break;
                case '--max-words-per-chunk':
                    options.maxWordsPerChunk = parseInt(args[i + 1], 10);
                    break;
                case '--word-overlap':
                    options.wordOverlap = parseInt(args[i + 1], 10);
                    break;
                case '--no-preserve-paragraphs':
                    options.preserveParagraphs = false;
                    i--; // No value to skip
                    break;
                case '--no-fix-hyphenation':
                    options.fixHyphenation = false;
                    i--; // No value to skip
                    break;
                case '--output-dir':
                    options.outputDir = args[i + 1];
                    break;
                case '--prefix':
                    options.filePrefix = args[i + 1];
                    break;
            }
        }

        switch (command) {
            case 'process-file': {
                const pdfPath = path.resolve(args[1]);
                console.log(`Processing PDF: ${pdfPath}`);
                const result = await manager.processPDFToFiles(pdfPath, options);
                console.log('\nResults:');
                console.log(`- Output directory: ${result.outputPath}`);
                console.log(`- Chunks created: ${result.chunkCount}`);
                console.log(`- Total characters: ${result.totalCharacters}`);
                console.log(`- Total bytes: ${result.totalBytes}`);
                console.log(`- Output files: ${result.outputFiles.join(', ')}`);
                break;
            }

            case 'process-dir': {
                const dirPath = path.resolve(args[1]);
                console.log(`Processing directory: ${dirPath}`);
                const result = await manager.processDirectoryToFiles(dirPath, options);
                console.log('\nResults:');
                console.log(`- Output directory: ${result.outputPath}`);
                console.log(`- Total chunks: ${result.chunkCount}`);
                console.log(`- Total characters: ${result.totalCharacters}`);
                console.log(`- Total bytes: ${result.totalBytes}`);
                console.log(`- Files created: ${result.outputFiles.length}`);
                break;
            }

            case 'get-chunks': {
                const pdfPath = path.resolve(args[1]);
                console.log(`Getting chunks from: ${pdfPath}`);
                const chunks = await manager.getChunks(pdfPath, options);
                console.log(`\nRetrieved ${chunks.length} chunks`);
                if (chunks.length > 0) {
                    console.log('\nFirst chunk preview:');
                    const firstChunk = chunks[0];
                    console.log(`- Page: ${firstChunk.metadata.pageNumber}`);
                    console.log(`- Characters: ${firstChunk.metadata.charCount}`);
                    console.log(`- Text preview: ${firstChunk.text.slice(0, 100)}...`);
                }
                break;
            }

            default:
                console.error(`Unknown command: ${command}`);
                printUsage();
                process.exit(1);
        }

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        } else {
            console.error('An unknown error occurred');
        }
        process.exit(1);
    }
}

main(); 