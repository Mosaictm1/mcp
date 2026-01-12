import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpException,
    HttpStatus,
    Res,
    Req,
    Headers,
    RawBodyRequest,
} from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ComposioService, ToolRouterSession, AuthorizationResult } from './composio.service';
import { ComposioWebhookService, ComposioWebhookPayload } from './composio-webhook.service';
import { InitiateConnectionDto, ExecuteActionDto } from './composio.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ConfigService } from '@nestjs/config';

// DTOs for new endpoints
class CreateSessionDto {
    toolkits?: string[];
}

class AuthorizeToolkitDto {
    toolkit: string;
}

class GetToolsDto {
    toolkits?: string[];
    limit?: number;
    search?: string;
}

@ApiTags('Composio')
@Controller('composio')
export class ComposioController {
    constructor(
        private composioService: ComposioService,
        private webhookService: ComposioWebhookService,
        private config: ConfigService,
    ) { }

    @Get('status')
    @ApiOperation({ summary: 'Check if Composio is configured' })
    getStatus() {
        const webhookStatus = this.webhookService.getStatus();
        return {
            configured: this.composioService.isConfigured(),
            message: this.composioService.isConfigured()
                ? 'Composio is ready'
                : 'COMPOSIO_API_KEY not configured',
            webhook: webhookStatus,
        };
    }

    // ==================== TOOL ROUTER ENDPOINTS ====================

