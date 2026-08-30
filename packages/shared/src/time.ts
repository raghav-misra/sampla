export const DEFAULT_SAMPLE_LEN_SEC = 0.25;
export const PEAKS_BUCKETS_PER_SEC = 100;

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const secToSamples = (sec: number, sampleRate: number): number =>
  Math.round(sec * sampleRate);

export const samplesToSec = (samples: number, sampleRate: number): number =>
  samples / sampleRate;

export const formatTime = (sec: number): string => {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const whole = Math.floor(rest);
  const ms = Math.floor((rest - whole) * 1000);
  return `${m}:${String(whole).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};
