import { Platform } from "react-native";

let unlocked = false;

/**
 * Mobile browsers (iOS Safari, Android Chrome) only allow speech synthesis after
 * it has been "unlocked" by a real user gesture. Call this from tap handlers
 * (e.g. accepting a ride, opening the trip screen) so that later auto-triggered
 * turn-by-turn voice announcements are allowed to play.
 */
export function unlockSpeech() {
  if (unlocked || Platform.OS !== "web") return;
  try {
    const synth: any = (globalThis as any).speechSynthesis;
    const Utter: any = (globalThis as any).SpeechSynthesisUtterance;
    if (synth && Utter) {
      const u = new Utter(" ");
      u.volume = 0;
      synth.speak(u);
      synth.resume();
      unlocked = true;
    }
  } catch {
    // ignore — speech simply won't be available
  }
}
