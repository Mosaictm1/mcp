import { Injectable } from '@nestjs/common';
import { PromptAnalyzerService } from '../../ai/prompt-analyzer.service';
import { GmailTool } from './gmail.tool';
import { SlackTool } from './slack.tool';
import { SheetsTool } from './sheets.tool';
import { TelegramTool } from './telegram.tool';

export interface OrchestratorInput {
    prompt: string;
    userId: string;
}

@Injectable()
export class OrchestratorTool {
    constructor(
        private promptAnalyzer: PromptAnalyzerService,
        private gmailTool: GmailTool,
        private slackTool: SlackTool,
        private sheetsTool: SheetsTool,
        private telegramTool: TelegramTool,
    ) { }

    async execute(input: OrchestratorInput) {
        const { prompt, userId } = input;

        // Step 1: Analyze the prompt to determine tool and action
        const analysis = await this.promptAnalyzer.analyze(prompt);

        // Step 2: Execute the appropriate tool
        let result;

        switch (analysis.tool) {
            case 'gmail':
                result = await this.gmailTool.execute({
                    userId,
                    action: analysis.action as any,
                    parameters: analysis.parameters,
                });
                break;
            case 'slack':
                result = await this.slackTool.execute({
                    userId,
                    action: analysis.action as any,
                    parameters: analysis.parameters,
                });
                break;
            case 'sheets':
                result = await this.sheetsTool.execute({
                    userId,
                    action: analysis.action as any,
                    parameters: analysis.parameters,
                });
                break;
            case 'telegram':
                result = await this.telegramTool.execute({
                    userId,
                    action: analysis.action as any,
                    parameters: analysis.parameters,
                });
                break;
            default:
                result = {
                    success: false,
                    error: `Unknown tool: ${analysis.tool}. Available tools: gmail, slack, sheets, telegram`,
                };
        }

        return {
            analysis: {
                intent: analysis.intent,
                tool: analysis.tool,
                action: analysis.action,
            },
            result,
        };
    }
}
