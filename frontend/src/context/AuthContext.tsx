import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import type { TokenResponse, AuthContextType } from "../types/auth";

const DEFAULT_LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes fallback
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousedown", "mousemove", "keydown", "scroll", "touchstart", "click",
];

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<TokenResponse | null>(() => {
    const stored = localStorage.getItem("erp_auth");
    return stored ? JSON.parse(stored) : null;
  });
  const [locked, setLocked] = useState<boolean>(() => {
    return localStorage.getItem("erp_locked") === "true";
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset the inactivity timer ──────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const timeoutMs = auth?.lock_timeout
      ? auth.lock_timeout * 60 * 1000
      : DEFAULT_LOCK_TIMEOUT_MS;
    timerRef.current = setTimeout(() => {
      // Only auto-lock if user is logged in and not already locked
      if (localStorage.getItem("erp_auth")) {
        setLocked(true);
        localStorage.setItem("erp_locked", "true");
      }
    }, timeoutMs);
  }, [auth?.lock_timeout]);

  // ── Start / stop activity listeners when auth changes ──────────────
  useEffect(() => {
    if (!auth || locked) return;

    resetTimer();

    function onActivity() {
      resetTimer();
    }

    ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, onActivity));
    };
  }, [auth, locked, resetTimer]);

  function login(data: TokenResponse) {
    localStorage.setItem("erp_auth", JSON.stringify(data));
    localStorage.removeItem("erp_locked");
    setAuth(data);
    setLocked(false);
  }

  function logout() {
    localStorage.removeItem("erp_auth");
    localStorage.removeItem("erp_locked");
    if (timerRef.current) clearTimeout(timerRef.current);
    setAuth(null);
    setLocked(false);
  }

  function lock() {
    setLocked(true);
    localStorage.setItem("erp_locked", "true");
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  function unlock() {
    setLocked(false);
    localStorage.removeItem("erp_locked");
  }

  return (
    <AuthContext.Provider value={{ auth, locked, login, logout, lock, unlock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
