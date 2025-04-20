# Ollama OpenAI Client

This is a Node.js TypeScript application that provides an OpenAI-compatible client for Ollama self-hosted models, featuring a web interface for easy interaction.

## Prerequisites

- Node.js (v14 or higher)
- Ollama installed and running locally
- A model pulled in Ollama (e.g., llama2)

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Configuration

Create a `.env` file in the root directory with the following variables:
```
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=llama2
SYSTEM_PROMPT=You are a helpful, concise, and professional AI assistant.\nYour responses should be:\n- Clear and direct\n- Focused on providing accurate information\n- Free from unnecessary elaboration\n- On topic and relevant\n\nIf you do not know the answer, say "I do not know".\n\nDisplay the output within a clean, bulleted list.
```

Note: Use `\n` for newlines in the system prompt. These will be properly displayed in the web interface while maintaining the correct format for the API.

## Features

- Web interface for easy model interaction
- Model selection with detailed information
- Real-time token usage and performance metrics
- Support for multiple Ollama models
- OpenAI-compatible API interface
- System prompt management with:
  - Live editing
  - Save and reset functionality
  - Collapsible interface
  - Proper newline handling

## Usage

### Development
```bash
npm run dev
```

### Build and Run
```bash
npm run build
npm start
```

The web interface will be available at `http://localhost:3000`

## API Methods

- `createChatCompletion(messages: any[], options?: any)`: Creates a chat completion using the Ollama chat API
- `createCompletion(prompt: string, options?: any)`: Creates a text completion using the Ollama generate API
- `listModels()`: Retrieves available models with their details

## Web Interface Features

- Model selection dropdown with parameter information
- Real-time chat interface
- Performance metrics display:
  - Model name
  - Total tokens used
  - Generation speed (tokens/second)
  - Response time
- Code block formatting
- Bulleted list support
- Smooth scrolling to latest messages
- System prompt management:
  - Collapsible editor
  - Save and reset functionality
  - Proper newline display
  - Persistent storage

## Example Code

```typescript
import { OllamaClient } from './ollama-client';

const client = new OllamaClient();

// Chat completion
const chatResponse = await client.createChatCompletion([
    { role: 'user', content: 'Hello, how are you?' }
]);

// Text completion
const completionResponse = await client.createCompletion('Once upon a time');

// List available models
const models = await client.listModels();
```

## License

ISC 