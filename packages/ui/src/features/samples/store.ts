import { create } from "zustand";
import type { PadKey, Region, Sample } from "@sampla/shared";
import { deleteSample, loadAllSamples, putSample } from "./persistence.js";

const PAD_ORDER: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

interface SamplesState {
  hydrated: boolean;
  byTrack: Record<string, Sample[]>;
  hydrate: () => Promise<void>;
  addSample: (trackId: string, region: Region) => Promise<Sample | null>;
  removeSample: (trackId: string, sampleId: string) => Promise<void>;
  setPlayThrough: (trackId: string, sampleId: string, value: boolean) => Promise<void>;
  clearForTrack: (trackId: string) => Sample[];
}

const nextPad = (existing: Sample[]): PadKey | null => {
  const used = new Set(existing.map((s) => s.padKey));
  return PAD_ORDER.find((p) => !used.has(p)) ?? null;
};

const randomId = (): string =>
  crypto.randomUUID?.() ??
  `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const useSamples = create<SamplesState>((set, get) => ({
  hydrated: false,
  byTrack: {},
  hydrate: async () => {
    if (get().hydrated) return;
    const all = await loadAllSamples();
    const byTrack: Record<string, Sample[]> = {};
    for (const s of all) {
      const arr = byTrack[s.trackId] ?? (byTrack[s.trackId] = []);
      arr.push(s);
    }
    for (const arr of Object.values(byTrack)) {
      arr.sort((a, b) => PAD_ORDER.indexOf(a.padKey) - PAD_ORDER.indexOf(b.padKey));
    }
    set({ byTrack, hydrated: true });
  },
  addSample: async (trackId, region) => {
    const existing = get().byTrack[trackId] ?? [];
    const padKey = nextPad(existing);
    if (!padKey) return null;
    const sample: Sample = {
      id: randomId(),
      trackId,
      region,
      gain: 1,
      padKey,
      createdAt: new Date().toISOString(),
    };
    await putSample(sample);
    set((s) => {
      const arr = [...(s.byTrack[trackId] ?? []), sample].sort(
        (a, b) => PAD_ORDER.indexOf(a.padKey) - PAD_ORDER.indexOf(b.padKey),
      );
      return { byTrack: { ...s.byTrack, [trackId]: arr } };
    });
    return sample;
  },
  removeSample: async (trackId, sampleId) => {
    await deleteSample(sampleId);
    set((s) => {
      const arr = (s.byTrack[trackId] ?? []).filter((x) => x.id !== sampleId);
      return { byTrack: { ...s.byTrack, [trackId]: arr } };
    });
  },
  setPlayThrough: async (trackId, sampleId, value) => {
    const current = (get().byTrack[trackId] ?? []).find((x) => x.id === sampleId);
    if (!current) return;
    const updated: Sample = { ...current, playThrough: value };
    await putSample(updated);
    set((s) => {
      const arr = (s.byTrack[trackId] ?? []).map((x) => (x.id === sampleId ? updated : x));
      return { byTrack: { ...s.byTrack, [trackId]: arr } };
    });
  },
  clearForTrack: (trackId) => get().byTrack[trackId] ?? [],
}));

export const samplesForTrack = (trackId: string | null): Sample[] => {
  if (!trackId) return [];
  return useSamples.getState().byTrack[trackId] ?? [];
};

export const padPalette = (padKey: PadKey): string => {
  const idx = PAD_ORDER.indexOf(padKey);
  return PAD_COLORS[idx] ?? "#7bd88f";
};

const PAD_COLORS = [
  "#7bd88f",
  "#f7b53a",
  "#5aaef2",
  "#c58af9",
  "#ff5470",
  "#79e3d1",
  "#a3d977",
  "#ffb86c",
  "#8e9dff",
  "#f97376",
];

export { PAD_ORDER };
