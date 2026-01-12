import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CredentialsModule } from './modules/credentials/credentials.module';
import { ExecutionsModule } from './modules/executions/executions.module';
import { ComposioModule } from './modules/composio/composio.module';
import { AgentModule } from './modules/agent/agent.module';
import { McpModule } from './mcp/mcp.module';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health.controller';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        PrismaModule,
        AuthModule,
        UsersModule,
        CredentialsModule,
        ExecutionsModule,
        ComposioModule,
        AgentModule,
        McpModule,
        AiModule,
    ],
    controllers: [HealthController],
})
export class AppModule { }
