import { Module } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { CredentialsController } from './credentials.controller';
import { OAuthController } from './oauth.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [CredentialsController, OAuthController],
    providers: [CredentialsService],
    exports: [CredentialsService],
})
export class CredentialsModule { }
