import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
    private client: OpenAI;
    private model: string;

    constructor(private configService: ConfigService) {
        this.client = new OpenAI({
            apiKey: this.configService.get('OPENAI_API_KEY'),
        });
        this.model = this.configService.get('OPENAI_MODEL', 'gpt-4-turbo-preview');
    }

    async chat(
        messages: OpenAI.Chat.ChatCompletionMessageParam[],
        options?: {
            temperature?: number;
            maxTokens?: number;
            responseFormat?: 'text' | 'json_object';
        },
    ): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 4096,
            response_format: options?.responseFormat
                ? { type: options.responseFormat }
                : undefined,
        });

        return response.choices[0]?.message?.content || '';
    }

    async createEmbedding(text: string): Promise<number[]> {
        const response = await this.client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
        });

        return response.data[0].embedding;
    }

    async createEmbeddings(texts: string[]): Promise<number[][]> {
        const response = await this.client.embeddings.create({
            model: 'text-embedding-3-small',
            input: texts,
        });

        return response.data.map((d) => d.embedding);
    }

    getTokenCount(text: string): number {
        // Rough estimation: ~4 chars per token
        return Math.ceil(text.length / 4);
    }
}
