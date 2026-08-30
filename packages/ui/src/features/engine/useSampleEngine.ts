import { useEffect, useState } from "react";
import type { Sample } from "@sampla/shared";
import { sampleEngine } from "./sampleEngine.js";
import { useRecordings } from "../recordings/store.js";

// Prime the AudioContext on the first user gesture anywhere in the window.
let gestureListenerAttached = false;
const attachGestureListener = (): void => {
  if (gestureListenerAttached) return;
  gestureListenerAttached = true;
  const prime = (): void => {
    sampleEngine.primeContext();
    window.removeEventListener("pointerdown", prime);
    window.removeEventListener("keydown", prime);
  };
  window.addEventListener("pointerdown", prime, { once: false });
  window.addEventListener("keydown", prime, { once: false });
};

export const useSampleEngine = (trackId: string | null): {
  ready: boolean;
  play: (sample: Sample) => void;
} => {
  const [ready, setReady] = useState<boolean>(trackId ? sampleEngine.isReady(trackId) : false);

  useEffect(() => {
    attachGestureListener();
    if (!trackId) {
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(sampleEngine.isReady(trackId));
    sampleEngine
      .loadTrack(trackId)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        console.error("[sampleEngine] loadTrack failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  return {
    ready,
    play: (sample: Sample) => {
      sampleEngine.play(sample.trackId, sample.region, sample.gain, !!sample.playThrough);
      useRecordings.getState().logTrigger(sample);
    },
  };
};
