import type { Region } from "@sampla/shared";
import { api } from "../../lib/api.js";

const WORKLET_URL = "/samplerProcessor.js";

class SampleEngine {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private workletLoading: Promise<void> | null = null;
  private tracksLoaded = new Set<string>();
  private tracksLoading = new Map<string, Promise<void>>();
  private trackSampleRate = 0;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  // Warm the audio graph + kick off worklet load on first user gesture so the
  // very first trigger doesn't pay startup latency.
  primeContext(): void {
    const ctx = this.ensureContext();
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(ctx.destination);
    src.start(0);
    void this.ensureWorklet();
  }

  private ensureWorklet(): Promise<void> {
    if (this.node) return Promise.resolve();
    if (this.workletLoading) return this.workletLoading;
    const ctx = this.ensureContext();
    this.workletLoading = (async () => {
      await ctx.audioWorklet.addModule(WORKLET_URL);
      const node = new AudioWorkletNode(ctx, "sampler", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      node.connect(ctx.destination);
      this.node = node;
    })();
    return this.workletLoading;
  }

  isReady(trackId: string): boolean {
    return this.tracksLoaded.has(trackId);
  }

  async loadTrack(trackId: string): Promise<void> {
    if (this.tracksLoaded.has(trackId)) return;
    const existing = this.tracksLoading.get(trackId);
    if (existing) return existing;
    const p = (async () => {
      const ctx = this.ensureContext();
      await this.ensureWorklet();
      const res = await fetch(api.audioUrl(trackId));
      if (!res.ok) throw new Error(`audio fetch ${res.status}`);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      const nCh = Math.min(2, buf.numberOfChannels);
      const channels: Float32Array[] = [];
      const transfers: ArrayBuffer[] = [];
      for (let c = 0; c < nCh; c++) {
        const src = buf.getChannelData(c);
        const copy = new Float32Array(src.length);
        copy.set(src);
        channels.push(copy);
        transfers.push(copy.buffer);
      }
      this.trackSampleRate = ctx.sampleRate;
      this.node!.port.postMessage({ type: "load", trackId, channels }, transfers);
      this.tracksLoaded.add(trackId);
      this.tracksLoading.delete(trackId);
    })();
    this.tracksLoading.set(trackId, p);
    return p;
  }

  play(trackId: string, region: Region, gain = 1, playThrough = false): void {
    if (!this.node || !this.tracksLoaded.has(trackId)) return;
    const sr = this.trackSampleRate || this.ctx?.sampleRate || 48000;
    const startFrame = Math.max(0, Math.floor(region.startSec * sr));
    const endFrame = Math.max(startFrame, Math.floor(region.endSec * sr));
    this.node.port.postMessage({
      type: "trigger",
      trackId,
      startFrame,
      endFrame,
      gain,
      playThrough,
    });
  }

  releaseTrack(trackId: string): void {
    this.tracksLoaded.delete(trackId);
    if (this.node) this.node.port.postMessage({ type: "unload", trackId });
  }
}

export const sampleEngine = new SampleEngine();
