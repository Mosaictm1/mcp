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
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ComposioService } from './composio.service';
import { InitiateConnectionDto, ExecuteActionDto } from './composio.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('Composio')
@Controller('composio')
export class ComposioController {
    constructor(
        private composioService: ComposioService,
        private config: ConfigService,
    ) { }

    @Get('status')
    @ApiOperation({ summary: 'Check if Composio is configured' })
    getStatus() {
        return {
            configured: this.composioService.isConfigured(),
            message: this.composioService.isConfigured()
                ? 'Composio is ready'
                : 'COMPOSIO_API_KEY not configured',
        };
    }

    @Post('connect')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Start a new connection with an app' })
    async initiateConnection(
        @Request() req: any,
        @Body() dto: InitiateConnectionDto,
    ) {
        const userId = req.user.id;

        try {
            const result = await this.composioService.initiateConnection(
                userId,
                dto.authConfigId,
                dto.callbackUrl,
            );

            // Save pending connection to local DB
            if (dto.toolkitName) {
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
