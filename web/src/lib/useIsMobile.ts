"use client";

import { useEffect, useState } from "react";

/** Returns true when viewport width is below the breakpoint (default 1024 = Tailwind lg). */
export function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(`(max-width:${breakpoint - 1}px)`);
    const on = () => setIsMobile(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [breakpoint]);
  return isMobile;
}
