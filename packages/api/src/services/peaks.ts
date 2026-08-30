import { writeFile } from "node:fs/promises";
import { Peaks, PEAKS_BUCKETS_PER_SEC } from "@sampla/shared";
import { streamMonoPcmF32 } from "./ffmpeg.js";

const PCM_RATE = 8000; // low-rate mono; plenty for waveform peaks
const BYTES_PER_SAMPLE = 4;

const quantize = (v: number): number => {
  const clamped = v < -1 ? -1 : v > 1 ? 1 : v;
  return Math.round(clamped * 127);
};

export const generatePeaks = async (
  inputPath: string,
  durationSec: number,
  outputPath: string,
): Promise<Peaks> => {
  const totalBuckets = Math.max(1, Math.ceil(durationSec * PEAKS_BUCKETS_PER_SEC));
  const samplesPerBucket = Math.max(1, Math.floor(PCM_RATE / PEAKS_BUCKETS_PER_SEC));

  const min = new Array<number>(totalBuckets).fill(0);
  const max = new Array<number>(totalBuckets).fill(0);
  const filled = new Array<boolean>(totalBuckets).fill(false);

  let carry: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let sampleIdx = 0;

  const process = (chunk: Buffer): void => {
    const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    const usable = buf.length - (buf.length % BYTES_PER_SAMPLE);
    carry = buf.subarray(usable);
    for (let off = 0; off < usable; off += BYTES_PER_SAMPLE) {
      const v = buf.readFloatLE(off);
      const bucket = Math.min(totalBuckets - 1, Math.floor(sampleIdx / samplesPerBucket));
      if (!filled[bucket]) {
        min[bucket] = v;
        max[bucket] = v;
        filled[bucket] = true;
      } else {
        if (v < (min[bucket] ?? 0)) min[bucket] = v;
        if (v > (max[bucket] ?? 0)) max[bucket] = v;
      }
      sampleIdx++;
    }
  };

  await streamMonoPcmF32(inputPath, PCM_RATE, process);

  const peaks: Peaks = {
    version: 1,
    bucketsPerSec: PEAKS_BUCKETS_PER_SEC,
    min: min.map(quantize),
    max: max.map(quantize),
  };
  await writeFile(outputPath, JSON.stringify(peaks), "utf8");
  return peaks;
};
