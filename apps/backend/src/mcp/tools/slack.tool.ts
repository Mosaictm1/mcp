import { Injectable } from '@nestjs/common';
import { CredentialsService } from '../../modules/credentials/credentials.service';

export interface SlackToolInput {
    userId: string;
    action: 'send_message' | 'list_channels';
    parameters: {
        channel?: string;
        message?: string;
    };
}

@Injectable()
export class SlackTool {
    constructor(private credentialsService: CredentialsService) { }

    async execute(input: SlackToolInput) {
        const { userId, action, parameters } = input;

        // Get user's Slack credentials
        const tokens = await this.credentialsService.getDecryptedTokens(
            await this.getCredentialId(userId, 'slack'),
            userId,
        );

        if (!tokens) {
            return {
                success: false,
                error: 'Slack not connected. Please connect Slack first in the Credentials page.',
            };
        }

        switch (action) {
            case 'send_message':
                return this.sendMessage(tokens.accessToken, parameters);
            case 'list_channels':
                return this.listChannels(tokens.accessToken);
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }

    private async getCredentialId(userId: string, provider: string): Promise<string> {
        const credentials = await this.credentialsService.findAllByUser(userId);
        const cred = credentials.find(c => c.provider === provider);
        return cred?.id || '';
    }

    private async sendMessage(accessToken: string, params: { channel?: string; message?: string }) {
        const { channel, message } = params;

        if (!channel || !message) {
            return { success: false, error: 'Missing required parameters: channel, message' };
        }

        try {
            const response = await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    channel,
                    text: message,
                }),
            });

            const data = await response.json();

            if (data.ok) {
                return {
                    success: true,
                    message: `✅ Message sent to #${channel}`,
                    ts: data.ts,
                };
            } else {
                return { success: false, error: data.error || 'Failed to send message' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    private async listChannels(accessToken: string) {
        try {
            const response = await fetch('https://slack.com/api/conversations.list?limit=20', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            const data = await response.json();

            if (data.ok) {
                const channels = data.channels.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    memberCount: c.num_members,
                }));

                return {
                    success: true,
                    message: `Found ${channels.length} channels`,
                    channels,
                };
            } else {
                return { success: false, error: data.error || 'Failed to list channels' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}
