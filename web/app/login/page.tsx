"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/lib/auth";
import { Button, Input, Label } from "@/src/components/ui";
import { Logo } from "@/src/components/SiteHeader";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(user.role === "driver" ? "/driver" : user.role === "admin" ? "/admin" : "/rider");
  }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      router.replace(u.role === "driver" ? "/driver" : u.role === "admin" ? "/admin" : "/rider");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-brand-primary p-12 lg:flex">
        <Logo light />
        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">Welcome back to Getaride.</h1>
          <p className="mt-3 max-w-md text-lg text-white/85">Compare driver offers for your Orlando airport ride and pick the one that fits your budget.</p>
        </div>
        <p className="text-sm text-white/70">Orlando · MCO airport transfers</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-bold">Log in</h2>
          <p className="mt-1 text-ink-muted">Enter your details to continue.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{err}</p>}
            <Button type="submit" size="lg" className="w-full" loading={loading}>Log in</Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-bold text-brand-primary">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
