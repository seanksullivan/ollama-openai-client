#!/usr/bin/env node
import { EmbeddingsManager, EmbeddingOptions } from './embeddings-manager';
import path from 'path';

function printUsage() {
    console.log(`
Embeddings Manager CLI

Usage:
    create-embeddings <command> [options]

Commands:
    process-dir <dirPath>           Create embeddings for all .txt files in a directory
    process-file <filePath>         Create embedding for a single text file

Options:
    --model <model>                 Embedding model to use (default: nomic-embed-text:v1.5)
    --api-url <url>                 Ollama API URL (default: http://127.0.0.1:11434)
    --batch-size <number>           Batch size for processing files (default: 10)
    --output-format <format>        Output format: 'json' or 'csv' (default: json)
    --output-dir <path>             Custom output directory (default: ./embeddings)
    --no-metadata                   Exclude text content from output (JSON only)
    --output-file <path>            Custom output file path

Examples:
    create-embeddings process-dir ./text-files --model nomic-embed-text:v1.5
    create-embeddings process-dir ./chunks --output-format csv --batch-size 5
    create-embeddings process-file ./document.txt --output-file ./my-embedding.json
`);
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        printUsage();
        process.exit(0);
    }

    try {
        const command = args[0];

        // Parse options
        const options: EmbeddingOptions = {};

        for (let i = 2; i < args.length; i += 2) {
            switch (args[i]) {
                case '--model':
                    options.model = args[i + 1];
                    break;
                case '--api-url':
                    options.apiUrl = args[i + 1];
                    break;
                case '--batch-size':
                    options.batchSize = parseInt(args[i + 1], 10);
                    break;
                case '--output-format':
                    options.outputFormat = args[i + 1] as 'json' | 'csv';
                    break;
                case '--output-dir':
                    options.outputDir = args[i + 1];
                    break;
                case '--no-metadata':
                    options.includeMetadata = false;
                    i--; // No value to skip
                    break;
                case '--output-file':
                    options.outputDir = path.dirname(args[i + 1]);
                    break;
            }
        }

        const manager = new EmbeddingsManager(options);
        const config = manager.getConfig();

        console.log('Embeddings Manager Configuration:');
        console.log(`- Model: ${config.model}`);
        console.log(`- API URL: ${config.apiUrl}`);
        console.log(`- Batch Size: ${config.batchSize}`);
        console.log(`- Output Format: ${config.outputFormat}`);
        console.log(`- Include Metadata: ${config.includeMetadata}`);
        console.log(`- Output Directory: ${config.outputDir}`);
        console.log('');

        switch (command) {
            case 'process-dir': {
                const dirPath = path.resolve(args[1]);
                console.log(`Processing directory: ${dirPath}`);
                
                const outputFile = args.find(arg => arg.startsWith('--output-file'))?.split('=')[1];
                
                const resultPath = await manager.processDirectoryAndSave(dirPath, outputFile);
                
                console.log('\nProcessing completed successfully!');
                console.log(`Embeddings saved to: ${resultPath}`);
                break;
            }

            case 'process-file': {
                const filePath = path.resolve(args[1]);
                console.log(`Processing file: ${filePath}`);
                
                const embedding = await manager.createEmbedding(filePath);
                
                console.log('\nEmbedding created successfully!');
                console.log(`- Source: ${embedding.sourceFile}`);
                console.log(`- Characters: ${embedding.charCount}`);
                console.log(`- Embedding dimension: ${embedding.embedding.length}`);
                console.log(`- File size: ${embedding.fileSize} bytes`);
                
                const outputFile = args.find(arg => arg.startsWith('--output-file'))?.split('=')[1];
                if (outputFile) {
                    await manager.saveEmbeddings([embedding], outputFile);
                    console.log(`Embedding saved to: ${outputFile}`);
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
            
            // Provide helpful suggestions for common errors
            if (error.message.includes('Model') && error.message.includes('not found')) {
                console.error('\nTo install the required model, run:');
                console.error(`ollama pull ${args.find(arg => arg.startsWith('--model'))?.split('=')[1] || 'nomic-embed-text:v1.5'}`);
            }
            
            if (error.message.includes('ECONNREFUSED')) {
                console.error('\nMake sure Ollama is running:');
                console.error('ollama serve');
            }
        } else {
            console.error('An unknown error occurred');
        }
        process.exit(1);
    }
}

main(); 