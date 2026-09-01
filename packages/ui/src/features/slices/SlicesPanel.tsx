import type { Slice } from "@sampla/shared";
import { formatTime } from "@sampla/shared";
import { PAD_ORDER, padPalette, useSlices } from "./store.js";
import { useTransport } from "../engine/store.js";

interface Props {
  trackId: string;
  slices: Slice[];
  ready: boolean;
  onTrigger: (slice: Slice) => void;
}

export function SlicesPanel({ trackId, slices, ready, onTrigger }: Props) {
  const byPad = new Map<string, Slice>();
  for (const s of slices) byPad.set(s.padKey, s);
  const removeSlice = useSlices((s) => s.removeSlice);
  const setPlayThrough = useSlices((s) => s.setPlayThrough);
  const setSelection = useTransport((s) => s.setSelection);
  const setActiveTrack = useTransport((s) => s.setActiveTrackId);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h4 style={{ margin: 0, fontSize: 11, color: "#9aa3b2", letterSpacing: 0.5 }}>
          PADS {ready ? "" : "· loading buffer…"}
        </h4>
        <span style={{ fontSize: 10, color: "#6b7280" }}>
          Enter to save · numpad/digit keys to trigger · click pad to play
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 6,
        }}
      >
        {PAD_ORDER.map((pad) => {
          const s = byPad.get(pad);
          const color = padPalette(pad);
          const bound = Boolean(s);
          const canPlay = bound && ready;
          return (
            <div
              key={pad}
              onClick={() => {
                if (s && ready) onTrigger(s);
              }}
              style={{
                border: `1px solid ${bound ? color : "#2a2f3a"}`,
                background: bound ? withAlpha(color, 0.14) : "#0f1115",
                borderRadius: 6,
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                cursor: canPlay ? "pointer" : "default",
                opacity: bound && !ready ? 0.6 : 1,
                minHeight: 62,
                position: "relative",
                userSelect: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 13,
                    color: bound ? color : "#4a5265",
                    fontWeight: 700,
                  }}
                >
                  {pad}
                </span>
                {s && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void setPlayThrough(trackId, s.id, !s.playThrough);
                      }}
                      title={
                        s.playThrough
                          ? "Plays through subsequent triggers — click to disable"
                          : "Cut off when another slice plays — click to let it ring"
                      }
                      style={{
                        ...pillBtn,
                        color: s.playThrough ? color : "#4a5265",
                        fontWeight: s.playThrough ? 700 : 400,
                      }}
                    >
                      ∞
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTrack(trackId);
                        setSelection(s.region);
                      }}
                      title="Focus this track and select region"
                      style={pillBtn}
                    >
                      ⌖
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeSlice(trackId, s.id);
                      }}
                      title="Remove"
                      style={pillBtn}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              {s ? (
                <div
                  style={{
                    fontSize: 10,
                    color: "#c8d0dc",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    lineHeight: 1.3,
                  }}
                >
                  <div>{formatTime(s.region.startSec)}</div>
                  <div style={{ color: "#6b7280" }}>
                    {(s.region.endSec - s.region.startSec).toFixed(2)}s
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 10, color: "#4a5265" }}>empty</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const pillBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#6b7280",
  cursor: "pointer",
  fontSize: 12,
  padding: 0,
  width: 14,
  height: 14,
  lineHeight: "14px",
};

const withAlpha = (hex: string, a: number): string => {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
