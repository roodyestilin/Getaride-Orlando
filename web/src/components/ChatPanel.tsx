"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { api } from "@/src/lib/api";
import { useInterval } from "@/src/lib/useInterval";
import { Button } from "./ui";

interface Msg { id: string; sender_role: string; sender_name: string; text: string; at: number }

export default function ChatPanel({ rideId, meRole, height = 340 }: { rideId: string; meRole: string; height?: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { messages } = await api<{ messages: Msg[] }>(`/rides/${rideId}/messages`);
      setMsgs(messages);
    } catch { /* ignore */ }
  }, [rideId]);

  useEffect(() => { load(); }, [load]);
  useInterval(load, 3000);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    setText("");
    try {
      await api(`/rides/${rideId}/messages`, { method: "POST", body: { text: t } });
      await load();
    } catch { setText(t); } finally { setSending(false); }
  }

  return (
    <div className="flex flex-col">
      <div ref={scroller} style={{ height }} className="space-y-2 overflow-y-auto rounded-xl bg-surface-alt p-3">
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-ink-muted">No messages yet. Say hello!</p>}
        {msgs.map((m) => {
          const mine = m.sender_role === meRole;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-brand-primary text-white" : "bg-white text-ink shadow-soft"}`}>
                {!mine && <p className="mb-0.5 text-[11px] font-bold opacity-70">{m.sender_name}</p>}
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Type a message…"
          className="h-11 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-brand-primary"
        />
        <Button size="sm" className="h-11 w-11 rounded-full p-0" loading={sending} onClick={send}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
