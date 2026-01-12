import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Composio } from '@composio/core';
import { VercelProvider } from '@composio/vercel';

// Session info for Tool Router
export interface ToolRouterSession {
    sessionId: string;
    userId: string;
    mcpUrl: string;
    mcpHeaders: Record<string, string>;
    toolkits?: string[];
}

// Authorization result
export interface AuthorizationResult {
    redirectUrl: string;
    connectionId: string;
    toolkit: string;
}

@Injectable()
export class ComposioService implements OnModuleInit {
    private readonly logger = new Logger(ComposioService.name);
    // Use any type to allow different provider configurations
    private composio: any = null;

    constructor(
        private config: ConfigService,
        private prisma: PrismaService,
    ) { }

    onModuleInit() {
        const apiKey = this.config.get<string>('COMPOSIO_API_KEY');
        if (apiKey) {
            // Initialize with Vercel AI SDK provider
            this.composio = new Composio({
                apiKey,
                provider: new VercelProvider(),
            });
            this.logger.log('✅ Composio SDK initialized with Vercel AI SDK provider');
        } else {
            this.logger.warn('⚠️ COMPOSIO_API_KEY not configured - Composio features disabled');
        }
    }

    private ensureInitialized(): any {
        if (!this.composio) {
            throw new Error('Composio is not configured. Please set COMPOSIO_API_KEY in .env');
        }
        return this.composio;
    }

    /**
     * Create a Tool Router session for a user
     * Sessions are ephemeral, user-scoped, and manage connections and tools
     */
    async createSession(userId: string, toolkits?: string[]): Promise<ToolRouterSession> {
        const composio = this.ensureInitialized();

        this.logger.log(`Creating Tool Router session for user ${userId}`);

        try {
            const session = await (composio as any).create(userId, {
                toolkits,
            });

            return {
                sessionId: session.id || `session_${Date.now()}`,
                userId,
                mcpUrl: session.mcp?.url || '',
                mcpHeaders: session.mcp?.headers || {},
                toolkits,
            };
        } catch (error: any) {
            this.logger.error(`Failed to create session: ${error.message}`);
            throw new Error(`Failed to create Tool Router session: ${error.message}`);
        }
    }

    /**
     * Get tools for a user session (for Vercel AI SDK binding)
     * These tools can be directly passed to generateText/streamText
     */
    async getSessionTools(userId: string, toolkits?: string[]): Promise<any> {
        const composio = this.ensureInitialized();

        this.logger.log(`Getting tools for user ${userId}, toolkits: ${toolkits?.join(', ') || 'all'}`);

        try {
            const session = await (composio as any).create(userId, { toolkits });
            const tools = await session.tools();
            return tools;
        } catch (error: any) {
            this.logger.error(`Failed to get session tools: ${error.message}`);
            throw new Error(`Failed to get session tools: ${error.message}`);
        }
    }

    /**
     * Authorize a specific toolkit for a user (manual auth flow)
     * Returns a redirect URL for the user to complete OAuth
     */
    async authorizeToolkit(userId: string, toolkit: string): Promise<AuthorizationResult> {
        const composio = this.ensureInitialized();

        this.logger.log(`Authorizing ${toolkit} for user ${userId}`);

        try {
            const session = await (composio as any).create(userId);
            const connectionRequest = await session.authorize(toolkit);

            return {
                redirectUrl: connectionRequest.redirect_url || connectionRequest.redirectUrl || '',
                connectionId: connectionRequest.id || connectionRequest.connectionId || '',
                toolkit,
            };
        } catch (error: any) {
            this.logger.error(`Failed to authorize toolkit: ${error.message}`);
            throw new Error(`Failed to authorize ${toolkit}: ${error.message}`);
        }
    }

