import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { router } from "expo-router";
import { api, setToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "customer" | "driver";
  phone?: string | null;
  photo?: string | null;
  rating?: number;
  vehicle?: string | null;
  plate?: string | null;
  date_of_birth?: string | null;
  created_at?: number;
  approval_status?: "pending" | "approved" | "declined" | "deactivated";
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: any) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export const useAuth = () => useContext(AuthContext);

function routeForRole(role: string) {
  return role === "driver" ? "/(driver)" : "/(customer)";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string | null>("token", null);
      if (token) {
        setToken(token);
        try {
          const res = await api<{ user: User }>("/auth/me");
          setUser(res.user);
        } catch {
          await storage.secureRemove("token");
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (token: string, u: User) => {
    await storage.secureSet("token", token);
    setToken(token);
    setUser(u);
    router.replace(routeForRole(u.role) as any);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await persist(res.token, res.user);
  }, [persist]);

  const signUp = useCallback(async (payload: any) => {
    const res = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: payload,
    });
    await persist(res.token, res.user);
  }, [persist]);

  const signOut = useCallback(async () => {
    await storage.secureRemove("token");
    setToken(null);
    setUser(null);
    router.replace("/auth");
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api<{ user: User }>("/auth/me");
    setUser(res.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
