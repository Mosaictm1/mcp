import { Module } from '@nestjs/common';
import { ComposioService } from './composio.service';
import { ComposioWebhookService } from './composio-webhook.service';
import { ComposioController } from './composio.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [ComposioController],
    providers: [ComposioService, ComposioWebhookService],
    exports: [ComposioService, ComposioWebhookService],
})
export class ComposioModule { }