    /**
     * Initiate a connection using Composio REST API v3
     */
    async initiateConnection(
        userId: string,
        authConfigId: string,
        callbackUrl?: string,
        toolkitName?: string,
        allowMultiple = false,
    ): Promise<{ redirectUrl: string; connectionRequestId: string }> {
        const apiKey = this.config.get<string>('COMPOSIO_API_KEY');
        const frontendUrl = this.config.get('FRONTEND_URL', 'https://n8n-autopilot.vercel.app');
        const finalCallbackUrl = callbackUrl || `${frontendUrl}/credentials?composio_callback=true`;

        this.logger.log(`Initiating connection for user ${userId}`);
        this.logger.log(`Auth Config: ${authConfigId}, Toolkit: ${toolkitName}`);

        if (!authConfigId) {
            throw new Error('authConfigId is required');
        }

        if (!apiKey) {
            throw new Error('COMPOSIO_API_KEY is not configured');
        }

        try {
            // Use Composio v3 API format
            const axios = (await import('axios')).default;

            const response = await axios.post(
                'https://backend.composio.dev/api/v3/connectedAccounts',
                {
                    integrationId: authConfigId,
                    entityId: userId,
                    redirectUri: finalCallbackUrl,
                    data: {},
                },
                {
                    headers: {
                        'X-API-Key': apiKey,
                        'Content-Type': 'application/json',
                    },
                }
            );

            this.logger.log(`API response: ${JSON.stringify(response.data)}`);

            const data = response.data;
            const redirectUrl = data?.redirectUrl ||
                data?.connectionStatus?.redirectUrl ||
                '';
            const connectionId = data?.connectedAccountId ||
                data?.id ||
                `conn_${Date.now()}`;

            return {
                redirectUrl,
                connectionRequestId: connectionId,
            };
        } catch (error: any) {
            this.logger.error(`API error: ${JSON.stringify(error.response?.data) || error.message}`);
            throw new Error(`Composio connection failed: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Wait for a connection to be established
     */
    async waitForConnection(connectionRequestId: string, timeoutSeconds = 60): Promise<any> {
        const composio = this.ensureInitialized();

        const startTime = Date.now();
        const timeoutMs = timeoutSeconds * 1000;

        while (Date.now() - startTime < timeoutMs) {
            try {
                const account = await composio.connectedAccounts.get({
                    connectedAccountId: connectionRequestId,
                } as any);

                if ((account as any).status === 'ACTIVE') {
                    return account;
                }

                if ((account as any).status === 'FAILED' || (account as any).status === 'EXPIRED') {
                    throw new Error(`Connection ${(account as any).status.toLowerCase()}`);
                }
            } catch (error: any) {
                if (!error.message?.includes('not found')) {
                    throw error;
                }
            }

            // Wait 2 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        throw new Error('Connection timeout');
    }

    /**
     * Get all connections for a user
     */
    async getConnections(userId: string): Promise<any[]> {
        const composio = this.ensureInitialized();

        try {
            const result = await composio.connectedAccounts.list({
                entityId: userId,
            } as any);

            return (result as any).items || [];
        } catch (error: any) {
            this.logger.error(`Failed to get connections: ${error.message}`);
            // Return empty array instead of throwing
            return [];
        }
    }

    /**
     * Get a specific connection
     */
    async getConnection(connectionId: string): Promise<any> {
        const composio = this.ensureInitialized();

        return composio.connectedAccounts.get({
            connectedAccountId: connectionId,
        } as any);
    }

    /**
     * Disconnect/delete a connection
     */
    async deleteConnection(connectionId: string): Promise<void> {
        const composio = this.ensureInitialized();

        await composio.connectedAccounts.delete({
            connectedAccountId: connectionId,
        } as any);

        this.logger.log(`Deleted connection ${connectionId}`);
    }

    /**
     * Get available toolkits/integrations
     */
    async getToolkits(): Promise<any[]> {
        const composio = this.ensureInitialized();

        try {
            // Try new SDK method first
            const result = await (composio as any).toolkits?.get?.() ||
                await composio.integrations.list({} as any);
            return (result as any).items || result || [];
        } catch (error: any) {
            this.logger.error(`Failed to get toolkits: ${error.message}`);
            return [];
        }
    }

    /**
     * Get tools for a specific toolkit with filtering
     * Uses dynamic tool retrieval to minimize prompt token bloat
     */
    async getTools(options: {
        toolkits?: string[];
        limit?: number;
        search?: string;
    } = {}): Promise<any[]> {
        const composio = this.ensureInitialized();

        try {
            const result = await (composio as any).tools?.get?.(options) ||
                await composio.actions.list({
                    apps: options.toolkits?.join(','),
                    limit: options.limit,
                } as any);

            return (result as any).items || result || [];
        } catch (error: any) {
            this.logger.error(`Failed to get tools: ${error.message}`);
            return [];
        }
    }

    /**
     * Get available actions for a toolkit
     */
    async getActions(toolkitName: string): Promise<any[]> {
        const composio = this.ensureInitialized();

        try {
            const result = await composio.actions.list({
                apps: toolkitName,
            } as any);

            return (result as any).items || [];
        } catch (error: any) {
            this.logger.error(`Failed to get actions: ${error.message}`);
            return [];
        }
    }

    /**
     * Execute an action using a connected account
     */
    async executeAction(
        connectionId: string,
        actionName: string,
        params: Record<string, any> = {},
    ): Promise<any> {
        const composio = this.ensureInitialized();

        this.logger.log(`Executing action ${actionName} on connection ${connectionId}`);

        // Execute using actions API
        const result = await (composio as any).actions.execute({
            action: actionName,
            entityId: connectionId,
            params,
        });

        return result;
    }

    /**
     * Check if Composio is configured
     */
    isConfigured(): boolean {
        return this.composio !== null;
    }

    /**
     * Save connection to local database for tracking
     */
    async saveConnectionToDb(
        userId: string,
        composioAccountId: string,
        authConfigId: string,
        toolkitName: string,
        status: string = 'ACTIVE',
    ) {
        return this.prisma.composioConnection.upsert({
            where: {
                userId_composioAccountId: {
                    userId,
                    composioAccountId,
                },
            },
            update: {
                status,
                updatedAt: new Date(),
            },
            create: {
                userId,
                composioAccountId,
                authConfigId,
                toolkitName,
                status,
            },
        });
    }

    /**
     * Get user connections from local database
     */
    async getDbConnections(userId: string) {
        return this.prisma.composioConnection.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Delete connection from local database
     */
    async deleteDbConnection(userId: string, composioAccountId: string) {
        return this.prisma.composioConnection.deleteMany({
            where: { userId, composioAccountId },
        });
    }
}
