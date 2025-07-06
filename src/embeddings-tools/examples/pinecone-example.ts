import { PineconeManager, PineconeConfig } from '../pinecone-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  // Configuration
  const config: PineconeConfig = {
    apiKey: process.env.PINECONE_API_KEY!,
    environment: process.env.PINECONE_ENVIRONMENT!,
    indexName: 'example-documents'
  };

  // Create Pinecone manager
  const pineconeManager = new PineconeManager(config);

  try {
    console.log('🚀 Starting Pinecone document upsert example...\n');

    // Step 1: Initialize the index
    console.log('📋 Step 1: Initializing Pinecone index...');
    await pineconeManager.initializeIndex(768);
    console.log('✅ Index initialized successfully\n');

    // Step 2: Create some sample documents
    console.log('📝 Step 2: Creating sample documents...');
    const sampleDocs = [
      {
        id: 'doc1',
        text: 'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions without being explicitly programmed.',
        metadata: { category: 'technology', topic: 'machine learning' }
      },
      {
        id: 'doc2',
        text: 'Natural language processing (NLP) is a field of artificial intelligence that focuses on the interaction between computers and human language.',
        metadata: { category: 'technology', topic: 'nlp' }
      },
      {
        id: 'doc3',
        text: 'Vector databases are specialized databases designed to store and retrieve high-dimensional vector data efficiently for similarity search applications.',
        metadata: { category: 'technology', topic: 'vector databases' }
      }
    ];

    // Step 3: Upsert documents individually
    console.log('📤 Step 3: Upserting documents individually...');
    for (const doc of sampleDocs) {
      await pineconeManager.upsertDocument(doc.text, doc.id, {
        metadata: doc.metadata,
        embeddingModel: 'nomic-embed-text:v1.5'
      });
    }
    console.log('✅ Documents upserted successfully\n');

    // Step 4: Upsert documents in batch
    console.log('📦 Step 4: Upserting documents in batch...');
    const batchDocs = [
      {
        id: 'doc4',
        text: 'Embeddings are numerical representations of text, images, or other data that capture semantic meaning in a high-dimensional space.',
        metadata: { category: 'technology', topic: 'embeddings' }
      },
      {
        id: 'doc5',
        text: 'Semantic search uses natural language processing to understand the meaning and context of search queries, providing more relevant results.',
        metadata: { category: 'technology', topic: 'semantic search' }
      }
    ];

    await pineconeManager.upsertDocuments(batchDocs, {
      batchSize: 10,
      embeddingModel: 'nomic-embed-text:v1.5'
    });
    console.log('✅ Batch documents upserted successfully\n');

    // Step 5: Query the index
    console.log('🔍 Step 5: Querying the index...');
    const queries = [
      'What is machine learning?',
      'How do vector databases work?',
      'Tell me about semantic search'
    ];

    for (const query of queries) {
      console.log(`\nQuery: "${query}"`);
      const results = await pineconeManager.query(query, 3);
      
      console.log('Top results:');
      results.matches?.forEach((match: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${match.id}, Score: ${match.score?.toFixed(4)}`);
        if (match.metadata?.content) {
          const content = (match.metadata.content as string).substring(0, 100) + '...';
          console.log(`     Content: ${content}`);
        }
      });
    }

    // Step 6: Get index statistics
    console.log('\n📊 Step 6: Getting index statistics...');
    const stats = await pineconeManager.getIndexStats();
    console.log('Index statistics:', JSON.stringify(stats, null, 2));

    // Step 7: List all indexes
    console.log('\n📋 Step 7: Listing all indexes...');
    const indexes = await pineconeManager.listIndexes();
    console.log('Available indexes:', JSON.stringify(indexes, null, 2));

    console.log('\n🎉 Example completed successfully!');

  } catch (error) {
    console.error('❌ Error during example:', error);
    process.exit(1);
  }
}

// Example of upserting from a directory
async function upsertFromDirectoryExample() {
  const config: PineconeConfig = {
    apiKey: process.env.PINECONE_API_KEY!,
    environment: process.env.PINECONE_ENVIRONMENT!,
    indexName: 'directory-documents'
  };

  const pineconeManager = new PineconeManager(config);

  try {
    console.log('📁 Upserting documents from directory...');
    
    // Create a sample directory with text files
    const sampleDir = './sample-documents';
    if (!fs.existsSync(sampleDir)) {
      fs.mkdirSync(sampleDir, { recursive: true });
    }

    // Create sample text files
    const sampleFiles = [
      { name: 'ai.txt', content: 'Artificial Intelligence (AI) is the simulation of human intelligence in machines.' },
      { name: 'ml.txt', content: 'Machine Learning is a subset of AI that focuses on algorithms and statistical models.' },
      { name: 'nlp.txt', content: 'Natural Language Processing enables computers to understand and process human language.' }
    ];

    for (const file of sampleFiles) {
      fs.writeFileSync(path.join(sampleDir, file.name), file.content);
    }

    // Initialize index and upsert from directory
    await pineconeManager.initializeIndex(768);
    await pineconeManager.upsertFromDirectory(sampleDir, {
      batchSize: 5,
      embeddingModel: 'nomic-embed-text:v1.5'
    });

    console.log('✅ Documents from directory upserted successfully!');

    // Clean up
    fs.rmSync(sampleDir, { recursive: true, force: true });

  } catch (error) {
    console.error('❌ Error upserting from directory:', error);
  }
}

// Run examples
if (require.main === module) {
  main()
    .then(() => upsertFromDirectoryExample())
    .catch(console.error);
} 