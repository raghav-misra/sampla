import { useEffect, useState } from "react";
import type { Slice } from "@sampla/shared";
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

// Ensures the audio buffer for `sampleId` is loaded and returns a trigger fn
// that plays a slice on that sample.
export const useSampleEngine = (sampleId: string | null): {
  ready: boolean;
  play: (slice: Slice) => void;
} => {
  const [ready, setReady] = useState<boolean>(
    sampleId ? sampleEngine.isReady(sampleId) : false,
  );

  useEffect(() => {
    attachGestureListener();
    if (!sampleId) {
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(sampleEngine.isReady(sampleId));
    sampleEngine
      .loadSample(sampleId)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        console.error("[sampleEngine] loadSample failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [sampleId]);

  return {
    ready,
    play: (slice: Slice) => {
      if (!sampleId) return;
      sampleEngine.play(
        sampleId,
        slice.region,
        slice.gain,
        !!slice.playThrough,
        slice.trackId,
      );
      useRecordings.getState().logTrigger(slice);
    },
  };
};
