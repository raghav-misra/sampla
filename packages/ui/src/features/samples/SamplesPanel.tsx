import type { Sample } from "@sampla/shared";
import { formatTime } from "@sampla/shared";
import { PAD_ORDER, padPalette, useSamples } from "./store.js";
import { useTransport } from "../engine/store.js";

interface Props {
  trackId: string;
  samples: Sample[];
  ready: boolean;
  onTrigger: (sample: Sample) => void;
}

export function SamplesPanel({ trackId, samples, ready, onTrigger }: Props) {
  const byPad = new Map<string, Sample>();
  for (const s of samples) byPad.set(s.padKey, s);
  const removeSample = useSamples((s) => s.removeSample);
  const setSelection = useTransport((s) => s.setSelection);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, color: "#9aa3b2", letterSpacing: 0.5 }}>
          SAMPLES {ready ? "" : "· loading buffer…"}
        </h3>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          Enter to save · numpad/digit keys to trigger · click pad to play
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
          gap: 8,
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
                padding: "10px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                cursor: canPlay ? "pointer" : "default",
                opacity: bound && !ready ? 0.6 : 1,
                minHeight: 72,
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
                    fontSize: 14,
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
                        setSelection(s.region);
                      }}
                      title="Select region on track"
                      style={pillBtn}
                    >
                      ⌖
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeSample(trackId, s.id);
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
