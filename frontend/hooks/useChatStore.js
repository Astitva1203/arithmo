import { create } from "zustand";

export const MODES = [
  { value: "general", label: "General Assistant" },
  { value: "coding", label: "Coding Assistant" },
  { value: "study", label: "Study Helper" },
  { value: "creative", label: "Creative Mode" }
];

export const useChatStore = create((set) => ({
  chats: [],
  currentChatId: null,
  mode: "general",
  setMode: (mode) => set({ mode }),
  setChats: (chats) => set({ chats }),
  setCurrentChat: (currentChatId) => set({ currentChatId }),
  addOrUpdateChat: (chat) =>
    set((state) => {
      const idx = state.chats.findIndex((item) => item._id === chat._id);
      if (idx === -1) {
        return { chats: [chat, ...state.chats], currentChatId: chat._id };
      }
      const next = [...state.chats];
      next[idx] = chat;
      next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      return { chats: next, currentChatId: chat._id };
    }),
  removeChat: (chatId) =>
    set((state) => ({
      chats: state.chats.filter((item) => item._id !== chatId),
      currentChatId: state.currentChatId === chatId ? null : state.currentChatId
    }))
}));
