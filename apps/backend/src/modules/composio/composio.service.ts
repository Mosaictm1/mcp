import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Composio } from 'composio-core';

@Injectable()
export class ComposioService implements OnModuleInit {
    private readonly logger = new Logger(ComposioService.name);
    private composio: Composio | null = null;

    constructor(
        private config: ConfigService,
        private prisma: PrismaService,
    ) { }

    onModuleInit() {
        const apiKey = this.config.get<string>('COMPOSIO_API_KEY');
        if (apiKey) {
            this.composio = new Composio({ apiKey });
            this.logger.log('✅ Composio SDK initialized');
        } else {
            this.logger.warn('⚠️ COMPOSIO_API_KEY not configured - Composio features disabled');
        }
    }

    private ensureInitialized(): Composio {
        if (!this.composio) {
            throw new Error('Composio is not configured. Please set COMPOSIO_API_KEY in .env');
        }
        return this.composio;
    }

    /**
     * Initiate a connection using Composio SDK
     */
    async initiateConnection(
        userId: string,
        authConfigId: string,
        callbackUrl?: string,
        toolkitName?: string,
    ): Promise<{ redirectUrl: string; connectionRequestId: string }> {
        const composio = this.ensureInitialized();

        const frontendUrl = this.config.get('FRONTEND_URL', 'https://n8n-autopilot.vercel.app');
        const finalCallbackUrl = callbackUrl || `${frontendUrl}/credentials?composio_callback=true`;

        this.logger.log(`Initiating connection for user ${userId}`);
        this.logger.log(`Auth Config: ${authConfigId}, Toolkit: ${toolkitName}`);

        try {
            // Use SDK's connectedAccounts.initiate - this generates proper links
            // Note: Composio SDK renamed integrationId to authConfigId and entityId to userId
            const connectionRequest = await (composio as any).connectedAccounts.initiate({
                authConfigId: authConfigId,
                userId: userId,
                redirectUri: finalCallbackUrl,
            });

            this.logger.log(`SDK response: ${JSON.stringify(connectionRequest)}`);

            const redirectUrl = connectionRequest?.redirectUrl ||
                connectionRequest?.connectionStatus?.redirectUrl ||
                '';
            const connectionId = connectionRequest?.connectedAccountId ||
                connectionRequest?.id ||
                `conn_${Date.now()}`;

            return {
                redirectUrl,
                connectionRequestId: connectionId,
            };
        } catch (error: any) {
            this.logger.error(`SDK error: ${error.message}`);
            this.logger.error(`Full error: ${JSON.stringify(error)}`);
            throw new Error(`Composio connection failed: ${error.message}`);
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
            const result = await composio.integrations.list({} as any);
            return (result as any).items || [];
        } catch (error: any) {
            this.logger.error(`Failed to get toolkits: ${error.message}`);
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
