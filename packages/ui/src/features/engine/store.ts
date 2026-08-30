import { create } from "zustand";
import type { Region } from "@sampla/shared";

interface TransportState {
  // ID of the currently focused Track (row). Playback + selection apply to
  // this track. Null when no track is focused.
  activeTrackId: string | null;
  // Per-track playhead and selection. Keyed by track id.
  playheadByTrack: Record<string, number>;
  selectionByTrack: Record<string, Region | null>;
  isPlaying: boolean;

  setActiveTrackId: (id: string | null) => void;
  setPlayhead: (trackId: string, t: number) => void;
  setSelection: (r: Region | null) => void;
  setPlaying: (v: boolean) => void;
  reset: () => void;
}

export const useTransport = create<TransportState>((set, get) => ({
  activeTrackId: null,
  playheadByTrack: {},
  selectionByTrack: {},
  isPlaying: false,

  setActiveTrackId: (id) => {
    const prev = get().activeTrackId;
    if (prev === id) return;
    // Pausing playback when focus moves keeps audio from bleeding across rows.
    set({ activeTrackId: id, isPlaying: false });
  },

  setPlayhead: (trackId, t) =>
    set((s) => ({
      playheadByTrack: { ...s.playheadByTrack, [trackId]: t },
    })),

  setSelection: (selection) => {
    const id = get().activeTrackId;
    if (!id) return;
    set((s) => ({
      selectionByTrack: { ...s.selectionByTrack, [id]: selection },
    }));
  },

  setPlaying: (isPlaying) => set({ isPlaying }),

  reset: () =>
    set({
      activeTrackId: null,
      playheadByTrack: {},
      selectionByTrack: {},
      isPlaying: false,
    }),
}));

export const getPlayhead = (trackId: string): number =>
  useTransport.getState().playheadByTrack[trackId] ?? 0;

export const getSelection = (trackId: string): Region | null =>
  useTransport.getState().selectionByTrack[trackId] ?? null;
