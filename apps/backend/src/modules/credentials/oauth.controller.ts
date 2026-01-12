import { Controller, Get, Query, Param, Res, Post, Body, UseGuards, Request } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CredentialsService } from './credentials.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

// OAuth configurations for each provider
const OAUTH_CONFIGS: Record<string, {
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientIdKey: string;
    clientSecretKey: string;
}> = {
    gmail: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify',
        ],
        clientIdKey: 'GOOGLE_CLIENT_ID',
        clientSecretKey: 'GOOGLE_CLIENT_SECRET',
    },
    slack: {
        authUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        scopes: [
            'chat:write',
            'channels:read',
            'users:read',
        ],
        clientIdKey: 'SLACK_CLIENT_ID',
        clientSecretKey: 'SLACK_CLIENT_SECRET',
    },
    google_drive: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: [
            'https://www.googleapis.com/auth/drive',
        ],
        clientIdKey: 'GOOGLE_CLIENT_ID',
        clientSecretKey: 'GOOGLE_CLIENT_SECRET',
    },
    google_sheets: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
        ],
        clientIdKey: 'GOOGLE_CLIENT_ID',
        clientSecretKey: 'GOOGLE_CLIENT_SECRET',
    },
    notion: {
        authUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token',
        scopes: [],
        clientIdKey: 'NOTION_CLIENT_ID',
        clientSecretKey: 'NOTION_CLIENT_SECRET',
    },
};

@ApiTags('OAuth')
@Controller('oauth')
export class OAuthController {
    constructor(
        private config: ConfigService,
        private credentialsService: CredentialsService,
    ) { }

