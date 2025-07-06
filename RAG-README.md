# RAG (Retrieval-Augmented Generation) Integration

This project now includes RAG capabilities that allow the AI to query a Pinecone vector database for relevant documents before generating responses.

## Features

- **Toggle RAG**: Enable/disable RAG functionality with a simple checkbox
- **Configurable Parameters**: Set index name, number of documents to retrieve, and similarity threshold
- **Visual Feedback**: See when RAG is used and how many documents were retrieved
- **Fallback**: Gracefully handles cases where Pinecone is unavailable or no relevant documents are found

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
OLLAMA_API_URL=http://127.0.0.1:11434
```

### 2. Install Dependencies

```bash
npm install @pinecone-database/pinecone
```

### 3. Build and Start

```bash
npm run build
npm run dev
```

## Usage

### Web Interface

1. **Enable RAG**: Check the "Enable RAG" checkbox in the web interface
2. **Configure Settings**:
   - **Pinecone Index Name**: The name of your Pinecone index (e.g., "my-docs")
   - **Number of Documents**: How many similar documents to retrieve (1-20)
   - **Similarity Threshold**: Minimum similarity score (0.0-1.0) for documents to be included
3. **Ask Questions**: The AI will now search your Pinecone index for relevant documents before answering

### Example Workflow

1. **Upload Documents to Pinecone**:
   ```bash
   # Initialize index
   pinecone-cli init --index-name my-docs --dimension 768
   
   # Upload documents
   pinecone-cli upsert-directory --index-name my-docs --directory ./documents
   ```

2. **Use RAG in Web Interface**:
   - Enable RAG checkbox
   - Set index name to "my-docs"
   - Set top-k to 5
   - Set similarity threshold to 0.7
   - Ask questions about your documents

3. **See Results**:
   - The AI will retrieve relevant documents from Pinecone
   - Include them as context in the system prompt
   - Generate responses based on both the retrieved documents and its knowledge

## How It Works

### 1. Document Retrieval
When RAG is enabled, the system:
- Takes the user's question
- Queries the Pinecone index for similar documents
- Filters results by similarity threshold
- Retrieves the most relevant documents

### 2. Context Enhancement
The retrieved documents are:
- Formatted with similarity scores
- Added to the system prompt
- Used to guide the AI's response

### 3. Response Generation
The AI generates a response that:
- Incorporates information from retrieved documents
- Falls back to general knowledge if no relevant documents are found
- Provides comprehensive answers based on available context

## Configuration Options

### RAG Parameters

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `indexName` | Pinecone index name | "my-docs" | Any valid index name |
| `topK` | Number of documents to retrieve | 5 | 1-20 |
| `similarityThreshold` | Minimum similarity score | 0.7 | 0.0-1.0 |

### System Prompt Enhancement

When RAG is enabled, the system prompt is automatically enhanced with:

```
IMPORTANT: Use the following retrieved documents to help answer the user's question. If the documents contain relevant information, incorporate it into your response. If the documents don't contain relevant information, answer based on your general knowledge.

Retrieved Documents:
Document 1 (similarity: 0.85):
[Document content]

Document 2 (similarity: 0.72):
[Document content]

Please provide a comprehensive answer based on the retrieved documents and your knowledge.
```

## Visual Indicators

### RAG Status
- **Enabled**: Checkbox is checked, configuration panel is visible
- **Disabled**: Checkbox is unchecked, configuration panel is hidden

### Response Information
When RAG is used, you'll see additional information in the response:
- **RAG: X docs (Y chars)**: Shows number of documents retrieved and context length
- **Enhanced responses**: More detailed answers based on retrieved documents

## Error Handling

The system gracefully handles various error conditions:

1. **Pinecone Unavailable**: RAG is disabled, responses use only general knowledge
2. **Index Not Found**: Error logged, RAG disabled for that request
3. **No Relevant Documents**: Response uses only general knowledge
4. **Low Similarity Scores**: Documents below threshold are excluded

## Testing

### Manual Testing
1. Start the web server: `npm run dev`
2. Open http://localhost:3000
3. Enable RAG and configure settings
4. Ask questions about your documents

### Automated Testing
```bash
node test-rag.js
```

This will test both RAG-enabled and regular requests.

## Troubleshooting

### Common Issues

1. **"Pinecone credentials not found"**
   - Check your `.env` file
   - Verify `PINECONE_API_KEY` and `PINECONE_ENVIRONMENT` are set

2. **"Index not found"**
   - Create the index first: `pinecone-cli init --index-name your-index`
   - Check the index name in the RAG configuration

3. **"No relevant documents found"**
   - Lower the similarity threshold
   - Upload more documents to the index
   - Check document content relevance

4. **"RAG query failed"**
   - Check Pinecone service status
   - Verify API key permissions
   - Check network connectivity

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=rag,pinecone npm run dev
```

## Best Practices

1. **Index Management**:
   - Use descriptive index names
   - Regularly update document embeddings
   - Monitor index performance

2. **Similarity Threshold**:
   - Start with 0.7 and adjust based on results
   - Higher values = more relevant but fewer documents
   - Lower values = more documents but potentially less relevant

3. **Document Quality**:
   - Ensure documents are well-formatted
   - Include relevant keywords
   - Keep documents focused and concise

4. **System Prompts**:
   - Customize system prompts for your use case
   - Consider adding domain-specific instructions
   - Test different prompt variations

## API Reference

### Chat Endpoint

**POST** `/api/chat`

**Request Body**:
```json
{
  "messages": [
    { "role": "user", "content": "What is machine learning?" }
  ],
  "model": "llama3.2:latest",
  "systemPrompt": "You are a helpful AI assistant.",
  "rag": {
    "enabled": true,
    "indexName": "my-docs",
    "topK": 5,
    "similarityThreshold": 0.7
  },
  "options": {
    "model": "llama3.2:latest"
  }
}
```

**Response**:
```json
{
  "choices": [
    {
      "message": {
        "content": "Based on the retrieved documents...",
        "role": "assistant"
      }
    }
  ],
  "usage": {
    "total_tokens": 1500
  },
  "rag": {
    "enabled": true,
    "documentsRetrieved": 3,
    "contextLength": 2500
  }
}
```

## Integration with Existing Tools

The RAG functionality integrates seamlessly with existing tools:

- **PDF Processing**: Use `process-pdf` to chunk PDFs, then upload to Pinecone
- **Embeddings**: Use `create-embeddings` to generate embeddings for custom documents
- **Pinecone CLI**: Use `pinecone-cli` for index management and document uploads

## Future Enhancements

Planned improvements:
- Support for multiple Pinecone indexes
- Advanced filtering and metadata search
- Document source attribution in responses
- RAG performance metrics and analytics
- Support for other vector databases 