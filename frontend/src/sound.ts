import { Platform } from "react-native";

let ctx: any = null;

function getCtx(): any {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/**
 * Unlock the audio context on a user gesture (e.g. tapping "Go Online").
 * Mobile browsers block audio until this happens.
 */
export function unlockSound() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
}

/** A catchy ascending 3-note chime to announce a new ride request. */
export function playRequestChime() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  const now = c.currentTime;
  const notes = [
    { f: 987.77, t: 0 },     // B5
    { f: 1318.51, t: 0.11 }, // E6
    { f: 1760.0, t: 0.22 },  // A6
  ];
  notes.forEach(({ f, t }) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    const start = now + t;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.24);
  });
}
