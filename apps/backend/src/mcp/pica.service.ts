import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PicaAction {
    platform: string;
    action: string;
    params: Record<string, any>;
    connectionKey?: string;
}

@Injectable()
export class PicaService {
    private apiKey: string;
    private baseUrl = 'https://api.picaos.com/v1';

    constructor(private config: ConfigService) {
        this.apiKey = this.config.get<string>('PICA_API_KEY') || '';
        if (!this.apiKey) {
            console.warn('⚠️ PICA_API_KEY not set - Pica integrations will not work');
        }
    }

    getApiKey(): string {
        return this.apiKey;
    }

    async getAvailablePlatforms(): Promise<string[]> {
        return [
            'gmail',
            'slack',
            'google-sheets',
            'google-drive',
            'notion',
            'telegram',
            'discord',
            'twitter',
            'linkedin',
            'hubspot',
            'salesforce',
        ];
    }

    async getConnectionLink(platform: string, userId: string): Promise<string> {
        const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');
        return `https://connect.picaos.com/connect/${platform}?userId=${userId}&redirectUrl=${frontendUrl}/credentials`;
    }

    async generateAuthKitToken(userId: string, userEmail: string): Promise<any> {
        if (!this.apiKey) {
            return { error: 'Pica API key not configured' };
        }

        try {
            // Generate AuthKit token via Pica API
            const response = await fetch(`${this.baseUrl}/authkit/token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    userEmail,
                }),
            });

            const result = await response.json();
            return result;
        } catch (error: any) {
            return { error: error.message };
        }
    }

    async executeAction(action: PicaAction, userId: string): Promise<any> {
        const { platform, action: actionName, params, connectionKey } = action;

        if (!this.apiKey) {
            return {
                success: false,
                error: 'Pica API key not configured. Please add PICA_API_KEY to .env file.',
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/actions/execute`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    actionKey: `${platform}::${actionName}`,
                    connectionKey: connectionKey || userId,
                    input: params,
                }),
            });

            const result = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: `✅ ${actionName} executed successfully on ${platform}`,
                    data: result,
                };
            } else {
                return {
                    success: false,
                    error: result.message || result.error || `Failed to execute ${actionName} on ${platform}`,
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message || `Failed to execute ${actionName} on ${platform}`,
            };
        }
    }

    async listConnections(userId: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/connections?userId=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
            });

            const result = await response.json();
            return result.connections || [];
        } catch {
            return [];
        }
    }
}
