import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../modules/auth/supabase-auth.guard';
import { ConfigService } from '@nestjs/config';
import { AuthKitToken } from '@picahq/authkit-token';

@ApiTags('Pica AuthKit')
@Controller('authkit')
export class AuthKitController {
    private authKitToken: AuthKitToken | null = null;

    constructor(private config: ConfigService) {
        const secretKey = this.config.get<string>('PICA_API_KEY');
        if (secretKey) {
            this.authKitToken = new AuthKitToken(secretKey);
        }
    }

    @Post('token')
    @UseGuards(SupabaseAuthGuard)
    @ApiOperation({ summary: 'Generate AuthKit token for user' })
    async createToken(@Request() req: any) {
        if (!this.authKitToken) {
            return {
                error: 'Pica API key not configured',
            };
        }

        try {
            const userId = req.user?.id || 'demo-user';
            const userEmail = req.user?.email || '';

            // Create secure token for this user
            const token = await this.authKitToken.create({
                identity: userId,
                identityType: 'user',
            });

            return token;
        } catch (error: any) {
            console.error('AuthKit token error:', error);
            return {
                error: error.message || 'Failed to create AuthKit token',
            };
        }
    }
}
