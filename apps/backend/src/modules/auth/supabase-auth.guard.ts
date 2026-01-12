import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
    constructor(
        private supabase: SupabaseService,
        private prisma: PrismaService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedException('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // Handle demo token for development
        if (token.startsWith('demo-token-')) {
            const demoUserId = token.replace('demo-token-', '');

            // Ensure demo user exists in database
            let user = await this.prisma.user.findUnique({
                where: { id: demoUserId },
            });

            if (!user) {
                user = await this.prisma.user.create({
                    data: {
                        id: demoUserId,
                        email: 'demo@n8n-autopilot.dev',
                        name: 'Demo User',
                    },
                });
            }

            request.user = {
                sub: user.id,
                email: user.email,
                userId: user.id,
            };
            return true;
        }

        try {
            // Verify token with Supabase
            const supabaseUser = await this.supabase.verifyToken(token);

            // Find or create user in our database
            let user = await this.prisma.user.findUnique({
                where: { email: supabaseUser.email! },
            });

            if (!user) {
                user = await this.prisma.user.create({
                    data: {
                        id: supabaseUser.id,
                        email: supabaseUser.email!,
                        name: supabaseUser.user_metadata?.full_name,
                        avatarUrl: supabaseUser.user_metadata?.avatar_url,
                    },
                });
            }

            request.user = {
                sub: user.id,
                email: user.email,
                userId: user.id,
            };

            return true;
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }
}
