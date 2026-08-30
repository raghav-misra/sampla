import { useEffect, useMemo, useRef, useState } from "react";
import type { Peaks, Region, Sample, Track } from "@sampla/shared";
import { clamp, formatTime } from "@sampla/shared";
import { padPalette } from "../samples/store.js";
import { useTransport } from "../engine/store.js";

interface Props {
  track: Track;
  peaks: Peaks;
  selection: Region | null;
  samples: Sample[];
  onSeek: (t: number) => void;
  onSelect: (r: Region | null) => void;
}

const BG = "#0f1115";
const AXIS = "#2a2f3a";
const WAVE = "#7bd88f";
const WAVE_DIM = "#3f6b4f";
const PLAYHEAD = "#ff5470";
const SELECTION = "rgba(123, 216, 143, 0.18)";
const SELECTION_EDGE = "rgba(123, 216, 143, 0.6)";
const TEXT = "#9aa3b2";

const DRAG_THRESHOLD_PX = 3;

export function Waveform({ track, peaks, selection, samples, onSeek, onSelect }: Props) {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 180 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: 180 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const secPerPx = useMemo(
    () => (size.w > 0 ? track.durationSec / size.w : 0),
    [size.w, track.durationSec],
  );

  // Background layer: waveform + samples + ruler + selection. Redraws only when
  // any of these inputs change (NOT on every playhead tick).
  useEffect(() => {
    const cv = bgCanvasRef.current;
    if (!cv || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size.w * dpr;
    cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`;
    cv.style.height = `${size.h}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(ctx, size.w, size.h, track, peaks, selection, samples);
  }, [size.w, size.h, track, peaks, selection, samples]);

  // Overlay layer: playhead only. Drawn via rAF from the transport store, so
  // playhead updates never re-render React.
  useEffect(() => {
    const cv = overlayCanvasRef.current;
    if (!cv || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size.w * dpr;
    cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`;
    cv.style.height = `${size.h}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let lastPh = -1;
    let raf = 0;
    const tick = (): void => {
      const ph = useTransport.getState().playhead;
      if (ph !== lastPh) {
        lastPh = ph;
        ctx.clearRect(0, 0, size.w, size.h);
        const px = (ph / track.durationSec) * size.w;
        ctx.strokeStyle = PLAYHEAD;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 0.5, 0);
        ctx.lineTo(px + 0.5, size.h);
        ctx.stroke();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, track.durationSec]);

  const clientXToSec = (clientX: number): number => {
    const cv = bgCanvasRef.current;
    if (!cv) return 0;
    const rect = cv.getBoundingClientRect();
    const x = clientX - rect.left;
    return clamp(x * secPerPx, 0, track.durationSec);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startSec = clientXToSec(e.clientX);
    let dragged = false;

    const move = (ev: PointerEvent): void => {
      if (!dragged && Math.abs(ev.clientX - startX) < DRAG_THRESHOLD_PX) return;
      dragged = true;
      const t = clientXToSec(ev.clientX);
      const a = Math.min(startSec, t);
      const b = Math.max(startSec, t);
      onSelect(b > a ? { startSec: a, endSec: b } : null);
    };
    const up = (ev: PointerEvent): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!dragged) {
        onSelect(null);
        onSeek(startSec);
      } else {
        const t = clientXToSec(ev.clientX);
        const a = Math.min(startSec, t);
        const b = Math.max(startSec, t);
        if (b - a < secPerPx * DRAG_THRESHOLD_PX) {
          onSelect(null);
          onSeek(startSec);
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div ref={wrapRef} style={{ width: "100%", position: "relative" }}>
      <canvas
        ref={bgCanvasRef}
        onPointerDown={onPointerDown}
        style={{ display: "block", cursor: "text", background: BG, borderRadius: 6 }}
      />
      <canvas
        ref={overlayCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          borderRadius: 6,
        }}
      />
    </div>
  );
}

const RULER_H = 22;

const drawBackground = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  track: Track,
  peaks: Peaks,
  selection: Region | null,
  samples: Sample[],
): void => {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  drawRuler(ctx, w, track.durationSec);

  const waveTop = RULER_H;
  const waveH = h - RULER_H;
  const mid = waveTop + waveH / 2;

  drawSampleBands(ctx, w, waveTop, waveH, track.durationSec, samples);

  if (selection) {
    const x1 = (selection.startSec / track.durationSec) * w;
    const x2 = (selection.endSec / track.durationSec) * w;
    ctx.fillStyle = SELECTION;
    ctx.fillRect(x1, waveTop, x2 - x1, waveH);
    ctx.strokeStyle = SELECTION_EDGE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 + 0.5, waveTop);
    ctx.lineTo(x1 + 0.5, h);
    ctx.moveTo(x2 - 0.5, waveTop);
    ctx.lineTo(x2 - 0.5, h);
    ctx.stroke();
  }

  drawPeaks(ctx, w, waveH, mid, peaks, selection === null ? WAVE : WAVE_DIM);
  if (selection) {
    const x1 = (selection.startSec / track.durationSec) * w;
    const x2 = (selection.endSec / track.durationSec) * w;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x1, waveTop, x2 - x1, waveH);
    ctx.clip();
    drawPeaks(ctx, w, waveH, mid, peaks, WAVE);
    ctx.restore();
  }
};

