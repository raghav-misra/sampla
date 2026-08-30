import { create } from "zustand";
import type { Region, Track, Peaks } from "@sampla/shared";

interface TransportState {
  track: Track | null;
  peaks: Peaks | null;
  playhead: number; // seconds
  selection: Region | null;
  isPlaying: boolean;
  setTrack: (track: Track, peaks: Peaks) => void;
  setPlayhead: (t: number) => void;
  setSelection: (r: Region | null) => void;
  setPlaying: (v: boolean) => void;
  reset: () => void;
}

export const useTransport = create<TransportState>((set) => ({
  track: null,
  peaks: null,
  playhead: 0,
  selection: null,
  isPlaying: false,
  setTrack: (track, peaks) =>
    set({ track, peaks, playhead: 0, selection: null, isPlaying: false }),
  setPlayhead: (playhead) => set({ playhead }),
  setSelection: (selection) => set({ selection }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  reset: () =>
    set({
      track: null,
      peaks: null,
      playhead: 0,
      selection: null,
      isPlaying: false,
    }),
}));
