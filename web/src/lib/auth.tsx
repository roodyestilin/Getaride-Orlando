"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: any) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setLoading(false);
      return;
    }
    try {
      const { user } = await api<{ user: User }>("/auth/me");
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (payload: any) => {
    const { token, user } = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: payload,
    });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api<{ user: User }>("/auth/me");
      setUser(user);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
