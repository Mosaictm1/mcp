import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';

export interface PromptAnalysis {
    originalPrompt: string;
    intent: string;
    action: string;
    tool: string;
    parameters: Record<string, any>;
    requiredCredential?: string;
}

const ANALYSIS_PROMPT = `You are an AI automation assistant. Analyze the user's request and extract ALL required parameters.

Available tools and their actions:

## Gmail
- send_email: { "to": "email address", "subject": "subject line", "body": "email body text" }
- read_emails: { "maxResults": number (default 10) }
- search_emails: { "query": "search query", "maxResults": number }

## Slack  
- send_message: { "channel": "channel name without #", "message": "message text" }
- list_channels: {}

## Google Sheets
- read_sheet: { "spreadsheetId": "id", "range": "Sheet1!A:Z" }
- append_row: { "spreadsheetId": "id", "values": ["col1", "col2", ...] }

## Telegram
- send_message: { "chatId": "chat id", "message": "message text" }

IMPORTANT RULES:
1. Extract ALL values mentioned in the user's request
2. For email: extract to, subject, and body from the text
3. If body is not specified, use the subject or a reasonable default like "This is an automated email."
4. Always return valid parameters for the action

Return JSON:
{
  "intent": "Brief description of what the user wants",
  "tool": "gmail|slack|sheets|telegram",
  "action": "the specific action",
  "parameters": { ... extracted parameters ... },
  "requiredCredential": "gmail|slack|google|telegram"
}

User request:`;

@Injectable()
export class PromptAnalyzerService {
    constructor(private openai: OpenAiService) { }

    async analyze(prompt: string): Promise<PromptAnalysis> {
        const messages = [
            {
                role: 'system' as const,
                content: ANALYSIS_PROMPT,
            },
            {
                role: 'user' as const,
                content: prompt,
            },
        ];

        const response = await this.openai.chat(messages, {
            temperature: 0.2,
            responseFormat: 'json_object',
        });

        const analysis = JSON.parse(response);

        // Ensure parameters exist
        const parameters = analysis.parameters || {};

        // For send_email, ensure all required fields
        if (analysis.action === 'send_email') {
            if (!parameters.body && parameters.subject) {
                parameters.body = parameters.subject;
            }
            if (!parameters.body) {
                parameters.body = 'This is an automated email.';
            }
        }

        return {
            originalPrompt: prompt,
            intent: analysis.intent,
            action: analysis.action,
            tool: analysis.tool,
            parameters,
            requiredCredential: analysis.requiredCredential,
        };
    }
}
