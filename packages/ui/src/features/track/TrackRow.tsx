import { useEffect, useState } from "react";
import type { Sample, Slice, Track } from "@sampla/shared";
import { DEFAULT_SAMPLE_LEN_SEC, formatTime, type PadKey } from "@sampla/shared";
import { api } from "../../lib/api.js";
import { useTransport } from "../engine/store.js";
import { useAudioEngine } from "../engine/useAudioEngine.js";
import { useSampleEngine } from "../engine/useSampleEngine.js";
import { useSlices } from "../slices/store.js";
import { SlicesPanel } from "../slices/SlicesPanel.js";
import { RecordingsPanel } from "../recordings/RecordingsPanel.js";
import { useProjects } from "../projects/store.js";
import { Waveform } from "./Waveform.js";

interface Props {
  track: Track;
}

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

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
};

// Cache of Sample+Peaks per sampleId, keyed here to avoid re-fetching across
// TrackRow re-mounts. Values are Promises so concurrent rows await the same
// fetch.
const sampleCache = new Map<
  string,
  Promise<{ sample: Sample; peaks: import("@sampla/shared").Peaks }>
>();

const fetchSampleBundle = (id: string) => {
  const existing = sampleCache.get(id);
  if (existing) return existing;
  const p = (async () => {
    const [sample, peaks] = await Promise.all([api.getSample(id), api.getPeaks(id)]);
    return { sample, peaks };
  })();
  sampleCache.set(id, p);
  return p;
};

export function TrackRow({ track }: Props) {
  const [bundle, setBundle] = useState<
    { sample: Sample; peaks: import("@sampla/shared").Peaks } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const removeTrack = useProjects((s) => s.removeTrack);

  useEffect(() => {
    let cancelled = false;
    fetchSampleBundle(track.sampleId)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [track.sampleId]);

  const active = useTransport((s) => s.activeTrackId === track.id);
  const setActiveTrack = useTransport((s) => s.setActiveTrackId);
  const setSelection = useTransport((s) => s.setSelection);
  const isPlaying = useTransport((s) => s.isPlaying && s.activeTrackId === track.id);
  const selection = useTransport((s) => s.selectionByTrack[track.id] ?? null);

  const slices = useSlices((s) => s.byTrack[track.id] ?? EMPTY);
  const addSlice = useSlices((s) => s.addSlice);
  const hydrateSlices = useSlices((s) => s.hydrate);

  const sampleEngine = useSampleEngine(bundle?.sample.id ?? null);
  const audioEngine = useAudioEngine(track.id, bundle?.sample ?? null);

  useEffect(() => {
    void hydrateSlices();
  }, [hydrateSlices]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent): void => {
      if (isEditable(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        audioEngine.toggle();
        return;
      }
      if (e.code === "Escape") {
        setSelection(null);
        return;
      }
      if ((e.code === "Enter" || e.code === "NumpadEnter") && bundle) {
        e.preventDefault();
        const sel = useTransport.getState().selectionByTrack[track.id] ?? null;
        const ph = useTransport.getState().playheadByTrack[track.id] ?? 0;
        const region = sel
          ? sel
          : {
              startSec: ph,
              endSec: Math.min(bundle.sample.durationSec, ph + DEFAULT_SAMPLE_LEN_SEC),
            };
        if (region.endSec <= region.startSec) return;
        void addSlice(track.id, region).then((created) => {
          if (created) setSelection(null);
        });
        return;
      }
      const pad = codeToPad(e.code);
      if (pad && !e.repeat) {
        const bound = (useSlices.getState().byTrack[track.id] ?? []).find(
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
  }, [active, audioEngine, setSelection, track.id, bundle, addSlice, sampleEngine]);

  const focus = (): void => setActiveTrack(track.id);

  return (
    <section
      onPointerDown={focus}
      style={{
        border: `1px solid ${active ? "#3f6b4f" : "#1a1e28"}`,
        background: "#0b0d12",
        borderRadius: 8,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: 999,
              background: active ? "#7bd88f" : "#3a3f4a",
            }}
          />
          <h2 style={{ margin: 0, fontSize: 15 }}>
            {bundle?.sample.title ?? (error ? "failed to load" : "loading…")}
          </h2>
          {bundle && (
            <span style={{ color: "#9aa3b2", fontSize: 11 }}>
              {formatTime(bundle.sample.durationSec)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {bundle && active && (
            <button
              type="button"
              onClick={audioEngine.toggle}
              style={{
                padding: "4px 10px",
                background: isPlaying ? "#ff5470" : "#7bd88f",
                color: "#0f1115",
                border: 0,
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void removeTrack(track.projectId, track.id);
            }}
            title="Remove track"
            style={{
              background: "transparent",
              border: "1px solid #2a2f3a",
              color: "#6b7280",
              cursor: "pointer",
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            ×
          </button>
        </div>
      </header>
      {error && (
        <span style={{ color: "#ff5470", fontSize: 12 }}>Failed to load: {error}</span>
      )}
      {bundle && (
        <Waveform
          trackId={track.id}
          sample={bundle.sample}
          peaks={bundle.peaks}
          selection={selection}
          slices={slices}
          active={active}
          onFocus={focus}
          onSeek={audioEngine.seek}
          onSelect={setSelection}
        />
      )}
      {bundle && selection && (
        <div style={{ fontSize: 11, color: "#9aa3b2" }}>
          selection {formatTime(selection.startSec)} → {formatTime(selection.endSec)} (
          {(selection.endSec - selection.startSec).toFixed(3)}s)
        </div>
      )}
      <SlicesPanel
        trackId={track.id}
        slices={slices as Slice[]}
        ready={sampleEngine.ready}
        onTrigger={(s) => sampleEngine.play(s)}
      />
      <RecordingsPanel trackId={track.id} />
    </section>
  );
}

const EMPTY: Slice[] = [];
