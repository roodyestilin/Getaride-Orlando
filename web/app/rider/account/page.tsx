"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { Card, Avatar, Button, Input, Label } from "@/src/components/ui";
import { Star, Phone, Mail, LogOut } from "lucide-react";

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
}

export default function AccountPage() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function savePhone() {
    setSaving(true); setMsg("");
    try { await api("/me", { method: "PATCH", body: { phone } }); await refresh(); setMsg("Saved!"); }
    catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const photo = await fileToBase64(file);
    try { await api("/me", { method: "PATCH", body: { photo } }); await refresh(); } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Account</h1>
      <Card className="flex items-center gap-4 p-5">
        <label className="cursor-pointer">
          <Avatar src={user?.photo} name={user?.name} size={72} />
          <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
        </label>
        <div>
          <p className="text-xl font-bold">{user?.name}</p>
          <p className="flex items-center gap-1 text-sm text-ink-muted"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {user?.rating?.toFixed(1) ?? "5.0"}</p>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-ink-muted" /> {user?.email}</div>
        <div>
          <Label>Phone</Label>
          <div className="flex gap-2">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(407) 555-0100" />
            <Button loading={saving} onClick={savePhone}>Save</Button>
          </div>
          {msg && <p className="mt-1 text-sm text-ink-muted">{msg}</p>}
        </div>
      </Card>

      <Button variant="light" className="w-full text-danger" onClick={() => { logout(); router.push("/"); }}>
        <LogOut className="h-4 w-4" /> Log out
      </Button>
    </div>
  );
}
