import { create } from "zustand";
import type { PadKey, Region, Slice } from "@sampla/shared";
import {
  deleteSlice,
  deleteSlicesForTrack,
  loadAllSlices,
  putSlice,
} from "./persistence.js";

const PAD_ORDER: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

interface SlicesState {
  hydrated: boolean;
  byTrack: Record<string, Slice[]>;
  hydrate: () => Promise<void>;
  addSlice: (trackId: string, region: Region) => Promise<Slice | null>;
  removeSlice: (trackId: string, sliceId: string) => Promise<void>;
  setPlayThrough: (trackId: string, sliceId: string, value: boolean) => Promise<void>;
  clearForTrack: (trackId: string) => Promise<void>;
}

const nextPad = (existing: Slice[]): PadKey | null => {
  const used = new Set(existing.map((s) => s.padKey));
  return PAD_ORDER.find((p) => !used.has(p)) ?? null;
};

const randomId = (): string =>
  crypto.randomUUID?.() ??
  `sl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const sortByPad = (arr: Slice[]): Slice[] =>
  [...arr].sort((a, b) => PAD_ORDER.indexOf(a.padKey) - PAD_ORDER.indexOf(b.padKey));

export const useSlices = create<SlicesState>((set, get) => ({
  hydrated: false,
  byTrack: {},
  hydrate: async () => {
    if (get().hydrated) return;
    const all = await loadAllSlices();
    const byTrack: Record<string, Slice[]> = {};
    for (const s of all) {
      let arr = byTrack[s.trackId];
      if (!arr) {
        arr = [];
        byTrack[s.trackId] = arr;
      }
      arr.push(s);
    }
    for (const [k, arr] of Object.entries(byTrack)) byTrack[k] = sortByPad(arr);
    set({ byTrack, hydrated: true });
  },
  addSlice: async (trackId, region) => {
    const existing = get().byTrack[trackId] ?? [];
    const padKey = nextPad(existing);
    if (!padKey) return null;
    const slice: Slice = {
      id: randomId(),
      trackId,
      region,
      gain: 1,
      padKey,
      createdAt: new Date().toISOString(),
    };
    await putSlice(slice);
    set((s) => ({
      byTrack: {
        ...s.byTrack,
        [trackId]: sortByPad([...(s.byTrack[trackId] ?? []), slice]),
      },
    }));
    return slice;
  },
  removeSlice: async (trackId, sliceId) => {
    await deleteSlice(sliceId);
    set((s) => ({
      byTrack: {
        ...s.byTrack,
        [trackId]: (s.byTrack[trackId] ?? []).filter((x) => x.id !== sliceId),
      },
    }));
  },
  setPlayThrough: async (trackId, sliceId, value) => {
    const current = (get().byTrack[trackId] ?? []).find((x) => x.id === sliceId);
    if (!current) return;
    const updated: Slice = { ...current, playThrough: value };
    await putSlice(updated);
    set((s) => ({
      byTrack: {
        ...s.byTrack,
        [trackId]: (s.byTrack[trackId] ?? []).map((x) => (x.id === sliceId ? updated : x)),
      },
    }));
  },
  clearForTrack: async (trackId) => {
    await deleteSlicesForTrack(trackId);
    set((s) => {
      const next = { ...s.byTrack };
      delete next[trackId];
      return { byTrack: next };
    });
  },
}));

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
