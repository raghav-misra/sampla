import { z } from "zod";

export const PadKey = z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]);
export type PadKey = z.infer<typeof PadKey>;

export const Region = z
  .object({
    startSec: z.number().nonnegative(),
    endSec: z.number().nonnegative(),
  })
  .refine((r) => r.endSec > r.startSec, { message: "endSec must be > startSec" });
export type Region = z.infer<typeof Region>;

export const Track = z.object({
  id: z.string(),
  sourceUrl: z.string().url(),
  title: z.string(),
  durationSec: z.number().positive(),
  sampleRate: z.number().int().positive(),
  channels: z.number().int().positive(),
  audioUrl: z.string(),
  peaksUrl: z.string(),
  createdAt: z.string(),
});
export type Track = z.infer<typeof Track>;

export const Sample = z.object({
  id: z.string(),
  trackId: z.string(),
  region: Region,
  gain: z.number().default(1),
  name: z.string().optional(),
  padKey: PadKey,
  createdAt: z.string(),
});
export type Sample = z.infer<typeof Sample>;

export const JobStatus = z.enum(["queued", "running", "done", "error"]);
export type JobStatus = z.infer<typeof JobStatus>;

export const Job = z.object({
  id: z.string(),
  kind: z.literal("ingest"),
  status: JobStatus,
  progress: z.number().min(0).max(1),
  error: z.string().optional(),
  trackId: z.string().optional(),
});
export type Job = z.infer<typeof Job>;

export const IngestRequest = z.object({
  youtubeUrl: z.string().url(),
});
export type IngestRequest = z.infer<typeof IngestRequest>;

export const IngestResponse = z.object({
  jobId: z.string(),
});
export type IngestResponse = z.infer<typeof IngestResponse>;

export const Peaks = z.object({
  version: z.literal(1),
  bucketsPerSec: z.number().positive(),
  // quantized to Int8 [-128, 127], length = bucketsPerSec * durationSec
  min: z.array(z.number()),
  max: z.array(z.number()),
});
export type Peaks = z.infer<typeof Peaks>;
