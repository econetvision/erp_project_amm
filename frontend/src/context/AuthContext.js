import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem("erp_auth");
    return stored ? JSON.parse(stored) : null;
  });

  function login(data) {
    localStorage.setItem("erp_auth", JSON.stringify(data));
    setAuth(data);
  }

  function logout() {
    localStorage.removeItem("erp_auth");
    setAuth(null);
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
