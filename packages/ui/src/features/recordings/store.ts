import { create } from "zustand";
import type { Recording, Sample, TriggerEvent } from "@sampla/shared";
import { sampleEngine } from "../engine/sampleEngine.js";
import { useSamples } from "../samples/store.js";
import {
  deleteRecording,
  loadAllRecordings,
  putRecording,
} from "./persistence.js";

const randomId = (): string =>
  crypto.randomUUID?.() ??
  `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

interface ActiveRecording {
  id: string;
  trackId: string;
  startedAt: number; // performance.now() when arm/start happened
  events: TriggerEvent[];
}

interface PlaybackState {
  recordingId: string;
  timeouts: number[];
}

interface RecordingsState {
  hydrated: boolean;
  byTrack: Record<string, Recording[]>;
  active: ActiveRecording | null;
  playback: PlaybackState | null;

  hydrate: () => Promise<void>;
  startRecording: (trackId: string) => void;
  stopRecording: () => Promise<Recording | null>;
  cancelRecording: () => void;
  logTrigger: (sample: Sample) => void;
  removeRecording: (trackId: string, id: string) => Promise<void>;
  renameRecording: (trackId: string, id: string, name: string) => Promise<void>;
  moveEvent: (trackId: string, recordingId: string, eventIndex: number, tMs: number) => void;
  commitEventMove: (trackId: string, recordingId: string) => Promise<void>;
  playRecording: (id: string) => void;
  stopPlayback: () => void;
}

const sortRecordings = (arr: Recording[]): Recording[] =>
  [...arr].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const nextTakeName = (existing: Recording[]): string => {
  // Find the highest "Take N" number and increment; also count total takes.
  let max = 0;
  for (const r of existing) {
    const m = /^Take (\d+)$/.exec(r.name);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `Take ${Math.max(max + 1, existing.length + 1)}`;
};

export const useRecordings = create<RecordingsState>((set, get) => ({
  hydrated: false,
  byTrack: {},
  active: null,
  playback: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const all = await loadAllRecordings();
    const byTrack: Record<string, Recording[]> = {};
    for (const r of all) {
      let arr = byTrack[r.trackId];
      if (!arr) {
        arr = [];
        byTrack[r.trackId] = arr;
      }
      arr.push(r);
    }
    for (const k of Object.keys(byTrack)) byTrack[k] = sortRecordings(byTrack[k]);
    set({ byTrack, hydrated: true });
  },

  startRecording: (trackId) => {
    // Cancel any in-flight playback so its scheduled triggers do not bleed
    // into a fresh take.
    get().stopPlayback();
    set({
      active: {
        id: randomId(),
        trackId,
        startedAt: performance.now(),
        events: [],
      },
    });
  },

  stopRecording: async () => {
    const active = get().active;
    if (!active) return null;
    const endedAt = performance.now();
    set({ active: null });
    if (active.events.length === 0) return null;
    // Trim the silent lead-in: shift so the first hit lands at t=0.
    const offset = active.events[0].tMs;
    const events = active.events.map((ev) => ({ ...ev, tMs: ev.tMs - offset }));
    const durationMs = Math.max(
      endedAt - active.startedAt - offset,
      events[events.length - 1].tMs,
    );
    const existing = get().byTrack[active.trackId] ?? [];
    const recording: Recording = {
      id: active.id,
      trackId: active.trackId,
      name: nextTakeName(existing),
      events,
      durationMs,
      createdAt: new Date().toISOString(),
    };
    await putRecording(recording);
    set((s) => ({
      byTrack: {
        ...s.byTrack,
        [active.trackId]: sortRecordings([...(s.byTrack[active.trackId] ?? []), recording]),
      },
    }));
    return recording;
  },

  cancelRecording: () => set({ active: null }),

  logTrigger: (sample) => {
    const active = get().active;
    if (!active || active.trackId !== sample.trackId) return;
    const tMs = performance.now() - active.startedAt;
    set({
      active: {
        ...active,
        events: [
          ...active.events,
          { tMs, sampleId: sample.id, padKey: sample.padKey },
        ],
      },
    });
  },

  removeRecording: async (trackId, id) => {
    const pb = get().playback;
    if (pb?.recordingId === id) get().stopPlayback();
    await deleteRecording(id);
    set((s) => ({
      byTrack: {
        ...s.byTrack,
        [trackId]: (s.byTrack[trackId] ?? []).filter((r) => r.id !== id),
      },
    }));
  },

  renameRecording: async (trackId, id, name) => {
    const rec = (get().byTrack[trackId] ?? []).find((r) => r.id === id);
    if (!rec) return;
    const updated: Recording = { ...rec, name };
    await putRecording(updated);
    set((s) => ({
      byTrack: {
        ...s.byTrack,
        [trackId]: (s.byTrack[trackId] ?? []).map((r) => (r.id === id ? updated : r)),
      },
    }));
  },

  // In-memory update while the user drags a tick. Does not persist or resort
  // events (so the tick's identity/key stays stable during the drag). Duration
  // extends if the user drags past the current end.
  moveEvent: (trackId, recordingId, eventIndex, tMs) => {
    set((s) => {
      const arr = s.byTrack[trackId];
      if (!arr) return {};
      const next = arr.map((r) => {
        if (r.id !== recordingId) return r;
        const events = r.events.slice();
        const cur = events[eventIndex];
        if (!cur) return r;
        const clamped = Math.max(0, tMs);
        events[eventIndex] = { ...cur, tMs: clamped };
        return {
          ...r,
          events,
          durationMs: Math.max(r.durationMs, clamped),
        };
      });
      return { byTrack: { ...s.byTrack, [trackId]: next } };
    });
  },

  // Persist the current in-memory state of a recording and normalize event
  // order. Called on pointerup after a drag.
  commitEventMove: async (trackId, recordingId) => {
    const rec = (get().byTrack[trackId] ?? []).find((r) => r.id === recordingId);
    if (!rec) return;
    const sorted: Recording = {
      ...rec,
      events: [...rec.events].sort((a, b) => a.tMs - b.tMs),
    };
    await putRecording(sorted);
    set((s) => ({
      byTrack: {
        ...s.byTrack,
        [trackId]: (s.byTrack[trackId] ?? []).map((r) =>
          r.id === recordingId ? sorted : r,
        ),
      },
    }));
  },

  playRecording: (id) => {
    get().stopPlayback();
    const rec = Object.values(get().byTrack)
      .flat()
      .find((r) => r.id === id);
    if (!rec) return;
    const samplesByTrack = useSamples.getState().byTrack[rec.trackId] ?? [];
    const sampleById = new Map(samplesByTrack.map((s) => [s.id, s]));
    const timeouts: number[] = [];
    for (const ev of rec.events) {
      const to = window.setTimeout(() => {
        const s = sampleById.get(ev.sampleId);
        if (!s) return;
        sampleEngine.play(s.trackId, s.region, s.gain, !!s.playThrough);
      }, ev.tMs);
      timeouts.push(to);
    }
    // Auto-clear playback state once the take is over.
    const endTo = window.setTimeout(() => {
      const pb = get().playback;
      if (pb?.recordingId === id) set({ playback: null });
    }, rec.durationMs + 20);
    timeouts.push(endTo);
    set({ playback: { recordingId: id, timeouts } });
  },

  stopPlayback: () => {
    const pb = get().playback;
    if (!pb) return;
    for (const to of pb.timeouts) window.clearTimeout(to);
    set({ playback: null });
  },
}));
