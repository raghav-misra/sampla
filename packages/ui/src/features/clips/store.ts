import type { Clip } from "@sampla/shared";
import { create } from "zustand";
import { deleteClip, loadAllClips, putClip } from "./persistence.js";

const randomId = (): string =>
  crypto.randomUUID?.() ??
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

interface ClipsState {
  hydrated: boolean;
  byTrack: Record<string, Clip[]>;
  selectedClipId: string | null;
  hydrate: () => Promise<void>;
  addClip: (trackId: string, recordingId: string, startMs: number) => Promise<Clip>;
  moveClip: (trackId: string, clipId: string, startMs: number) => Promise<void>;
  removeClip: (trackId: string, clipId: string) => Promise<void>;
  removeForRecording: (recordingId: string) => Promise<void>;
  selectClip: (id: string | null) => void;
}

const sortClips = (clips: Clip[]): Clip[] =>
  [...clips].sort((a, b) => a.startMs - b.startMs || a.createdAt.localeCompare(b.createdAt));

export const useClips = create<ClipsState>((set, get) => ({
  hydrated: false,
  byTrack: {},
  selectedClipId: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const clips = await loadAllClips();
    const byTrack: Record<string, Clip[]> = {};
    for (const clip of clips) {
      byTrack[clip.trackId] = [...(byTrack[clip.trackId] ?? []), clip];
    }
    for (const [trackId, trackClips] of Object.entries(byTrack)) {
      byTrack[trackId] = sortClips(trackClips);
    }
    set({ hydrated: true, byTrack });
  },

  addClip: async (trackId, recordingId, startMs) => {
    const clip: Clip = {
      id: randomId(),
      trackId,
      recordingId,
      startMs: Math.max(0, startMs),
      createdAt: new Date().toISOString(),
    };
    await putClip(clip);
    set((state) => ({
      byTrack: {
        ...state.byTrack,
        [trackId]: sortClips([...(state.byTrack[trackId] ?? []), clip]),
      },
      selectedClipId: clip.id,
    }));
    return clip;
  },

  moveClip: async (trackId, clipId, startMs) => {
    const clip = (get().byTrack[trackId] ?? []).find((candidate) => candidate.id === clipId);
    if (!clip) return;
    const updated = { ...clip, startMs: Math.max(0, startMs) };
    await putClip(updated);
    set((state) => ({
      byTrack: {
        ...state.byTrack,
        [trackId]: sortClips(
          (state.byTrack[trackId] ?? []).map((candidate) =>
            candidate.id === clipId ? updated : candidate,
          ),
        ),
      },
    }));
  },

  removeClip: async (trackId, clipId) => {
    await deleteClip(clipId);
    set((state) => ({
      byTrack: {
        ...state.byTrack,
        [trackId]: (state.byTrack[trackId] ?? []).filter((clip) => clip.id !== clipId),
      },
      selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
    }));
  },

  removeForRecording: async (recordingId) => {
    const clips = Object.values(get().byTrack)
      .flat()
      .filter((clip) => clip.recordingId === recordingId);
    await Promise.all(clips.map((clip) => deleteClip(clip.id)));
    const removed = new Set(clips.map((clip) => clip.id));
    set((state) => ({
      byTrack: Object.fromEntries(
        Object.entries(state.byTrack).map(([trackId, trackClips]) => [
          trackId,
          trackClips.filter((clip) => !removed.has(clip.id)),
        ]),
      ),
      selectedClipId:
        state.selectedClipId && removed.has(state.selectedClipId)
          ? null
          : state.selectedClipId,
    }));
  },

  selectClip: (selectedClipId) => set({ selectedClipId }),
}));