const drawRuler = (ctx: CanvasRenderingContext2D, w: number, duration: number): void => {
  ctx.fillStyle = "#151922";
  ctx.fillRect(0, 0, w, RULER_H);
  ctx.strokeStyle = AXIS;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, RULER_H - 0.5);
  ctx.lineTo(w, RULER_H - 0.5);
  ctx.stroke();

  const targetTicks = Math.max(4, Math.floor(w / 90));
  const stepRaw = duration / targetTicks;
  const step = niceStep(stepRaw);
  ctx.fillStyle = TEXT;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (let t = 0; t <= duration + 1e-6; t += step) {
    const x = (t / duration) * w;
    ctx.strokeStyle = AXIS;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, RULER_H - 6);
    ctx.lineTo(x + 0.5, RULER_H);
    ctx.stroke();
    ctx.fillText(formatTime(t), x + 4, RULER_H / 2);
  }
};

const niceStep = (raw: number): number => {
  if (raw <= 0) return 1;
  const candidates = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const c of candidates) if (c >= raw) return c;
  return candidates[candidates.length - 1] ?? 600;
};

const drawSampleBands = (
  ctx: CanvasRenderingContext2D,
  w: number,
  top: number,
  h: number,
  duration: number,
  samples: Sample[],
): void => {
  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textBaseline = "top";
  for (const s of samples) {
    const x1 = (s.region.startSec / duration) * w;
    const x2 = (s.region.endSec / duration) * w;
    const width = Math.max(1, x2 - x1);
    const color = padPalette(s.padKey);
    ctx.fillStyle = withAlpha(color, 0.15);
    ctx.fillRect(x1, top, width, h);
    ctx.strokeStyle = withAlpha(color, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 + 0.5, top);
    ctx.lineTo(x1 + 0.5, top + h);
    ctx.moveTo(x2 - 0.5, top);
    ctx.lineTo(x2 - 0.5, top + h);
    ctx.stroke();
    // pad label
    const label = s.padKey;
    ctx.fillStyle = color;
    ctx.fillRect(x1, top, 14, 14);
    ctx.fillStyle = "#0f1115";
    ctx.fillText(label, x1 + 4, top + 2);
  }
};

const withAlpha = (hex: string, a: number): string => {
  // hex like "#rrggbb"
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const drawPeaks = (
  ctx: CanvasRenderingContext2D,
  w: number,
  waveH: number,
  mid: number,
  peaks: Peaks,
  color: string,
): void => {
  const n = peaks.min.length;
  if (n === 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    const i0 = Math.floor((x / w) * n);
    const i1 = Math.max(i0 + 1, Math.floor(((x + 1) / w) * n));
    let mn = 127;
    let mx = -128;
    for (let i = i0; i < i1 && i < n; i++) {
      const a = peaks.min[i] ?? 0;
      const b = peaks.max[i] ?? 0;
      if (a < mn) mn = a;
      if (b > mx) mx = b;
    }
    const yTop = mid - (mx / 127) * (waveH / 2 - 2);
    const yBot = mid - (mn / 127) * (waveH / 2 - 2);
    ctx.moveTo(x + 0.5, yTop);
    ctx.lineTo(x + 0.5, Math.max(yTop + 1, yBot));
  }
  ctx.stroke();
};
