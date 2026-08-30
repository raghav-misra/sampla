import { useEffect, useState } from "react";
import { useProjects } from "../projects/store.js";
import { useRecordings } from "../recordings/store.js";
import { useSampleLibrary } from "../sampleLibrary/store.js";
import { SampleLibrary } from "../sampleLibrary/SampleLibrary.js";
import { TrackRow } from "../track/TrackRow.js";

export function ProjectView() {
  const activeId = useProjects((s) => s.activeProjectId);
  const project = useProjects((s) =>
    s.projects.find((p) => p.id === s.activeProjectId) ?? null,
  );
  const tracks = useProjects((s) =>
    activeId ? s.tracksByProject[activeId] ?? EMPTY : EMPTY,
  );
  const renameProject = useProjects((s) => s.renameProject);
  const addTrackForSample = useProjects((s) => s.addTrackForSample);
  const hydrateRecordings = useRecordings((s) => s.hydrate);
  const refreshLibrary = useSampleLibrary((s) => s.refresh);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    void hydrateRecordings();
    void refreshLibrary();
  }, [hydrateRecordings, refreshLibrary]);

  if (!project || !activeId) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
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
        <button
          type="button"
          onClick={() => setLibraryOpen((v) => !v)}
          style={{
            padding: "6px 12px",
            borderRadius: 4,
            border: "1px solid #3a3f4a",
            background: libraryOpen ? "#1a1e28" : "transparent",
            color: "#eef1f6",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          + Add Track
        </button>
      </header>

      {libraryOpen && (
        <SampleLibrary
          onPick={(s) => {
            void addTrackForSample(activeId, s.id);
            setLibraryOpen(false);
          }}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {tracks.length === 0 ? (
        <p style={{ color: "#9aa3b2", fontSize: 13 }}>
          No tracks yet. Click <b>+ Add Track</b> to pick a sample from your library or
          import a new YouTube video.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tracks.map((t) => (
            <TrackRow key={t.id} track={t} />
          ))}
        </div>
      )}
    </section>
  );
}

const EMPTY: never[] = [];
