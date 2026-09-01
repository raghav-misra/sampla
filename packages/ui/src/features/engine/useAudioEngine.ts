import { useEffect, useRef } from "react";
import type { Sample } from "@sampla/shared";
import { useTransport } from "./store.js";
import { api } from "../../lib/api.js";

export interface AudioEngine {
  playFromPlayhead: () => void;
  playSelection: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
}

// Binds an <audio> element to a specific Sample (audio source), driven by the
// transport for the given Track (row). Playhead + selection are read from the
// transport's per-track maps.
export const useAudioEngine = (
  trackId: string | null,
  sample: Sample | null,
): AudioEngine => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  // stop time for the current play burst (used when playing a selection)
  const stopAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sample) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }
    const el = new Audio(api.audioUrl(sample.id));
    el.preload = "auto";
    el.addEventListener("error", () => {
      const code = el.error?.code;
      const msg = el.error?.message ?? "audio element error";
      console.error(`[audio] error code=${code} msg=${msg} src=${el.src}`);
    });
    audioRef.current = el;
    return () => {
      el.pause();
      el.src = "";
      audioRef.current = null;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [sample]);

  const stopRafLoop = (): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startRafLoop = (): void => {
    stopRafLoop();
    const tick = (): void => {
      const el = audioRef.current;
      if (!el || !trackId) return;
      const t = el.currentTime;
      const stopAt = stopAtRef.current;
      if (stopAt !== null && t >= stopAt) {
        el.pause();
        useTransport.getState().setPlayhead(trackId, stopAt);
        useTransport.getState().setPlaying(false);
        stopAtRef.current = null;
        stopRafLoop();
        return;
      }
      useTransport.getState().setPlayhead(trackId, t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const currentPlayhead = (): number =>
    trackId ? useTransport.getState().playheadByTrack[trackId] ?? 0 : 0;

  const currentSelection = (): { startSec: number; endSec: number } | null =>
    trackId ? useTransport.getState().selectionByTrack[trackId] ?? null : null;

  const playFromPlayhead = (): void => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = currentPlayhead();
    stopAtRef.current = null;
    void el.play()
      .then(() => {
        useTransport.getState().setPlaying(true);
        startRafLoop();
      })
      .catch((error: unknown) => {
        useTransport.getState().setPlaying(false);
        console.error("[audio] playback failed", error);
      });
  };

  const playSelection = (): void => {
    const el = audioRef.current;
    const sel = currentSelection();
    if (!el || !sel || !trackId) return;
    el.currentTime = sel.startSec;
    useTransport.getState().setPlayhead(trackId, sel.startSec);
    stopAtRef.current = sel.endSec;
    void el.play()
      .then(() => {
        useTransport.getState().setPlaying(true);
        startRafLoop();
      })
      .catch((error: unknown) => {
        useTransport.getState().setPlaying(false);
        console.error("[audio] playback failed", error);
      });
  };

  const pause = (): void => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    useTransport.getState().setPlaying(false);
    stopRafLoop();
  };

  const toggle = (): void => {
    const { isPlaying } = useTransport.getState();
    const sel = currentSelection();
    if (isPlaying) {
      pause();
    } else if (sel) {
      playSelection();
    } else {
      playFromPlayhead();
    }
  };

  const seek = (t: number): void => {
    const el = audioRef.current;
    if (el) el.currentTime = t;
    if (trackId) useTransport.getState().setPlayhead(trackId, t);
  };

  return { playFromPlayhead, playSelection, pause, toggle, seek };
};
