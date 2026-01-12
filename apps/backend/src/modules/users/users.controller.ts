import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get('me')
    async getCurrentUser(@Request() req: any) {
        return this.usersService.findById(req.user.sub);
    }

    @Get('me/usage')
    async getUsage(@Request() req: any) {
        const user = await this.usersService.findById(req.user.sub);
        return {
            tokensUsed: user?.tokensUsed ?? 0,
            tokensLimit: user?.tokensLimit ?? 0,
            percentUsed: user ? (user.tokensUsed / user.tokensLimit) * 100 : 0,
            plan: user?.plan,
        };
    }
}
