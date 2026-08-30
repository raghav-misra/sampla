import { create } from "zustand";
import type { Sample } from "@sampla/shared";
import { api } from "../../lib/api.js";

interface SampleLibraryState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  samples: Sample[];
  query: string;

  refresh: () => Promise<void>;
  setQuery: (q: string) => void;
  addLocal: (sample: Sample) => void;
}

export const useSampleLibrary = create<SampleLibraryState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  samples: [],
  query: "",

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const samples = await api.listSamples();
      set({ samples, loaded: true, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setQuery: (query) => set({ query }),

  addLocal: (sample) => {
    set((s) => {
      const existing = s.samples.find((x) => x.id === sample.id);
      const merged = existing
        ? s.samples.map((x) => (x.id === sample.id ? sample : x))
        : [sample, ...s.samples];
      return { samples: merged };
    });
  },
}));

export const filteredSamples = (samples: Sample[], query: string): Sample[] => {
  const q = query.trim().toLowerCase();
  if (!q) return samples;
  return samples.filter((s) => s.title.toLowerCase().includes(q));
};
