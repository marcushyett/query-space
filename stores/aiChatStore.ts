import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  // For assistant messages
  sql?: string;
  previousSql?: string;
  explanation?: string;
  error?: string;
}

interface AiChatStore {
  // Chat state
  messages: ChatMessage[];
  isOpen: boolean;
  isGenerating: boolean;
  currentSql: string | null;

  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  addUserMessage: (content: string) => string;
  addAssistantMessage: (message: Omit<ChatMessage, 'id' | 'role' | 'timestamp'>) => void;
  updateLastAssistantMessage: (update: Partial<ChatMessage>) => void;
  setCurrentSql: (sql: string | null) => void;
  setIsGenerating: (generating: boolean) => void;
  clearChat: () => void;
  startNewConversation: () => void;
}

export const useAiChatStore = create<AiChatStore>((set) => ({
  messages: [],
  isOpen: false,
  isGenerating: false,
  currentSql: null,

  setOpen: (open: boolean) => {
    set({ isOpen: open });
  },

  toggleOpen: () => {
    set((state) => ({ isOpen: !state.isOpen }));
  },

  addUserMessage: (content: string) => {
    const id = `user-${Date.now()}`;
    const message: ChatMessage = {
      id,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, message],
    }));
    return id;
  },

  addAssistantMessage: (message) => {
    const assistantMessage: ChatMessage = {
      ...message,
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, assistantMessage],
      currentSql: message.sql || state.currentSql,
    }));
  },

  updateLastAssistantMessage: (update) => {
    set((state) => {
      const messages = [...state.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          messages[i] = { ...messages[i], ...update };
          break;
        }
      }
      return {
        messages,
        currentSql: update.sql || state.currentSql,
      };
    });
  },

  setCurrentSql: (sql: string | null) => {
    set({ currentSql: sql });
  },

  setIsGenerating: (generating: boolean) => {
    set({ isGenerating: generating });
  },

  clearChat: () => {
    set({ messages: [], currentSql: null });
  },

  startNewConversation: () => {
    set({ messages: [], currentSql: null, isGenerating: false });
  },
}));
