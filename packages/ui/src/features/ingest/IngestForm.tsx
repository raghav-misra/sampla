import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { useTransport } from "../engine/store.js";

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "polling"; jobId: string; status: string; progress: number }
  | { kind: "loading"; trackId: string }
  | { kind: "error"; message: string };

export function IngestForm() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const pollRef = useRef<number | null>(null);
  const setTrack = useTransport((s) => s.setTrack);

  useEffect(
    () => () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    },
    [],
  );

  const loadTrack = async (trackId: string): Promise<void> => {
    setPhase({ kind: "loading", trackId });
    try {
      const [track, peaks] = await Promise.all([
        api.getTrack(trackId),
        api.getPeaks(trackId),
      ]);
      setTrack(track, peaks);
      setPhase({ kind: "idle" });
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  };

  const pollJob = (jobId: string): void => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const j = await api.getJob(jobId);
        if (j.status === "done" && j.trackId) {
          if (pollRef.current !== null) window.clearInterval(pollRef.current);
          pollRef.current = null;
          await loadTrack(j.trackId);
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

  const busy = phase.kind === "submitting" || phase.kind === "polling" || phase.kind === "loading";

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="url"
        required
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
        }}
      />
      <button
        type="submit"
        disabled={busy}
        style={{
          padding: "8px 14px",
          borderRadius: 4,
          border: 0,
          background: busy ? "#3f6b4f" : "#7bd88f",
          color: "#0f1115",
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Working…" : "Import"}
      </button>
      <StatusPill phase={phase} />
    </form>
  );
}

function StatusPill({ phase }: { phase: Phase }) {
  const style: React.CSSProperties = {
    fontSize: 12,
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
      return <span style={style}>loading track…</span>;
    case "error":
      return <span style={{ ...style, color: "#ff5470" }}>{phase.message}</span>;
  }
}
