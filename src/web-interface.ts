import express, { Request, Response, RequestHandler } from 'express';
import { OllamaClient } from './ollama-client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = 3000;
const client = new OllamaClient();

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
        const { message, model, options, systemPrompt } = req.body;
        const response = await client.createChatCompletion([
            { 
                role: 'system', 
                content: systemPrompt || defaultSystemPrompt
            },
            { role: 'user', content: message }
        ], { ...options, model });
        res.json(response);
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