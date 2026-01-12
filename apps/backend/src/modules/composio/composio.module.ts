import { Module } from '@nestjs/common';
import { ComposioService } from './composio.service';
import { ComposioController } from './composio.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [ComposioController],
    providers: [ComposioService],
    exports: [ComposioService],
})
export class ComposioModule { }
