// Tiny WebAudio synth — no audio assets needed.
// All sounds are generated procedurally so the app stays dependency-free
// and works offline. Respects the user's sound toggle + browser autoplay rules.

const STORAGE_KEY = "mc.sound-enabled.v1";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // ignore
  }
}

interface ToneOpts {
  freq: number;
  endFreq?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, endFreq, duration = 0.12, type = "sine", gain = 0.08, delay = 0 }: ToneOpts) {
  const ac = getCtx();
  if (!ac || !isSoundEnabled()) return;
  try {
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch {
    // best-effort only
  }
}

/** Soft UI click for any button. */
export function playClick() {
  tone({ freq: 660, endFreq: 880, duration: 0.07, type: "sine", gain: 0.05 });
}

/** Whoosh when the user sends a message. */
export function playSend() {
  tone({ freq: 480, endFreq: 920, duration: 0.16, type: "sine", gain: 0.07 });
  tone({ freq: 960, duration: 0.06, type: "triangle", gain: 0.03, delay: 0.08 });
}

/** Gentle "thinking" blip while the agent works. Call on interval. */
export function playThinkingTick(step = 0) {
  const scale = [520, 620, 740];
  tone({ freq: scale[step % scale.length], duration: 0.09, type: "sine", gain: 0.035 });
}

/** Ding when the AI reply / draft is ready. */
export function playReceive() {
  tone({ freq: 740, duration: 0.1, type: "sine", gain: 0.07 });
  tone({ freq: 1108, duration: 0.16, type: "sine", gain: 0.06, delay: 0.09 });
}

/** Happy chime when something is saved. */
export function playSuccess() {
  tone({ freq: 620, duration: 0.1, type: "triangle", gain: 0.07 });
  tone({ freq: 830, duration: 0.1, type: "triangle", gain: 0.07, delay: 0.09 });
  tone({ freq: 1240, duration: 0.18, type: "sine", gain: 0.06, delay: 0.18 });
}

/** Low buzz on errors. */
export function playError() {
  tone({ freq: 220, endFreq: 150, duration: 0.22, type: "sawtooth", gain: 0.045 });
}

/** Pop when the assistant sheet opens. */
export function playPop() {
  tone({ freq: 380, endFreq: 720, duration: 0.12, type: "triangle", gain: 0.06 });
}

/** Mic start beep. */
export function playListenStart() {
  tone({ freq: 880, duration: 0.08, type: "sine", gain: 0.06 });
}
