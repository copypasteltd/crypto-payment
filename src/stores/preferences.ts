import { create } from "zustand";

type Theme = "dark" | "light";
type Language = "zh-CN" | "en-US";

function initialTheme(): Theme {
  const stored = localStorage.getItem("lingban-admin-theme");
  return stored === "light" ? "light" : "dark";
}

type PreferencesState = {
  collapsed: boolean;
  theme: Theme;
  language: Language;
  toggleCollapsed: () => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
};

export const usePreferences = create<PreferencesState>((set) => ({
  collapsed: localStorage.getItem("lingban-admin-sidebar") === "collapsed",
  theme: initialTheme(),
  language: localStorage.getItem("lingban-admin-language") === "en-US" ? "en-US" : "zh-CN",
  toggleCollapsed: () =>
    set((state) => {
      const collapsed = !state.collapsed;
      localStorage.setItem("lingban-admin-sidebar", collapsed ? "collapsed" : "expanded");
      return { collapsed };
    }),
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("lingban-admin-theme", theme);
      document.documentElement.dataset.theme = theme;
      return { theme };
    }),
  setLanguage: (language) => {
    localStorage.setItem("lingban-admin-language", language);
    set({ language });
  },
}));
