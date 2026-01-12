import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiateConnectionDto {
    @ApiProperty({
        description: 'Auth Config ID from Composio Dashboard',
        example: 'ac_1234567890'
    })
    @IsString()
    authConfigId: string;

    @ApiPropertyOptional({
        description: 'Callback URL after authentication',
        example: 'https://your-app.com/callback'
    })
    @IsOptional()
    @IsString()
    callbackUrl?: string;

    @ApiPropertyOptional({
        description: 'Toolkit name for display purposes',
        example: 'gmail'
    })
    @IsOptional()
    @IsString()
    toolkitName?: string;

    @ApiPropertyOptional({
        description: 'Allow multiple accounts for this toolkit',
        example: false
    })
    @IsOptional()
    allowMultiple?: boolean;
}

export class ExecuteActionDto {
    @ApiProperty({
        description: 'Connected account ID',
        example: 'ca_1234567890'
    })
    @IsString()
    connectionId: string;

    @ApiProperty({
        description: 'Action to execute',
        example: 'GMAIL_SEND_EMAIL'
    })
    @IsString()
    action: string;

    @ApiPropertyOptional({
        description: 'Parameters for the action'
    })
    @IsOptional()
    @IsObject()
    params?: Record<string, any>;
}

export class ConnectionResponseDto {
    id: string;
    toolkitName: string;
    status: string;
    createdAt: Date;
}

export class RedirectUrlResponseDto {
    redirectUrl: string;
    connectionRequestId: string;
}
