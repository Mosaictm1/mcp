import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Execution, ExecutionStatus, Prisma } from '@prisma/client';

@Injectable()
export class ExecutionsService {
    constructor(private prisma: PrismaService) { }

    async create(
        userId: string,
        workflowId: string,
        inputData?: Prisma.InputJsonValue,
    ): Promise<Execution> {
        return this.prisma.execution.create({
            data: {
                userId,
                workflowId,
                inputData,
                status: ExecutionStatus.PENDING,
            },
        });
    }

    async findAllByUser(userId: string, limit = 50): Promise<Execution[]> {
        return this.prisma.execution.findMany({
            where: { userId },
            orderBy: { startedAt: 'desc' },
            take: limit,
            include: { workflow: { select: { name: true } } },
        });
    }

    async findById(id: string): Promise<Execution | null> {
        return this.prisma.execution.findUnique({
            where: { id },
            include: { workflow: true },
        });
    }

    async updateStatus(
        id: string,
        status: ExecutionStatus,
        n8nExecutionId?: string,
    ) {
        return this.prisma.execution.update({
            where: { id },
            data: { status, n8nExecutionId },
        });
    }

    async complete(
        id: string,
        status: ExecutionStatus,
        outputData?: Prisma.InputJsonValue,
        error?: string,
        tokensUsed = 0,
    ) {
        return this.prisma.execution.update({
            where: { id },
            data: {
                status,
                outputData,
                error,
                tokensUsed,
                finishedAt: new Date(),
                durationMs: undefined, // Will be calculated via trigger
            },
        });
    }
}
