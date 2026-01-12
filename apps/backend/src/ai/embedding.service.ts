import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';

@Injectable()
export class EmbeddingService {
    constructor(private openai: OpenAiService) { }

    async createEmbedding(text: string): Promise<number[]> {
        return this.openai.createEmbedding(text);
    }

    async createEmbeddings(texts: string[]): Promise<number[][]> {
        return this.openai.createEmbeddings(texts);
    }
}
