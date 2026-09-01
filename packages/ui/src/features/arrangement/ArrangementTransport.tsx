import type { Track } from "@sampla/shared";
import { useEffect, useRef } from "react";
import { useClips } from "../clips/store.js";
import { sampleEngine } from "../engine/sampleEngine.js";
import { useTransport } from "../engine/store.js";
import { useInstruments } from "../instruments/store.js";
import { useRecordings } from "../recordings/store.js";
import { useSlices } from "../slices/store.js";

interface Props {
  tracks: Track[];
  durationMs: number;
}

export function ArrangementTransport({ tracks, durationMs }: Props) {
  const playheadMs = useTransport((state) => state.arrangementPlayheadMs);
  const playing = useTransport((state) => state.arrangementPlaying);
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const playbackTokenRef = useRef(0);

  const stopScheduled = (): void => {
    playbackTokenRef.current += 1;
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const pause = (): void => {
    stopScheduled();
    useTransport.getState().setArrangementPlaying(false);
  };

  const play = async (): Promise<void> => {
    stopScheduled();
    const playbackToken = playbackTokenRef.current;
    const state = useTransport.getState();
    const startAtMs = state.arrangementPlayheadMs >= durationMs ? 0 : state.arrangementPlayheadMs;
    state.setArrangementPlayhead(startAtMs);
    state.setArrangementPlaying(true);
    const instruments = useInstruments.getState().instruments;
    const instrumentIds = new Set(tracks.map((track) => track.instrumentId));
    await Promise.allSettled(
      instruments
        .filter((instrument) => instrumentIds.has(instrument.id))
        .map((instrument) => sampleEngine.loadSample(instrument.sampleId)),
    );
    if (
      playbackToken !== playbackTokenRef.current ||
      !useTransport.getState().arrangementPlaying
    ) {
      return;
    }
    const startedAt = performance.now();
    const clipsByTrack = useClips.getState().byTrack;
    const recordingsByTrack = useRecordings.getState().byTrack;
    const slicesByTrack = useSlices.getState().byTrack;

    for (const track of tracks) {
      const instrument = instruments.find((candidate) => candidate.id === track.instrumentId);
      if (!instrument) continue;
      const recordingById = new Map(
        (recordingsByTrack[track.id] ?? []).map((recording) => [recording.id, recording]),
      );
      const sliceById = new Map(
        (slicesByTrack[track.id] ?? []).map((slice) => [slice.id, slice]),
      );
      for (const clip of clipsByTrack[track.id] ?? []) {
        const recording = recordingById.get(clip.recordingId);
        if (!recording) continue;
        for (const recordedEvent of recording.events) {
          const eventAtMs = clip.startMs + recordedEvent.tMs;
          if (eventAtMs < startAtMs) continue;
          const slice = sliceById.get(recordedEvent.sliceId);
          if (!slice) continue;
          timersRef.current.push(
            window.setTimeout(() => {
              sampleEngine.play(
                instrument.sampleId,
                slice.region,
                slice.gain,
                !!slice.playThrough,
                track.id,
              );
            }, eventAtMs - startAtMs),
          );
        }
      }
    }

    const tick = (): void => {
      const nextMs = Math.min(durationMs, startAtMs + performance.now() - startedAt);
      useTransport.getState().setArrangementPlayhead(nextMs);
      if (nextMs >= durationMs) {
        stopScheduled();
        useTransport.getState().setArrangementPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => stopScheduled, []);

  useEffect(() => {
    if (!playing) stopScheduled();
  }, [playing]);

  const seek = (value: number): void => {
    pause();
    useTransport.getState().setArrangementPlayhead(Math.min(durationMs, Math.max(0, value)));
  };

  return (
    <div className="arrangement-transport">
      <button type="button" onClick={playing ? pause : () => void play()} title={playing ? "Pause song" : "Play song"}>
        {playing ? "■" : "▶"}
      </button>
      <button type="button" onClick={() => seek(0)} title="Return cursor to start">
        ↤
      </button>
      <span>{formatArrangementTime(playheadMs)}</span>
      <input
        type="range"
        min={0}
        max={durationMs}
        step={10}
        value={Math.min(playheadMs, durationMs)}
        onChange={(event) => seek(Number(event.target.value))}
        aria-label="Song cursor"
      />
    </div>
  );
}

const formatArrangementTime = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${(totalSeconds - minutes * 60).toFixed(2).padStart(5, "0")}`;
};