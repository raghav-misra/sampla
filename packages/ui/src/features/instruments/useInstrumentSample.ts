import type { Peaks, Sample } from "@sampla/shared";
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

interface SampleBundle {
  sample: Sample;
  peaks: Peaks;
}

const sampleCache = new Map<string, Promise<SampleBundle>>();

const fetchSampleBundle = (sampleId: string): Promise<SampleBundle> => {
  const existing = sampleCache.get(sampleId);
  if (existing) return existing;
  const request = Promise.all([api.getSample(sampleId), api.getPeaks(sampleId)]).then(
    ([sample, peaks]) => ({ sample, peaks }),
  );
  sampleCache.set(sampleId, request);
  return request;
};

export const useInstrumentSample = (sampleId: string | null) => {
  const [bundle, setBundle] = useState<SampleBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sampleId) {
      setBundle(null);
      setError("Instrument not found");
      return;
    }
    let cancelled = false;
    setError(null);
    void fetchSampleBundle(sampleId)
      .then((result) => {
        if (!cancelled) setBundle(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError((reason as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [sampleId]);

  return { bundle, error };
};