import { IngestForm } from "../features/ingest/IngestForm.js";
import { TrackView } from "../features/track/TrackView.js";
import { useTransport } from "../features/engine/store.js";

export function App() {
  const hasTrack = useTransport((s) => s.track !== null);

  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        background: "#0a0c11",
        color: "#eef1f6",
        minHeight: "100vh",
        padding: "24px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 0.5 }}>sampla</h1>
      <IngestForm />
      {hasTrack ? (
        <TrackView />
      ) : (
        <p style={{ color: "#9aa3b2", fontSize: 13 }}>
          Paste a YouTube link and hit Import. Once the track loads, click to place the
          playhead, drag to select a region, and hit Space to play.
        </p>
      )}
    </main>
  );
}
