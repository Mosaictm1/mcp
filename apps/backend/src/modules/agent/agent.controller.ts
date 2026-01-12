import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
    HttpException,
    HttpStatus,
    Res,
    Sse,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Observable, Subject } from 'rxjs';
import { AgentService, CoreMessage, AgentResponse, AuthRequiredError, ExecutionFailureError } from './agent.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

// DTOs
class ChatDto {
    messages: CoreMessage[];
    toolkits?: string[];
}

class SimpleChatDto {
    messages: CoreMessage[];
}

// SSE Message Event
interface MessageEvent {
    data: string;
}

@ApiTags('Agent')
@Controller('agent')
export class AgentController {
    constructor(private agentService: AgentService) { }

    @Post('chat')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Chat with AI agent (non-streaming, with Composio tools)' })
    @ApiBody({ type: ChatDto })
    async chat(
        @Request() req: any,
        @Body() dto: ChatDto,
    ): Promise<AgentResponse> {
        const userId = req.user?.id || req.user?.sub;

        if (!userId) {
            throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
        }

        if (!dto.messages || dto.messages.length === 0) {
            throw new HttpException('Messages are required', HttpStatus.BAD_REQUEST);
        }

        try {
            const response = await this.agentService.generateResponse(
                userId,
                dto.messages,
                dto.toolkits,
            );
            return response;
        } catch (error: any) {
            // Handle auth_required state
            if (error instanceof AuthRequiredError) {
                throw new HttpException(
                    {
                        message: 'Authentication required',
                        code: 'AUTH_REQUIRED',
                        toolkit: error.toolkit,
                    },
                    HttpStatus.UNAUTHORIZED,
                );
            }

            // Handle execution_failure state
            if (error instanceof ExecutionFailureError) {
                throw new HttpException(
                    {
                        message: error.message,
                        code: 'EXECUTION_FAILURE',
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }

            throw new HttpException(
                error.message || 'Agent chat failed',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('chat/stream')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Chat with AI agent (streaming, with Composio tools)' })
    @ApiBody({ type: ChatDto })
    async chatStream(
        @Request() req: any,
        @Body() dto: ChatDto,
        @Res() res: Response,
    ): Promise<void> {
        const userId = req.user?.id || req.user?.sub;

        if (!userId) {
            throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
        }

        if (!dto.messages || dto.messages.length === 0) {
            throw new HttpException('Messages are required', HttpStatus.BAD_REQUEST);
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        try {
            const stream = this.agentService.streamResponse(
                userId,
                dto.messages,
                dto.toolkits,
            );

            for await (const chunk of stream) {
                // Format as SSE
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);

                // Flush for immediate delivery
                if (typeof (res as any).flush === 'function') {
                    (res as any).flush();
                }
            }

            res.write('data: [DONE]\n\n');
            res.end();
        } catch (error: any) {
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        }
    }

    @Post('chat/simple')
    @UseGuards(SupabaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Simple chat without tools' })
    @ApiBody({ type: SimpleChatDto })
    async simpleChat(
        @Body() dto: SimpleChatDto,
    ): Promise<{ text: string }> {
        if (!dto.messages || dto.messages.length === 0) {
            throw new HttpException('Messages are required', HttpStatus.BAD_REQUEST);
        }

        try {
            const text = await this.agentService.simpleChat(dto.messages);
            return { text };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Chat failed',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
