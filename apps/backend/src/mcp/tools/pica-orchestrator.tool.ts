import { Injectable } from '@nestjs/common';
import { PromptAnalyzerService } from '../../ai/prompt-analyzer.service';
import { PicaService } from '../pica.service';

export interface PicaOrchestratorInput {
    prompt: string;
    userId: string;
}

// Map our tool names to Pica platform names
const PLATFORM_MAP: Record<string, string> = {
    'gmail': 'gmail',
    'slack': 'slack',
    'sheets': 'google-sheets',
    'drive': 'google-drive',
    'telegram': 'telegram',
    'notion': 'notion',
    'discord': 'discord',
};

// Map our action names to Pica action keys
const ACTION_MAP: Record<string, Record<string, string>> = {
    'gmail': {
        'send_email': 'send-email',
        'read_emails': 'list-messages',
        'search_emails': 'search-messages',
    },
    'slack': {
        'send_message': 'post-message',
        'list_channels': 'list-conversations',
    },
    'sheets': {
        'read_sheet': 'get-values',
        'append_row': 'append-values',
    },
    'telegram': {
        'send_message': 'send-message',
    },
};

@Injectable()
export class PicaOrchestratorTool {
    constructor(
        private promptAnalyzer: PromptAnalyzerService,
        private picaService: PicaService,
    ) { }

    async execute(input: PicaOrchestratorInput) {
        const { prompt, userId } = input;

        // Step 1: Analyze the prompt to determine tool and action
        const analysis = await this.promptAnalyzer.analyze(prompt);

        // Step 2: Map to Pica platform and action
        const picaPlatform = PLATFORM_MAP[analysis.tool] || analysis.tool;
        const actionMap = ACTION_MAP[analysis.tool] || {};
        const picaAction = actionMap[analysis.action] || analysis.action;

        // Step 3: Execute via Pica
        const result = await this.picaService.executeAction({
            platform: picaPlatform,
            action: picaAction,
            params: analysis.parameters,
            connectionKey: userId,
        }, userId);

        return {
            analysis: {
                intent: analysis.intent,
                tool: analysis.tool,
                action: analysis.action,
                picaPlatform,
                picaAction,
            },
            result,
        };
    }
}
