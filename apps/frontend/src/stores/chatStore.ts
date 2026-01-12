import { create } from 'zustand';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    workflowId?: string;
    metadata?: any;
    createdAt: Date;
}

interface ChatState {
    messages: Message[];
    isLoading: boolean;
    currentWorkflowId: string | null;
    addMessage: (message: Omit<Message, 'id' | 'createdAt'>) => void;
    setLoading: (loading: boolean) => void;
    setCurrentWorkflowId: (id: string | null) => void;
    clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    isLoading: false,
    currentWorkflowId: null,

    addMessage: (message) =>
        set((state) => ({
            messages: [
                ...state.messages,
                {
                    ...message,
                    id: crypto.randomUUID(),
                    createdAt: new Date(),
                },
            ],
        })),

    setLoading: (isLoading) => set({ isLoading }),
    setCurrentWorkflowId: (currentWorkflowId) => set({ currentWorkflowId }),
    clearMessages: () => set({ messages: [], currentWorkflowId: null }),
}));
