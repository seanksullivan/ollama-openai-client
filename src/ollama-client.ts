import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class OllamaClient {
    private apiUrl: string;
    private model: string;

    constructor() {
        this.apiUrl = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434';
        this.model = process.env.OLLAMA_MODEL || 'llama3.2:latest';
    }

    get currentModel() {
        return this.model;
    }

    async createChatCompletion(messages: any[], options: any = {}) {
        try {
            const model = options.model || this.model;
            const response = await axios.post(`${this.apiUrl}/api/chat`, {
                model: model,
                messages: messages,
                stream: false,
                ...options
            });

            return {
                choices: [{
                    message: {
                        content: response.data.message.content,
                        role: 'assistant'
                    }
                }],
                usage: {
                    prompt_tokens: response.data.eval_count || 0,
                    completion_tokens: response.data.eval_count || 0,
                    total_tokens: response.data.eval_count || 0
                }
            };
        } catch (error) {
            console.error('Error creating chat completion:', error);
            throw error;
        }
    }

    async createCompletion(prompt: string, options: any = {}) {
        try {
            const response = await axios.post(`${this.apiUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                ...options
            });

            return {
                choices: [{
                    text: response.data.response,
                    role: 'assistant'
                }],
                usage: {
                    prompt_tokens: response.data.eval_count || 0,
                    completion_tokens: response.data.eval_count || 0,
                    total_tokens: response.data.eval_count || 0
                }
            };
        } catch (error) {
            console.error('Error creating completion:', error);
            throw error;
        }
    }

    async listModels() {
        try {
            console.log('Fetching models from:', `${this.apiUrl}/api/tags`);
            const response = await axios.get(`${this.apiUrl}/api/tags`);
            console.log('Response data:', response.data);
            if (response.data.models) {
                return response.data.models.map((model: any) => ({
                    name: model.name,
                    size: this.formatSize(model.size),
                    family: model.details?.family || 'unknown',
                    parameterSize: model.details?.parameter_size || 'unknown'
                }));
            }
            return [];
        } catch (error) {
            console.error('Error listing models:', error);
            if (axios.isAxiosError(error)) {
                console.error('Error details:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    url: error.config?.url
                });
            }
            throw error;
        }
    }

    private formatSize(bytes: number): string {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }
} 