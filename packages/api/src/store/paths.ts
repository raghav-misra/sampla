import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdir, readdir } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// storage lives at <repo>/storage regardless of dev (src) or built (dist)
export const STORAGE_ROOT = resolve(__dirname, "..", "..", "..", "..", "storage");
export const SAMPLES_DIR = join(STORAGE_ROOT, "samples");

export const sampleDir = (id: string): string => join(SAMPLES_DIR, id);
export const sampleMetaPath = (id: string): string => join(sampleDir(id), "meta.json");
export const sampleAudioPath = (id: string): string => join(sampleDir(id), "audio.webm");
export const samplePeaksPath = (id: string): string => join(sampleDir(id), "peaks.json");
export const sampleSourcePath = (id: string, ext: string): string =>
  join(sampleDir(id), `source.${ext}`);

export const ensureStorage = async (): Promise<void> => {
  await mkdir(SAMPLES_DIR, { recursive: true });
};

export const ensureSampleDir = async (id: string): Promise<void> => {
  await mkdir(sampleDir(id), { recursive: true });
};

export const listSampleIds = async (): Promise<string[]> => {
  try {
    const entries = await readdir(SAMPLES_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
};
