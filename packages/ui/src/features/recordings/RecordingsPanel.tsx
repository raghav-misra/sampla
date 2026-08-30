import { useEffect, useRef, useState } from "react";
import type { Recording } from "@sampla/shared";
import { padPalette } from "../slices/store.js";
import { useRecordings } from "./store.js";

interface Props {
  trackId: string;
}

const formatMs = (ms: number): string => {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, "0")}`;
};

export function RecordingsPanel({ trackId }: Props) {
  const recordings = useRecordings((s) => s.byTrack[trackId] ?? EMPTY);
  const active = useRecordings((s) => s.active);
  const playback = useRecordings((s) => s.playback);
  const startRecording = useRecordings((s) => s.startRecording);
  const stopRecording = useRecordings((s) => s.stopRecording);
  const removeRecording = useRecordings((s) => s.removeRecording);
  const renameRecording = useRecordings((s) => s.renameRecording);
  const playRecording = useRecordings((s) => s.playRecording);
  const stopPlayback = useRecordings((s) => s.stopPlayback);

  const isRecording = active?.trackId === trackId;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, color: "#9aa3b2", letterSpacing: 0.5 }}>
          RECORDINGS
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isRecording && <LiveCounter startedAt={active.startedAt} />}
          <button
            type="button"
            onClick={() => {
              if (isRecording) void stopRecording();
              else startRecording(trackId);
            }}
            style={{
              padding: "6px 12px",
              background: isRecording ? "#ff5470" : "#1a1e28",
              color: isRecording ? "#0f1115" : "#ff5470",
              border: `1px solid ${isRecording ? "#ff5470" : "#3a3f4a"}`,
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: isRecording ? "#0f1115" : "#ff5470",
                display: "inline-block",
              }}
            />
            {isRecording ? "Stop" : "Record"}
          </button>
        </div>
      </div>
      {recordings.length === 0 && !isRecording ? (
        <span style={{ fontSize: 11, color: "#4a5265" }}>
          No takes yet. Hit Record and start hitting pads.
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {recordings.map((r) => (
            <RecordingRow
              key={r.id}
              recording={r}
              isPlaying={playback?.recordingId === r.id}
              onPlay={() => playRecording(r.id)}
              onStop={stopPlayback}
              onRemove={() => void removeRecording(trackId, r.id)}
              onRename={(name) => void renameRecording(trackId, r.id, name)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const EMPTY: Recording[] = [];

interface RowProps {
  recording: Recording;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}

function RecordingRow({
  recording,
  isPlaying,
  onPlay,
  onStop,
  onRemove,
  onRename,
}: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(recording.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = (): void => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== recording.name) onRename(trimmed);
    else setDraft(recording.name);
  };

  const duration = Math.max(recording.durationMs, 1);

  return (
    <div
      style={{
        border: "1px solid #2a2f3a",
        borderRadius: 6,
        padding: "8px 10px",
        background: "#0f1115",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
        }}
      >
        <button
          type="button"
          onClick={isPlaying ? onStop : onPlay}
          title={isPlaying ? "Stop" : "Play"}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            border: `1px solid ${isPlaying ? "#ff5470" : "#3a3f4a"}`,
            background: isPlaying ? "#ff5470" : "transparent",
            color: isPlaying ? "#0f1115" : "#c8d0dc",
            cursor: "pointer",
            fontSize: 11,
            padding: 0,
          }}
        >
          {isPlaying ? "■" : "▶"}
        </button>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setDraft(recording.name);
                setEditing(false);
              }
            }}
            style={{
              background: "#1a1e28",
              border: "1px solid #3a3f4a",
              borderRadius: 3,
              color: "#eef1f6",
              fontFamily: "inherit",
              fontSize: 12,
              padding: "2px 6px",
              width: 140,
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(recording.name);
              setEditing(true);
            }}
            title="Rename"
            style={{
              background: "transparent",
              border: 0,
              color: "#eef1f6",
              cursor: "text",
              fontFamily: "inherit",
              fontSize: 12,
              padding: 0,
            }}
          >
            {recording.name}
          </button>
        )}
        <span style={{ color: "#6b7280" }}>
          {formatMs(recording.durationMs)} · {recording.events.length} hits
        </span>
        <button
          type="button"
          onClick={onRemove}
          title="Delete"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: 0,
            color: "#6b7280",
            cursor: "pointer",
            fontSize: 14,
            padding: 0,
            width: 18,
            height: 18,
          }}
        >
          ×
        </button>
      </div>
      <Timeline recording={recording} durationMs={duration} isPlaying={isPlaying} />
    </div>
  );
}

interface TimelineProps {
  recording: Recording;
  durationMs: number;
  isPlaying: boolean;
}

function Timeline({ recording, durationMs, isPlaying }: TimelineProps) {
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const moveEvent = useRecordings((s) => s.moveEvent);
  const commitEventMove = useRecordings((s) => s.commitEventMove);
  const stopPlayback = useRecordings((s) => s.stopPlayback);

  useEffect(() => {
    if (!isPlaying) {
      if (playheadRef.current) playheadRef.current.style.opacity = "0";
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (): void => {
      const el = playheadRef.current;
      if (!el) return;
      const t = performance.now() - start;
      const pct = Math.min(1, t / durationMs);
      el.style.left = `${pct * 100}%`;
      el.style.opacity = "1";
      if (pct < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, durationMs]);

  const onTickDown = (index: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    stopPlayback();
    const strip = stripRef.current;
    if (!strip) return;
    setDragIndex(index);
    strip.setPointerCapture(e.pointerId);
    const applyFromClientX = (clientX: number): void => {
      const rect = strip.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      moveEvent(recording.trackId, recording.id, index, pct * durationMs);
    };
    const onMove = (ev: PointerEvent): void => applyFromClientX(ev.clientX);
    const onUp = (): void => {
      strip.removeEventListener("pointermove", onMove);
      strip.removeEventListener("pointerup", onUp);
      strip.removeEventListener("pointercancel", onUp);
      try {
        strip.releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture may already be released
      }
      setDragIndex(null);
      void commitEventMove(recording.trackId, recording.id);
    };
    strip.addEventListener("pointermove", onMove);
    strip.addEventListener("pointerup", onUp);
    strip.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      ref={stripRef}
      style={{
        position: "relative",
        height: 22,
        borderRadius: 3,
        background: "#1a1e28",
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      {recording.events.map((ev, i) => {
        const left = (ev.tMs / durationMs) * 100;
        const color = padPalette(ev.padKey);
        const isDragging = dragIndex === i;
        return (
          <div
            // Index-keyed on purpose: the slot's tMs mutates during drag and we
            // need React to reuse the same DOM node so pointer capture holds.
            // biome-ignore lint/suspicious/noArrayIndexKey: see comment above
            key={`${ev.sliceId}-${i}`}
            role="slider"
            tabIndex={-1}
            aria-label={`${ev.padKey} at ${formatMs(ev.tMs)}`}
            aria-valuenow={Math.round(ev.tMs)}
            aria-valuemin={0}
            aria-valuemax={Math.round(durationMs)}
            title={`${ev.padKey} @ ${formatMs(ev.tMs)} — drag to nudge`}
            onPointerDown={onTickDown(i)}
            style={{
              position: "absolute",
              left: `calc(${left}% - 4px)`,
              top: 1,
              bottom: 1,
              width: 9,
              display: "flex",
              justifyContent: "center",
              alignItems: "stretch",
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
            }}
          >
            <div
              style={{
                width: 3,
                borderRadius: 2,
                background: color,
                boxShadow: isDragging
                  ? `0 0 10px ${color}, 0 0 0 1px ${color}`
                  : `0 0 4px ${color}`,
                transform: isDragging ? "scaleY(1.15)" : "none",
                transition: "transform 80ms",
              }}
            />
          </div>
        );
      })}
      <div
        ref={playheadRef}
        style={{
          position: "absolute",
          left: "0%",
          top: 0,
          bottom: 0,
          width: 1,
          background: "#eef1f6",
          opacity: 0,
          transition: "opacity 120ms",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function LiveCounter({ startedAt }: { startedAt: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const el = ref.current;
      if (el) el.textContent = formatMs(performance.now() - startedAt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startedAt]);
  return (
    <span
      style={{
        color: "#ff5470",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
      }}
    >
      ● <span ref={ref}>0:00.00</span>
    </span>
  );
}
