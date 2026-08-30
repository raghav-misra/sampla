import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdir } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// storage lives at <repo>/storage regardless of dev (src) or built (dist)
export const STORAGE_ROOT = resolve(__dirname, "..", "..", "..", "..", "storage");
export const TRACKS_DIR = join(STORAGE_ROOT, "tracks");

export const trackDir = (id: string): string => join(TRACKS_DIR, id);
export const trackMetaPath = (id: string): string => join(trackDir(id), "meta.json");
export const trackAudioPath = (id: string): string => join(trackDir(id), "audio.webm");
export const trackPeaksPath = (id: string): string => join(trackDir(id), "peaks.json");
export const trackSourcePath = (id: string, ext: string): string =>
  join(trackDir(id), `source.${ext}`);

export const ensureStorage = async (): Promise<void> => {
  await mkdir(TRACKS_DIR, { recursive: true });
};

export const ensureTrackDir = async (id: string): Promise<void> => {
  await mkdir(trackDir(id), { recursive: true });
};
