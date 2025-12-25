import { create } from 'zustand';

export interface QueryResultInfo {
  rowCount: number;
  executionTime: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  // For assistant messages
  sql?: string;
  previousSql?: string;
  explanation?: string;
  error?: string;
  // For query results
  queryResult?: QueryResultInfo;
  isAutoFix?: boolean;
}

interface AiChatStore {
  // Chat state
  messages: ChatMessage[];
  isOpen: boolean;
  isGenerating: boolean;
  currentSql: string | null;
  isAiGenerated: boolean; // Track if current SQL is AI-generated
  lastQueryError: string | null; // Track last query error for auto-fix

  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  addUserMessage: (content: string) => string;
  addAssistantMessage: (message: Omit<ChatMessage, 'id' | 'role' | 'timestamp'>) => void;
  addSystemMessage: (content: string, queryResult?: QueryResultInfo) => void;
  updateLastAssistantMessage: (update: Partial<ChatMessage>) => void;
  setCurrentSql: (sql: string | null) => void;
  setIsGenerating: (generating: boolean) => void;
  setIsAiGenerated: (isAiGenerated: boolean) => void;
  setLastQueryError: (error: string | null) => void;
  clearChat: () => void;
  startNewConversation: () => void;
}

export const useAiChatStore = create<AiChatStore>((set) => ({
  messages: [],
  isOpen: false,
  isGenerating: false,
  currentSql: null,
  isAiGenerated: false,
  lastQueryError: null,

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
      isAiGenerated: !!message.sql,
    }));
  },

  addSystemMessage: (content: string, queryResult?: QueryResultInfo) => {
    const systemMessage: ChatMessage = {
      id: `system-${Date.now()}`,
      role: 'system',
      content,
      timestamp: Date.now(),
      queryResult,
    };
    set((state) => ({
      messages: [...state.messages, systemMessage],
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

  setIsAiGenerated: (isAiGenerated: boolean) => {
    set({ isAiGenerated });
  },

  setLastQueryError: (error: string | null) => {
    set({ lastQueryError: error });
  },

  clearChat: () => {
    set({ messages: [], currentSql: null, isAiGenerated: false, lastQueryError: null });
  },

  startNewConversation: () => {
    set({ messages: [], currentSql: null, isGenerating: false, isAiGenerated: false, lastQueryError: null });
  },
}));
