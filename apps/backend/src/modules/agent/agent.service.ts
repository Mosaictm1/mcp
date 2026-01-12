import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ComposioService } from '../composio/composio.service';

// Message types for Vercel AI SDK
export interface CoreMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Tool call result
export interface ToolCall {
    toolName: string;
    args: Record<string, any>;
}

// Tool result
export interface ToolResult {
    toolCallId: string;
    result: any;
}

// Agent response
export interface AgentResponse {
    text: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// Streaming chunk
export interface StreamChunk {
    type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
    content?: string;
    toolName?: string;
    toolArgs?: Record<string, any>;
    error?: string;
}

@Injectable()
export class AgentService {
    private readonly logger = new Logger(AgentService.name);

    constructor(
        private config: ConfigService,
        private composioService: ComposioService,
    ) { }

    /**
     * Generate a non-streaming response with Composio tools
     */
    async generateResponse(
        userId: string,
        messages: CoreMessage[],
        toolkits?: string[],
    ): Promise<AgentResponse> {
        this.logger.log(`Generating response for user ${userId}`);

        try {
            // Dynamically import Vercel AI SDK (ES modules)
            const { generateText } = await import('ai');
            const { openai } = await import('@ai-sdk/openai');

            // Get tools for this user's session
            const tools = await this.composioService.getSessionTools(userId, toolkits);

            this.logger.log(`Loaded ${Object.keys(tools || {}).length} tools for agent`);

            const result = await generateText({
                model: openai('gpt-4-turbo'),
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                tools,
                toolChoice: 'auto',
                maxRetries: 3, // Retry on failures
            } as any);

            // Log tool usage
            if (result.toolCalls && result.toolCalls.length > 0) {
                result.toolCalls.forEach((call: any) => {
                    this.logger.log(`[Tool Used: ${call.toolName}]`);
                });
            }

            // Get usage data safely
            const usage = (result as any).usage;

            return {
                text: result.text,
                toolCalls: result.toolCalls?.map((call: any) => ({
                    toolName: call.toolName,
                    args: call.args,
                })),
                toolResults: result.toolResults?.map((res: any) => ({
                    toolCallId: res.toolCallId,
                    result: res.result,
                })),
                usage: usage ? {
                    promptTokens: usage.promptTokens || 0,
                    completionTokens: usage.completionTokens || 0,
                    totalTokens: usage.totalTokens || 0,
                } : undefined,
            };
        } catch (error: any) {
            this.logger.error(`Agent error: ${error.message}`);

            // Handle specific Composio error states
            if (error.message?.includes('auth_required')) {
                throw new AuthRequiredError(error.toolkit || 'unknown', error.message);
            }

            if (error.message?.includes('execution_failure')) {
                throw new ExecutionFailureError(error.message);
            }

            throw error;
        }
    }

    /**
     * Generate a streaming response with Composio tools
     * Returns an async generator that yields chunks
     */
    async *streamResponse(
        userId: string,
        messages: CoreMessage[],
        toolkits?: string[],
    ): AsyncGenerator<StreamChunk> {
        this.logger.log(`Streaming response for user ${userId}`);

        try {
            // Dynamically import Vercel AI SDK (ES modules)
            const { streamText } = await import('ai');
            const { openai } = await import('@ai-sdk/openai');

            // Get tools for this user's session
            const tools = await this.composioService.getSessionTools(userId, toolkits);

            this.logger.log(`Loaded ${Object.keys(tools || {}).length} tools for streaming agent`);

            const result = await streamText({
                model: openai('gpt-4-turbo'),
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                tools,
                toolChoice: 'auto',
                maxRetries: 3,
            } as any);

            // Note: onStepFinish is not available in all versions
            // Tool calls are logged separately

            // Stream text chunks
            for await (const chunk of result.textStream) {
                yield { type: 'text', content: chunk };
            }

            // Signal completion
            yield { type: 'done' };

        } catch (error: any) {
            this.logger.error(`Streaming error: ${error.message}`);

            // Handle specific Composio error states
            if (error.message?.includes('auth_required')) {
                yield {
                    type: 'error',
                    error: `Authentication required for ${error.toolkit || 'a toolkit'}`,
                };
                return;
            }

            yield { type: 'error', error: error.message };
        }
    }

    /**
     * Simple chat without tools (fallback)
     */
    async simpleChat(messages: CoreMessage[]): Promise<string> {
        try {
            const { generateText } = await import('ai');
            const { openai } = await import('@ai-sdk/openai');

            const result = await generateText({
                model: openai('gpt-4-turbo'),
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
            });

            return result.text;
        } catch (error: any) {
            this.logger.error(`Simple chat error: ${error.message}`);
            throw error;
        }
    }
}

// Custom error classes for specific states
export class AuthRequiredError extends Error {
    constructor(public toolkit: string, message: string) {
        super(message);
        this.name = 'AuthRequiredError';
    }
}

export class ExecutionFailureError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExecutionFailureError';
    }
}
