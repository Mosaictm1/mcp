import { Injectable } from '@nestjs/common';
import { PromptAnalyzerService } from '../../ai/prompt-analyzer.service';

export interface AnalyzePromptInput {
    prompt: string;
    userId: string;
}

@Injectable()
export class AnalyzePromptTool {
    constructor(private promptAnalyzer: PromptAnalyzerService) { }

    async execute(input: AnalyzePromptInput) {
        const { prompt } = input;

        const analysis = await this.promptAnalyzer.analyze(prompt);

        return {
            analysis,
            message: `Will use ${analysis.tool} to ${analysis.action}`,
        };
    }
}
