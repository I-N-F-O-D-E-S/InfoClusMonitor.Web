import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, LoginDto } from "../types";
import { loginUser, getCurrentUser } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (dto: LoginDto) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("infodes_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("infodes_token");
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem("infodes_token");
      if (storedToken) {
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
          localStorage.setItem("infodes_user", JSON.stringify(currentUser));
        } catch {
          // Token expired or invalid
          logout();
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (dto: LoginDto) => {
    const response = await loginUser(dto);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem("infodes_token", response.token);
    localStorage.setItem("infodes_user", JSON.stringify(response.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("infodes_token");
    localStorage.removeItem("infodes_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
