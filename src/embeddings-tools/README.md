# Embeddings Manager

A powerful tool for creating vector embeddings from text files using Ollama's embedding models. This tool is designed to work seamlessly with the PDF chunking tools to create embeddings for RAG (Retrieval-Augmented Generation) applications. It also includes Pinecone integration for storing and querying embeddings in a vector database.

## Features

- **Multiple Embedding Models**: Support for any Ollama embedding model (default: nomic-embed-text:v1.5)
- **Batch Processing**: Process multiple text files efficiently with configurable batch sizes
- **Flexible Output Formats**: Save embeddings as JSON or CSV
- **Rich Metadata**: Include source file information, timestamps, and statistics
- **CLI Interface**: Easy-to-use command-line tool
- **Error Handling**: Comprehensive error handling with helpful suggestions
- **Pinecone Integration**: Store and query embeddings in Pinecone vector database
- **Vector Search**: Semantic search capabilities with configurable similarity metrics

## Installation

### Prerequisites

1. **Install Ollama**: [https://ollama.ai/](https://ollama.ai/)
2. **Install the embedding model**:
   ```bash
   ollama pull nomic-embed-text:v1.5
   ```
3. **Start Ollama**:
   ```bash
   ollama serve
   ```

### Setup

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Install globally** (optional):
   ```bash
   npm install -g .
   ```

## Usage

### Command Line Interface

#### Process a Directory of Text Files

```bash
# Basic usage
create-embeddings process-dir ./text-files

# With custom options
create-embeddings process-dir ./chunks \
  --model nomic-embed-text:v1.5 \
  --batch-size 5 \
  --output-format json \
  --output-dir ./embeddings
```

#### Process a Single Text File

```bash
# Process single file
create-embeddings process-file ./document.txt

# Save to specific location
create-embeddings process-file ./document.txt --output-file ./my-embedding.json
```

#### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--model <model>` | Embedding model to use | `nomic-embed-text:v1.5` |
| `--api-url <url>` | Ollama API URL | `http://127.0.0.1:11434` |
| `--batch-size <number>` | Batch size for processing | `10` |
| `--output-format <format>` | Output format: `json` or `csv` | `json` |
| `--output-dir <path>` | Custom output directory | `./embeddings` |
| `--no-metadata` | Exclude text content from output | `false` |
| `--output-file <path>` | Custom output file path | Auto-generated |

### Programmatic Usage

#### Basic Example

```typescript
import { EmbeddingsManager } from './embeddings-manager';

async function createEmbeddings() {
    const manager = new EmbeddingsManager({
        model: 'nomic-embed-text:v1.5',
        batchSize: 10,
        outputFormat: 'json'
    });

    // Process directory
    const resultPath = await manager.processDirectoryAndSave('./text-files');
    console.log(`Embeddings saved to: ${resultPath}`);
}
```

#### Advanced Example

```typescript
import { EmbeddingsManager } from './embeddings-manager';

async function advancedExample() {
    const manager = new EmbeddingsManager({
        model: 'nomic-embed-text:v1.5',
        batchSize: 5,
        outputFormat: 'json',
        includeMetadata: true,
        outputDir: './custom-embeddings'
    });

    // Get embeddings without saving
    const embeddings = await manager.createEmbeddingsFromDirectory('./chunks');
    
    console.log(`Created ${embeddings.length} embeddings`);
    
    // Access individual embedding data
    embeddings.forEach((embedding, index) => {
        console.log(`Embedding ${index + 1}:`);
        console.log(`  Source: ${embedding.sourceFile}`);
        console.log(`  Characters: ${embedding.charCount}`);
        console.log(`  Dimension: ${embedding.embedding.length}`);
        console.log(`  First 3 values: [${embedding.embedding.slice(0, 3).join(', ')}...]`);
    });

    // Save with custom filename
    await manager.saveEmbeddings(embeddings, './my-embeddings.json');
}
```

## Output Formats

### JSON Format

```json
{
  "metadata": {
    "model": "nomic-embed-text:v1.5",
    "totalFiles": 10,
    "totalCharacters": 25000,
    "totalBytes": 25000,
    "created": "2024-01-15T10:30:00.000Z",
    "embeddingDimension": 768
  },
  "embeddings": [
    {
      "text": "Original text content...",
      "embedding": [0.123, -0.456, 0.789, ...],
      "sourceFile": "./chunks/chunk_001.txt",
      "fileSize": 2500,
      "charCount": 2500,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### CSV Format

```csv
sourceFile,fileSize,charCount,timestamp,embedding_0,embedding_1,embedding_2,...
./chunks/chunk_001.txt,2500,2500,2024-01-15T10:30:00.000Z,0.123,-0.456,0.789,...
```

## Integration with PDF Tools

This embeddings manager works seamlessly with the PDF chunking tools:

```bash
# Step 1: Process PDFs into chunks
process-pdf process-dir ./pdfs --output-dir ./chunks --prefix doc

# Step 2: Create embeddings from chunks
create-embeddings process-dir ./chunks --output-format json
```

## Pinecone Integration

The embeddings manager includes a `PineconeManager` class for storing and querying embeddings in Pinecone vector database.

### Setup

1. **Install Pinecone SDK**:
   ```bash
   npm install @pinecone-database/pinecone
   ```

2. **Set environment variables**:
   ```env
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_ENVIRONMENT=your_pinecone_environment
   ```

3. **Use the Pinecone CLI**:
   ```bash
   # Initialize index
   pinecone-cli init --index-name my-docs --dimension 768
   
   # Upsert documents from directory
   pinecone-cli upsert-directory --index-name my-docs --directory ./chunks
   
   # Query the index
   pinecone-cli query --index-name my-docs --query "machine learning" --top-k 5
   ```

### Programmatic Usage

```typescript
import { PineconeManager } from './pinecone-manager';

const pineconeManager = new PineconeManager({
  apiKey: process.env.PINECONE_API_KEY!,
  environment: process.env.PINECONE_ENVIRONMENT!,
  indexName: 'my-docs'
});

// Initialize index
await pineconeManager.initializeIndex(768);

// Upsert documents
await pineconeManager.upsertFromDirectory('./chunks', {
  batchSize: 50,
  embeddingModel: 'nomic-embed-text:v1.5'
});

// Query
const results = await pineconeManager.query('What is machine learning?', 10);
```

For detailed Pinecone documentation, see [PINECONE-README.md](./PINECONE-README.md).

## Configuration

### Environment Variables

- `OLLAMA_API_URL`: Ollama API URL (default: `http://127.0.0.1:11434`)
- `OLLAMA_MODEL`: Default embedding model (default: `nomic-embed-text:v1.5`)

### Model Selection

The tool supports any Ollama embedding model. Popular options include:

- `nomic-embed-text:v1.5` (default) - High quality, 768 dimensions
- `nomic-embed-text:v1` - Good quality, 768 dimensions
- `all-minilm` - Fast, 384 dimensions
- `gte-small` - Good quality, 384 dimensions

To use a different model:

```bash
# Install the model
ollama pull all-minilm

# Use it with the tool
create-embeddings process-dir ./chunks --model all-minilm
```

## Error Handling

The tool provides helpful error messages and suggestions:

### Common Issues

1. **Model not found**:
   ```
   Error: Model 'nomic-embed-text:v1.5' not found
   To install the required model, run: ollama pull nomic-embed-text:v1.5
   ```

2. **Ollama not running**:
   ```
   Error: ECONNREFUSED
   Make sure Ollama is running: ollama serve
   ```

3. **No text files found**:
   ```
   Error: No .txt files found in directory: ./chunks
   ```

## Performance Tips

1. **Batch Size**: Adjust based on your system's memory and Ollama's performance
   - Small batches (5-10): Better for memory-constrained systems
   - Large batches (20-50): Faster processing on powerful systems

2. **Model Selection**: Choose based on your needs
   - High quality: `nomic-embed-text:v1.5`
   - Fast processing: `all-minilm`
   - Balanced: `gte-small`

3. **Output Format**: 
   - Use JSON for rich metadata and debugging
   - Use CSV for large datasets and external processing

## Examples

### Complete Workflow

```bash
# 1. Process PDFs into chunks
process-pdf process-dir ./documents --output-dir ./chunks --prefix doc

# 2. Create embeddings
create-embeddings process-dir ./chunks --output-format json

# 3. Use embeddings in your RAG application
```

### Custom Configuration

```bash
# Process with custom settings
create-embeddings process-dir ./chunks \
  --model all-minilm \
  --batch-size 20 \
  --output-format csv \
  --no-metadata \
  --output-dir ./embeddings-csv
```

## API Reference

### EmbeddingsManager

#### Constructor
```typescript
new EmbeddingsManager(options?: EmbeddingOptions)
```

#### Methods

- `createEmbedding(filePath: string): Promise<EmbeddingResult>`
- `createEmbeddingsFromDirectory(dirPath: string): Promise<EmbeddingResult[]>`
- `saveEmbeddings(embeddings: EmbeddingResult[], outputPath?: string): Promise<string>`
- `processDirectoryAndSave(dirPath: string, outputPath?: string): Promise<string>`
- `getConfig(): Required<EmbeddingOptions>`

### Types

- `EmbeddingResult`: Contains embedding vector and metadata
- `EmbeddingOptions`: Configuration options for the manager

## License

This project is licensed under the ISC License. 