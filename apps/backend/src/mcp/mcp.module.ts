import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { PicaController } from './pica.controller';
import { AiModule } from '../ai/ai.module';
import { ExecutionsModule } from '../modules/executions/executions.module';
import { CredentialsModule } from '../modules/credentials/credentials.module';
import { AuthModule } from '../modules/auth/auth.module';

// Pica Integration
import { PicaService } from './pica.service';
import { PicaOrchestratorTool } from './tools/pica-orchestrator.tool';

// MCP Tools
import { AnalyzePromptTool } from './tools/analyze-prompt.tool';
import { ListCredentialsTool } from './tools/list-credentials.tool';

@Module({
    imports: [
        AiModule,
        ExecutionsModule,
        CredentialsModule,
        AuthModule,
    ],
    controllers: [McpController, PicaController],
    providers: [
        McpService,
        PicaService,
        PicaOrchestratorTool,
        AnalyzePromptTool,
        ListCredentialsTool,
    ],
    exports: [McpService, PicaService],
})
export class McpModule { }
