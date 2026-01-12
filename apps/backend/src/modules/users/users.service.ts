import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User, Plan } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { id } });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { email } });
    }

    async updateTokensUsed(userId: string, tokens: number) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { tokensUsed: { increment: tokens } },
        });
    }

    async checkTokenLimit(userId: string): Promise<boolean> {
        const user = await this.findById(userId);
        if (!user) return false;
        return user.tokensUsed < user.tokensLimit;
    }

    async upgradePlan(userId: string, plan: Plan) {
        const limits: Record<Plan, number> = {
            FREE: 10000,
            PRO: 100000,
            ENTERPRISE: 1000000,
        };

        return this.prisma.user.update({
            where: { id: userId },
            data: { plan, tokensLimit: limits[plan] },
        });
    }
}
