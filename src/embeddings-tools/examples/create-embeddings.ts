import { EmbeddingsManager } from '../embeddings-manager';
import path from 'path';

async function main() {
    try {
        console.log('Embeddings Manager Example\n');

        // Create embeddings manager with custom options
        const manager = new EmbeddingsManager({
            model: 'nomic-embed-text:v1.5',
            batchSize: 5,
            outputFormat: 'json',
            includeMetadata: true,
            outputDir: './embeddings-output'
        });

        // Example 1: Process a directory of text files
        console.log('Example 1: Processing directory of text files');
        const pdfOutputDir = path.join(__dirname, '../../pdf-tools/output/batch');
        
        try {
            const resultPath = await manager.processDirectoryAndSave(pdfOutputDir);
            console.log(`✅ Successfully created embeddings from ${pdfOutputDir}`);
            console.log(`📁 Embeddings saved to: ${resultPath}`);
        } catch (error) {
            console.log(`⚠️  Could not process PDF output directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.log('   (This is expected if no PDF chunks have been generated yet)');
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Example 2: Process a single file
        console.log('Example 2: Processing a single text file');
        
        // Create a sample text file for demonstration
        const sampleText = `This is a sample text document for embedding demonstration.
        
It contains multiple paragraphs and demonstrates how the embeddings manager
processes text content and creates vector representations.

The embeddings can be used for semantic search, document similarity,
and other natural language processing tasks.`;

        const sampleFilePath = path.join(__dirname, 'sample-document.txt');
        const fs = require('fs');
        fs.writeFileSync(sampleFilePath, sampleText, 'utf8');

        try {
            const embedding = await manager.createEmbedding(sampleFilePath);
            
            console.log('✅ Single file embedding created successfully!');
            console.log(`📄 Source: ${embedding.sourceFile}`);
            console.log(`📊 Characters: ${embedding.charCount}`);
            console.log(`🔢 Embedding dimension: ${embedding.embedding.length}`);
            console.log(`💾 File size: ${embedding.fileSize} bytes`);
            console.log(`⏰ Timestamp: ${embedding.timestamp.toISOString()}`);
            
            // Show first few values of the embedding vector
            console.log(`🔍 First 5 embedding values: [${embedding.embedding.slice(0, 5).join(', ')}...]`);
            
            // Save the single embedding
            const singleOutputPath = await manager.saveEmbeddings([embedding], './embeddings-output/single-embedding.json');
            console.log(`💾 Single embedding saved to: ${singleOutputPath}`);
            
        } catch (error) {
            console.error(`❌ Error processing single file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Example 3: Show configuration
        console.log('Example 3: Current Configuration');
        const config = manager.getConfig();
        console.log('📋 Current settings:');
        console.log(`   Model: ${config.model}`);
        console.log(`   API URL: ${config.apiUrl}`);
        console.log(`   Batch Size: ${config.batchSize}`);
        console.log(`   Output Format: ${config.outputFormat}`);
        console.log(`   Include Metadata: ${config.includeMetadata}`);
        console.log(`   Output Directory: ${config.outputDir}`);

        console.log('\n✅ Embeddings Manager example completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Install the nomic-embed-text model: ollama pull nomic-embed-text:v1.5');
        console.log('   2. Start Ollama: ollama serve');
        console.log('   3. Run this example: npm run build && node dist/embeddings-tools/examples/create-embeddings.js');

    } catch (error) {
        console.error('❌ Error in embeddings example:', error);
        process.exit(1);
    }
}

// Run the example
main(); 