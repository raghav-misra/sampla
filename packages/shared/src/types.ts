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

// A Sample is a YouTube-ingested audio source (the "instrument"). It lives on
// the server; the UI references it by id.
export const Sample = z.object({
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
export type Sample = z.infer<typeof Sample>;

// A Project is a "sampled song" — the top-level user artifact. It contains
// one or more Tracks.
export const Project = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});
export type Project = z.infer<typeof Project>;

// A Track is one row in a Project. It binds a single Sample as its instrument
// and owns its own set of Slices (pad bindings) and Recordings.
export const Track = z.object({
  id: z.string(),
  projectId: z.string(),
  sampleId: z.string(),
  name: z.string().optional(),
  order: z.number(),
  createdAt: z.string(),
});
export type Track = z.infer<typeof Track>;

// A Slice binds a region within a Track's Sample to a pad key. Triggering the
// pad plays that region.
export const Slice = z.object({
  id: z.string(),
  trackId: z.string(),
  region: Region,
  gain: z.number().default(1),
  name: z.string().optional(),
  padKey: PadKey,
  // When true, subsequent triggers do not choke this slice; it plays to its
  // region end regardless.
  playThrough: z.boolean().optional(),
  createdAt: z.string(),
});
export type Slice = z.infer<typeof Slice>;

// One pad press within a recording, timestamped from the start of the take.
export const TriggerEvent = z.object({
  tMs: z.number().nonnegative(),
  sliceId: z.string(),
  padKey: PadKey,
});
export type TriggerEvent = z.infer<typeof TriggerEvent>;

export const Recording = z.object({
  id: z.string(),
  trackId: z.string(),
  name: z.string(),
  events: z.array(TriggerEvent),
  durationMs: z.number().nonnegative(),
  createdAt: z.string(),
});
export type Recording = z.infer<typeof Recording>;

export const JobStatus = z.enum(["queued", "running", "done", "error"]);
export type JobStatus = z.infer<typeof JobStatus>;

export const Job = z.object({
  id: z.string(),
  kind: z.literal("ingest"),
  status: JobStatus,
  progress: z.number().min(0).max(1),
  error: z.string().optional(),
  sampleId: z.string().optional(),
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
