import { Module } from '@nestjs/common';
import { PromptAnalyzerService } from './prompt-analyzer.service';
import { EmbeddingService } from './embedding.service';
import { OpenAiService } from './openai.service';

@Module({
    providers: [
        OpenAiService,
        EmbeddingService,
        PromptAnalyzerService,
    ],
    exports: [
        PromptAnalyzerService,
        EmbeddingService,
        OpenAiService,
    ],
})
export class AiModule { }
