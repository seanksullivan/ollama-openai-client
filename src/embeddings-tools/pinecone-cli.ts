#!/usr/bin/env node

import { PineconeManager, PineconeConfig } from './pinecone-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface CLIArgs {
  command: string;
  indexName?: string;
  directory?: string;
  file?: string;
  text?: string;
  id?: string;
  query?: string;
  topK?: number;
  batchSize?: number;
  namespace?: string;
  dimension?: number;
  model?: string;
  help?: boolean;
}

function printUsage() {
  console.log(`
Pinecone Document Upsert CLI

Usage: pinecone-cli <command> [options]

Commands:
  init                    Initialize a new Pinecone index
  upsert-file            Upsert a single text file
  upsert-directory       Upsert all .txt files from a directory
  upsert-text            Upsert a single text string
  query                  Query the index
  delete                 Delete vectors by IDs
  stats                  Get index statistics
  list-indexes           List all indexes

Options:
  --index-name <name>    Pinecone index name (required)
  --directory <path>     Directory containing .txt files
  --file <path>          Path to a single .txt file
  --text <string>        Text content to upsert
  --id <string>          Document ID for upserting
  --query <string>       Query text for searching
  --top-k <number>       Number of results to return (default: 10)
  --batch-size <number>  Batch size for processing (default: 100)
  --namespace <string>   Pinecone namespace
  --dimension <number>   Vector dimension (default: 768)
  --model <string>       Embedding model (default: nomic-embed-text:v1.5)
  --help                 Show this help message

Environment Variables:
  PINECONE_API_KEY       Your Pinecone API key (required)
  PINECONE_ENVIRONMENT   Your Pinecone environment (required)
  OLLAMA_API_URL         Ollama API URL (default: http://127.0.0.1:11434)

Examples:
  pinecone-cli init --index-name my-docs --dimension 768
  pinecone-cli upsert-directory --index-name my-docs --directory ./documents
  pinecone-cli upsert-file --index-name my-docs --file ./document.txt --id doc1
  pinecone-cli query --index-name my-docs --query "search term" --top-k 5
  pinecone-cli stats --index-name my-docs
`);
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const parsed: CLIArgs = { command: '' };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case 'init':
      case 'upsert-file':
      case 'upsert-directory':
      case 'upsert-text':
      case 'query':
      case 'delete':
      case 'stats':
      case 'list-indexes':
        parsed.command = arg;
        break;
      case '--index-name':
        parsed.indexName = args[++i];
        break;
      case '--directory':
        parsed.directory = args[++i];
        break;
      case '--file':
        parsed.file = args[++i];
        break;
      case '--text':
        parsed.text = args[++i];
        break;
      case '--id':
        parsed.id = args[++i];
        break;
      case '--query':
        parsed.query = args[++i];
        break;
      case '--top-k':
        parsed.topK = parseInt(args[++i]);
        break;
      case '--batch-size':
        parsed.batchSize = parseInt(args[++i]);
        break;
      case '--namespace':
        parsed.namespace = args[++i];
        break;
      case '--dimension':
        parsed.dimension = parseInt(args[++i]);
        break;
      case '--model':
        parsed.model = args[++i];
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
    }
  }

  return parsed;
}

async function main() {
  const args = parseArgs();

  if (args.help || !args.command) {
    printUsage();
    return;
  }

  // Check required environment variables
  const apiKey = process.env.PINECONE_API_KEY;
  const environment = process.env.PINECONE_ENVIRONMENT;

  if (!apiKey) {
    console.error('Error: PINECONE_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!environment) {
    console.error('Error: PINECONE_ENVIRONMENT environment variable is required');
    process.exit(1);
  }

  if (!args.indexName && args.command !== 'list-indexes') {
    console.error('Error: --index-name is required for this command');
    process.exit(1);
  }

  try {
    const config: PineconeConfig = {
      apiKey,
      environment,
      indexName: args.indexName || ''
    };

    const pineconeManager = new PineconeManager(config);

    switch (args.command) {
      case 'init':
        await pineconeManager.initializeIndex(args.dimension || 768);
        console.log('Index initialized successfully');
        break;

      case 'upsert-file':
        if (!args.file || !args.id) {
          console.error('Error: --file and --id are required for upsert-file');
          process.exit(1);
        }
        if (!fs.existsSync(args.file)) {
          console.error(`Error: File not found: ${args.file}`);
          process.exit(1);
        }
        const content = fs.readFileSync(args.file, 'utf-8');
        await pineconeManager.upsertDocument(content, args.id, {
          embeddingModel: args.model,
          metadata: { filename: path.basename(args.file) }
        });
        break;

      case 'upsert-directory':
        if (!args.directory) {
          console.error('Error: --directory is required for upsert-directory');
          process.exit(1);
        }
        if (!fs.existsSync(args.directory)) {
          console.error(`Error: Directory not found: ${args.directory}`);
          process.exit(1);
        }
        await pineconeManager.upsertFromDirectory(args.directory, {
          batchSize: args.batchSize,
          embeddingModel: args.model
        });
        break;

      case 'upsert-text':
        if (!args.text || !args.id) {
          console.error('Error: --text and --id are required for upsert-text');
          process.exit(1);
        }
        await pineconeManager.upsertDocument(args.text, args.id, {
          embeddingModel: args.model
        });
        break;

      case 'query':
        if (!args.query) {
          console.error('Error: --query is required for query');
          process.exit(1);
        }
        const results = await pineconeManager.query(
          args.query,
          args.topK || 10
        );
        console.log('Query results:', JSON.stringify(results, null, 2));
        break;

      case 'delete':
        if (!args.id) {
          console.error('Error: --id is required for delete');
          process.exit(1);
        }
        await pineconeManager.deleteVectors([args.id]);
        break;

      case 'stats':
        const stats = await pineconeManager.getIndexStats();
        console.log('Index statistics:', JSON.stringify(stats, null, 2));
        break;

      case 'list-indexes':
        const indexes = await pineconeManager.listIndexes();
        console.log('Available indexes:', JSON.stringify(indexes, null, 2));
        break;

      default:
        console.error(`Unknown command: ${args.command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 