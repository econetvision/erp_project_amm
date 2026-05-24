import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { updateProfile } from "../api/authApi";

export interface ThemePreference {
  mode: "light" | "dark" | "custom";
  primaryColor: string;
  accentColor: string;
}

const DEFAULT_THEME: ThemePreference = { mode: "light", primaryColor: "#0d6efd", accentColor: "#4ea8e8" };

interface ThemeContextType {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  saveTheme: (t: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

function applyTheme(t: ThemePreference) {
  const html = document.documentElement;
  if (t.mode === "dark") {
    html.setAttribute("data-bs-theme", "dark");
  } else {
    html.removeAttribute("data-bs-theme");
  }
  if (t.mode === "custom") {
    html.style.setProperty("--bs-primary", t.primaryColor);
    html.style.setProperty("--bs-primary-rgb", hexToRgb(t.primaryColor));
    html.style.setProperty("--erp-accent", t.accentColor);
  } else {
    html.style.removeProperty("--bs-primary");
    html.style.removeProperty("--bs-primary-rgb");
    html.style.removeProperty("--erp-accent");
  }
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();

  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem("erp_theme");
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    if (auth?.theme_preference) {
      const t = { ...DEFAULT_THEME, ...auth.theme_preference } as ThemePreference;
      setThemeState(t);
      localStorage.setItem("erp_theme", JSON.stringify(t));
    }
  }, [auth]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(t: ThemePreference) {
    setThemeState(t);
    localStorage.setItem("erp_theme", JSON.stringify(t));
    applyTheme(t);
  }

  async function saveTheme(t: ThemePreference) {
    setTheme(t);
    if (auth) {
      try {
        await updateProfile({ theme_preference: t });
      } catch { /* silently fail — theme still applied locally */ }
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, saveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
