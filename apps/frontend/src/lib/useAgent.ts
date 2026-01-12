import { useMutation } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import api from './api';

// ==================== TYPES ====================

export interface AgentMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ToolCall {
    toolName: string;
    args: Record<string, any>;
}

export interface ToolResult {
    toolCallId: string;
    result: any;
}

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

export interface StreamChunk {
    type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
    content?: string;
    toolName?: string;
    toolArgs?: Record<string, any>;
    error?: string;
}

export interface ChatParams {
    messages: AgentMessage[];
    toolkits?: string[];
}

export interface AuthRequiredError {
    message: string;
    code: 'AUTH_REQUIRED';
    toolkit: string;
}

// ==================== API FUNCTIONS ====================

async function chat(params: ChatParams): Promise<AgentResponse> {
    const response = await api.post('/api/agent/chat', params);
    return response.data;
}

async function simpleChat(messages: AgentMessage[]): Promise<{ text: string }> {
    const response = await api.post('/api/agent/chat/simple', { messages });
    return response.data;
}

// ==================== HOOKS ====================

/**
 * Hook for AI agent chat with Composio tools (non-streaming)
 */
export function useAgentChat() {
    return useMutation({
        mutationFn: chat,
        onError: (error: any) => {
            // Check for auth_required state
            if (error.response?.data?.code === 'AUTH_REQUIRED') {
                console.warn(`Authentication required for: ${error.response.data.toolkit}`);
            }
        },
    });
}

/**
 * Hook for simple chat without tools
 */
export function useSimpleChat() {
    return useMutation({
        mutationFn: simpleChat,
    });
}

/**
 * Hook for streaming agent chat with Composio tools
 * Returns real-time updates as the AI generates responses
 */
export function useStreamingAgentChat() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [chunks, setChunks] = useState<StreamChunk[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [fullText, setFullText] = useState('');

    const streamChat = useCallback(async (params: ChatParams, onChunk?: (chunk: StreamChunk) => void) => {
        setIsStreaming(true);
        setChunks([]);
        setError(null);
        setFullText('');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const token = localStorage.getItem('auth_token');

        try {
            const response = await fetch(`${API_URL}/api/agent/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Stream request failed');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let accumulatedText = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            setIsStreaming(false);
                            return { text: accumulatedText };
                        }

                        try {
                            const chunk: StreamChunk = JSON.parse(data);
                            setChunks(prev => [...prev, chunk]);
                            onChunk?.(chunk);

                            if (chunk.type === 'text' && chunk.content) {
                                accumulatedText += chunk.content;
                                setFullText(accumulatedText);
                            }

                            if (chunk.type === 'error') {
                                setError(chunk.error || 'Unknown error');
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }

            setIsStreaming(false);
            return { text: accumulatedText };

        } catch (err: any) {
            setError(err.message);
            setIsStreaming(false);
            throw err;
        }
    }, []);

    const reset = useCallback(() => {
        setChunks([]);
        setError(null);
        setFullText('');
    }, []);

    return {
        streamChat,
        isStreaming,
        chunks,
        fullText,
        error,
        reset,
    };
}

/**
 * Conversation manager hook
 * Manages a multi-turn conversation with the AI agent
 */
export function useAgentConversation() {
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const agentChat = useAgentChat();

    const sendMessage = useCallback(async (content: string, toolkits?: string[]) => {
        const userMessage: AgentMessage = { role: 'user', content };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const response = await agentChat.mutateAsync({
                messages: newMessages,
                toolkits,
            });

            const assistantMessage: AgentMessage = {
                role: 'assistant',
                content: response.text,
            };

            setMessages(prev => [...prev, assistantMessage]);
            return response;
        } catch (error: any) {
            // Handle auth required
            if (error.response?.data?.code === 'AUTH_REQUIRED') {
                const assistantMessage: AgentMessage = {
                    role: 'assistant',
                    content: `I need you to connect your ${error.response.data.toolkit} account first. Please go to the Credentials page to connect.`,
                };
                setMessages(prev => [...prev, assistantMessage]);
            } else {
                const assistantMessage: AgentMessage = {
                    role: 'assistant',
                    content: `I encountered an error: ${error.message || 'Something went wrong'}`,
                };
                setMessages(prev => [...prev, assistantMessage]);
            }
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [messages, agentChat]);

    const addSystemMessage = useCallback((content: string) => {
        const systemMessage: AgentMessage = { role: 'system', content };
        setMessages(prev => [systemMessage, ...prev.filter(m => m.role !== 'system')]);
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return {
        messages,
        isLoading,
        sendMessage,
        addSystemMessage,
        clearMessages,
        authError: agentChat.error?.response?.data?.code === 'AUTH_REQUIRED'
            ? agentChat.error.response.data
            : null,
    };
}
