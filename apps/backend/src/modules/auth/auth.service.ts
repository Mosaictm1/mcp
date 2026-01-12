import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from './supabase.service';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private supabase: SupabaseService,
    ) { }

    async validateUser(supabaseToken: string) {
        try {
            const supabaseUser = await this.supabase.verifyToken(supabaseToken);

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

            return user;
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }

    async login(supabaseToken: string) {
        const user = await this.validateUser(supabaseToken);

        const payload = { sub: user.id, email: user.email };
        const accessToken = this.jwtService.sign(payload);

        return {
            user,
            accessToken,
        };
    }

    async getProfile(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                plan: true,
                tokensUsed: true,
                tokensLimit: true,
                createdAt: true,
            },
        });
    }
}
