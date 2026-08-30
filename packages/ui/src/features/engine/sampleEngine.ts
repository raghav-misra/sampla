import type { Region } from "@sampla/shared";
import { api } from "../../lib/api.js";

interface TrackEntry {
  buffer: AudioBuffer | null;
  loading: Promise<AudioBuffer> | null;
}

class SampleEngine {
  private ctx: AudioContext | null = null;
  private tracks = new Map<string, TrackEntry>();

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  isReady(trackId: string): boolean {
    return this.tracks.get(trackId)?.buffer !== undefined && this.tracks.get(trackId)?.buffer !== null;
  }

  async loadTrack(trackId: string): Promise<AudioBuffer> {
    const cached = this.tracks.get(trackId);
    if (cached?.buffer) return cached.buffer;
    if (cached?.loading) return cached.loading;

    const ctx = this.ensureContext();
    const loading = (async () => {
      const res = await fetch(api.audioUrl(trackId));
      if (!res.ok) throw new Error(`audio fetch ${res.status}`);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      this.tracks.set(trackId, { buffer: buf, loading: null });
      return buf;
    })();
    this.tracks.set(trackId, { buffer: null, loading });
    return loading;
  }

  play(trackId: string, region: Region, gain = 1): void {
    const entry = this.tracks.get(trackId);
    if (!entry?.buffer) return;
    const ctx = this.ensureContext();
    const src = ctx.createBufferSource();
    src.buffer = entry.buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(ctx.destination);
    const duration = Math.max(0, region.endSec - region.startSec);
    src.start(0, region.startSec, duration);
  }

  releaseTrack(trackId: string): void {
    this.tracks.delete(trackId);
  }
}

export const sampleEngine = new SampleEngine();
