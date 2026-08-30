import { useEffect, useRef } from "react";
import { useTransport } from "./store.js";
import { api } from "../../lib/api.js";

export interface AudioEngine {
  playFromPlayhead: () => void;
  playSelection: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
}

export const useAudioEngine = (): AudioEngine => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  // stop time for the current play burst (used when playing a selection)
  const stopAtRef = useRef<number | null>(null);

  const track = useTransport((s) => s.track);

  useEffect(() => {
    if (!track) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }
    const el = new Audio(api.audioUrl(track.id));
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
  }, [track]);

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
      if (!el) return;
      const t = el.currentTime;
      const stopAt = stopAtRef.current;
      if (stopAt !== null && t >= stopAt) {
        el.pause();
        useTransport.getState().setPlayhead(stopAt);
        useTransport.getState().setPlaying(false);
        stopAtRef.current = null;
        stopRafLoop();
        return;
      }
      useTransport.getState().setPlayhead(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const playFromPlayhead = (): void => {
    const el = audioRef.current;
    if (!el) return;
    const { playhead } = useTransport.getState();
    el.currentTime = playhead;
    stopAtRef.current = null;
    void el.play().then(() => {
      useTransport.getState().setPlaying(true);
      startRafLoop();
    });
  };

  const playSelection = (): void => {
    const el = audioRef.current;
    const { selection } = useTransport.getState();
    if (!el || !selection) return;
    el.currentTime = selection.startSec;
    useTransport.getState().setPlayhead(selection.startSec);
    stopAtRef.current = selection.endSec;
    void el.play().then(() => {
      useTransport.getState().setPlaying(true);
      startRafLoop();
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
    const { isPlaying, selection } = useTransport.getState();
    if (isPlaying) {
      pause();
    } else if (selection) {
      playSelection();
    } else {
      playFromPlayhead();
    }
  };

  const seek = (t: number): void => {
    const el = audioRef.current;
    if (el) el.currentTime = t;
    useTransport.getState().setPlayhead(t);
  };

  return { playFromPlayhead, playSelection, pause, toggle, seek };
};
