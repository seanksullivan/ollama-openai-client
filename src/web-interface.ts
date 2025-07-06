import express, { Request, Response, RequestHandler } from 'express';
import { OllamaClient } from './ollama-client';
import { PineconeManager, PineconeConfig } from './embeddings-tools/pinecone-manager';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = 3000;
const client = new OllamaClient();

// Store Pinecone credentials for dynamic manager creation
let pineconeCredentials: { apiKey: string; environment: string } | null = null;
if (process.env.PINECONE_API_KEY && process.env.PINECONE_ENVIRONMENT) {
    pineconeCredentials = {
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT
    };
    console.log('✅ Pinecone credentials loaded successfully');
} else {
    console.log('⚠️  Pinecone credentials not found. RAG functionality will be disabled.');
}

// Get the default system prompt from .env
const defaultSystemPrompt = process.env.SYSTEM_PROMPT || 'You are a helpful AI assistant.';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the main page with embedded default system prompt
app.get('/', ((req: Request, res: Response) => {
    const indexPath = path.join(__dirname, '../public/index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Add the default system prompt to the HTML
    html = html.replace(
        '<script>',
        `<script>
            // Initialize default system prompt
            const defaultSystemPrompt = ${JSON.stringify(defaultSystemPrompt)};
        </script>
        <script>`
    );
    
    res.send(html);
}) as RequestHandler);

// Get default system prompt
app.get('/api/system-prompt', ((req: Request, res: Response) => {
    res.json({ prompt: defaultSystemPrompt });
}) as RequestHandler);

// Reset system prompt to default
app.post('/api/system-prompt/reset', ((req: Request, res: Response) => {
    res.json({ prompt: defaultSystemPrompt });
}) as RequestHandler);

app.get('/api/models', (async (req: Request, res: Response) => {
    try {
        const models = await client.listModels();
        res.json({ models });
    } catch (error) {
        console.error('Error getting models:', error);
        res.status(500).json({ error: 'Failed to get models' });
    }
}) as RequestHandler);

app.post('/api/chat', (async (req: Request, res: Response) => {
    try {
        const { messages, model, options, systemPrompt, rag, ragQueryHistory } = req.body;
        
        let enhancedSystemPrompt = systemPrompt || defaultSystemPrompt;
        let retrievedContext = '';
        
        // If ragQueryHistory is present, prepend a summary to the system prompt
        if (Array.isArray(ragQueryHistory) && ragQueryHistory.length > 0) {
            const historySummary = ragQueryHistory.map((item, idx) =>
                `${idx + 1}. User: ${item.user}\n   Docs Retrieved: ${item.documents}\n   Context Length: ${item.contextLength}`
            ).join('\n');
            enhancedSystemPrompt = `RAG Query History:\n${historySummary}\n\n` + enhancedSystemPrompt;
        }

        // Handle RAG if enabled and Pinecone credentials are available
        if (rag?.enabled && pineconeCredentials && rag.indexName) {
            try {
                console.log('🔍 Performing RAG query...');
                
                // Create PineconeManager with the specific index name
                const pineconeManager = new PineconeManager({
                    apiKey: pineconeCredentials.apiKey,
                    environment: pineconeCredentials.environment,
                    indexName: rag.indexName
                });
                
                // Get the last user message for retrieval
                const lastUserMessage = messages[messages.length - 1]?.content || '';
                
                // Query Pinecone for similar documents
                const queryResults = await pineconeManager.query(
                    lastUserMessage,
                    rag.topK || 5,
                    undefined, // namespace
                    undefined  // filter
                );
                
                // Filter results by similarity threshold
                const relevantResults = queryResults.matches?.filter(
                    (match: any) => (match.score || 0) >= (rag.similarityThreshold || 0.7)
                ) || [];
                
                if (relevantResults.length > 0) {
                    console.log(`📚 Found ${relevantResults.length} relevant documents`);
                    
                    // Build context from retrieved documents
                    retrievedContext = relevantResults.map((match: any, index: number) => {
                        const content = match.metadata?.content || '';
                        const score = match.score || 0;
                        return `Document ${index + 1} (similarity: ${score.toFixed(3)}):\n${content}\n`;
                    }).join('\n');
                    
                    // Enhance system prompt with retrieved context
                    enhancedSystemPrompt = `${systemPrompt || defaultSystemPrompt}

IMPORTANT: Use the following retrieved documents to help answer the user's question. If the documents contain relevant information, incorporate it into your response. If the documents don't contain relevant information, answer based on your general knowledge.

Retrieved Documents:
${retrievedContext}

Please provide a comprehensive answer based on the retrieved documents and your knowledge.`;
                    
                    console.log('✅ RAG context added to system prompt');
                } else {
                    console.log('⚠️  No relevant documents found above similarity threshold');
                    
                    // If there is RAG history, continue and let the LLM answer
                    if (Array.isArray(ragQueryHistory) && ragQueryHistory.length > 0) {
                        // Do not return early, just continue
                    } else {
                        // No history and no relevant docs: return early
                        const noDocumentsResponse = {
                            choices: [{
                                message: {
                                    content: 'No relevant documents found within the vector database - try reducing the similarity threshold',
                                    role: 'assistant'
                                }
                            }],
                            usage: {
                                prompt_tokens: 0,
                                completion_tokens: 0,
                                total_tokens: 0
                            },
                            rag: {
                                enabled: true,
                                documentsRetrieved: 0,
                                contextLength: 0,
                                noRelevantDocuments: true
                            }
                        };
                        return res.json(noDocumentsResponse);
                    }
                }
            } catch (ragError) {
                console.error('❌ RAG query failed:', ragError);
                
                // Provide more specific error messages
                const errorMessage = ragError instanceof Error ? ragError.message : String(ragError);
                if (errorMessage.includes('404')) {
                    console.log('💡 Tip: The Pinecone index does not exist. Create it first with:');
                    console.log(`   pinecone-cli init --index-name ${rag.indexName} --dimension 768`);
                } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
                    console.log('💡 Tip: Check your Pinecone API key and permissions');
                } else if (errorMessage.includes('Ollama')) {
                    console.log('💡 Tip: Make sure Ollama is running and the embedding model is available');
                }
                
                // Continue without RAG if there's an error
            }
        }
        
        // Ensure messages is an array and prepend the system message
        const conversationMessages = [
            { 
                role: 'system', 
                content: enhancedSystemPrompt
            },
            ...messages // Include the full conversation history
        ];

        const response = await client.createChatCompletion(conversationMessages, { ...options, model });
        
        // Add RAG metadata to response if RAG was used
        const enhancedResponse: any = { ...response };
        if (rag?.enabled && retrievedContext) {
            enhancedResponse.rag = {
                enabled: true,
                documentsRetrieved: retrievedContext.split('Document ').length - 1,
                contextLength: retrievedContext.length
            };
        }
        
        if (Array.isArray(ragQueryHistory) && ragQueryHistory.length > 0) {
            // Mark in the response that RAG history was used
            if (!enhancedResponse.rag) enhancedResponse.rag = {};
            enhancedResponse.rag.usedHistory = true;
            enhancedResponse.rag.historyCount = ragQueryHistory.length;
        }
        
        res.json(enhancedResponse);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
}) as RequestHandler);

// Serve static files
app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 