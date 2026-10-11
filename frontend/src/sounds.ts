let context: AudioContext | null = null;
let enabled = localStorage.getItem("alert-sounds") !== "off";
let lastPlayed = 0;
export function soundEnabled() {
  return enabled;
}
export function setSoundEnabled(value: boolean) {
  enabled = value;
  localStorage.setItem("alert-sounds", value ? "on" : "off");
  if (value) {
    void unlockAudio().then(() => playAlert());
  }
}
export async function unlockAudio() {
  if (!enabled || !("AudioContext" in window)) return;
  try {
    context ||= new AudioContext();
    if (context.state === "suspended") await context.resume();
  } catch {
    /* Visual alerts remain available. */
  }
}
export function playAlert(error = false) {
  if (
    !enabled ||
    !context ||
    context.state !== "running" ||
    Date.now() - lastPlayed < 250
  )
    return;
  lastPlayed = Date.now();
  try {
    const start = context.currentTime;
    const tones = error ? [330, 220] : [660, 880];
    tones.forEach((frequency, index) => {
      const oscillator = context!.createOscillator(),
        gain = context!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = start + index * 0.1;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.025, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
      oscillator.connect(gain);
      gain.connect(context!.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.1);
    });
  } catch {
    /* Sound is optional and cannot block an operation. */
  }
}
