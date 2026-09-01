import type { Clip, Recording, Track } from "@sampla/shared";
import { useRef, useState } from "react";
import { useClips } from "../clips/store.js";
import { useTransport } from "../engine/store.js";
import { useProjects } from "../projects/store.js";
import { useRecordings } from "../recordings/store.js";
import { padPalette } from "../slices/store.js";

interface Props {
  track: Track;
  timelineDurationMs: number;
}

export function TrackRow({ track, timelineDurationMs }: Props) {
  const laneRef = useRef<HTMLDivElement | null>(null);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const active = useTransport((state) => state.activeTrackId === track.id);
  const setActiveTrack = useTransport((state) => state.setActiveTrackId);
  const setArrangementPlayhead = useTransport((state) => state.setArrangementPlayhead);
  const setArrangementPlaying = useTransport((state) => state.setArrangementPlaying);
  const removeTrack = useProjects((state) => state.removeTrack);
  const recordings = useRecordings((state) => state.byTrack[track.id] ?? EMPTY_RECORDINGS);
  const clips = useClips((state) => state.byTrack[track.id] ?? EMPTY_CLIPS);
  const selectedClipId = useClips((state) => state.selectedClipId);
  const addClip = useClips((state) => state.addClip);
  const moveClip = useClips((state) => state.moveClip);
  const removeClip = useClips((state) => state.removeClip);
  const selectClip = useClips((state) => state.selectClip);
  const recordingById = new Map(recordings.map((recording) => [recording.id, recording]));

  const selectTrack = (): void => {
    setActiveTrack(track.id);
    selectClip(null);
  };

  const msAtClientX = (clientX: number): number => {
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const fraction = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(timelineDurationMs, fraction * timelineDurationMs));
  };

  return (
    <section className={`track-lane${active ? " active" : ""}`} onPointerDown={selectTrack}>
      <header className="track-lane-header">
        <div style={{ minWidth: 0 }}>
          <strong>{track.name || `Track ${track.order + 1}`}</strong>
          <span>YouTube sampler</span>
        </div>
        <button
          type="button"
          title="Remove track"
          onClick={(event) => {
            event.stopPropagation();
            void removeTrack(track.projectId, track.id);
          }}
        >
          ×
        </button>
      </header>
      <div
        ref={laneRef}
        className="track-lane-content"
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          setArrangementPlaying(false);
          setArrangementPlayhead(msAtClientX(event.clientX));
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("application/x-sampla-recording")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const recordingId = event.dataTransfer.getData("application/x-sampla-recording");
          const recording = recordingById.get(recordingId);
          if (!recording) return;
          const startMs = Math.max(0, msAtClientX(event.clientX) - recording.durationMs / 2);
          setActiveTrack(track.id);
          void addClip(track.id, recording.id, startMs);
        }}
      >
        {clips.map((clip) => {
          const recording = recordingById.get(clip.recordingId);
          if (!recording) return null;
          const left = (clip.startMs / timelineDurationMs) * 100;
          const width = Math.max(2.5, (recording.durationMs / timelineDurationMs) * 100);
          return (
            <div
              key={clip.id}
              tabIndex={0}
              className={`recording-clip${selectedClipId === clip.id ? " selected" : ""}${draggingClipId === clip.id ? " dragging" : ""}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${recording.name} at ${(clip.startMs / 1000).toFixed(2)}s`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveTrack(track.id);
                  selectClip(clip.id);
                }
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setActiveTrack(track.id);
                selectClip(clip.id);
                setDraggingClipId(clip.id);
                const startX = event.clientX;
                const initialStart = clip.startMs;
                const target = event.currentTarget;
                target.setPointerCapture(event.pointerId);
                const onMove = (moveEvent: PointerEvent): void => {
                  const rect = laneRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const deltaMs = ((moveEvent.clientX - startX) / rect.width) * timelineDurationMs;
                  const nextStart = Math.max(0, initialStart + deltaMs);
                  target.style.left = `${(nextStart / timelineDurationMs) * 100}%`;
                };
                const onUp = (upEvent: PointerEvent): void => {
                  target.removeEventListener("pointermove", onMove);
                  target.removeEventListener("pointerup", onUp);
                  target.removeEventListener("pointercancel", onUp);
                  setDraggingClipId(null);
                  const rect = laneRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const deltaMs = ((upEvent.clientX - startX) / rect.width) * timelineDurationMs;
                  void moveClip(track.id, clip.id, Math.max(0, initialStart + deltaMs));
                };
                target.addEventListener("pointermove", onMove);
                target.addEventListener("pointerup", onUp);
                target.addEventListener("pointercancel", onUp);
              }}
            >
              <span className="clip-title">{recording.name}</span>
              <small className="clip-meta">{recording.events.length} hits</small>
              <div className="clip-events">
                {recording.events.map((recordedEvent, index) => (
                  <i
                    key={`${recordedEvent.sliceId}-${index}`}
                    style={{
                      left: `${(recordedEvent.tMs / Math.max(recording.durationMs, 1)) * 100}%`,
                      background: padPalette(recordedEvent.padKey),
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                className="clip-remove"
                title="Remove clip"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  void removeClip(track.id, clip.id);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        {clips.length === 0 && (
          <span className="track-lane-empty">Drag a recording here from the instrument inspector</span>
        )}
      </div>
    </section>
  );
}

const EMPTY_RECORDINGS: Recording[] = [];
const EMPTY_CLIPS: Clip[] = [];