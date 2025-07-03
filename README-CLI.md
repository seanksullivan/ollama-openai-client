# PDF Chunk Manager CLI

A command-line tool for processing PDF files into text chunks for RAG (Retrieval-Augmented Generation) applications. This tool helps you extract, process, and manage text from PDFs with configurable chunk sizes and various processing options.

## Features

- **Single PDF Processing**: Process individual PDF files with customizable chunk sizes
- **Batch Processing**: Process entire directories of PDFs at once
- **Preview Mode**: Get chunk information without saving files
- **Smart Text Processing**: Preserve paragraphs and fix hyphenation
- **Flexible Output**: Customizable output directories and file naming
- **Detailed Reporting**: Comprehensive statistics on processing results

## Installation

### Local Development
```bash
# Clone the repository
git clone <repository-url>
cd ollama-openai-client

# Install dependencies
npm install

# Build the project
npm run build
```

### Global Installation
```bash
# Install globally to use from anywhere
npm install -g .
```

This will install the `process-pdf` command globally on your system.

## Quick Start

1. **Build the project** (if not installed globally):
   ```bash
   npm run build
   ```

2. **Process a single PDF**:
   ```bash
   # Using the built CLI
   node dist/pdf-tools/cli.js process-file ./document.pdf
   
   # Or if installed globally
   process-pdf process-file ./document.pdf
   ```

3. **Process a directory of PDFs**:
   ```bash
   process-pdf process-dir ./pdfs --output-dir ./output --prefix doc
   ```

## Usage

The CLI provides three main commands:

### 1. Process a Single PDF File

```bash
process-pdf process-file <pdfPath> [options]
```

**Example:**
```bash
process-pdf process-file ./document.pdf --max-chunk-size 2500 --overlap 100 --output-dir ./output
```

**What it does:**
- Processes the specified PDF file
- Creates chunks of approximately 2500 characters each
- Includes 100 characters of overlap between chunks
- Saves the chunks in the ./output directory
- Provides detailed statistics about the processing

### 2. Process a Directory of PDFs

```bash
process-pdf process-dir <dirPath> [options]
```

**Example:**
```bash
process-pdf process-dir ./pdfs --output-dir ./output --prefix doc
```

**What it does:**
- Processes all PDF files in the specified directory
- Saves chunks for each PDF with the specified prefix
- Creates organized output structure
- Provides summary statistics for all processed files

### 3. Get Chunks Without Saving

```bash
process-pdf get-chunks <pdfPath> [options]
```

**Example:**
```bash
process-pdf get-chunks ./document.pdf --max-chunk-size 2000
```

**What it does:**
- Processes the PDF and displays chunk information
- Shows a preview of the first chunk
- Does not save any files (useful for testing configurations)

## Command Line Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `--max-chunk-size <number>` | Maximum characters per chunk | 1000 | `--max-chunk-size 2500` |
| `--overlap <number>` | Characters to overlap between chunks | 200 | `--overlap 100` |
| `--chunk-strategy <strategy>` | Chunking strategy: 'characters' or 'words' | 'characters' | `--chunk-strategy words` |
| `--max-words-per-chunk <number>` | Maximum words per chunk (word strategy) | 150 | `--max-words-per-chunk 200` |
| `--word-overlap <number>` | Words to overlap between chunks (word strategy) | 20 | `--word-overlap 15` |
| `--no-preserve-paragraphs` | Disable paragraph preservation | false | `--no-preserve-paragraphs` |
| `--no-fix-hyphenation` | Disable hyphenation fixing | false | `--no-fix-hyphenation` |
| `--output-dir <path>` | Custom output directory | `./chunks` | `--output-dir ./processed` |
| `--prefix <string>` | Custom prefix for output files | "chunk" | `--prefix section` |

## Output Format

Each chunk file contains a structured format with metadata and content:

```
Source: original_filename.pdf
Page: <page_number>
Position: <position_in_document>
Chunk: <chunk_number>
Size: <character_count> characters (<byte_size> bytes)
-------------------
[Chunk content]
```

## Examples

### Basic Usage

1. **Process a large PDF with custom chunk size:**
   ```bash
   process-pdf process-file ./large-doc.pdf --max-chunk-size 3000 --overlap 150
   ```

