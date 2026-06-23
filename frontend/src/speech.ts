import { Platform } from "react-native";
import * as Speech from "expo-speech";

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

let femaleVoice: string | undefined;
let voiceResolved = false;

async function pickFemaleVoice(): Promise<string | undefined> {
  if (voiceResolved) return femaleVoice;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const en = voices.filter((v) => (v.language || "").toLowerCase().startsWith("en"));
    const rx = /female|samantha|karen|moira|tessa|victoria|zira|fiona|serena|allison|susan|google us english|aria|jenny/i;
    const female = en.find((v) => rx.test(`${v.name || ""} ${v.identifier || ""}`));
    femaleVoice = (female || en[0])?.identifier;
  } catch {
    femaleVoice = undefined;
  }
  voiceResolved = true;
  return femaleVoice;
}

/** Speak a phrase with a friendly female voice (web/mobile). */
export async function speak(text: string) {
  unlockSpeech();
  const voice = await pickFemaleVoice();
  try {
    Speech.stop();
    Speech.speak(text, { voice, rate: 0.98, pitch: 1.08, language: "en-US" });
  } catch {
    // ignore
  }
}
