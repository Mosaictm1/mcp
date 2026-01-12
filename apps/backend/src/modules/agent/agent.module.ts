import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { ComposioModule } from '../composio/composio.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [ComposioModule, AuthModule],
    controllers: [AgentController],
    providers: [AgentService],
    exports: [AgentService],
})
export class AgentModule { }
