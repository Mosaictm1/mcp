import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { callMcpTool } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export default function ChatPage() {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { messages, isLoading, addMessage, setLoading } = useChatStore();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userPrompt = input.trim();
        setInput('');
        addMessage({ role: 'user', content: userPrompt });
        setLoading(true);

        try {
            // Show analyzing message
            addMessage({
                role: 'assistant',
                content: '🔍 Analyzing your request...',
            });

            // Execute directly using the orchestrator
            const result = await callMcpTool('execute', { prompt: userPrompt });

            if (!result.success) {
                throw new Error(result.error);
            }

            const { analysis, result: toolResult } = result.data;

            // Build response message
            let message = '';

            if (toolResult.success) {
                message = `✅ **Success!**\n\n`;
                message += `**Action:** ${analysis.intent}\n\n`;
                message += `**Tool:** ${analysis.tool} → ${analysis.action}\n\n`;
                message += `${toolResult.message || 'Automation completed successfully.'}`;

                if (toolResult.emails) {
                    message += `\n\n**Recent Emails:**\n`;
                    toolResult.emails.forEach((email: any) => {
                        message += `- **${email.subject}** from ${email.from}\n`;
                    });
                }

                if (toolResult.channels) {
                    message += `\n\n**Channels:**\n`;
                    toolResult.channels.forEach((ch: any) => {
                        message += `- #${ch.name} (${ch.memberCount} members)\n`;
                    });
                }
            } else {
                message = `❌ **Error:** ${toolResult.error}\n\n`;

                if (toolResult.error?.includes('not connected')) {
                    message += `💡 **Tip:** Go to the Credentials page to connect your ${analysis.tool} account.`;
                }
            }

            addMessage({
                role: 'assistant',
                content: message,
            });

        } catch (error: any) {
            addMessage({
                role: 'assistant',
                content: `❌ **Error:** ${error.message}\n\nPlease try again or rephrase your request.`,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-auto space-y-4 pb-4">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center mb-6">
                            <Sparkles className="w-10 h-10 text-primary-400" />
                        </div>
                        <h2 className="text-2xl font-semibold gradient-text mb-2">
                            What would you like to automate?
                        </h2>
                        <p className="text-dark-400 max-w-md">
                            Describe your automation in plain English, and I'll execute it instantly.
                        </p>
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                            {[
                                'Send an email to test@example.com saying "Hello!"',
                                'Read my latest 5 emails',
                                'Send a message to #general on Slack',
                                'List my Slack channels',
                            ].map((example) => (
                                <button
                                    key={example}
                                    onClick={() => setInput(example)}
                                    className="p-4 glass-card text-left text-sm text-dark-300 hover:text-dark-100 hover:border-primary-500/30 transition-all"
                                >
                                    "{example}"
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <AnimatePresence>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-2xl px-4 py-3 rounded-2xl ${msg.role === 'user'
                                        ? 'bg-primary-500/20 border border-primary-500/30'
                                        : 'glass-card'
                                        }`}
                                >
                                    <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="mt-auto">
                <div className="relative gradient-border rounded-xl">
                    <div className="relative glass-card rounded-xl">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Describe what you want to automate..."
                            className="w-full px-6 py-4 bg-transparent text-dark-50 placeholder:text-dark-400 focus:outline-none pr-14"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center text-white disabled:opacity-50 transition-opacity"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
