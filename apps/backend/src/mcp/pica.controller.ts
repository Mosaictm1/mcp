import { Controller, Get, Param, Query, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../modules/auth/supabase-auth.guard';
import { PicaService } from './pica.service';

@ApiTags('Pica')
@Controller('pica')
export class PicaController {
    constructor(private picaService: PicaService) { }

    @Get('platforms')
    @ApiOperation({ summary: 'Get available platforms for connection' })
    async getPlatforms() {
        const platforms = await this.picaService.getAvailablePlatforms();
        return {
            platforms: platforms.map(p => ({
                id: p,
                name: this.formatName(p),
                icon: this.getIcon(p),
            })),
        };
    }

    @Post('authkit/token')
    @UseGuards(SupabaseAuthGuard)
    @ApiOperation({ summary: 'Generate AuthKit token for user' })
    async getAuthKitToken(@Request() req: any) {
        const userId = req.user?.id || 'demo-user';
        const userEmail = req.user?.email || '';

        // Generate AuthKit token via Pica API
        const token = await this.picaService.generateAuthKitToken(userId, userEmail);
        return token;
    }

    @Get('connections')
    @UseGuards(SupabaseAuthGuard)
    @ApiOperation({ summary: 'List user connections' })
    async listConnections(@Request() req: any) {
        const userId = req.user?.id || 'demo-user';
        const connections = await this.picaService.listConnections(userId);
        return { connections };
    }

    private formatName(platform: string): string {
        return platform
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    private getIcon(platform: string): string {
        const icons: Record<string, string> = {
            'gmail': '📧',
            'slack': '💬',
            'google-sheets': '📊',
            'google-drive': '📁',
            'notion': '📝',
            'telegram': '✈️',
            'discord': '🎮',
            'twitter': '🐦',
            'linkedin': '💼',
            'hubspot': '🔶',
            'salesforce': '☁️',
        };
        return icons[platform] || '🔗';
    }
}
