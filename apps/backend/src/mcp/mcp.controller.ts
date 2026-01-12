import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../modules/auth/supabase-auth.guard';
import { McpService, McpRequest } from './mcp.service';

@ApiTags('MCP')
@Controller('mcp')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class McpController {
    constructor(private mcpService: McpService) { }

    @Post()
    @ApiOperation({ summary: 'MCP protocol endpoint' })
    async handleMcpRequest(
        @Request() req: any,
        @Body() body: { method: string; params?: any },
    ) {
        const request: McpRequest = {
            method: body.method,
            params: body.params || {},
            userId: req.user.sub,
        };

        return this.mcpService.handleRequest(request);
    }
}
