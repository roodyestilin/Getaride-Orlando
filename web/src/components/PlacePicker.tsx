"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { MapPin, Search, X } from "lucide-react";
import { ORLANDO_PLACES } from "@/src/lib/places";
import type { Place } from "@/src/lib/types";
import { cn } from "@/src/lib/utils";

export default function PlacePicker({
  value,
  onChange,
  placeholder = "Search destination",
  excludeAirports = true,
}: {
  value: Place | null;
  onChange: (p: Place | null) => void;
  placeholder?: string;
  excludeAirports?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const base = excludeAirports ? ORLANDO_PLACES.filter((p) => !p.airport) : ORLANDO_PLACES;
    const s = q.trim().toLowerCase();
    if (!s) return base;
    return base.filter((p) => p.label.toLowerCase().includes(s));
  }, [q, excludeAirports]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={box} className="relative">
      {value ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3">
          <MapPin className="h-4 w-4 shrink-0 text-brand-primary" />
          <span className="flex-1 truncate text-[15px] font-semibold">{value.label}</span>
          <button onClick={() => { onChange(null); setQ(""); setOpen(true); }} className="text-ink-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-ink-muted"
          />
        </div>
      )}

      {open && !value && (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lift">
          {list.length === 0 && <p className="px-4 py-3 text-sm text-ink-muted">No places found.</p>}
          {list.map((p) => (
            <button
              key={p.label}
              onClick={() => { onChange(p); setOpen(false); }}
              className={cn("flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-alt")}
            >
              <MapPin className="h-4 w-4 shrink-0 text-brand-primary" />
              <span className="text-sm font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
