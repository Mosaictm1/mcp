import { Injectable } from '@nestjs/common';
import { CredentialsService } from '../../modules/credentials/credentials.service';

export interface ListCredentialsInput {
    userId: string;
}

@Injectable()
export class ListCredentialsTool {
    constructor(private credentialsService: CredentialsService) { }

    async execute(input: ListCredentialsInput) {
        const credentials = await this.credentialsService.findAllByUser(input.userId);

        return {
            credentials: credentials.map((c) => ({
                id: c.id,
                provider: c.provider,
                displayName: c.displayName,
                connected: true,
                expiresAt: c.expiresAt,
            })),
            total: credentials.length,
        };
    }
}
