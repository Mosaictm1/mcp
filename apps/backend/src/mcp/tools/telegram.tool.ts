import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TelegramToolInput {
    userId: string;
    action: 'send_message';
    parameters: {
        chatId?: string;
        message?: string;
    };
}

@Injectable()
export class TelegramTool {
    private botToken: string;

    constructor(private config: ConfigService) {
        this.botToken = this.config.get('TELEGRAM_BOT_TOKEN') || '';
    }

    async execute(input: TelegramToolInput) {
        const { action, parameters } = input;

        if (!this.botToken) {
            return {
                success: false,
                error: 'Telegram bot not configured. Please add TELEGRAM_BOT_TOKEN to .env',
            };
        }

        switch (action) {
            case 'send_message':
                return this.sendMessage(parameters);
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }

    private async sendMessage(params: { chatId?: string; message?: string }) {
        const { chatId, message } = params;

        if (!chatId || !message) {
            return { success: false, error: 'Missing required parameters: chatId, message' };
        }

        try {
            const response = await fetch(
                `https://api.telegram.org/bot${this.botToken}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: message,
                        parse_mode: 'HTML',
                    }),
                },
            );

            const data = await response.json();

            if (data.ok) {
                return {
                    success: true,
                    message: '✅ Telegram message sent',
                    messageId: data.result.message_id,
                };
            } else {
                return { success: false, error: data.description || 'Failed to send message' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}
