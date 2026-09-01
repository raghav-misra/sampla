import type { Instrument, Sample } from "@sampla/shared";
import { create } from "zustand";
import { loadAllInstruments, putInstrument } from "./persistence.js";

interface InstrumentsState {
  hydrated: boolean;
  instruments: Instrument[];
  hydrate: () => Promise<void>;
  ensureYouTubeSampler: (sample: Sample) => Promise<Instrument>;
}

export const youtubeInstrumentId = (sampleId: string): string => `youtube:${sampleId}`;

export const useInstruments = create<InstrumentsState>((set, get) => ({
  hydrated: false,
  instruments: [],

  hydrate: async () => {
    if (get().hydrated) return;
    const instruments = await loadAllInstruments();
    instruments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    set({ hydrated: true, instruments });
  },

  ensureYouTubeSampler: async (sample) => {
    const id = youtubeInstrumentId(sample.id);
    const existing = get().instruments.find((instrument) => instrument.id === id);
    if (existing) return existing;
    const instrument: Instrument = {
      id,
      type: "youtube-sampler",
      sampleId: sample.id,
      createdAt: sample.createdAt,
    };
    await putInstrument(instrument);
    set((state) =>
      state.instruments.some((candidate) => candidate.id === id)
        ? state
        : { instruments: [...state.instruments, instrument] },
    );
    return instrument;
  },
}));