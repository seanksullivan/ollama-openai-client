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
const defaultSystemPrompt = process.env.SYSTEM_PROMPT || '';

// Path to store the custom system prompt
const systemPromptPath = path.join(__dirname, 'system-prompt.txt');

// Ensure the system prompt file exists
if (!fs.existsSync(systemPromptPath)) {
    fs.writeFileSync(systemPromptPath, defaultSystemPrompt);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the main page with embedded system prompt
app.get('/', ((req: Request, res: Response) => {
    const indexPath = path.join(__dirname, '../public/index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Read the current system prompt
    const systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
    
    // Add the system prompt to the HTML
    html = html.replace(
        '<script>',
        `<script>
            // Initialize system prompt
            const initialSystemPrompt = ${JSON.stringify(systemPrompt)};
        </script>
        <script>`
    );
    
    res.send(html);
}) as RequestHandler);

// Get current system prompt
app.get('/api/system-prompt', ((req: Request, res: Response) => {
    try {
        const prompt = fs.readFileSync(systemPromptPath, 'utf8');
        res.json({ prompt });
    } catch (error) {
        console.error('Error reading system prompt:', error);
        res.status(500).json({ error: 'Failed to read system prompt' });
    }
}) as RequestHandler);

// Update system prompt
app.post('/api/system-prompt', ((req: Request, res: Response) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        // Replace actual newlines with \n for storage
        const formattedPrompt = prompt.replace(/\n/g, '\\n');
        fs.writeFileSync(systemPromptPath, formattedPrompt);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving system prompt:', error);
        res.status(500).json({ error: 'Failed to save system prompt' });
    }
}) as RequestHandler);

// Reset system prompt to default
app.post('/api/system-prompt/reset', ((req: Request, res: Response) => {
    try {
        // Replace actual newlines with \n for storage
        const formattedPrompt = defaultSystemPrompt.replace(/\n/g, '\\n');
        fs.writeFileSync(systemPromptPath, formattedPrompt);
        res.json({ prompt: formattedPrompt });
    } catch (error) {
        console.error('Error resetting system prompt:', error);
        res.status(500).json({ error: 'Failed to reset system prompt' });
    }
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
        const { message, model, options } = req.body;
        const systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
        const response = await client.createChatCompletion([
            { 
                role: 'system', 
                content: systemPrompt
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