import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

let memToken: string | null = null;

export function setToken(t: string | null) {
  memToken = t;
}

export async function getToken(): Promise<string | null> {
  if (memToken) return memToken;
  memToken = await storage.secureGet<string | null>("token", null);
  return memToken;
}

type Opts = {
  method?: string;
  body?: any;
  token?: string | null;
};

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const token = opts.token ?? (await getToken());
  const res = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data?.detail || "Something went wrong. Please try again.");
  }
  return data as T;
}
