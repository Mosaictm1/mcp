import { Injectable } from '@nestjs/common';
import { CredentialsService } from '../../modules/credentials/credentials.service';

export interface SheetsTooInput {
    userId: string;
    action: 'read_sheet' | 'write_row' | 'append_row';
    parameters: {
        spreadsheetId?: string;
        range?: string;
        values?: any[];
    };
}

@Injectable()
export class SheetsTool {
    constructor(private credentialsService: CredentialsService) { }

    async execute(input: SheetsTooInput) {
        const { userId, action, parameters } = input;

        // Get user's Google credentials
        const tokens = await this.credentialsService.getDecryptedTokens(
            await this.getCredentialId(userId, 'google_sheets'),
            userId,
        );

        if (!tokens) {
            return {
                success: false,
                error: 'Google Sheets not connected. Please connect Google in the Credentials page.',
            };
        }

        switch (action) {
            case 'read_sheet':
                return this.readSheet(tokens.accessToken, parameters);
            case 'append_row':
                return this.appendRow(tokens.accessToken, parameters);
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }

    private async getCredentialId(userId: string, provider: string): Promise<string> {
        const credentials = await this.credentialsService.findAllByUser(userId);
        const cred = credentials.find(c => c.provider === provider);
        return cred?.id || '';
    }

    private async readSheet(
        accessToken: string,
        params: { spreadsheetId?: string; range?: string },
    ) {
        const { spreadsheetId, range = 'Sheet1!A:Z' } = params;

        if (!spreadsheetId) {
            return { success: false, error: 'Missing spreadsheetId' };
        }

        try {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );

            const data = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: `Read ${data.values?.length || 0} rows from sheet`,
                    values: data.values,
                };
            } else {
                return { success: false, error: data.error?.message || 'Failed to read sheet' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    private async appendRow(
        accessToken: string,
        params: { spreadsheetId?: string; range?: string; values?: any[] },
    ) {
        const { spreadsheetId, range = 'Sheet1', values } = params;

        if (!spreadsheetId || !values) {
            return { success: false, error: 'Missing spreadsheetId or values' };
        }

        try {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ values: [values] }),
                },
            );

            const data = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: '✅ Row added successfully',
                    updatedRange: data.updates?.updatedRange,
                };
            } else {
                return { success: false, error: data.error?.message || 'Failed to append row' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}
