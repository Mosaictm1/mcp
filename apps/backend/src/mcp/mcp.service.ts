import { Injectable } from '@nestjs/common';
import { AnalyzePromptTool } from './tools/analyze-prompt.tool';
import { ListCredentialsTool } from './tools/list-credentials.tool';
import { PicaOrchestratorTool } from './tools/pica-orchestrator.tool';

export interface McpRequest {
    method: string;
    params: any;
    userId: string;
}

export interface McpResponse {
    success: boolean;
    data?: any;
    error?: string;
}

interface McpTool {
    execute(input: any): Promise<any>;
}

@Injectable()
export class McpService {
    private tools: Map<string, McpTool>;

    constructor(
        private analyzePromptTool: AnalyzePromptTool,
        private listCredentialsTool: ListCredentialsTool,
        private picaOrchestratorTool: PicaOrchestratorTool,
    ) {
        this.tools = new Map<string, McpTool>();
        this.tools.set('analyze_prompt', this.analyzePromptTool);
        this.tools.set('list_credentials', this.listCredentialsTool);
        this.tools.set('execute', this.picaOrchestratorTool);
    }

    async handleRequest(request: McpRequest): Promise<McpResponse> {
        const { method, params, userId } = request;

        // List available tools
        if (method === 'tools/list') {
            return {
                success: true,
                data: this.getToolsList(),
            };
        }

        // Execute tool
        if (method === 'tools/call') {
            const { name, arguments: args } = params;
            const tool = this.tools.get(name);

            if (!tool) {
                return { success: false, error: `Unknown tool: ${name}` };
            }

            try {
                const result = await tool.execute({ ...args, userId });
                return { success: true, data: result };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        }

        // List resources
        if (method === 'resources/list') {
            return {
                success: true,
                data: this.getResourcesList(),
            };
        }

        return { success: false, error: `Unknown method: ${method}` };
    }

    private getToolsList() {
        return {
            tools: [
                {
                    name: 'execute',
                    description: 'Execute an automation via Pica. Supports 150+ integrations including: Gmail, Slack, Google Sheets, Drive, Notion, Telegram, Discord, and more.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            prompt: { type: 'string', description: 'The automation request in natural language' },
                        },
                        required: ['prompt'],
                    },
                },
                {
                    name: 'analyze_prompt',
                    description: 'Analyze a prompt without executing - useful for preview',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            prompt: { type: 'string', description: 'The automation request to analyze' },
                        },
                        required: ['prompt'],
                    },
                },
                {
                    name: 'list_credentials',
                    description: 'List user connected services/credentials',
                    inputSchema: { type: 'object', properties: {} },
                },
            ],
        };
    }

    private getResourcesList() {
        return {
            resources: [
                {
                    uri: 'pica://integrations',
                    name: 'Available Integrations',
                    description: '150+ integrations available via Pica',
                    mimeType: 'application/json',
                },
            ],
        };
    }
}
