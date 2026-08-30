import { useEffect, useRef, useState } from "react";
import type { Sample } from "@sampla/shared";
import { formatTime } from "@sampla/shared";
import { api } from "../../lib/api.js";
import { filteredSamples, useSampleLibrary } from "./store.js";

type IngestPhase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "polling"; jobId: string; status: string; progress: number }
  | { kind: "loading"; sampleId: string }
  | { kind: "error"; message: string };

interface Props {
  onPick: (sample: Sample) => void;
  onClose?: () => void;
}

export function SampleLibrary({ onPick, onClose }: Props) {
  const samples = useSampleLibrary((s) => s.samples);
  const query = useSampleLibrary((s) => s.query);
  const setQuery = useSampleLibrary((s) => s.setQuery);
  const loading = useSampleLibrary((s) => s.loading);
  const error = useSampleLibrary((s) => s.error);
  const refresh = useSampleLibrary((s) => s.refresh);
  const addLocal = useSampleLibrary((s) => s.addLocal);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = filteredSamples(samples, query);

  return (
    <div
      style={{
        background: "#0b0d12",
        border: "1px solid #1a1e28",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
        maxWidth: 640,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 13, color: "#9aa3b2", letterSpacing: 0.5 }}>
          SAMPLE LIBRARY
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "#6b7280",
              cursor: "pointer",
              fontSize: 16,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
      <input
        type="search"
        placeholder="Search samples by title…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: 4,
          border: "1px solid #2a2f3a",
          background: "#0f1115",
          color: "#eef1f6",
          fontSize: 13,
        }}
      />
      <ImportRow onImported={(s) => addLocal(s)} />
      {error && <span style={{ color: "#ff5470", fontSize: 12 }}>{error}</span>}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxHeight: 360,
          overflowY: "auto",
        }}
      >
        {loading && samples.length === 0 && (
          <span style={{ color: "#6b7280", fontSize: 12 }}>loading…</span>
        )}
        {!loading && filtered.length === 0 && samples.length > 0 && (
          <span style={{ color: "#6b7280", fontSize: 12 }}>no matches for “{query}”</span>
        )}
        {!loading && samples.length === 0 && (
          <span style={{ color: "#6b7280", fontSize: 12 }}>
            no samples yet — paste a YouTube URL above to import one
          </span>
        )}
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 10px",
              borderRadius: 4,
              border: "1px solid #1a1e28",
              background: "#0f1115",
              color: "#eef1f6",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              fontSize: 12,
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {s.title}
            </span>
            <span style={{ color: "#6b7280", fontSize: 11 }}>
              {formatTime(s.durationSec)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ImportRowProps {
  onImported: (s: Sample) => void;
}

function ImportRow({ onImported }: ImportRowProps) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<IngestPhase>({ kind: "idle" });
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    },
    [],
  );

  const loadSample = async (sampleId: string): Promise<void> => {
    setPhase({ kind: "loading", sampleId });
    try {
      const sample = await api.getSample(sampleId);
      onImported(sample);
      setPhase({ kind: "idle" });
      setUrl("");
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  };

  const pollJob = (jobId: string): void => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const j = await api.getJob(jobId);
        if (j.status === "done" && j.sampleId) {
          if (pollRef.current !== null) window.clearInterval(pollRef.current);
          pollRef.current = null;
          await loadSample(j.sampleId);
        } else if (j.status === "error") {
          if (pollRef.current !== null) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setPhase({ kind: "error", message: j.error ?? "job failed" });
        } else {
          setPhase({ kind: "polling", jobId, status: j.status, progress: j.progress });
        }
      } catch (err) {
        if (pollRef.current !== null) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setPhase({ kind: "error", message: (err as Error).message });
      }
    }, 1000);
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!url.trim()) return;
    setPhase({ kind: "submitting" });
    try {
      const { jobId } = await api.ingest({ youtubeUrl: url.trim() });
      setPhase({ kind: "polling", jobId, status: "queued", progress: 0 });
      pollJob(jobId);
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  };

  const busy =
    phase.kind === "submitting" || phase.kind === "polling" || phase.kind === "loading";

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        type="url"
        placeholder="YouTube URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={busy}
        style={{
          flex: 1,
          padding: "8px 10px",
          borderRadius: 4,
          border: "1px solid #2a2f3a",
          background: "#0f1115",
          color: "#eef1f6",
          fontSize: 13,
        }}
      />
      <button
        type="submit"
        disabled={busy || !url.trim()}
        style={{
          padding: "8px 14px",
          borderRadius: 4,
          border: 0,
          background: busy ? "#3f6b4f" : "#7bd88f",
          color: "#0f1115",
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          fontSize: 12,
        }}
      >
        {busy ? "Working…" : "Import"}
      </button>
      <StatusPill phase={phase} />
    </form>
  );
}

function StatusPill({ phase }: { phase: IngestPhase }) {
  const style: React.CSSProperties = {
    fontSize: 11,
    color: "#9aa3b2",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  };
  switch (phase.kind) {
    case "idle":
      return null;
    case "submitting":
      return <span style={style}>submitting…</span>;
    case "polling":
      return (
        <span style={style}>
          {phase.status} {(phase.progress * 100).toFixed(0)}%
        </span>
      );
    case "loading":
      return <span style={style}>loading…</span>;
    case "error":
      return <span style={{ ...style, color: "#ff5470" }}>{phase.message}</span>;
  }
}
