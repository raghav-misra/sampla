import { useEffect, useState } from "react";
import type { Sample } from "@sampla/shared";
import { sampleEngine } from "./sampleEngine.js";

export const useSampleEngine = (trackId: string | null): {
  ready: boolean;
  play: (sample: Sample) => void;
} => {
  const [ready, setReady] = useState<boolean>(trackId ? sampleEngine.isReady(trackId) : false);

  useEffect(() => {
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
    play: (sample: Sample) => sampleEngine.play(sample.trackId, sample.region, sample.gain),
  };
};
