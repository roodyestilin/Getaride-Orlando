const BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/api`;

let memToken: string | null = null;

export function setToken(t: string | null) {
  memToken = t;
  if (typeof window !== "undefined") {
    if (t) window.localStorage.setItem("gr_token", t);
    else window.localStorage.removeItem("gr_token");
  }
}

export function getToken(): string | null {
  if (memToken) return memToken;
  if (typeof window !== "undefined") {
    memToken = window.localStorage.getItem("gr_token");
  }
  return memToken;
}

type Opts = { method?: string; body?: any; token?: string | null };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const token = opts.token ?? getToken();
  const res = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
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
