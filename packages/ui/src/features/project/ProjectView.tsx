import { useEffect, useMemo, useState } from "react";
import { useProjects } from "../projects/store.js";
import { useRecordings } from "../recordings/store.js";
import { useSampleLibrary } from "../sampleLibrary/store.js";
import { SampleLibrary } from "../sampleLibrary/SampleLibrary.js";
import { TrackRow } from "../track/TrackRow.js";
import { useInstruments } from "../instruments/store.js";
import { useTransport } from "../engine/store.js";
import { TrackInspector } from "../track/TrackInspector.js";
import { useClips } from "../clips/store.js";
import { ArrangementTransport } from "../arrangement/ArrangementTransport.js";

export function ProjectView() {
  const activeId = useProjects((s) => s.activeProjectId);
  const project = useProjects((s) =>
    s.projects.find((p) => p.id === s.activeProjectId) ?? null,
  );
  const tracks = useProjects((s) =>
    activeId ? s.tracksByProject[activeId] ?? EMPTY : EMPTY,
  );
  const renameProject = useProjects((s) => s.renameProject);
  const addTrack = useProjects((s) => s.addTrack);
  const ensureYouTubeSampler = useInstruments((s) => s.ensureYouTubeSampler);
  const samples = useSampleLibrary((s) => s.samples);
  const activeTrackId = useTransport((s) => s.activeTrackId);
  const setActiveTrackId = useTransport((s) => s.setActiveTrackId);
  const arrangementPlayheadMs = useTransport((s) => s.arrangementPlayheadMs);
  const hydrateRecordings = useRecordings((s) => s.hydrate);
  const recordingsByTrack = useRecordings((s) => s.byTrack);
  const hydrateClips = useClips((s) => s.hydrate);
  const clipsByTrack = useClips((s) => s.byTrack);
  const refreshLibrary = useSampleLibrary((s) => s.refresh);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(true);

  useEffect(() => {
    void Promise.all([hydrateRecordings(), hydrateClips()]);
    void refreshLibrary();
  }, [hydrateRecordings, hydrateClips, refreshLibrary]);

  useEffect(() => {
    for (const sample of samples) void ensureYouTubeSampler(sample);
  }, [samples, ensureYouTubeSampler]);

  useEffect(() => {
    if (!tracks.some((track) => track.id === activeTrackId)) {
      setActiveTrackId(tracks[0]?.id ?? null);
    }
  }, [tracks, activeTrackId, setActiveTrackId]);

  const timelineDurationMs = useMemo(() => {
    let endMs = 0;
    for (const track of tracks) {
      const recordings = recordingsByTrack[track.id] ?? [];
      const recordingById = new Map(recordings.map((recording) => [recording.id, recording]));
      for (const clip of clipsByTrack[track.id] ?? []) {
        endMs = Math.max(endMs, clip.startMs + (recordingById.get(clip.recordingId)?.durationMs ?? 0));
      }
    }
    return Math.max(30_000, Math.ceil((endMs + 5_000) / 10_000) * 10_000);
  }, [tracks, recordingsByTrack, clipsByTrack]);

  if (!project || !activeId) return null;

  return (
    <section className="daw-shell">
      <header className="song-bar">
        <div className="song-identity">
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            title={menuOpen ? "Hide instruments" : "Show instruments"}
            aria-expanded={menuOpen}
          >
            ☰
          </button>
        {editingName ? (
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              if (nameDraft.trim()) void renameProject(project.id, nameDraft.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingName(false);
            }}
            // biome-ignore lint/a11y/noAutofocus: intentional inline rename
            autoFocus
            style={{
              background: "transparent",
              border: 0,
              borderBottom: "1px solid #3a3f4a",
              color: "#eef1f6",
              fontSize: 20,
              fontFamily: "inherit",
              outline: "none",
              padding: 0,
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(project.name);
              setEditingName(true);
            }}
            title="Rename project"
            style={{
              background: "transparent",
              border: 0,
              color: "#eef1f6",
              fontSize: 20,
              fontFamily: "inherit",
              padding: 0,
              cursor: "text",
              textAlign: "left",
            }}
          >
            {project.name}
          </button>
        )}
        </div>
        <ArrangementTransport tracks={tracks} durationMs={timelineDurationMs} />
        <div style={{ color: "#68717e", fontSize: 11 }}>
          {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
        </div>
      </header>
      <div className={`daw-workspace${menuOpen ? "" : " menu-closed"}`}>
        {menuOpen && <aside className="instrument-browser">
          <div style={{ padding: "12px 14px 0", color: "#68717e", fontSize: 10 }}>
            CLICK AN INSTRUMENT TO ADD A TRACK
          </div>
        <SampleLibrary
            onPick={(sample) => {
              void ensureYouTubeSampler(sample).then((instrument) =>
              addTrack(activeId, instrument.id),
            );
          }}
        />
        </aside>}
        <section className="arrangement">
          <div className="arrangement-ruler">
            <span>TRACKS</span>
            <div className="timeline-ruler">
              {Array.from({ length: timelineDurationMs / 5_000 + 1 }, (_, index) => (
                <span key={index} style={{ left: `${(index * 5_000 / timelineDurationMs) * 100}%` }}>
                  0:{String(index * 5).padStart(2, "0")}
                </span>
              ))}
            </div>
          </div>
          {tracks.length === 0 ? (
            <div className="arrangement-empty">
              Choose a YouTube sampler from the instrument browser to add the first track.
            </div>
          ) : (
            <div className="arrangement-lanes">
              <div
                className="arrangement-cursor"
                style={{ left: `calc(220px + (100% - 220px) * ${arrangementPlayheadMs / timelineDurationMs})` }}
              />
          {tracks.map((t) => (
            <TrackRow key={t.id} track={t} timelineDurationMs={timelineDurationMs} />
          ))}
            </div>
          )}
        </section>
        <TrackInspector
          track={tracks.find((track) => track.id === activeTrackId) ?? null}
        />
      </div>
    </section>
  );
}

const EMPTY: never[] = [];
