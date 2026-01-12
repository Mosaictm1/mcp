import { Controller, Get, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CredentialsService } from './credentials.service';

@ApiTags('Credentials')
@Controller('credentials')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class CredentialsController {
    constructor(private credentialsService: CredentialsService) { }

    @Get()
    @ApiOperation({ summary: 'List all credentials for current user' })
    async findAll(@Request() req: any) {
        return this.credentialsService.findAllByUser(req.user.sub);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete credential' })
    async delete(@Request() req: any, @Param('id') id: string) {
        return this.credentialsService.delete(id, req.user.sub);
    }
}