    @Post('session')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create Tool Router session for the current user' })
    @ApiBody({ type: CreateSessionDto })
    async createSession(
        @Request() req: any,
        @Body() dto: CreateSessionDto,
    ): Promise<ToolRouterSession> {
        const userId = req.user?.id || req.user?.sub;

        if (!userId) {
            throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
        }

        try {
            const session = await this.composioService.createSession(userId, dto.toolkits);
            return session;
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to create session',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Post('authorize')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Authorize a specific toolkit for the user' })
    @ApiBody({ type: AuthorizeToolkitDto })
    async authorizeToolkit(
        @Request() req: any,
        @Body() dto: AuthorizeToolkitDto,
    ): Promise<AuthorizationResult> {
        const userId = req.user?.id || req.user?.sub;

        if (!userId) {
            throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
        }

        if (!dto.toolkit) {
            throw new HttpException('Toolkit name is required', HttpStatus.BAD_REQUEST);
        }

        try {
            return await this.composioService.authorizeToolkit(userId, dto.toolkit);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to authorize toolkit',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Post('tools')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get tools for the user session' })
    @ApiBody({ type: GetToolsDto })
    async getSessionTools(
        @Request() req: any,
        @Body() dto: GetToolsDto,
    ) {
        const userId = req.user?.id || req.user?.sub;

        if (!userId) {
            throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
        }

        try {
            const tools = await this.composioService.getSessionTools(userId, dto.toolkits);
            return { tools };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to get tools',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    // ==================== WEBHOOK ENDPOINT ====================

    @Post('webhook')
    @ApiOperation({ summary: 'Composio webhook endpoint for trigger events' })
    async handleWebhook(
        @Req() req: RawBodyRequest<ExpressRequest>,
        @Headers('webhook-signature') signature: string,
        @Headers('webhook-id') webhookId: string,
        @Headers('webhook-timestamp') timestamp: string,
        @Body() body: ComposioWebhookPayload,
    ) {
        // Get raw body for signature verification
        const rawBody = req.rawBody?.toString() || JSON.stringify(body);

        // Verify signature
        if (!this.webhookService.verifySignature(signature, webhookId, timestamp, rawBody)) {
            throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
        }

        // Process the webhook
        try {
            await this.webhookService.handleWebhook(body);
            return { status: 'success', message: 'Webhook processed' };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to process webhook',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ==================== CONNECTION ENDPOINTS ====================

    @Post('connect')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Start a new connection with an app' })
    async initiateConnection(
        @Request() req: any,
        @Body() dto: InitiateConnectionDto,
    ) {
        const userId = req.user?.id || req.user?.sub;

        if (!userId) {
            throw new HttpException('User ID not found in request', HttpStatus.UNAUTHORIZED);
        }

        try {
            const result = await this.composioService.initiateConnection(
                userId,
                dto.authConfigId,
                dto.callbackUrl,
                dto.toolkitName,
                dto.allowMultiple || false,
            );

            // Save pending connection to local DB only if we have valid IDs
            if (dto.toolkitName && result.connectionRequestId) {
                await this.composioService.saveConnectionToDb(
                    userId,
                    result.connectionRequestId,
                    dto.authConfigId,
                    dto.toolkitName,
                    'PENDING',
                );
            }

            return result;
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to initiate connection',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Get('callback')
    @ApiOperation({ summary: 'OAuth callback handler' })
    @ApiQuery({ name: 'connection_id', required: false })
    @ApiQuery({ name: 'status', required: false })
    async handleCallback(
        @Query('connection_id') connectionId: string,
        @Query('status') status: string,
        @Res() res: Response,
    ) {
        const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');

        if (status === 'success' && connectionId) {
            // Redirect to frontend with success
            return res.redirect(
                `${frontendUrl}/credentials?composio_success=true&connection_id=${connectionId}`,
            );
        }

        // Redirect with error
        return res.redirect(
            `${frontendUrl}/credentials?composio_error=true&message=${status || 'Unknown error'}`,
        );
    }

    @Get('connections')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all connections for the current user' })
    async getConnections(@Request() req: any) {
        const userId = req.user.id;

        try {
            // Get from Composio API
            const composioConnections = await this.composioService.getConnections(userId);

            // Get from local DB
            const dbConnections = await this.composioService.getDbConnections(userId);

            return {
                connections: composioConnections.map(conn => ({
                    id: conn.id,
                    integrationId: conn.integrationId,
                    status: conn.status,
                    createdAt: conn.createdAt,
                    // Find matching local record for toolkit name
                    toolkitName: dbConnections.find(
                        (db: { composioAccountId: string; toolkitName: string }) => db.composioAccountId === conn.id
                    )?.toolkitName || conn.integrationId,
                })),
            };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to fetch connections',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('connections/:id')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get a specific connection' })
    async getConnection(
        @Param('id') connectionId: string,
    ) {
        try {
            const connection = await this.composioService.getConnection(connectionId);
            return { connection };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Connection not found',
                HttpStatus.NOT_FOUND,
            );
        }
    }

    @Delete('connections/:id')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a connection' })
    async deleteConnection(
        @Request() req: any,
        @Param('id') connectionId: string,
    ) {
        const userId = req.user.id;

        try {
            // Delete from Composio
            await this.composioService.deleteConnection(connectionId);

            // Delete from local DB
            await this.composioService.deleteDbConnection(userId, connectionId);

            return { message: 'Connection deleted successfully' };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to delete connection',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    // ==================== TOOLKIT ENDPOINTS ====================

    @Get('toolkits')
    @ApiOperation({ summary: 'Get available toolkits/integrations' })
    async getToolkits() {
        try {
            const toolkits = await this.composioService.getToolkits();
            return { toolkits };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to fetch toolkits',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('toolkits/:name/actions')
    @ApiOperation({ summary: 'Get available actions for a toolkit' })
    async getActions(@Param('name') toolkitName: string) {
        try {
            const actions = await this.composioService.getActions(toolkitName);
            return { actions };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to fetch actions',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ==================== ACTION EXECUTION ====================

    @Post('execute')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Execute an action on a connected account' })
    async executeAction(
        @Body() dto: ExecuteActionDto,
    ) {
        try {
            const result = await this.composioService.executeAction(
                dto.connectionId,
                dto.action,
                dto.params || {},
            );
            return { result };
        } catch (error: any) {
            // Handle auth_required state
            if (error.message?.includes('auth_required') || error.code === 'AUTH_REQUIRED') {
                throw new HttpException(
                    { message: 'Re-authentication required', code: 'AUTH_REQUIRED' },
                    HttpStatus.UNAUTHORIZED,
                );
            }

            // Handle execution_failure state
            if (error.message?.includes('execution_failure') || error.code === 'EXECUTION_FAILURE') {
                throw new HttpException(
                    { message: error.message || 'Action execution failed', code: 'EXECUTION_FAILURE' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            throw new HttpException(
                error.message || 'Failed to execute action',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Post('connections/:id/verify')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Verify and activate a pending connection' })
    async verifyConnection(
        @Request() req: any,
        @Param('id') connectionId: string,
        @Body() body: { toolkitName?: string; authConfigId?: string },
    ) {
        const userId = req.user.id;

        try {
            const connection = await this.composioService.getConnection(connectionId);

            if (connection.status === 'ACTIVE') {
                // Update local DB
                await this.composioService.saveConnectionToDb(
                    userId,
                    connectionId,
                    body.authConfigId || connection.integrationId,
                    body.toolkitName || connection.integrationId,
                    'ACTIVE',
                );

                return {
                    verified: true,
                    connection: {
                        id: connection.id,
                        status: connection.status,
                        toolkitName: body.toolkitName || connection.integrationId,
                    },
                };
            }

            return {
                verified: false,
                status: connection.status,
            };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to verify connection',
                HttpStatus.BAD_REQUEST,
            );
        }
    }
}
