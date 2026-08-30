import { useEffect } from "react";
import { DEFAULT_SAMPLE_LEN_SEC, formatTime, type PadKey } from "@sampla/shared";
import { useTransport } from "../engine/store.js";
import { useAudioEngine } from "../engine/useAudioEngine.js";
import { useSampleEngine } from "../engine/useSampleEngine.js";
import { useSamples } from "../samples/store.js";
import { SamplesPanel } from "../samples/SamplesPanel.js";
import { Waveform } from "./Waveform.js";

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
};

const codeToPad = (code: string): PadKey | null => {
  if (code.startsWith("Numpad")) {
    const d = code.slice(6);
    if (/^\d$/.test(d)) return d as PadKey;
  }
  if (code.startsWith("Digit")) {
    const d = code.slice(5);
    if (/^\d$/.test(d)) return d as PadKey;
  }
  return null;
};

export function TrackView() {
  const track = useTransport((s) => s.track);
  const peaks = useTransport((s) => s.peaks);
  const playhead = useTransport((s) => s.playhead);
  const selection = useTransport((s) => s.selection);
  const isPlaying = useTransport((s) => s.isPlaying);
  const setSelection = useTransport((s) => s.setSelection);
  const engine = useAudioEngine();

  const hydrate = useSamples((s) => s.hydrate);
  const addSample = useSamples((s) => s.addSample);
  const samples = useSamples((s) => (track ? s.byTrack[track.id] ?? EMPTY : EMPTY));
  const sampleEngine = useSampleEngine(track?.id ?? null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isEditable(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        engine.toggle();
        return;
      }
      if (e.code === "Escape") {
        setSelection(null);
        return;
      }
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        if (!track) return;
        e.preventDefault();
        const { selection: sel, playhead: ph } = useTransport.getState();
        const region = sel
          ? sel
          : {
              startSec: ph,
              endSec: Math.min(track.durationSec, ph + DEFAULT_SAMPLE_LEN_SEC),
            };
        if (region.endSec <= region.startSec) return;
        void addSample(track.id, region).then((created) => {
          if (created) setSelection(null);
        });
        return;
      }
      const pad = codeToPad(e.code);
      if (pad && !e.repeat && track) {
        const bound = (useSamples.getState().byTrack[track.id] ?? []).find(
          (s) => s.padKey === pad,
        );
        if (bound) {
          e.preventDefault();
          sampleEngine.play(bound);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, setSelection, track, addSample, sampleEngine]);

  if (!track || !peaks) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{track.title}</h2>
        <span style={{ color: "#9aa3b2", fontSize: 12 }}>
          {formatTime(track.durationSec)}
        </span>
      </header>
      <Waveform
        track={track}
        peaks={peaks}
        playhead={playhead}
        selection={selection}
        samples={samples}
        onSeek={engine.seek}
        onSelect={setSelection}
      />
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          color: "#c8d0dc",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
        }}
      >
        <button
          type="button"
          onClick={engine.toggle}
          style={{
            padding: "6px 12px",
            background: isPlaying ? "#ff5470" : "#7bd88f",
            color: "#0f1115",
            border: 0,
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {isPlaying ? "Pause" : "Play"} (Space)
        </button>
        <span>playhead {formatTime(playhead)}</span>
        {selection && (
          <span>
            selection {formatTime(selection.startSec)} → {formatTime(selection.endSec)} (
            {(selection.endSec - selection.startSec).toFixed(3)}s)
          </span>
        )}
      </div>
      <SamplesPanel
        trackId={track.id}
        samples={samples}
        ready={sampleEngine.ready}
        onTrigger={(s) => sampleEngine.play(s)}
      />
    </section>
  );
}

const EMPTY: never[] = [];