    @Get(':provider/authorize')
    @ApiOperation({ summary: 'Start OAuth authorization flow' })
    async authorize(
        @Param('provider') provider: string,
        @Query('userId') userId: string,
        @Res() res: Response,
    ) {
        const oauthConfig = OAUTH_CONFIGS[provider];
        if (!oauthConfig) {
            return res.status(400).send(`Unknown OAuth provider: ${provider}`);
        }

        const clientId = this.config.get(oauthConfig.clientIdKey);
        if (!clientId) {
            return res.status(500).send(`
                <html>
                    <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1a1a2e; color: white;">
                        <div style="text-align: center;">
                            <h2>⚠️ OAuth Not Configured</h2>
                            <p>Please add ${oauthConfig.clientIdKey} and ${oauthConfig.clientSecretKey} to your .env file</p>
                        </div>
                    </body>
                </html>
            `);
        }

        const redirectUri = `${this.config.get('APP_URL', 'http://localhost:3001')}/api/oauth/${provider}/callback`;

        // Store state for security (in production, use Redis or similar)
        const state = Buffer.from(JSON.stringify({
            provider,
            userId: userId || 'pending',
            timestamp: Date.now()
        })).toString('base64');

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: oauthConfig.scopes.join(' '),
            state,
            access_type: 'offline',
            prompt: 'consent',
        });

        res.redirect(`${oauthConfig.authUrl}?${params.toString()}`);
    }

    @Get(':provider/callback')
    @ApiOperation({ summary: 'OAuth callback handler' })
    async callback(
        @Param('provider') provider: string,
        @Query('code') code: string,
        @Query('state') state: string,
        @Query('error') error: string,
        @Res() res: Response,
    ) {
        // Handle errors
        if (error) {
            return res.send(this.renderErrorPage(error));
        }

        if (!code) {
            return res.send(this.renderErrorPage('No authorization code received'));
        }

        const oauthConfig = OAUTH_CONFIGS[provider];
        if (!oauthConfig) {
            return res.send(this.renderErrorPage(`Unknown provider: ${provider}`));
        }

        try {
            // Decode state
            let stateData: any = {};
            try {
                stateData = JSON.parse(Buffer.from(state, 'base64').toString());
            } catch (e) {
                console.error('Failed to decode state:', e);
            }

            const clientId = this.config.get(oauthConfig.clientIdKey);
            const clientSecret = this.config.get(oauthConfig.clientSecretKey);
            const redirectUri = `${this.config.get('APP_URL', 'http://localhost:3001')}/api/oauth/${provider}/callback`;

            // Exchange code for tokens
            const tokenResponse = await fetch(oauthConfig.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: redirectUri,
                }),
            });

            const tokens = await tokenResponse.json();

            if (tokens.error) {
                return res.send(this.renderErrorPage(tokens.error_description || tokens.error));
            }

            // Get user info to display name
            let displayName = provider;
            if (provider.startsWith('google') || provider === 'gmail') {
                try {
                    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: { Authorization: `Bearer ${tokens.access_token}` },
                    });
                    const userData = await userInfo.json();
                    displayName = userData.email || userData.name || provider;
                } catch (e) {
                    console.error('Failed to get user info:', e);
                }
            }

            // Save credentials to database
            // We need userId from the state - for now, create a "pending" user or use session
            const userId = stateData.userId || 'demo-user-123';

            // Check if credential already exists for this provider/user
            const existingCreds = await this.credentialsService.findAllByUser(userId);
            const existing = existingCreds.find(c => c.provider === provider);

            if (existing) {
                // Delete existing and create new
                await this.credentialsService.delete(existing.id, userId);
            }

            // Save new credential
            await this.credentialsService.create(
                userId,
                provider,
                displayName,
                tokens.access_token,
                tokens.refresh_token,
                tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
            );

            console.log(`✅ Credential saved for ${provider}: ${displayName}`);

            // Return success page that closes the popup
            return res.send(this.renderSuccessPage(provider, displayName));

        } catch (error: any) {
            console.error('OAuth callback error:', error);
            return res.send(this.renderErrorPage(error.message));
        }
    }

    private renderSuccessPage(provider: string, displayName: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Connected!</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                    }
                    .container {
                        text-align: center;
                        padding: 40px;
                        background: rgba(255,255,255,0.05);
                        border-radius: 16px;
                        border: 1px solid rgba(255,255,255,0.1);
                    }
                    .success-icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    h2 { margin: 0 0 10px 0; }
                    p { color: rgba(255,255,255,0.7); margin: 0; }
                    .closing { font-size: 14px; margin-top: 20px; color: rgba(255,255,255,0.5); }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">✅</div>
                    <h2>${provider.charAt(0).toUpperCase() + provider.slice(1)} Connected!</h2>
                    <p>Account: ${displayName}</p>
                    <p class="closing">This window will close automatically...</p>
                </div>
                <script>
                    // Send message to parent window
                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'oauth_success',
                            provider: '${provider}',
                            displayName: '${displayName}'
                        }, '*');
                    }
                    // Close after delay
                    setTimeout(() => window.close(), 2000);
                </script>
            </body>
            </html>
        `;
    }

    private renderErrorPage(error: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Connection Failed</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                    }
                    .container {
                        text-align: center;
                        padding: 40px;
                        background: rgba(255,255,255,0.05);
                        border-radius: 16px;
                        border: 1px solid rgba(255,100,100,0.3);
                    }
                    .error-icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    h2 { margin: 0 0 10px 0; color: #ff6b6b; }
                    p { color: rgba(255,255,255,0.7); margin: 0; }
                    button {
                        margin-top: 20px;
                        padding: 10px 20px;
                        background: rgba(255,255,255,0.1);
                        border: 1px solid rgba(255,255,255,0.2);
                        border-radius: 8px;
                        color: white;
                        cursor: pointer;
                    }
                    button:hover { background: rgba(255,255,255,0.2); }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error-icon">❌</div>
                    <h2>Connection Failed</h2>
                    <p>${error}</p>
                    <button onclick="window.close()">Close</button>
                </div>
            </body>
            </html>
        `;
    }
}
