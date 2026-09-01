import type { PadKey, Recording, Slice, Track } from "@sampla/shared";
import { DEFAULT_SAMPLE_LEN_SEC, formatTime } from "@sampla/shared";
import { useEffect, useRef, useState } from "react";
import { useClips } from "../clips/store.js";
import { useTransport } from "../engine/store.js";
import { useAudioEngine } from "../engine/useAudioEngine.js";
import { useSampleEngine } from "../engine/useSampleEngine.js";
import { useInstruments } from "../instruments/store.js";
import { useInstrumentSample } from "../instruments/useInstrumentSample.js";
import { RecordingEditor, RecordingsPanel } from "../recordings/RecordingsPanel.js";
import { useRecordings } from "../recordings/store.js";
import { SlicesPanel } from "../slices/SlicesPanel.js";
import { useSlices } from "../slices/store.js";
import { Waveform } from "./Waveform.js";

interface Props {
  track: Track | null;
}

const codeToPad = (code: string): PadKey | null => {
  const digit = code.startsWith("Numpad")
    ? code.slice(6)
    : code.startsWith("Digit")
      ? code.slice(5)
      : "";
  return /^\d$/.test(digit) ? (digit as PadKey) : null;
};

const isEditable = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
};

export function TrackInspector({ track }: Props) {
  const inspectorRef = useRef<HTMLElement | null>(null);
  const [instrumentFocused, setInstrumentFocused] = useState(false);
  const instrument = useInstruments((state) =>
    state.instruments.find((candidate) => candidate.id === track?.instrumentId),
  );
  const { bundle, error } = useInstrumentSample(instrument?.sampleId ?? null);
  const slices = useSlices((state) =>
    track ? state.byTrack[track.id] ?? EMPTY_SLICES : EMPTY_SLICES,
  );
  const recordings = useRecordings((state) =>
    track ? state.byTrack[track.id] ?? EMPTY_RECORDINGS : EMPTY_RECORDINGS,
  );
  const hydrateSlices = useSlices((state) => state.hydrate);
  const addSlice = useSlices((state) => state.addSlice);
  const selection = useTransport((state) =>
    track ? state.selectionByTrack[track.id] ?? null : null,
  );
  const isPlaying = useTransport(
    (state) => state.isPlaying && state.activeTrackId === track?.id,
  );
  const setSelection = useTransport((state) => state.setSelection);
  const selectedClipId = useClips((state) => state.selectedClipId);
  const selectClip = useClips((state) => state.selectClip);
  const selectedClip = useClips((state) =>
    track
      ? (state.byTrack[track.id] ?? []).find((clip) => clip.id === state.selectedClipId)
      : undefined,
  );
  const selectedRecording = recordings.find(
    (recording) => recording.id === selectedClip?.recordingId,
  );
  const sampler = useSampleEngine(instrument?.sampleId ?? null);
  const audio = useAudioEngine(track?.id ?? null, bundle?.sample ?? null);

  useEffect(() => {
    void hydrateSlices();
  }, [hydrateSlices]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      setInstrumentFocused(Boolean(inspectorRef.current?.contains(event.target as Node)));
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!track || selectedClip || !instrumentFocused) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditable(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        audio.toggle();
        return;
      }
      if (event.code === "Escape") {
        if (selectedClipId) selectClip(null);
        else setSelection(null);
        return;
      }
      if ((event.code === "Enter" || event.code === "NumpadEnter") && bundle) {
        event.preventDefault();
        const currentSelection = useTransport.getState().selectionByTrack[track.id] ?? null;
        const playhead = useTransport.getState().playheadByTrack[track.id] ?? 0;
        const region = currentSelection ?? {
          startSec: playhead,
          endSec: Math.min(bundle.sample.durationSec, playhead + DEFAULT_SAMPLE_LEN_SEC),
        };
        if (region.endSec <= region.startSec) return;
        void addSlice(track.id, region).then((created) => {
          if (created) setSelection(null);
        });
        return;
      }
      const pad = codeToPad(event.code);
      if (!pad || event.repeat) return;
      const slice = (useSlices.getState().byTrack[track.id] ?? []).find(
        (candidate) => candidate.padKey === pad,
      );
      if (slice) {
        event.preventDefault();
        sampler.play(slice);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [track, selectedClip, instrumentFocused, bundle, audio, sampler, addSlice, selectedClipId, selectClip, setSelection]);

  useEffect(() => {
    if (selectedClip) audio.pause();
  }, [selectedClip, audio]);

  if (!track) {
    return (
      <aside ref={inspectorRef} className="track-inspector">
        <SectionTitle>INSTRUMENT</SectionTitle>
        <p style={{ margin: 0, color: "#68717e", fontSize: 12 }}>
          Select a track to open its instrument.
        </p>
      </aside>
    );
  }

  if (selectedClip && selectedRecording) {
    return (
      <aside ref={inspectorRef} className="track-inspector">
        <div className="inspector-heading">
          <div>
            <SectionTitle>CLIP EDITOR</SectionTitle>
            <span>
              {(selectedClip.startMs / 1000).toFixed(2)}s on {track.name || `Track ${track.order + 1}`}
            </span>
          </div>
          <button type="button" onClick={() => selectClip(null)} title="Back to instrument">
            ←
          </button>
        </div>
        <RecordingEditor recording={selectedRecording} />
      </aside>
    );
  }

  return (
    <aside ref={inspectorRef} className="track-inspector">
      <div className="inspector-heading">
        <div style={{ minWidth: 0 }}>
          <SectionTitle>INSTRUMENT</SectionTitle>
          <strong>{bundle?.sample.title || track.name || `Track ${track.order + 1}`}</strong>
          <span>
            YouTube sampler{bundle ? ` · ${formatTime(bundle.sample.durationSec)}` : ""}
          </span>
        </div>
        {bundle && (
          <button type="button" onClick={audio.toggle} title={isPlaying ? "Pause source" : "Play source"}>
            {isPlaying ? "■" : "▶"}
          </button>
        )}
      </div>
      {error && <span style={{ color: "#ff6b6b", fontSize: 12 }}>{error}</span>}
      {bundle && (
        <Waveform
          trackId={track.id}
          sample={bundle.sample}
          peaks={bundle.peaks}
          selection={selection}
          slices={slices}
          active
          height={150}
          onFocus={() => undefined}
          onSeek={audio.seek}
          onSelect={setSelection}
        />
      )}
      {bundle && selection && (
        <span style={{ color: "#8a94a3", fontSize: 10 }}>
          {formatTime(selection.startSec)} → {formatTime(selection.endSec)} · press Enter to save
        </span>
      )}
      <SlicesPanel
        trackId={track.id}
        slices={slices}
        ready={sampler.ready}
        onTrigger={sampler.play}
      />
      <RecordingsPanel trackId={track.id} />
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: 0, fontSize: 10, color: "#8a94a3" }}>{children}</h3>;
}

const EMPTY_SLICES: Slice[] = [];
const EMPTY_RECORDINGS: Recording[] = [];