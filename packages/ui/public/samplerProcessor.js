// AudioWorklet processor for low-latency sample playback.
// Runs on the audio thread; receives PCM data + triggers via port messages.

class SamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    /** @type {Map<string, Float32Array[]>} */
    this.tracks = new Map();
    /** @type {Array<{
     *  channels: Float32Array[],
     *  pos: number, end: number, gain: number,
     *  attackFrames: number, attackPos: number,
     *  choking: boolean, chokeFrames: number, chokePos: number,
     *  playThrough: boolean,
     * }>}
     */
    this.voices = [];
    this.port.onmessage = (e) => this._onMsg(e.data);
    this.port.postMessage({ type: "ready" });
  }

  _onMsg(msg) {
    switch (msg.type) {
      case "load":
        this.tracks.set(msg.trackId, msg.channels);
        break;
      case "unload":
        this.tracks.delete(msg.trackId);
        break;
      case "trigger":
        this._trigger(msg);
        break;
      case "stopAll":
        this._chokeAll();
        break;
      default:
        break;
    }
  }

  _chokeAll() {
    const chokeFrames = Math.max(1, Math.round(sampleRate * 0.008));
    for (const v of this.voices) {
      if (!v.choking) {
        v.choking = true;
        v.chokeFrames = chokeFrames;
        v.chokePos = 0;
      }
    }
  }

  // Called on trigger: only chokes voices that opted into being interrupted.
  // Voices with playThrough=true keep sounding until they hit their region end.
  _chokeInterruptible() {
    const chokeFrames = Math.max(1, Math.round(sampleRate * 0.008));
    for (const v of this.voices) {
      if (v.playThrough || v.choking) continue;
      v.choking = true;
      v.chokeFrames = chokeFrames;
      v.chokePos = 0;
    }
  }

  _trigger({ trackId, startFrame, endFrame, gain, playThrough }) {
    const channels = this.tracks.get(trackId);
    if (!channels || !channels[0]) return;
    // Choke any currently sounding voice that hasn't opted into play-through
    // before starting the new one.
    this._chokeInterruptible();
    const len = channels[0].length;
    this.voices.push({
      channels,
      pos: Math.max(0, Math.floor(startFrame)),
      end: Math.min(len, Math.floor(endFrame)),
      gain: typeof gain === "number" ? gain : 1,
      attackFrames: Math.max(1, Math.round(sampleRate * 0.003)),
      attackPos: 0,
      choking: false,
      chokeFrames: 0,
      chokePos: 0,
      playThrough: !!playThrough,
    });
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const N = out[0].length;
    const outL = out[0];
    const outR = out[1] || out[0];
    const stereoOut = out.length > 1;
    for (let i = 0; i < N; i++) {
      outL[i] = 0;
      if (stereoOut) outR[i] = 0;
    }
    for (let vi = 0; vi < this.voices.length; vi++) {
      const v = this.voices[vi];
      const ch0 = v.channels[0];
      const ch1 = v.channels[1] || v.channels[0];
      for (let i = 0; i < N; i++) {
        if (v.pos >= v.end) break;
        let g = v.gain;
        if (v.attackPos < v.attackFrames) {
          g *= v.attackPos / v.attackFrames;
          v.attackPos++;
        }
        if (v.choking) {
          const r = 1 - v.chokePos / v.chokeFrames;
          g *= r > 0 ? r : 0;
          v.chokePos++;
          if (v.chokePos >= v.chokeFrames) {
            v.pos = v.end;
            break;
          }
        }
        outL[i] += ch0[v.pos] * g;
        if (stereoOut) outR[i] += ch1[v.pos] * g;
        v.pos++;
      }
    }
    // compact: drop finished voices
    if (this.voices.length > 0) {
      let w = 0;
      for (let r = 0; r < this.voices.length; r++) {
        if (this.voices[r].pos < this.voices[r].end) this.voices[w++] = this.voices[r];
      }
      this.voices.length = w;
    }
    return true;
  }
}

registerProcessor("sampler", SamplerProcessor);
