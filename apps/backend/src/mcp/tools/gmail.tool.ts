import { Injectable } from '@nestjs/common';
import { CredentialsService } from '../../modules/credentials/credentials.service';

export interface GmailToolInput {
    userId: string;
    action: 'send_email' | 'read_emails' | 'search_emails';
    parameters: {
        to?: string;
        subject?: string;
        body?: string;
        query?: string;
        maxResults?: number;
    };
}

@Injectable()
export class GmailTool {
    constructor(private credentialsService: CredentialsService) { }

    async execute(input: GmailToolInput) {
        const { userId, action, parameters } = input;

        // Get user's Gmail credentials
        const tokens = await this.credentialsService.getDecryptedTokens(
            await this.getCredentialId(userId, 'gmail'),
            userId,
        );

        if (!tokens) {
            return {
                success: false,
                error: 'Gmail not connected. Please connect Gmail first in the Credentials page.',
            };
        }

        switch (action) {
            case 'send_email':
                return this.sendEmail(tokens.accessToken, parameters);
            case 'read_emails':
                return this.readEmails(tokens.accessToken, parameters);
            case 'search_emails':
                return this.searchEmails(tokens.accessToken, parameters);
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }

    private async getCredentialId(userId: string, provider: string): Promise<string> {
        const credentials = await this.credentialsService.findAllByUser(userId);
        const cred = credentials.find(c => c.provider === provider);
        return cred?.id || '';
    }

    private async sendEmail(
        accessToken: string,
        params: { to?: string; subject?: string; body?: string },
    ) {
        const { to, subject, body } = params;

        if (!to || !subject || !body) {
            return { success: false, error: 'Missing required parameters: to, subject, body' };
        }

        const email = [
            `To: ${to}`,
            `Subject: ${subject}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            body,
        ].join('\r\n');

        const encodedEmail = Buffer.from(email).toString('base64url');

        try {
            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ raw: encodedEmail }),
            });

            const data = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: `✅ Email sent successfully to ${to}`,
                    messageId: data.id,
                };
            } else {
                return { success: false, error: data.error?.message || 'Failed to send email' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    private async readEmails(accessToken: string, params: { maxResults?: number }) {
        const maxResults = params.maxResults || 10;

        try {
            const response = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );

            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error?.message || 'Failed to fetch emails' };
            }

            // Get details for each message
            const messages = await Promise.all(
                (data.messages || []).slice(0, 5).map(async (msg: any) => {
                    const msgResponse = await fetch(
                        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`,
                        {
                            headers: { Authorization: `Bearer ${accessToken}` },
                        },
                    );
                    const msgData = await msgResponse.json();
                    const headers = msgData.payload?.headers || [];
                    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value;

                    return {
                        id: msg.id,
                        from: getHeader('From'),
                        subject: getHeader('Subject'),
                        date: getHeader('Date'),
                    };
                }),
            );

            return {
                success: true,
                message: `Found ${data.messages?.length || 0} emails`,
                emails: messages,
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    private async searchEmails(accessToken: string, params: { query?: string; maxResults?: number }) {
        const { query = '', maxResults = 10 } = params;

        try {
            const response = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );

            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error?.message || 'Failed to search emails' };
            }

            return {
                success: true,
                message: `Found ${data.messages?.length || 0} emails matching "${query}"`,
                count: data.messages?.length || 0,
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}