2. **Process multiple PDFs with custom output:**
   ```bash
   process-pdf process-dir ./documents --output-dir ./processed --prefix section
   ```

3. **Quick preview of chunks:**
   ```bash
   process-pdf get-chunks ./article.pdf --max-chunk-size 1500
   ```

### Advanced Usage

4. **Process with minimal overlap for clear sections:**
   ```bash
   process-pdf process-file ./manual.pdf --max-chunk-size 2000 --overlap 50
   ```

5. **Use word-based chunking for natural language processing:**
   ```bash
   process-pdf process-file ./article.pdf --chunk-strategy words --max-words-per-chunk 200 --word-overlap 15
   ```

6. **Disable text processing features:**
   ```bash
   process-pdf process-file ./raw-text.pdf --no-preserve-paragraphs --no-fix-hyphenation
   ```

7. **Custom output organization:**
   ```bash
   process-pdf process-dir ./research-papers --output-dir ./chunks --prefix paper
   ```

8. **Word-based chunking with custom overlap:**
   ```bash
   process-pdf process-file ./document.pdf --chunk-strategy words --max-words-per-chunk 150 --word-overlap 25
   ```

## Configuration Tips

### Chunking Strategies

The tool supports two chunking strategies:

#### Character-Based Chunking (Default)
- **Best for**: RAG applications, API token limits, cross-language support
- **Advantages**: Predictable token counts, language-agnostic, precise control
- **Use when**: You need consistent chunk sizes for vector embeddings or API calls

#### Word-Based Chunking
- **Best for**: Natural language processing, semantic coherence
- **Advantages**: More natural text boundaries, better for reading comprehension
- **Use when**: Content is primarily English and you want more natural chunk boundaries

### Chunk Size Guidelines

#### Character-Based Guidelines
- **Small chunks (500-1000 chars)**: Good for precise retrieval, more chunks to manage
- **Medium chunks (1000-2000 chars)**: Balanced approach, good for most use cases
- **Large chunks (2000-3000 chars)**: Better context, fewer chunks, good for long-form content

#### Word-Based Guidelines
- **Small chunks (50-100 words)**: Good for precise retrieval, more semantic units
- **Medium chunks (100-200 words)**: Balanced approach, natural paragraph-like chunks
- **Large chunks (200-300 words)**: Better context, fewer chunks, good for document sections

### Overlap Guidelines

#### Character-Based Overlap
- **Small overlap (50-100 chars)**: For documents with clear section breaks
- **Medium overlap (100-200 chars)**: Default, works well for most documents
- **Large overlap (200-300 chars)**: For documents with complex context requirements

#### Word-Based Overlap
- **Small overlap (5-10 words)**: For documents with clear section breaks
- **Medium overlap (10-20 words)**: Default, works well for most documents
- **Large overlap (20-30 words)**: For documents with complex context requirements

### Processing Options
- **Keep paragraph preservation enabled** for better context and readability
- **Keep hyphenation fixing enabled** for cleaner text
- **Use meaningful prefixes** when processing multiple documents for better organization

## Error Handling

The tool provides comprehensive error handling:

- **File validation**: Checks if input files exist and are valid PDFs
- **Directory creation**: Automatically creates output directories if they don't exist
- **Detailed error messages**: Clear explanations for common issues
- **Graceful failure**: Exits with appropriate status codes on errors

### Common Issues and Solutions

1. **"File not found"**: Ensure the PDF path is correct and the file exists
2. **"Invalid PDF"**: Check if the file is corrupted or not a valid PDF
3. **"Permission denied"**: Ensure you have write permissions for the output directory
4. **"Memory issues"**: Reduce chunk size for very large PDFs

## Development

### Running from Source
```bash
# Install dependencies
npm install

# Run the CLI directly with ts-node
npx ts-node src/pdf-tools/cli.ts process-file ./document.pdf

# Or build and run
npm run build
node dist/pdf-tools/cli.js process-file ./document.pdf
```

### Testing
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Getting Help

Display the help message:
```bash
process-pdf --help
```

or
```bash
process-pdf -h
```

## License

This project is licensed under the ISC License. 