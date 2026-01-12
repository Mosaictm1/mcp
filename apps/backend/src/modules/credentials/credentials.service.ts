import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Credential } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class CredentialsService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly key: Buffer;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        this.key = Buffer.from(
            this.configService.get('ENCRYPTION_KEY')!.padEnd(32, '0').slice(0, 32),
        );
    }

    private encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    private decrypt(encryptedText: string): string {
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    async create(
        userId: string,
        provider: string,
        displayName: string,
        accessToken: string,
        refreshToken?: string,
        expiresAt?: Date,
        metadata?: object,
    ): Promise<Credential> {
        return this.prisma.credential.create({
            data: {
                userId,
                provider,
                displayName,
                accessTokenEnc: this.encrypt(accessToken),
                refreshTokenEnc: refreshToken ? this.encrypt(refreshToken) : null,
                expiresAt,
                metadata: metadata ?? undefined,
            },
        });
    }

    async findAllByUser(userId: string): Promise<Omit<Credential, 'accessTokenEnc' | 'refreshTokenEnc'>[]> {
        return this.prisma.credential.findMany({
            where: { userId },
            select: {
                id: true,
                userId: true,
                provider: true,
                displayName: true,
                expiresAt: true,
                metadata: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    async getDecryptedTokens(credentialId: string, userId: string) {
        const cred = await this.prisma.credential.findFirst({
            where: { id: credentialId, userId },
        });
        if (!cred) return null;

        return {
            accessToken: this.decrypt(cred.accessTokenEnc),
            refreshToken: cred.refreshTokenEnc ? this.decrypt(cred.refreshTokenEnc) : null,
        };
    }

    async delete(id: string, userId: string) {
        return this.prisma.credential.deleteMany({
            where: { id, userId },
        });
    }
}
