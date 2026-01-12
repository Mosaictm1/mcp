import { Controller, Get, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ExecutionsService } from './executions.service';

@ApiTags('Executions')
@Controller('executions')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class ExecutionsController {
    constructor(private executionsService: ExecutionsService) { }

    @Get()
    @ApiOperation({ summary: 'List all executions for current user' })
    async findAll(@Request() req: any, @Query('limit') limit?: number) {
        return this.executionsService.findAllByUser(req.user.sub, limit || 50);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get execution by ID' })
    async findOne(@Param('id') id: string) {
        return this.executionsService.findById(id);
    }
}
