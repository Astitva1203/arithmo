import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("arithmo_token");
    const userRaw = localStorage.getItem("arithmo_user");
    if (!token || !userRaw) return;
    try {
      set({ token, user: JSON.parse(userRaw) });
    } catch {
      localStorage.removeItem("arithmo_token");
      localStorage.removeItem("arithmo_user");
    }
  },
  login: ({ token, user }) => {
    localStorage.setItem("arithmo_token", token);
    localStorage.setItem("arithmo_user", JSON.stringify(user));
    set({ token, user });
  },
  updateUser: (partial) =>
    set((state) => {
      const nextUser = state.user ? { ...state.user, ...partial } : state.user;
      if (nextUser) localStorage.setItem("arithmo_user", JSON.stringify(nextUser));
      return { user: nextUser };
    }),
  logout: () => {
    localStorage.removeItem("arithmo_token");
    localStorage.removeItem("arithmo_user");
    set({ token: null, user: null });
  }
}));
